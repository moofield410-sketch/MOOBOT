import type { Address } from "@/lib/types";

/**
 * What the Tournament stores (lib/tournament/store.ts). Every pitch, vote, score and tender keeps
 * the exact message its wallet signed and the signature, so anyone can re-check them (the audit log).
 */

export interface Signed {
  message: string;
  signature: `0x${string}`;
}

export interface StoredPitch extends Signed {
  /** r<round>-<agentId>: one pitch per agent per round. */
  id: string;
  round: number;
  agentId: string;
  fighter: string;
  ticker: string;
  fighterToken: Address;
  fighterOwner: Address;
  fighterAgentWallet: Address | null;
  /** The Fighter's token icon (lib/safe-url.ts logoPath), or null for initials. */
  logoUrl?: string | null;
  /** The wallet that signed (the agent's owner or agent wallet). */
  submittedBy: Address;
  title: string;
  summary: string;
  demoUrl: string | null;
  masterToken: Address | null;
  tenderId: string | null;
  submittedAt: string;
}

export interface StoredVote extends Signed {
  round: number;
  wallet: Address;
  pitchId: string;
  power: number;
  /** $ORBIO at the snapshot block, whole tokens (rounded down). */
  balance: number;
  castAt: string;
}

export interface StoredScore extends Signed {
  round: number;
  pitchId: string;
  masterToken: Address;
  masterAgentId: string | null;
  masterName: string;
  /** The Master's owner wallet (a Master can't score a pitch from an agent its owner also runs). */
  masterOwner: Address;
  wallet: Address;
  score: number;
  scoredAt: string;
}

export interface HiddenPitch {
  pitchId: string;
  by: Address;
  reason: string;
  at: string;
  /** Votes the pitch had: removed, so those wallets can vote again. */
  removedVotes: StoredVote[];
}

export interface Snapshot {
  block: string;
  /** The snapshot block's own timestamp (ms). */
  blockTime: number;
  takenAt: string;
}

export interface RoundDoc {
  round: number;
  snapshot: Snapshot | null;
  pitches: StoredPitch[];
  votes: StoredVote[];
  scores: StoredScore[];
  hidden: HiddenPitch[];
}

export interface StoredTender extends Signed {
  /** t<round>-<masterAgentId or token prefix>-<n>. */
  id: string;
  round: number;
  masterToken: Address;
  masterAgentId: string | null;
  masterName: string;
  wallet: Address;
  title: string;
  description: string;
  criteria: string[];
  deadline: string;
  postedAt: string;
}

export interface TendersDoc {
  tenders: StoredTender[];
}

/** One wallet's voting power for a round, read once and kept. */
export interface PowerRecord {
  round: number;
  wallet: Address;
  block: string;
  /** Raw $ORBIO at the snapshot block (wei), as a string. */
  raw: string;
  decimals: number;
  balance: number;
  power: number;
  /** "direct": balanceOf at the snapshot block. "transfers": rebuilt from today's balance and the Transfer log since. */
  method: "direct" | "transfers";
  readAt: string;
}

export const emptyRound = (round: number): RoundDoc => ({ round, snapshot: null, pitches: [], votes: [], scores: [], hidden: [] });

/**
 * A finished round, frozen the first time it is read after it ends (lib/tournament/service.ts
 * pastRounds). $CREDIT amounts are atoms (6 decimals) as strings. The dev pays `allocatedAtoms`
 * to the winners by hand: `fromTreasuryAtoms` out of the treasury's share, `fromDevAtoms` added.
 */
export interface FinalRound {
  round: number;
  frozenAt: string;
  /** The treasury this round started from (after every earlier round's payouts). */
  treasuryAtoms: string;
  /** REWARDS.roundPoolPctOfTreasury% of it. */
  shareAtoms: string;
  /** What the dev adds so the pool reaches the floor. */
  devTopUpAtoms: string;
  poolAtoms: string;
  /** What the round actually awards (less than the pool when a place or bucket is empty). */
  allocatedAtoms: string;
  fromTreasuryAtoms: string;
  fromDevAtoms: string;
  /** Everything the rewards calculator used, so every wallet's share can be recomputed exactly. */
  input: Omit<import("@/lib/rewards").RoundInput, "pool"> & { pool: string };
  /** Every share (atoms as strings), computed when frozen: what the dev pays, whatever the rules become later. */
  payouts: FrozenPayouts;
  result: import("@/lib/types").PastRound;
}

export interface FrozenPayouts {
  pitches: { pitchId: string; amount: string }[];
  voters: { wallet: string; amount: string }[];
  masters: { masterId: string; amount: string }[];
}
