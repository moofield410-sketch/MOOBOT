import { CREDIT_DECIMALS, REWARDS } from "@/config";
import { splitByPercent } from "@/lib/splits";
import type { Address } from "@/lib/types";

/**
 * Rewards model (displayed, not paid; legal review comes before any real payout).
 * Pure functions on bigint $CREDIT atoms (6 decimals). Every atom of a round pool is
 * accounted for: payouts + amount kept in the treasury === pool.
 */

export const CREDIT = 10n ** BigInt(CREDIT_DECIMALS);
export const credits = (whole: number | bigint): bigint => BigInt(whole) * CREDIT;

export type RewardsConfig = typeof REWARDS;

const pctOf = (amount: bigint, pct: number) => (amount * BigInt(Math.round(pct * 100))) / 10_000n;

/** Of the $CREDIT the MooBot agent receives: 20% to running the agent first, the rest to the treasury. */
export function splitReceived(received: bigint, r: RewardsConfig = REWARDS): { agentOps: bigint; treasury: bigint } {
  const agentOps = pctOf(received, r.agentOpsPct);
  return { agentOps, treasury: received - agentOps };
}

/** Round pool = min(25% of the treasury, cap). Null while the cap is not set (shown as "n/a"). */
export function roundPool(treasury: bigint, r: { roundPoolPctOfTreasury: number; roundPoolCapCredits: number | null } = REWARDS): bigint | null {
  if (r.roundPoolCapCredits === null) return null;
  const share = pctOf(treasury, r.roundPoolPctOfTreasury);
  const cap = credits(r.roundPoolCapCredits);
  return share < cap ? share : cap;
}

export interface RoundPitch {
  id: string;
  /** Fighter agent id. */
  fighter: string;
  fighterOwner: Address;
  submittedAt: string;
}

export interface RoundVote {
  wallet: Address;
  pitchId: string;
  power: number;
}

export interface RoundMaster {
  id: string;
  /** The Master's own agent id (to detect its own pitches). */
  agentId: string;
  ownerWallet: Address;
}

export interface RoundInput {
  pool: bigint;
  pitches: RoundPitch[];
  votes: RoundVote[];
  masters: RoundMaster[];
  /** Which Master scored which pitch. */
  scores: { masterId: string; pitchId: string }[];
  /** Tenders posted this round and how many pitches each received. */
  tenders: { masterId: string; pitchCount: number }[];
  /** Fighter ids that placed in the top 3 within the last `repeatWinner.rounds` rounds. */
  recentTop3: string[];
}

export interface Skipped {
  kind: "round" | "pitch" | "voter" | "master" | "vote";
  id: string;
  amount: bigint;
  reason: string;
}

export interface RoundPayouts {
  pool: bigint;
  paidOut: boolean;
  ranked: (RoundPitch & { power: number; rank: number })[];
  pitches: { pitchId: string; fighter: string; place: number; amount: bigint; reduced: boolean }[];
  voters: { wallet: Address; amount: bigint }[];
  masters: { masterId: string; amount: bigint }[];
  toTreasury: bigint;
  skipped: Skipped[];
}

/** One vote per wallet per round: the first vote counts, later ones are ignored. */
export function dedupeVotes(votes: RoundVote[]): { kept: RoundVote[]; ignored: RoundVote[] } {
  const seen = new Set<string>();
  const kept: RoundVote[] = [];
  const ignored: RoundVote[] = [];
  for (const v of votes) {
    const key = v.wallet.toLowerCase();
    (seen.has(key) ? ignored : kept).push(v);
    seen.add(key);
  }
  return { kept, ignored };
}

/**
 * Rank pitches by voting power; ties go to the earliest submission.
 * One pitch per agent per round: only each agent's earliest pitch is ranked.
 */
export function rankRoundPitches(pitches: RoundPitch[], votes: RoundVote[]): (RoundPitch & { power: number; rank: number })[] {
  const byTime = [...pitches].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const seenAgents = new Set<string>();
  const firstPerAgent = byTime.filter((p) => !seenAgents.has(p.fighter) && seenAgents.add(p.fighter));
  const power = new Map<string, number>();
  for (const v of votes) power.set(v.pitchId, (power.get(v.pitchId) ?? 0) + v.power);
  return firstPerAgent
    .map((p) => ({ ...p, power: power.get(p.id) ?? 0 }))
    .sort((a, b) => b.power - a.power || a.submittedAt.localeCompare(b.submittedAt))
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

/**
 * Proportional split with a per-recipient cap ("water filling"): anyone above the cap gets the
 * cap and the excess is shared again among the rest. Whatever cannot be placed is returned as `left`.
 */
export function cappedWeightedSplit(amount: bigint, weights: bigint[], cap: bigint): { shares: bigint[]; left: bigint } {
  const shares = weights.map(() => 0n);
  let active = weights.map((w, i) => i).filter((i) => weights[i] > 0n);
  let remaining = amount;
  for (;;) {
    const total = active.reduce((s, i) => s + weights[i], 0n);
    if (total === 0n || remaining <= 0n) break;
    const over = active.filter((i) => (remaining * weights[i]) / total > cap);
    if (over.length === 0) {
      for (const i of active) shares[i] = (remaining * weights[i]) / total;
      remaining -= active.reduce((s, i) => s + shares[i], 0n);
      break;
    }
    for (const i of over) {
      shares[i] = cap;
      remaining -= cap;
    }
    active = active.filter((i) => !over.includes(i));
  }
  return { shares, left: remaining };
}

/** A Master takes part by scoring enough pitches (not its own) or by posting a tender that received a pitch. */
export function mastersTakingPart(input: RoundInput, r: RewardsConfig = REWARDS): RoundMaster[] {
  const pitchById = new Map(input.pitches.map((p) => [p.id, p]));
  const isOwn = (m: RoundMaster, p: RoundPitch) => p.fighter === m.agentId || p.fighterOwner.toLowerCase() === m.ownerWallet.toLowerCase();

  return input.masters.filter((m) => {
    const eligible = input.pitches.filter((p) => !isOwn(m, p));
    const required = Math.min(r.mastersParticipation.minScoredPitches, eligible.length);
    const scored = new Set(
      input.scores
        .filter((s) => s.masterId === m.id)
        .map((s) => pitchById.get(s.pitchId))
        .filter((p): p is RoundPitch => p !== undefined && !isOwn(m, p))
        .map((p) => p.id),
    );
    const byScoring = required > 0 && scored.size >= required;
    const byTender = input.tenders.some((t) => t.masterId === m.id && t.pitchCount >= 1);
    return byScoring || byTender;
  });
}

export function computeRoundPayouts(input: RoundInput, r: RewardsConfig = REWARDS): RoundPayouts {
  const skipped: Skipped[] = [];
  const minPayout = credits(r.minPayoutCredits);
  let toTreasury = 0n;

  const { kept: votes, ignored } = dedupeVotes(input.votes);
  for (const v of ignored) skipped.push({ kind: "vote", id: v.wallet, amount: 0n, reason: "Only one vote per wallet per round counts" });

  const ranked = rankRoundPitches(input.pitches, votes);
  const result: RoundPayouts = { pool: input.pool, paidOut: false, ranked, pitches: [], voters: [], masters: [], toTreasury: 0n, skipped };

  if (votes.length < r.minVoters) {
    skipped.push({ kind: "round", id: "round", amount: input.pool, reason: `Fewer than ${r.minVoters} wallets voted` });
    result.toTreasury = input.pool;
    return result;
  }
  result.paidOut = true;

  const buckets = splitByPercent(input.pool, r.roundSplit, "treasuryPct");
  toTreasury += buckets.treasuryPct;

  /** Applies the minimum-payout guard; returns the amount actually allocated. */
  const pay = (kind: Skipped["kind"], id: string, amount: bigint): bigint => {
    if (amount <= 0n) return 0n;
    if (amount < minPayout) {
      skipped.push({ kind, id, amount, reason: `Under ${r.minPayoutCredits} $CREDIT` });
      toTreasury += amount;
      return 0n;
    }
    return amount;
  };

  // Pitches: top 3 share the pitches bucket 50/30/20.
  const placeShares = r.pitchPlaces.map((pct, i, all) =>
    i === all.length - 1 ? buckets.pitchesPct - all.slice(0, -1).reduce((s, p) => s + pctOf(buckets.pitchesPct, p), 0n) : pctOf(buckets.pitchesPct, pct),
  );
  const recent = new Set(input.recentTop3);
  placeShares.forEach((share, i) => {
    const p = ranked[i];
    if (!p || p.power <= 0) {
      skipped.push({ kind: "pitch", id: `place-${i + 1}`, amount: share, reason: "No pitch with votes in this place" });
      toTreasury += share;
      return;
    }
    const reduced = recent.has(p.fighter);
    let amount = share;
    if (reduced) {
      amount = (share * BigInt(Math.round(r.repeatWinner.factor * 100))) / 100n;
      skipped.push({ kind: "pitch", id: p.id, amount: share - amount, reason: `Placed in the top 3 within the last ${r.repeatWinner.rounds} rounds` });
      toTreasury += share - amount;
    }
    const paid = pay("pitch", p.id, amount);
    if (paid > 0n) result.pitches.push({ pitchId: p.id, fighter: p.fighter, place: i + 1, amount: paid, reduced });
  });

  // Voters: everyone who voted, weighted by voting power, capped per wallet.
  const weights = votes.map((v) => BigInt(Math.floor(v.power)));
  const cap = pctOf(buckets.votersPct, r.voterShareCapPct);
  const { shares, left } = cappedWeightedSplit(buckets.votersPct, weights, cap);
  toTreasury += left;
  votes.forEach((v, i) => {
    const paid = pay("voter", v.wallet, shares[i]);
    if (paid > 0n) result.voters.push({ wallet: v.wallet, amount: paid });
  });

  // Masters: equal split among Masters taking part, excluding any Master behind a top-3 pitch.
  const top3Fighters = new Set(ranked.slice(0, r.pitchPlaces.length).filter((p) => p.power > 0).map((p) => p.fighter));
  const masters = mastersTakingPart(input, r).filter((m) => !top3Fighters.has(m.agentId));
  if (masters.length === 0) {
    skipped.push({ kind: "master", id: "masters", amount: buckets.mastersPct, reason: "No Master took part" });
    toTreasury += buckets.mastersPct;
  } else {
    const each = buckets.mastersPct / BigInt(masters.length);
    toTreasury += buckets.mastersPct - each * BigInt(masters.length);
    for (const m of masters) {
      const paid = pay("master", m.id, each);
      if (paid > 0n) result.masters.push({ masterId: m.id, amount: paid });
    }
  }

  result.toTreasury = toTreasury;
  return result;
}

export function totalAllocated(p: RoundPayouts): bigint {
  const sum = (xs: { amount: bigint }[]) => xs.reduce((s, x) => s + x.amount, 0n);
  return sum(p.pitches) + sum(p.voters) + sum(p.masters);
}

/** "1,234.5" from atoms (up to 2 decimals). */
export function formatCredits(atoms: bigint | string | null): string {
  if (atoms === null) return "n/a";
  const a = typeof atoms === "string" ? BigInt(atoms) : atoms;
  const whole = a / CREDIT;
  const cents = ((a % CREDIT) * 100n) / CREDIT;
  return whole.toLocaleString("en-US") + (cents > 0n ? `.${cents.toString().padStart(2, "0").replace(/0$/, "")}` : "");
}
