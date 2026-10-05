import type { MooBotState } from "@/lib/moobot";

export type Address = `0x${string}`;
export type Hash = `0x${string}`;

/** "live" = real site data (for example, the Tournament's own records), even when empty. */
export type DataSourceKind = "mock" | "chain" | "orbio" | "live" | "unavailable";

/** Every data card is backed by one of these, so it can show "last updated" and a stale warning. */
export interface DataEnvelope<T> {
  data: T | null;
  source: DataSourceKind;
  updatedAt: string | null;
  stale: boolean;
  error?: string;
}

/** A graduated Orbio agent (from the Orbio API, or the mock scanner in preview mode). */
export interface Master {
  tokenAddress: Address;
  name: string;
  ticker: string;
  ownerWallet: Address;
  /** Orbio agent wallet (can harvest and claim); null when unknown. */
  agentWallet: Address | null;
  orbioAgentId: string | null;
  launchedAt: string | null;
  launchTx: Hash | null;
  /** Orbio publishes no graduation time or transaction; these stay null for real data. */
  graduatedAt: string | null;
  gradTx: Hash | null;
  gradBlock: string | null;
  marketCapUsd: number | null;
  /** Orbio does not expose liquidity, holders or volume yet: null shows as "n/a". */
  liquidityUsd: number | null;
  holderCount: number | null;
  explorerUrl: string | null;
  orbioUrl: string | null;
  /** Token icon from Orbio's `logo`, already checked by safeLogoUrl (https only); null shows initials. */
  logoUrl: string | null;
  /** Phase 3 profile fields (set by the Master by signed message, never by the scanner). */
  contactRoute: string | null;
  openToPitches: boolean;
  description: string | null;
  category: MasterCategory | null;
  isMock: boolean;
}

export const MASTER_CATEGORIES = ["Trading", "Social", "Data", "Tools", "Games", "Art"] as const;
export type MasterCategory = (typeof MASTER_CATEGORIES)[number];

export type PitchStatus = "open" | "shortlisted" | "winner" | "closed";

export interface Pitch {
  id: string;
  title: string;
  summary: string;
  /** The Fighter agent that submitted the pitch. */
  fighter: string;
  fighterWallet: Address;
  /** Token address of the Master being pitched to, or null for an open pitch. */
  masterToken: Address | null;
  tenderId: string | null;
  status: PitchStatus;
  votes: number;
  votingPower: number;
  submittedAt: string;
  roundId: string;
  /** Real pitches only (lib/tournament/results.ts). */
  agentId?: string;
  ticker?: string;
  fighterToken?: Address;
  demoUrl?: string | null;
  /** The Fighter's token icon (a Moofield logo path), or null for initials. */
  logoUrl?: string | null;
  /** Masters' scores (1 to TOURNAMENT.scoreMax): the average, and how many Masters scored. */
  scoreAvg?: number | null;
  scoreCount?: number;
}

export interface Tender {
  id: string;
  masterToken: Address;
  title: string;
  description: string;
  criteria: string[];
  deadline: string;
  status: "open" | "closed";
  bids: number;
}

export interface PastRound {
  id: string;
  number: number;
  startedAt: string;
  endedAt: string;
  /** null when no snapshot was taken (nobody voted or pitched that round). */
  snapshotBlock: string | null;
  /** Counting every eligible holder needs a full token indexer: null shows "n/a". */
  eligibleWallets: number | null;
  votesCast: number;
  /** null when no pitch received a vote. */
  winnerPitchId: string | null;
  winnerTitle: string | null;
  winnerFighter: string | null;
  /** The round pool in whole $CREDIT, or null while the per-round cap isn't set. */
  poolCredits: number | null;
  pitchCount?: number;
  /** The top places, best first. */
  top?: { id: string; title: string; fighter: string; ticker?: string; logoUrl?: string | null; votes: number; votingPower: number }[];
}

export interface VoterRank {
  wallet: Address;
  votingPower: number;
  votesCast: number;
  backedWinners: number;
}

export interface Leaderboard {
  pitches: (Pitch & { rank: number })[];
  voters: (VoterRank & { rank: number })[];
}

export interface DailyCredits {
  /** ISO date (YYYY-MM-DD). */
  day: string;
  credits: number;
}

export interface CreditMovement {
  at: string;
  kind: "$CREDIT received" | "Agent operations" | "Round pool (displayed)";
  amount: number;
}

export interface CreditMarket {
  history: DailyCredits[];
  /** Whole $CREDIT received in the last 24 hours. */
  received24h: number;
  movements: CreditMovement[];
}

export interface TokenBalance {
  symbol: "ORBIO" | "MOOBOT";
  /**
   * not-launched: $MOOBOT has no verified contract yet (MOOBOT_TOKEN_ADDRESS empty, invalid or not on Orbio).
   * unverified: a $MOOBOT address is set but Orbio couldn't be reached to confirm it yet.
   * not-configured: no balance source (RPC_URL) is connected.
   */
  status: "ok" | "not-launched" | "unverified" | "not-configured" | "error";
  /** Raw integer amount as a decimal string. */
  raw: string | null;
  decimals: number | null;
  /** Human-readable amount. */
  formatted: string | null;
  error?: string;
}

export interface WalletBalances {
  address: Address;
  /** Block the balances were read at ("latest" or a snapshot block). */
  block: string;
  orbio: TokenBalance;
  moobot: TokenBalance;
  /** Informational only: voting is not open until the 24-hour unlock. */
  meetsVotingMinimum: boolean | null;
  /** Cosmetic holder aura tier from the $MOOBOT balance. null while $MOOBOT is unread or below the first tier. */
  aura: string | null;
}

/** Orbio $CREDIT received by the MooBot agent and its 20/80 split. Amounts are atom strings (6 decimals). */
export interface CreditStats {
  receivedAtoms: string;
  /** Accrued to the agent but not yet claimed (Orbio credit.owedAtoms). null when Orbio has no value. */
  waitingAtoms: string | null;
  /** The two parts of receivedAtoms (null when Orbio has no value): gateway balance credited, and staking $CREDIT claimed. */
  gatewayAtoms: string | null;
  claimedAtoms: string | null;
  agentOpsAtoms: string;
  treasuryAtoms: string;
}

/** Treasury and this round's pool. Atom strings; poolAtoms is null while the cap is not set. */
export interface TreasuryState {
  treasuryAtoms: string;
  poolShareAtoms: string;
  capAtoms: string | null;
  poolAtoms: string | null;
}

export interface OwnedAgent {
  agentId: string | null;
  name: string;
  ticker: string;
  tokenAddress: Address;
  graduated: boolean;
  explorerUrl: string | null;
  /** Checked by safeLogoUrl; null shows initials. */
  logoUrl: string | null;
}

export interface SystemStatus {
  mode: "mock" | "live";
  rpc: {
    status: "ok" | "down" | "not-configured" | "mock";
    latencyMs: number | null;
    headBlock: string | null;
    error?: string;
    /** Whether the node still answers balances from days ago (an archive node): then votes are read directly. null = unknown. */
    archive?: boolean | null;
  };
  indexer: { lastScannedBlock: string | null; lagBlocks: string | null; lastScanAt: string | null; lastScanError: string | null };
  orbio: { lastFetchAt: string | null; agentsTotal: number | null; graduated: number | null; hiddenMismatches: number; lastError: string | null } | null;
  /** The $MOOBOT launch switch (lib/moobot.ts). */
  moobot: MooBotState;
  configErrors: string[];
  missingConfirm: string[];
  checkedAt: string;
}
