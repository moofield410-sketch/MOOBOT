import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { AUTH, CHAIN, FULL_UNLOCK_AFTER_H, REWARDS, TOURNAMENT, VOTING } from "@/config";
import { kvCas, kvClearMemory } from "@/lib/kv";
import { buildTimeline } from "@/lib/schedule";
import type { OrbioAgent } from "@/lib/sources/orbio-api";
import { buildAction, oneLine, parseAction, parsePitchTarget, pitchTarget, type ActionFields, type ActionKind } from "@/lib/tournament/messages";
import { pastRoundOf, rankBoard } from "@/lib/tournament/results";
import { applyHide, applyScore, applyVote, checkDemoUrl, textProblem, TournamentError } from "@/lib/tournament/rules";
import {
  castVote,
  currentPool,
  FREEZE_AFTER_MS,
  hidePitch,
  ledger,
  pastRounds,
  postTender,
  powerFor,
  submitPitch,
  submitScore,
  verifySignature,
  type TournamentDeps,
} from "@/lib/tournament/service";
import { balanceAtSnapshot, findSnapshotBlock, type SnapshotChain } from "@/lib/tournament/snapshot";
import { readPower, readRound } from "@/lib/tournament/store";
import { emptyRound, type StoredPitch, type StoredVote } from "@/lib/tournament/types";
import type { Address, Master } from "@/lib/types";

// Throwaway keys generated in memory, used only to sign test messages offline.
const key = () => privateKeyToAccount(generatePrivateKey());
const lc = (a: PrivateKeyAccount) => a.address.toLowerCase() as Address;

const ORBIO = "0xaa07a0e9209e16ac99708c3ec70159c6ef3128a3" as Address;
const LIVE_AT = Date.parse("2026-10-04T12:00:00Z");
const UNLOCK = LIVE_AT + FULL_UNLOCK_AFTER_H * 3_600_000;
const ROUND_MS = TOURNAMENT.roundLengthH * 3_600_000;
const E18 = 10n ** 18n;

// --- A fake chain: one block every 250 ms from GENESIS, balances changed by recorded transfers ---

const GENESIS = UNLOCK / 1000 - 1_000_000;
const BLOCK_MS = 250;

function fakeChain(opts: { prunedBelow?: bigint } = {}) {
  const transfers: { block: bigint; from: string; to: string; value: bigint }[] = [];
  const balanceAt = (owner: string, block: bigint) =>
    transfers.filter((t) => t.block <= block).reduce((b, t) => b + (t.to === owner ? t.value : 0n) - (t.from === owner ? t.value : 0n), 0n);
  let head = 0n;
  const calls = { blockTime: 0 };
  const chain: SnapshotChain = {
    headBlock: async () => head,
    async blockTime(b) {
      calls.blockTime++;
      return Math.floor((GENESIS * 1000 + Number(b) * BLOCK_MS) / 1000);
    },
    async balanceAt(_token, owner, block) {
      if (opts.prunedBelow !== undefined && block < opts.prunedBelow) throw new Error("missing trie node");
      return balanceAt(owner.toLowerCase(), block);
    },
    decimals: async () => 18,
    async transferSum(_token, owner, dir, from, to) {
      if (to - from > 500_000n) throw new Error("block range too large");
      const o = owner.toLowerCase();
      return transfers.filter((t) => t.block >= from && t.block <= to && (dir === "in" ? t.to === o : t.from === o)).reduce((s, t) => s + t.value, 0n);
    },
  };
  return {
    chain,
    calls,
    /** The block whose time is exactly `ms` (rounded down). */
    blockAt: (ms: number) => BigInt(Math.floor((ms - GENESIS * 1000) / BLOCK_MS)),
    setHead(ms: number) {
      head = BigInt(Math.floor((ms - GENESIS * 1000) / BLOCK_MS));
    },
    send(block: bigint, from: string, to: string, whole: number) {
      transfers.push({ block, from: from.toLowerCase(), to: to.toLowerCase(), value: BigInt(whole) * E18 });
    },
  };
}

function agent(id: string, owner: Address, extra: Partial<OrbioAgent> = {}): OrbioAgent {
  return {
    agentId: id,
    token: `0x${id.padStart(40, "a")}` as Address,
    name: `Agent ${id}`,
    symbol: `AG${id}`,
    logo: null,
    owner,
    agentWallet: null,
    launchedAt: null,
    launchTx: null,
    description: null,
    twitter: null,
    price: null,
    curve: null,
    credit: null,
    stake: null,
    converted: null,
    ...extra,
  };
}

function master(id: string, owner: Address): Master {
  const a = agent(id, owner);
  return {
    tokenAddress: a.token,
    name: `Master ${id}`,
    ticker: `M${id}`,
    ownerWallet: owner,
    agentWallet: null,
    orbioAgentId: id,
    launchedAt: null,
    launchTx: null,
    graduatedAt: null,
    gradTx: null,
    gradBlock: null,
    marketCapUsd: null,
    liquidityUsd: null,
    holderCount: null,
    explorerUrl: null,
    orbioUrl: null,
    logoUrl: null,
    contactRoute: null,
    openToPitches: true,
    description: null,
    category: null,
    isMock: false,
  };
}

function setup() {
  const fc = fakeChain();
  let now = UNLOCK + 3_600_000;
  fc.setHead(now);
  const fighter = key();
  const masterOwner = key();
  const voters = Array.from({ length: 6 }, key);
  const agents = new Map<string, OrbioAgent[]>([
    [lc(fighter), [agent("101", lc(fighter)), agent("102", lc(fighter))]],
    [lc(masterOwner), [agent("900", lc(masterOwner))]],
  ]);
  const masters = [master("900", lc(masterOwner))];
  const mods: Address[] = [];
  // Voters hold 4,000 $ORBIO from well before the snapshot; voter 5 holds too little.
  for (const [i, v] of voters.entries()) fc.send(10n, "0x0000000000000000000000000000000000000000", v.address, i === 5 ? 10 : 4_000 * (i + 1));
  const deps: TournamentDeps = {
    now: () => now,
    timeline: () => buildTimeline(LIVE_AT, FULL_UNLOCK_AFTER_H),
    chain: () => fc.chain,
    orbioToken: ORBIO,
    agentsOf: async (w) => agents.get(w.toLowerCase()) ?? [],
    masters: async () => masters,
    verify: verifySignature,
    moderators: () => mods,
  };
  return {
    fc,
    deps,
    fighter,
    masterOwner,
    voters,
    mods,
    masters,
    setNow(ms: number) {
      now = ms;
      fc.setHead(ms);
    },
  };
}

async function sign<K extends ActionKind>(who: PrivateKeyAccount, kind: K, fields: ActionFields<K>, opts: { round?: number; at?: number } = {}) {
  const message = buildAction({ kind, address: lc(who), chainId: CHAIN.id, round: opts.round ?? 1, fields, issuedAt: new Date(opts.at ?? Date.now()).toISOString() });
  return { message, signature: await who.signMessage({ message }) };
}

/** sign(), as the (message, signature) arguments of a Tournament action. */
async function signed<K extends ActionKind>(...a: Parameters<typeof sign<K>>) {
  const { message, signature } = await sign(...a);
  return [message, signature] as const;
}

const pitchFields = (agentId: string, title = "Daily holder digest", extra: Partial<ActionFields<"pitch">> = {}): ActionFields<"pitch"> => ({
  "Agent ID": agentId,
  "Pitch to": "open pitch (any Master)",
  Title: title,
  Summary: "A short daily summary of what changed for holders, posted to the agent's channel.",
  Demo: "none",
  ...extra,
});

async function rejects(p: Promise<unknown>, status: number, re?: RegExp) {
  await assert.rejects(p, (err: unknown) => {
    assert.ok(err instanceof TournamentError, `expected a TournamentError, got ${err}`);
    assert.equal(err.status, status, err.message);
    if (re) assert.match(err.message, re);
    return true;
  });
}

beforeEach(() => kvClearMemory());

describe("signed Tournament messages", () => {
  it("say what they do, carry the safety line and round-trip exactly", () => {
    const a = { kind: "vote" as const, address: "0x1111111111111111111111111111111111111111" as Address, chainId: CHAIN.id, round: 3, fields: { Pitch: "r3-7" }, issuedAt: new Date(0).toISOString() };
    const m = buildAction(a);
    assert.ok(m.split("\n").includes(AUTH.safetyLine));
    assert.match(m, /Your first vote in a round is final\./);
    assert.deepEqual(parseAction("vote", m), a);
    assert.equal(parseAction("pitch", m), null, "a vote isn't a pitch");
    assert.equal(parseAction("vote", m.replace("Pitch: r3-7", "Pitch:  r3-7")), null);
    assert.equal(parseAction("vote", m.replace(`Chain ID: ${CHAIN.id}`, "Chain ID: 1")), null);
    assert.equal(parseAction("vote", m.replace("Round: 3", "Round: 0")), null);
    assert.equal(parseAction("vote", `${m}\nExtra: line`), null);
  });

  it("keep each field on one line", () => {
    assert.equal(oneLine("  two\nlines\t here "), "two lines here");
    const m = buildAction({ kind: "pitch", address: "0x1111111111111111111111111111111111111111" as Address, chainId: CHAIN.id, round: 1, fields: pitchFields("1", "Title\nInjected: line"), issuedAt: new Date(0).toISOString() });
    assert.ok(parseAction("pitch", m));
    assert.ok(m.includes("Title: Title Injected: line"));
  });

  it("encode the pitch target", () => {
    for (const t of [
      { masterToken: null, tenderId: null },
      { masterToken: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa900" as Address, tenderId: null },
      { masterToken: null, tenderId: "t1-900-1" },
    ]) {
      assert.deepEqual(parsePitchTarget(pitchTarget(t)), t);
    }
    assert.equal(parsePitchTarget("Master 0xnope"), null);
  });
});

describe("pitch text checks", () => {
  it("block scams, addresses, links and money promises, and allow normal pitches", () => {
    assert.equal(textProblem("A weekly report on what changed for holders."), null);
    assert.ok(textProblem("Join our airdrop"));
    assert.ok(textProblem("send ETH to claim"));
    assert.ok(textProblem("contract 0x388785c9FE"));
    assert.ok(textProblem("see moofield.lol for more"));
    assert.ok(textProblem("guaranteed 10x for holders"));
    assert.ok(textProblem("holders earn more"));
  });

  it("accept one https demo link only", () => {
    assert.equal(checkDemoUrl("none"), null);
    assert.equal(checkDemoUrl(""), null);
    assert.equal(checkDemoUrl("https://demo.example.com/x"), "https://demo.example.com/x");
    assert.throws(() => checkDemoUrl("http://demo.example.com"), TournamentError);
    assert.throws(() => checkDemoUrl("javascript:alert(1)"), TournamentError);
    assert.throws(() => checkDemoUrl("https://a.com https://b.com"), TournamentError);
    assert.throws(() => checkDemoUrl("https://user:pw@a.com"), TournamentError);
  });
});

describe("the snapshot", () => {
  it("finds the last block at or before the round start", async () => {
    const fc = fakeChain();
    fc.setHead(UNLOCK + 5 * 3_600_000);
    const block = await findSnapshotBlock(fc.chain, UNLOCK);
    assert.ok(block !== null);
    assert.ok((await fc.chain.blockTime(block)) <= UNLOCK / 1000);
    assert.ok((await fc.chain.blockTime(block + 1n)) > UNLOCK / 1000 || (await fc.chain.blockTime(block + 4n)) > UNLOCK / 1000);
    assert.equal(await fc.chain.blockTime(block), UNLOCK / 1000);
    assert.equal(await fc.chain.blockTime(block + 4n), UNLOCK / 1000 + 1);
    assert.ok(fc.calls.blockTime < 80, `too many block reads: ${fc.calls.blockTime}`);
  });

  it("waits while the chain hasn't reached the round start", async () => {
    const fc = fakeChain();
    fc.setHead(UNLOCK - 60_000);
    assert.equal(await findSnapshotBlock(fc.chain, UNLOCK), null);
  });

  it("rebuilds an old balance from transfers when the node has pruned that state", async () => {
    const owner = "0x2222222222222222222222222222222222222222" as Address;
    const other = "0x3333333333333333333333333333333333333333";
    const fc = fakeChain({ prunedBelow: 3_900_000n });
    fc.send(100n, other, owner, 5_000);
    const snapshot = 2_000_000n;
    fc.send(2_500_000n, owner, other, 1_200); // sold after the snapshot: still counts
    fc.send(3_000_000n, other, owner, 9_000); // bought after the snapshot: doesn't count
    fc.send(snapshot, other, owner, 1); // in the snapshot block itself: counts
    fc.setHead(UNLOCK + 72 * 3_600_000);
    const direct = await balanceAtSnapshot(fakeChain().chain, ORBIO, owner, snapshot).catch(() => null);
    assert.ok(direct);
    const b = await balanceAtSnapshot(fc.chain, ORBIO, owner, snapshot);
    assert.equal(b.method, "transfers");
    assert.equal(b.raw, 5_001n * E18);
  });

  it("reads directly when the node still has the state", async () => {
    const owner = "0x2222222222222222222222222222222222222222" as Address;
    const fc = fakeChain();
    fc.send(100n, "0x0000000000000000000000000000000000000000", owner, 42);
    fc.setHead(UNLOCK);
    const b = await balanceAtSnapshot(fc.chain, ORBIO, owner, 200n);
    assert.deepEqual([b.method, b.raw], ["direct", 42n * E18]);
  });
});

describe("Tournament actions", () => {
  it("refuse everything before the Tournament opens", async () => {
    const s = setup();
    s.setNow(UNLOCK - 60_000);
    await rejects(submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101"), { at: UNLOCK - 60_000 }))), 403, /hasn't opened/);
  });

  it("run a whole round: pitch, score, vote, and the result when it ends", async () => {
    const s = setup();
    const now = s.deps.now();
    const p1 = await submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101"), { at: now })));
    assert.equal(p1.id, "r1-101");
    assert.equal(p1.fighterOwner, lc(s.fighter));
    const p2 = await submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("102", "Second idea for Masters"), { at: now })));

    // One pitch per agent per round.
    await rejects(submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101", "Another title here"), { at: now }))), 409, /One pitch per agent/);
    // A wallet that doesn't own the agent.
    await rejects(submitPitch(s.deps, ...(await signed(s.voters[0], "pitch", pitchFields("101"), { at: now }))), 403);

    // The Master scores both; never twice.
    await submitScore(s.deps, ...(await signed(s.masterOwner, "score", { Pitch: p1.id, Master: s.masters[0].tokenAddress, Score: "8" }, { at: now })));
    await submitScore(s.deps, ...(await signed(s.masterOwner, "score", { Pitch: p2.id, Master: s.masters[0].tokenAddress, Score: "6" }, { at: now })));
    await rejects(submitScore(s.deps, ...(await signed(s.masterOwner, "score", { Pitch: p1.id, Master: s.masters[0].tokenAddress, Score: "9" }, { at: now }))), 409);
    // Only the Master's owner can score for it.
    await rejects(submitScore(s.deps, ...(await signed(s.voters[0], "score", { Pitch: p1.id, Master: s.masters[0].tokenAddress, Score: "9" }, { at: now }))), 403);

    // Votes: power is sqrt of the snapshot balance; the first vote is final.
    const v0 = await castVote(s.deps, ...(await signed(s.voters[0], "vote", { Pitch: p1.id }, { at: now })));
    assert.equal(v0.balance, 4_000);
    assert.equal(v0.power, Math.floor(Math.sqrt(4_000)));
    await rejects(castVote(s.deps, ...(await signed(s.voters[0], "vote", { Pitch: p2.id }, { at: now }))), 409, /first vote is final/);
    await castVote(s.deps, ...(await signed(s.voters[1], "vote", { Pitch: p2.id }, { at: now })));
    await castVote(s.deps, ...(await signed(s.voters[2], "vote", { Pitch: p2.id }, { at: now })));
    // Below the minimum.
    await rejects(castVote(s.deps, ...(await signed(s.voters[5], "vote", { Pitch: p1.id }, { at: now }))), 403, /under the voting minimum/);
    // Your own agent's pitch.
    await rejects(castVote(s.deps, ...(await signed(s.fighter, "vote", { Pitch: p1.id }, { at: now }))), 403, /own agent/);

    const doc = await readRound(1);
    assert.ok(doc.snapshot, "the snapshot block is stored with the first vote");
    const board = rankBoard(doc, false);
    assert.deepEqual(
      board.map((p) => [p.id, p.votes, p.status, p.scoreAvg]),
      [
        ["r1-102", 2, "open", 6],
        ["r1-101", 1, "open", 8],
      ],
    );

    // The round ends: no more votes, and the result is final.
    s.setNow(UNLOCK + ROUND_MS + 60_000);
    await rejects(castVote(s.deps, ...(await signed(s.voters[3], "vote", { Pitch: p1.id }, { at: s.deps.now() }))), 409, /isn't running/);
    const { past } = await pastRounds(s.deps);
    assert.equal(past.length, 1);
    assert.equal(past[0].winnerPitchId, "r1-102");
    assert.equal(past[0].votesCast, 3);
    assert.equal(past[0].snapshotBlock, doc.snapshot!.block);
    assert.equal(past[0].poolCredits, null, "no pool while the per-round cap isn't set");

    const entries = await ledger(lc(s.voters[1]), s.deps);
    assert.deepEqual(
      entries.map((e) => [e.round, e.role, e.amountAtoms]),
      [[1, "voter", null]],
    );
    const fighterEntries = await ledger(lc(s.fighter), s.deps);
    assert.ok(fighterEntries.some((e) => e.label.includes("placed #1")));
  });

  it("refuse stale, future-dated, tampered and wrong-round signatures", async () => {
    const s = setup();
    const now = s.deps.now();
    await rejects(submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101"), { at: now - TOURNAMENT.signatureMaxAgeMs - 1 }))), 401, /expired/);
    await rejects(submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101"), { at: now + 5 * 60_000 }))), 401, /future/);
    await rejects(submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101"), { at: now, round: 2 }))), 409);
    const good = await sign(s.fighter, "pitch", pitchFields("101"), { at: now });
    await rejects(submitPitch(s.deps, good.message.replace("Daily holder digest", "Daily holder digests"), good.signature), 401, /doesn't match/);
    const other = await sign(s.voters[0], "pitch", pitchFields("101"), { at: now });
    await rejects(submitPitch(s.deps, good.message, other.signature), 401);
    await rejects(submitPitch(s.deps, "hello", "0x00"), 400);
  });

  it("apply the pitch text rules on the server too", async () => {
    const s = setup();
    const at = s.deps.now();
    await rejects(submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101", "Free airdrop for all"), { at }))), 400, /Airdrops/);
    await rejects(submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101", "Hi"), { at }))), 400, /too short/);
    await rejects(submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101", "Good title", { Demo: "http://x.com" }), { at }))), 400, /https/);
    await rejects(
      submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101", "Good title", { "Pitch to": "Master 0x1111111111111111111111111111111111111111" }), { at }))),
      404,
      /graduated Master/,
    );
  });

  it("keep every vote when many wallets vote at the same moment", async () => {
    const s = setup();
    const at = s.deps.now();
    const p = await submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101"), { at })));
    const signedVotes = await Promise.all(s.voters.slice(0, 5).map((v) => sign(v, "vote", { Pitch: p.id }, { at })));
    // Every voter twice, all at once: exactly one vote each is kept.
    const results = await Promise.allSettled([...signedVotes, ...signedVotes].map((v) => castVote(s.deps, v.message, v.signature)));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 5);
    const doc = await readRound(1);
    assert.equal(doc.votes.length, 5);
    assert.equal(new Set(doc.votes.map((v) => v.wallet)).size, 5);
  });

  it("let a Master post tenders that Fighters answer, within the limits", async () => {
    const s = setup();
    const at = s.deps.now();
    const day = 86_400_000;
    const tenderFields = (title: string, days = 3): ActionFields<"tender"> => ({
      Master: s.masters[0].tokenAddress,
      Title: title,
      Description: "We need a small feature that tells holders what changed this week.",
      "Looking for": "Fast | Open source",
      Deadline: new Date(at + days * day).toISOString(),
    });
    const t = await postTender(s.deps, ...(await signed(s.masterOwner, "tender", tenderFields("Weekly holder report"), { at })));
    assert.equal(t.id, "t1-900-1");
    assert.deepEqual(t.criteria, ["Fast", "Open source"]);
    await rejects(postTender(s.deps, ...(await signed(s.masterOwner, "tender", tenderFields("Too far away", 30), { at }))), 400, /at most/);
    await rejects(postTender(s.deps, ...(await signed(s.fighter, "tender", tenderFields("Not a Master"), { at }))), 403);
    await postTender(s.deps, ...(await signed(s.masterOwner, "tender", tenderFields("Second request here"), { at })));
    await postTender(s.deps, ...(await signed(s.masterOwner, "tender", tenderFields("Third request here"), { at })));
    await rejects(postTender(s.deps, ...(await signed(s.masterOwner, "tender", tenderFields("Fourth request here"), { at }))), 409, /open tenders/);

    const p = await submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101", "Answering the tender", { "Pitch to": `tender ${t.id}` }), { at })));
    assert.equal(p.tenderId, t.id);
    assert.equal(p.masterToken, s.masters[0].tokenAddress, "a tender pitch is pitched to the tender's Master");
  });

  it("let only moderators hide a pitch, and give its voters their vote back", async () => {
    const s = setup();
    const at = s.deps.now();
    const p = await submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101"), { at })));
    const p2 = await submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("102", "Another good idea"), { at })));
    await castVote(s.deps, ...(await signed(s.voters[0], "vote", { Pitch: p.id }, { at })));
    await rejects(hidePitch(s.deps, lc(s.voters[0]), p.id, "spam"), 403);
    await rejects(hidePitch(s.deps, null, p.id, "spam"), 401);
    s.mods.push(lc(s.voters[4]));
    await hidePitch(s.deps, lc(s.voters[4]), p.id, "Scam link");
    const doc = await readRound(1);
    assert.deepEqual(rankBoard(doc, false).map((x) => x.id), [p2.id]);
    assert.equal(doc.hidden[0].removedVotes.length, 1);
    // The voter can vote again, and the hidden pitch can't get votes.
    await rejects(castVote(s.deps, ...(await signed(s.voters[1], "vote", { Pitch: p.id }, { at }))), 404);
    await castVote(s.deps, ...(await signed(s.voters[0], "vote", { Pitch: p2.id }, { at })));
  });

  it("keep a wallet's voting power from the snapshot, even if it buys more later", async () => {
    const s = setup();
    const before = await powerFor(s.deps, lc(s.voters[0]));
    s.fc.send(s.fc.blockAt(s.deps.now()), "0x0000000000000000000000000000000000000000", s.voters[0].address, 1_000_000);
    const after = await powerFor(s.deps, lc(s.voters[0]));
    assert.equal(after.power, before.power);
    assert.equal(before.balance, 4_000);
    assert.ok(VOTING.minOrbio <= 4_000);
  });
});

describe("compare-and-swap storage", () => {
  it("never loses a write when many happen at once", async () => {
    await Promise.all(Array.from({ length: 25 }, (_, i) => kvCas<number[], void>("t:test", (cur) => ({ value: [...(cur ?? []), i], result: undefined }), 50)));
    const { kvGet } = await import("@/lib/kv");
    assert.equal((await kvGet<number[]>("t:test"))?.length, 25);
  });
});

describe("round results", () => {
  const vote = (wallet: string, pitchId: string, power: number): StoredVote => ({ round: 1, wallet: wallet as Address, pitchId, power, balance: power * power, castAt: "", message: "", signature: "0x" });
  const pitch = (id: string, submittedAt: string): StoredPitch => ({
    id,
    round: 1,
    agentId: id,
    fighter: `F${id}`,
    ticker: "",
    fighterToken: `0x${id.padStart(40, "b")}` as Address,
    fighterOwner: `0x${id.padStart(40, "c")}` as Address,
    fighterAgentWallet: null,
    submittedBy: `0x${id.padStart(40, "c")}` as Address,
    title: `Pitch ${id}`,
    summary: "",
    demoUrl: null,
    masterToken: null,
    tenderId: null,
    submittedAt,
    message: "",
    signature: "0x",
  });

  it("refuse a Master's score on a pitch from an agent its owner also runs", () => {
    const doc = { ...emptyRound(1), pitches: [pitch("7", "2026-10-05T13:00:00Z")] };
    const owner = doc.pitches[0].fighterOwner;
    const score = { round: 1, pitchId: "7", masterToken: "0x00000000000000000000000000000000000000f1" as Address, masterAgentId: "99", masterName: "M", masterOwner: owner, wallet: owner, score: 5, scoredAt: "", message: "", signature: "0x" as const };
    assert.throws(() => applyScore(doc, score), /own owner/);
    const other = "0x00000000000000000000000000000000000000e1" as Address;
    assert.equal(applyScore(doc, { ...score, masterOwner: other, wallet: other }).scores.length, 1);
    assert.throws(() => applyScore(doc, { ...score, masterOwner: other, wallet: other, score: 11 }), /Scores go from/);
  });

  it("ranks by power, ties to the earliest, and needs a vote to win", () => {
    const doc = { ...emptyRound(1), pitches: [pitch("1", "2026-10-05T13:00:00Z"), pitch("2", "2026-10-05T12:30:00Z"), pitch("3", "2026-10-05T12:10:00Z"), pitch("4", "2026-10-05T12:00:00Z")] };
    let d = applyVote(doc, vote("0x01", "1", 50));
    d = applyVote(d, vote("0x02", "2", 50));
    d = applyVote(d, vote("0x03", "3", 10));
    const board = rankBoard(d, true);
    assert.deepEqual(board.map((p) => [p.id, p.status]), [
      ["2", "winner"],
      ["1", "shortlisted"],
      ["3", "shortlisted"],
      ["4", "closed"],
    ]);
    const r = pastRoundOf(d, { number: 1, startsAt: UNLOCK, endsAt: UNLOCK + ROUND_MS }, null);
    assert.equal(r.winnerPitchId, "2");
    assert.equal(r.top?.length, 3);
    const empty = pastRoundOf(emptyRound(2), { number: 2, startsAt: UNLOCK, endsAt: UNLOCK + ROUND_MS }, null);
    assert.equal(empty.winnerTitle, null);
    const hidden = applyHide(d, "2", "0x09" as Address, "spam", "");
    assert.equal(pastRoundOf(hidden, { number: 1, startsAt: UNLOCK, endsAt: UNLOCK + ROUND_MS }, null).winnerPitchId, "1");
  });
});

describe("Audit fixes (5 Oct 2026)", () => {
  it("never changes a finished round: no hide after its end", async () => {
    const s = setup();
    const at = s.deps.now();
    const p = await submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101"), { at })));
    await castVote(s.deps, ...(await signed(s.voters[0], "vote", { Pitch: p.id }, { at })));
    s.mods.push(lc(s.voters[4]));
    s.setNow(UNLOCK + ROUND_MS + 60_000);
    await rejects(hidePitch(s.deps, lc(s.voters[4]), p.id, "Changed my mind"), 409, /has ended/);
    assert.equal((await readRound(1)).votes.length, 1);
  });

  it("refuses a vote whose request runs past the round's end, instead of using the next round's snapshot", async () => {
    const s = setup();
    const at = s.deps.now();
    const p = await submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101"), { at })));
    // The round ends while the voter's power is being read from the chain.
    s.setNow(UNLOCK + ROUND_MS - 30_000);
    const late = s.deps.now();
    const slow: SnapshotChain = {
      ...s.fc.chain,
      async balanceAt(token, owner, block) {
        s.setNow(UNLOCK + ROUND_MS + 1_000);
        return s.fc.chain.balanceAt(token, owner, block);
      },
    };
    await rejects(castVote({ ...s.deps, chain: () => slow }, ...(await signed(s.voters[1], "vote", { Pitch: p.id }, { at: late }))), 409, /has ended/);
    assert.equal((await readRound(1)).votes.length, 0, "nothing landed in the finished round");
  });

  it("refuses the same signed tender posted twice (it's public in the audit log)", async () => {
    const s = setup();
    const at = s.deps.now();
    const sig = await signed(s.masterOwner, "tender", {
      Master: s.masters[0].tokenAddress,
      Title: "Weekly holder report",
      Description: "We need a small feature that tells holders what changed this week.",
      "Looking for": "Fast",
      Deadline: new Date(at + 3 * 86_400_000).toISOString(),
    }, { at });
    await postTender(s.deps, ...sig);
    await rejects(postTender(s.deps, ...sig), 409, /already posted/);
  });

  it("accepts the longest tender deadline the form offers (rounded up to the hour)", async () => {
    const s = setup();
    const at = s.deps.now();
    const hour = 3_600_000;
    const deadline = new Date(Math.ceil((at + TOURNAMENT.tender.maxDays * 86_400_000) / hour) * hour + hour - 60_000);
    await postTender(s.deps, ...(await signed(s.masterOwner, "tender", {
      Master: s.masters[0].tokenAddress,
      Title: "Two-week request",
      Description: "We need a small feature that tells holders what changed this week.",
      "Looking for": "Fast",
      Deadline: deadline.toISOString(),
    }, { at })));
  });

  it("only fixes the snapshot once a later second exists", async () => {
    const fc = fakeChain();
    fc.setHead(UNLOCK);
    assert.equal(await findSnapshotBlock(fc.chain, UNLOCK), null, "head is still in the round-start second");
    fc.setHead(UNLOCK + 2_000);
    assert.notEqual(await findSnapshotBlock(fc.chain, UNLOCK), null);
  });

  it("keeps a zero voting power out of storage", async () => {
    const s = setup();
    const r = await powerFor(s.deps, "0x4444444444444444444444444444444444444444" as Address);
    assert.equal(r.power, 0);
    assert.equal(await readPower(1, "0x4444444444444444444444444444444444444444" as Address), null);
    assert.equal((await powerFor(s.deps, "0x4444444444444444444444444444444444444444" as Address)).power, 0, "still answered, from memory");
  });

  it("never stores a wrong 0 when the rebuilt balance comes out negative", async () => {
    const fc = fakeChain({ prunedBelow: 3_900_000n });
    fc.setHead(UNLOCK + 72 * 3_600_000);
    const broken: SnapshotChain = { ...fc.chain, transferSum: async (_t, _o, dir) => (dir === "in" ? 5n * E18 : 0n) };
    await assert.rejects(balanceAtSnapshot(broken, ORBIO, "0x2222222222222222222222222222222222222222" as Address, 2_000_000n), /negative/);
  });
});

describe("Paid rounds: frozen results, 60% pool and the dev's floor", () => {
  const C = (n: number) => BigInt(n) * 1_000_000n;

  async function playRound(s: ReturnType<typeof setup>) {
    const at = s.deps.now();
    const p = await submitPitch(s.deps, ...(await signed(s.fighter, "pitch", pitchFields("101"), { at })));
    // Five voters (the minimum) back the pitch; voter 5 holds too little to vote.
    for (const v of s.voters.slice(0, 5)) await castVote(s.deps, ...(await signed(v, "vote", { Pitch: p.id }, { at })));
    return p;
  }

  it("waits a couple of minutes after the end before freezing (late writes land first)", async () => {
    const s = setup();
    const deps = { ...s.deps, grossTreasury: async () => C(100) };
    await playRound({ ...s, deps });
    s.setNow(UNLOCK + ROUND_MS + 30_000);
    assert.equal((await pastRounds(deps)).finals[0], null);
    s.setNow(UNLOCK + ROUND_MS + FREEZE_AFTER_MS + 1_000);
    assert.ok((await pastRounds(deps)).finals[0]);
  });

  it("doesn't freeze while the Masters list can't be read (no Master loses a share)", async () => {
    const s = setup();
    const deps = { ...s.deps, grossTreasury: async () => C(100), masters: async () => Promise.reject(new Error("Orbio down")) };
    await playRound({ ...s, deps: s.deps });
    s.setNow(UNLOCK + ROUND_MS + FREEZE_AFTER_MS + 1_000);
    assert.equal((await pastRounds(deps)).finals[0], null);
  });

  it("freezes a finished round once: pool, funding and shares never change after", async () => {
    const s = setup();
    let gross = C(100);
    const deps = { ...s.deps, grossTreasury: async () => gross };
    await playRound({ ...s, deps });
    s.setNow(UNLOCK + ROUND_MS + FREEZE_AFTER_MS + 1_000);

    const first = await pastRounds(deps);
    const f = first.finals[0]!;
    assert.equal(f.shareAtoms, C(60).toString(), "60% of the treasury");
    assert.equal(f.devTopUpAtoms, C(40).toString(), "the dev tops up to the floor");
    assert.equal(f.poolAtoms, C(REWARDS.roundPoolFloorCredits).toString());
    // Only the pitches and voters buckets are used (no Master took part): the treasury pays first.
    assert.ok(BigInt(f.allocatedAtoms) > 0n && BigInt(f.allocatedAtoms) <= BigInt(f.poolAtoms));
    assert.equal(BigInt(f.fromTreasuryAtoms) + BigInt(f.fromDevAtoms), BigInt(f.allocatedAtoms));
    assert.ok(BigInt(f.fromTreasuryAtoms) <= BigInt(f.shareAtoms));
    const fighterBefore = await ledger(lc(s.fighter), deps);

    // The treasury grows and a new Master appears: the frozen round doesn't move.
    gross = C(10_000);
    s.masters.push(master("901", lc(s.voters[0])));
    const again = await pastRounds(deps);
    assert.deepEqual(again.finals[0], f);
    assert.deepEqual(await ledger(lc(s.fighter), deps), fighterBefore);
    // The shares are stored with the round: the ledger matches them exactly.
    const won = fighterBefore.find((e) => e.role === "pitch")!;
    assert.equal(won.amountAtoms, f.payouts.pitches[0].amount);
  });

  it("starts each round from what earlier rounds left in the treasury", async () => {
    const s = setup();
    const deps = { ...s.deps, grossTreasury: async () => C(1_000) };
    await playRound({ ...s, deps });
    s.setNow(UNLOCK + ROUND_MS + FREEZE_AFTER_MS + 1_000);
    const { finals, paidFromTreasury } = await pastRounds(deps);
    const paid = BigInt(finals[0]!.fromTreasuryAtoms);
    assert.equal(paidFromTreasury, paid);
    const now = await currentPool(deps);
    assert.equal(now!.treasury, C(1_000) - paid, "the next round's treasury is what's left");
    assert.equal(now!.share, (now!.treasury * 60n) / 100n);
  });

  it("awards nothing and costs the dev nothing with too few voters", async () => {
    const s = setup();
    const deps = { ...s.deps, grossTreasury: async () => C(50) };
    const at = s.deps.now();
    const p = await submitPitch(deps, ...(await signed(s.fighter, "pitch", pitchFields("101"), { at })));
    await castVote(deps, ...(await signed(s.voters[0], "vote", { Pitch: p.id }, { at })));
    s.setNow(UNLOCK + ROUND_MS + FREEZE_AFTER_MS + 1_000);
    const f = (await pastRounds(deps)).finals[0]!;
    assert.equal(f.allocatedAtoms, "0");
    assert.equal(f.fromDevAtoms, "0");
    assert.equal(f.fromTreasuryAtoms, "0");
  });

  it("waits to freeze while the treasury can't be read", async () => {
    const s = setup();
    const deps = { ...s.deps, grossTreasury: async () => null };
    await playRound({ ...s, deps });
    s.setNow(UNLOCK + ROUND_MS + FREEZE_AFTER_MS + 1_000);
    const v = await pastRounds(deps);
    assert.equal(v.finals[0], null);
    assert.equal(v.past[0].poolCredits, null);
  });
});
