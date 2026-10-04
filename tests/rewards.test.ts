import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REWARDS } from "@/config";
import {
  cappedWeightedSplit,
  computeRoundPayouts,
  credits,
  dedupeVotes,
  formatCredits,
  mastersTakingPart,
  rankRoundPitches,
  roundPool,
  splitReceived,
  totalAllocated,
  type RoundInput,
  type RoundMaster,
  type RoundPitch,
  type RoundVote,
} from "@/lib/rewards";
import type { Address } from "@/lib/types";

const w = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;
const R = { ...REWARDS, roundPoolCapCredits: 40_000 };

const pitch = (id: string, fighter: string, minute: number, owner = w(900 + minute)): RoundPitch => ({
  id,
  fighter,
  fighterOwner: owner,
  submittedAt: `2026-10-04T15:${String(minute).padStart(2, "0")}:00Z`,
});
const votes = (pitchId: string, count: number, power: number, start: number): RoundVote[] =>
  Array.from({ length: count }, (_, i) => ({ wallet: w(start + i), pitchId, power }));
const master = (id: string, agentId = `agent-${id}`, ownerWallet = w(5_000 + id.length)): RoundMaster => ({ id, agentId, ownerWallet });

function baseInput(overrides: Partial<RoundInput> = {}): RoundInput {
  return {
    pool: credits(40_000),
    pitches: [pitch("p1", "A", 1), pitch("p2", "B", 2), pitch("p3", "C", 3), pitch("p4", "D", 4)],
    votes: [...votes("p1", 4, 100, 1), ...votes("p2", 3, 100, 10), ...votes("p3", 2, 100, 20), ...votes("p4", 1, 100, 30)],
    masters: [],
    scores: [],
    tenders: [],
    recentTop3: [],
    ...overrides,
  };
}

const conserved = (p: ReturnType<typeof computeRoundPayouts>) => assert.equal(totalAllocated(p) + p.toTreasury, p.pool);

describe("20/80 split of $CREDIT received", () => {
  it("takes 20% for running the agent first and sends 80% to the treasury", () => {
    assert.deepEqual(splitReceived(credits(10_000)), { agentOps: credits(2_000), treasury: credits(8_000) });
  });

  it("sums exactly for awkward amounts", () => {
    for (const a of [0n, 1n, 7n, 999_999n, 10n ** 24n + 3n]) {
      const s = splitReceived(a);
      assert.equal(s.agentOps + s.treasury, a);
    }
  });
});

describe("round pool", () => {
  it("is 25% of the treasury when that is under the cap", () => {
    assert.equal(roundPool(credits(100_000), R), credits(25_000));
  });

  it("is the cap when 25% of the treasury is larger", () => {
    assert.equal(roundPool(credits(200_000), R), credits(40_000));
  });

  it("round 1 can never exceed the cap, however large the treasury", () => {
    for (const treasury of [credits(160_001), credits(10_000_000), 10n ** 30n]) {
      const pool = roundPool(treasury, R)!;
      assert.ok(pool <= credits(R.roundPoolCapCredits));
      const payouts = computeRoundPayouts(baseInput({ pool }), R);
      assert.ok(totalAllocated(payouts) + payouts.toTreasury <= credits(R.roundPoolCapCredits));
    }
  });

  it("is n/a (null) while the cap is not set", () => {
    assert.equal(roundPool(credits(1_000), { ...REWARDS, roundPoolCapCredits: null }), null);
  });
});

describe("ranking", () => {
  it("ranks by voting power and breaks ties by the earliest submission", () => {
    const ranked = rankRoundPitches([pitch("late", "X", 30), pitch("early", "Y", 5)], [...votes("late", 1, 50, 1), ...votes("early", 1, 50, 2)]);
    assert.deepEqual(ranked.map((p) => p.id), ["early", "late"]);
  });

  it("counts only one pitch per agent per round (the earliest)", () => {
    const ranked = rankRoundPitches([pitch("a2", "A", 9), pitch("a1", "A", 1)], votes("a2", 5, 100, 1));
    assert.deepEqual(ranked.map((p) => p.id), ["a1"]);
  });

  it("counts one vote per wallet per round", () => {
    const { kept, ignored } = dedupeVotes([
      { wallet: w(1), pitchId: "p1", power: 10 },
      { wallet: w(1), pitchId: "p2", power: 10 },
    ]);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].pitchId, "p1");
    assert.equal(ignored.length, 1);
  });
});

describe("round payouts", () => {
  it("splits 35/10/10/45 and pays the top 3 pitches 50/30/20", () => {
    const masters = [master("m1"), master("m2")];
    const p = computeRoundPayouts(
      baseInput({ masters, tenders: masters.map((m) => ({ masterId: m.id, pitchCount: 1 })) }),
      R,
    );
    assert.equal(p.paidOut, true);
    assert.deepEqual(p.pitches.map((x) => [x.pitchId, x.amount]), [
      ["p1", credits(7_000)],
      ["p2", credits(4_200)],
      ["p3", credits(2_800)],
    ]);
    assert.equal(p.voters.reduce((s, v) => s + v.amount, 0n), credits(4_000));
    assert.deepEqual(p.masters.map((m) => m.amount), [credits(2_000), credits(2_000)]);
    assert.equal(p.toTreasury, credits(18_000));
    conserved(p);
  });

  it("pays nothing and keeps the whole pool when fewer than 5 wallets voted", () => {
    const p = computeRoundPayouts(baseInput({ votes: votes("p1", 4, 100, 1) }), R);
    assert.equal(p.paidOut, false);
    assert.equal(totalAllocated(p), 0n);
    assert.equal(p.toTreasury, credits(40_000));
  });

  it("skips any payout under 100 $CREDIT and keeps it in the treasury", () => {
    const p = computeRoundPayouts(baseInput({ pool: credits(2_000) }), R);
    // Voters bucket is 200, capped at 10% (20) each: every voter payout is under 100.
    assert.equal(p.voters.length, 0);
    assert.ok(p.skipped.some((s) => s.kind === "voter" && s.reason.includes("Under 100")));
    conserved(p);
  });

  it("keeps a place's share in the treasury when there is no pitch for it", () => {
    const p = computeRoundPayouts(baseInput({ pitches: [pitch("p1", "A", 1)], votes: votes("p1", 6, 100, 1) }), R);
    assert.equal(p.pitches.length, 1);
    assert.ok(p.skipped.filter((s) => s.id.startsWith("place-")).length === 2);
    conserved(p);
  });

  it("halves the share of an agent that placed in the top 3 within the last 5 rounds", () => {
    const p = computeRoundPayouts(baseInput({ recentTop3: ["B"] }), R);
    const second = p.pitches.find((x) => x.pitchId === "p2")!;
    assert.equal(second.amount, credits(2_100));
    assert.equal(second.reduced, true);
    conserved(p);
  });

  it("conserves every atom with an odd pool", () => {
    const p = computeRoundPayouts(baseInput({ pool: credits(40_000) + 7n, masters: [master("m1")], tenders: [{ masterId: "m1", pitchCount: 2 }] }), R);
    conserved(p);
  });
});

describe("voters bucket", () => {
  it("shares among everyone who voted, whichever pitch they backed, by voting power", () => {
    const input = baseInput({ votes: [...votes("p1", 5, 200, 1), ...votes("p4", 5, 200, 50)] });
    const p = computeRoundPayouts(input, R);
    assert.equal(p.voters.length, 10);
    assert.ok(p.voters.every((v) => v.amount === credits(400)));
  });

  it("caps each wallet at 10% of the bucket and shares the excess with the others", () => {
    const { shares, left } = cappedWeightedSplit(credits(4_000), [1_000n, ...Array(9).fill(100n)], credits(400));
    assert.equal(shares[0], credits(400));
    assert.ok(shares.slice(1).every((s) => s === credits(400)));
    assert.equal(left, 0n);
  });

  it("returns what cannot be placed under the cap", () => {
    const { shares, left } = cappedWeightedSplit(credits(4_000), [100n, 100n], credits(400));
    assert.deepEqual(shares, [credits(400), credits(400)]);
    assert.equal(left, credits(3_200));
  });
});

describe("Masters bucket", () => {
  const pitches = [pitch("p1", "A", 1, w(1_001)), pitch("p2", "B", 2), pitch("p3", "C", 3), pitch("p4", "D", 4)];
  const input = (over: Partial<RoundInput>) => baseInput({ pitches, ...over });

  it("counts a Master that scored at least 3 pitches", () => {
    const m = master("m1");
    const taking = mastersTakingPart(input({ masters: [m], scores: ["p1", "p2", "p3"].map((pitchId) => ({ masterId: "m1", pitchId })) }));
    assert.deepEqual(taking.map((x) => x.id), ["m1"]);
  });

  it("does not count a Master that scored only 2 of 4 pitches", () => {
    const taking = mastersTakingPart(input({ masters: [master("m1")], scores: ["p1", "p2"].map((pitchId) => ({ masterId: "m1", pitchId })) }));
    assert.equal(taking.length, 0);
  });

  it("requires every pitch when there are fewer than 3", () => {
    const two = [pitch("p1", "A", 1), pitch("p2", "B", 2)];
    const m = master("m1");
    assert.equal(mastersTakingPart(baseInput({ pitches: two, masters: [m], scores: [{ masterId: "m1", pitchId: "p1" }] })).length, 0);
    assert.equal(
      mastersTakingPart(baseInput({ pitches: two, masters: [m], scores: two.map((p) => ({ masterId: "m1", pitchId: p.id })) })).length,
      1,
    );
  });

  it("counts a Master whose tender received at least one pitch, but not an empty tender", () => {
    assert.equal(mastersTakingPart(input({ masters: [master("m1")], tenders: [{ masterId: "m1", pitchCount: 1 }] })).length, 1);
    assert.equal(mastersTakingPart(input({ masters: [master("m1")], tenders: [{ masterId: "m1", pitchCount: 0 }] })).length, 0);
  });

  it("ignores scores on a pitch from the Master's own agent or owner wallet", () => {
    const own: RoundMaster = { id: "m1", agentId: "B", ownerWallet: w(1_001) }; // owns p1's wallet and is agent B (p2)
    const scores = ["p1", "p2", "p3"].map((pitchId) => ({ masterId: "m1", pitchId }));
    assert.equal(mastersTakingPart(input({ masters: [own], scores })).length, 0);
    const withP4 = [...scores, { masterId: "m1", pitchId: "p4" }];
    // Only p3 and p4 are eligible for this Master; with fewer than 3 eligible pitches, scoring both is enough.
    assert.equal(mastersTakingPart(input({ masters: [own], scores: withP4 })).length, 1);
  });

  it("excludes a Master that is the Fighter behind a top-3 pitch", () => {
    const fighterMaster = master("m1", "A");
    const other = master("m2");
    const p = computeRoundPayouts(
      input({ masters: [fighterMaster, other], tenders: [{ masterId: "m1", pitchCount: 1 }, { masterId: "m2", pitchCount: 1 }] }),
      R,
    );
    assert.deepEqual(p.masters.map((m) => m.masterId), ["m2"]);
    assert.equal(p.masters[0].amount, credits(4_000));
    conserved(p);
  });

  it("keeps the Masters bucket in the treasury when no Master took part", () => {
    const p = computeRoundPayouts(input({}), R);
    assert.equal(p.masters.length, 0);
    assert.ok(p.skipped.some((s) => s.kind === "master"));
    conserved(p);
  });
});

describe("formatCredits", () => {
  it("formats atoms as whole $CREDIT with up to 2 decimals", () => {
    assert.equal(formatCredits(credits(1_234)), "1,234");
    assert.equal(formatCredits(credits(1) + 500_000n), "1.5");
    assert.equal(formatCredits(null), "n/a");
    assert.equal(formatCredits(2_000n), "<0.01");
    assert.equal(formatCredits(0n), "0");
  });
});
