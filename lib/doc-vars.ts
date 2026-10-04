import {
  AGENT_LIVE_AT,
  CACHE,
  FULL_UNLOCK_AFTER_H,
  GATEWAY,
  HOLDER_AURA_TIERS,
  ORBIO_LINKS,
  REWARDS,
  SOCIAL,
  TOURNAMENT,
  VOTING,
} from "@/config";
import { CREDIT, computeRoundPayouts, credits, roundPool, splitReceived, type RoundPitch } from "@/lib/rewards";
import { buildTimeline } from "@/lib/schedule";
import { splitByPercent } from "@/lib/splits";
import { votingPower } from "@/lib/voting";

/**
 * Every number the Docs state, computed from config.ts and the real rewards/voting code, so the
 * Docs and the code cannot drift apart. Docs use them as {{NAME}}; tests check that the markdown
 * itself contains no hand-typed numbers.
 */

const int = (n: number | bigint) => n.toLocaleString("en-US");
const whole = (atoms: bigint) => int(atoms / CREDIT);
const longDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}, ${d.toISOString().slice(11, 16)} UTC`;
};
const shortDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}, ${d.toISOString().slice(11, 16)}`;
};
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n: number) => WORDS[n] ?? int(n);
const fraction = (f: number) => (f === 0.5 ? "half" : `${Math.round(f * 100)}%`);

/** The Rewards worked example: illustrative inputs, every output computed by lib/rewards.ts. */
export const EXAMPLE = { receivedCredits: 10_000, treasuryCredits: 200_000, capCredits: 40_000, bigPower: 1_000, smallPower: 100, smallVoters: 9, masters: 5 };

export function rewardsWorkedExample(r = REWARDS, ex = EXAMPLE): string {
  const received = splitReceived(credits(ex.receivedCredits), r);
  const rc = { ...r, roundPoolCapCredits: ex.capCredits };
  const share = (credits(ex.treasuryCredits) * BigInt(r.roundPoolPctOfTreasury * 100)) / 10_000n;
  const pool = roundPool(credits(ex.treasuryCredits), rc)!;

  const wallet = (i: number) => `0x${(1_000 + i).toString(16).padStart(40, "0")}` as const;
  const pitch = (id: string, fighter: string, minute: number): RoundPitch => ({
    id,
    fighter,
    fighterOwner: `0x${(100 + minute).toString(16).padStart(40, "0")}`,
    submittedAt: `2026-01-01T00:${String(minute).padStart(2, "0")}:00Z`,
  });
  const pitches = [pitch("p1", "A", 1), pitch("p2", "B", 2), pitch("p3", "C", 3)];
  const votes = [
    { wallet: wallet(0), pitchId: "p1", power: ex.bigPower },
    ...Array.from({ length: ex.smallVoters }, (_, i) => ({ wallet: wallet(i + 1), pitchId: i < 5 ? "p2" : "p3", power: ex.smallPower })),
  ];
  // Master 0 is also Fighter "A" (behind the first-place pitch), so it is left out.
  const masters = Array.from({ length: ex.masters }, (_, i) => ({ id: `m${i}`, agentId: i === 0 ? "A" : `master-${i}`, ownerWallet: wallet(50 + i) }));
  const base = { pool, pitches, votes, masters, scores: [], tenders: masters.map((m) => ({ masterId: m.id, pitchCount: 1 })), recentTop3: [] as string[] };
  const p = computeRoundPayouts(base, rc);
  const repeat = computeRoundPayouts({ ...base, recentTop3: ["B"] }, rc);

  const split = splitByPercent(pool, r.roundSplit, "treasuryPct");
  const buckets = { pitches: split.pitchesPct, voters: split.votersPct, masters: split.mastersPct };
  const kept = split.treasuryPct;
  const totalPower = ex.bigPower + ex.smallVoters * ex.smallPower;
  const uncapped = (Number(buckets.voters / CREDIT) * ex.bigPower) / totalPower;
  const voterCap = (buckets.voters * BigInt(r.voterShareCapPct)) / 100n;
  const voterAmounts = [...new Set(p.voters.map((v) => whole(v.amount)))];
  const second = p.pitches.find((x) => x.place === 2)!;
  const secondRepeat = repeat.pitches.find((x) => x.place === 2)?.amount ?? 0n;
  const paidMasters = p.masters.length;
  const sharedPool = share > pool ? `which is above the cap, so the round pool is **${whole(pool)} $CREDIT**` : `which is below the cap, so the round pool is **${whole(pool)} $CREDIT**`;

  return [
    `Say the MooBot agent receives **${int(ex.receivedCredits)} $CREDIT**:`,
    "",
    `- Running the agent (${r.agentOpsPct}%, taken first): **${whole(received.agentOps)} $CREDIT**`,
    `- Into the treasury (${r.treasuryPct}%): **${whole(received.treasury)} $CREDIT**`,
    "",
    `Later, the treasury holds **${int(ex.treasuryCredits)} $CREDIT** and the cap is **${int(ex.capCredits)} $CREDIT** (an example; the real cap isn't set yet). ${r.roundPoolPctOfTreasury}% of the treasury is **${whole(share)}**, ${sharedPool}.`,
    "",
    "**Splitting the pool**",
    "",
    "| Bucket | Share | $CREDIT |",
    "|---|---|---|",
    `| Pitches | ${r.roundSplit.pitchesPct}% | ${whole(buckets.pitches)} |`,
    `| Voters | ${r.roundSplit.votersPct}% | ${whole(buckets.voters)} |`,
    `| Masters | ${r.roundSplit.mastersPct}% | ${whole(buckets.masters)} |`,
    `| Stays in the treasury | ${r.roundSplit.treasuryPct}% | ${whole(kept)} |`,
    "",
    `**The top ${r.pitchPlaces.length} pitches** share ${whole(buckets.pitches)}: ${p.pitches.map((x) => `${["first", "second", "third"][x.place - 1] ?? `place ${x.place}`} **${whole(x.amount)}**`).join(", ")}. If the second-place agent had also placed in the top ${r.pitchPlaces.length} within the last ${r.repeatWinner.rounds} rounds, it would get **${whole(secondRepeat)}** and the other ${whole(second.amount - secondRepeat)} would stay in the treasury.`,
    "",
    `**Voters.** ${word(1 + ex.smallVoters).replace(/^./, (c) => c.toUpperCase())} wallets voted: one with voting power ${int(ex.bigPower)} and ${word(ex.smallVoters)} with ${int(ex.smallPower)} each. Without a cap the big wallet would get about ${int(Math.round(uncapped))} of the ${whole(buckets.voters)}. The cap is ${r.voterShareCapPct}% of the bucket, **${whole(voterCap)}**, so it gets ${whole(p.voters[0].amount)} and the rest is shared among the others${voterAmounts.length === 1 ? `: each of the ${word(p.voters.length)} wallets gets **${voterAmounts[0]}**` : ""}.`,
    "",
    `**Masters.** ${word(ex.masters).replace(/^./, (c) => c.toUpperCase())} Masters took part, but one is the Fighter behind a top-${r.pitchPlaces.length} pitch, so the other ${word(paidMasters)} share the ${whole(buckets.masters)}: **${whole(p.masters[0].amount)}** each.`,
    "",
    `Everything adds up: ${whole(buckets.pitches)} + ${whole(buckets.voters)} + ${whole(buckets.masters)} + ${whole(kept)} = ${whole(pool)}.`,
  ].join("\n");
}

/** Example balances for the voting power table; the powers come from lib/voting.ts. */
export const VOTING_TABLE_BALANCES = [10_000, 160_000, 250_000, 1_000_000];

export function votingPowerTable(): string {
  return ["| Snapshot balance | Voting power |", "|---|---|", ...VOTING_TABLE_BALANCES.map((b) => `| ${int(b)} $ORBIO | ${int(votingPower(b))} |`)].join("\n");
}

export function docVars(): Record<string, string> {
  const t = buildTimeline(Date.parse(AGENT_LIVE_AT), FULL_UNLOCK_AFTER_H);
  const roundMs = TOURNAMENT.roundLengthH * 3_600_000;
  return {
    GO_LIVE: longDate(t.agentLiveAt),
    GO_LIVE_SHORT: shortDate(t.agentLiveAt),
    UNLOCK: longDate(t.fullUnlockAt),
    UNLOCK_SHORT: shortDate(t.fullUnlockAt),
    UNLOCK_AFTER_H: String(FULL_UNLOCK_AFTER_H),
    ROUND_H: String(TOURNAMENT.roundLengthH),
    ROUND1_ENDS: longDate(t.fullUnlockAt + roundMs),
    MIN_ORBIO: int(VOTING.minOrbio),
    POWER_MODEL: VOTING.powerModel === "sqrt" ? "the **square root** of your snapshot balance" : `your snapshot balance, capped at **${int(VOTING.powerCap)} $ORBIO**`,
    VOTING_POWER_TABLE: votingPowerTable(),
    AGENT_OPS_PCT: String(REWARDS.agentOpsPct),
    TREASURY_PCT: String(REWARDS.treasuryPct),
    POOL_PCT: String(REWARDS.roundPoolPctOfTreasury),
    CAP: REWARDS.roundPoolCapCredits === null ? "not set yet" : `${int(REWARDS.roundPoolCapCredits)} $CREDIT`,
    SPLIT_PITCHES: String(REWARDS.roundSplit.pitchesPct),
    SPLIT_VOTERS: String(REWARDS.roundSplit.votersPct),
    SPLIT_MASTERS: String(REWARDS.roundSplit.mastersPct),
    SPLIT_TREASURY: String(REWARDS.roundSplit.treasuryPct),
    TOP_N: String(REWARDS.pitchPlaces.length),
    PLACES: REWARDS.pitchPlaces.join(" / "),
    VOTER_CAP_PCT: String(REWARDS.voterShareCapPct),
    MIN_VOTERS: String(REWARDS.minVoters),
    MIN_PAYOUT: int(REWARDS.minPayoutCredits),
    REPEAT_ROUNDS: String(REWARDS.repeatWinner.rounds),
    REPEAT_SHARE: fraction(REWARDS.repeatWinner.factor),
    MASTER_MIN_SCORED: String(REWARDS.mastersParticipation.minScoredPitches),
    MASTERS_REFRESH_MIN: String(Math.round(CACHE.mastersTtlMs / 60_000)),
    CHAT_LIMIT:
      GATEWAY.chat.perVisitorPerDay === null
        ? "There's no daily question limit."
        : `Each visitor can ask ${word(GATEWAY.chat.perVisitorPerDay)} questions a day.`,
    X_HANDLE: SOCIAL.xHandle,
    AURA_TIERS: HOLDER_AURA_TIERS.map((a) => `${a.name} (${int(a.minMooBot)}+)`).join(", "),
    REWARDS_WORKED_EXAMPLE: rewardsWorkedExample(),
    ORBIO_DOCS: ORBIO_LINKS.docs,
    ORBIO_TERMS: ORBIO_LINKS.liveTerms,
  };
}
