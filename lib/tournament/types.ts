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
