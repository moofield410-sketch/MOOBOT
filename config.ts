/**
 * Moofield: single source of configuration.
 *
 * Everything marked CONFIRM is a placeholder until the value is confirmed
 * with Orbio or by the project owner. Do not hard-code these values anywhere else.
 */

type Address = `0x${string}`;

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

export const SITE = {
  name: "Moofield",
  ticker: "$MOOBOT",
  event: "The Tournament",
  tagline: "Every pitch needs a power-up.",
} as const;

/**
 * Community links. Leave a link null until the real account exists;
 * the footer shows "Coming soon" instead of linking to a guessed account.
 */
export const SOCIAL = {
  /** The official Moofield X account (the From X section embeds its timeline; no X API). */
  x: "https://x.com/M00FIELD" as string | null,
  xHandle: "@M00FIELD",
  /** CONFIRM */
  telegram: null as string | null,
  /** CONFIRM */
  discord: null as string | null,
} as const;

/** Orbio's own account, credited wherever the Docs mention Orbio. */
export const ORBIO_SOCIAL = {
  x: "https://x.com/orbiodotso",
  xHandle: "@orbiodotso",
} as const;

/** Shown in the footer and the Docs. */
export const DISCLAIMER = "Independent community project, not affiliated with Orbio. Not financial advice.";

// ---------------------------------------------------------------------------
// Schedule (all UTC). Everything is derived from these two values.
// ---------------------------------------------------------------------------

/**
 * Go-live (UTC): the site's schedule starts and MooBot wakes up. This is a schedule only: whether
 * the MooBot agent's token exists is decided by MOOBOT_TOKEN_ADDRESS (see MOOBOT_TOKEN below).
 */
export const AGENT_LIVE_AT = "2026-10-04T12:00:00Z";

/** The Tournament (board, leaderboard, rewards ledger card) unlocks this many hours after go-live. */
export const FULL_UNLOCK_AFTER_H = 24;

/** How often the browser re-syncs its clock offset with the server. */
export const CLOCK_RESYNC_MS = 5 * 60_000;

// ---------------------------------------------------------------------------
// Data mode
// ---------------------------------------------------------------------------

/**
 * The preview switch. Set to true to see sample data while developing locally.
 * While true, Masters, balances, credits and Tournament data are sample data.
 * While false, Masters come from the Orbio API and balances from the chain (RPC_URL).
 */
const MOCK_DATA_SWITCH = false;

/**
 * Sample data is never shown in production (`next build`/`next start`, and so on Netlify), even if
 * the switch above is left on. Next.js inlines NODE_ENV, so server and browser always agree.
 */
export const USE_MOCK_DATA: boolean = MOCK_DATA_SWITCH && process.env.NODE_ENV !== "production";

// ---------------------------------------------------------------------------
// Chain and contracts. Source: https://www.orbio.so/protocol (checked 2026-10-03)
// ---------------------------------------------------------------------------

export const CHAIN = {
  id: 4663,
  name: "Robinhood Chain",
  /** Explorer listed on Orbio's protocol page. (viem's built-in chain lists Blockscout instead.) */
  explorerUrl: "https://robin.etherscan.io" as string | null,
  /** RPC URL comes from the environment (server only). Never expose it to the browser. */
  rpcUrlEnv: "RPC_URL",
} as const;

export const CONTRACTS = {
  /** CONFIRM: no launchpad contract is published on Orbio's protocol page. */
  launchpad: [] as Address[],
  /** CONFIRM: block the launchpad was deployed at (only needed for on-chain log scanning). */
  launchpadDeployBlock: null as bigint | null,
  orbioToken: "0xaa07a0e9209e16ac99708c3ec70159c6ef3128a3" as Address | null,
  /** Orbio $CREDIT token (6 decimals). */
  creditToken: "0xe33322da1380e61e5ae5dfb21e7f62924c73004c" as Address,
  staking: "0xe0710011278bfb63e57c5f227e5980984b1eddca" as Address,
  exchange: "0x6951ffd32630b05e06f50062aea801625a58ebc0" as Address,
  payout: "0x4cbbbf652b11ed1294df0ac49d8322394310cfc5" as Address,
} as const;

/**
 * The $MOOBOT launch switch: ONE setting, the MOOBOT_TOKEN_ADDRESS environment variable (server-only).
 * Empty: every $MOOBOT item shows "Not launched yet". Set: the address is checked (format and
 * checksum) and must exist as an agent on the Orbio API before any $MOOBOT feature turns on.
 * The MooBot agent (its fees, stake and $CREDIT) is the Orbio agent behind this token.
 * Set it in .env.local locally, or in Netlify's environment variables (then redeploy).
 */
export const MOOBOT_TOKEN = {
  env: "MOOBOT_TOKEN_ADDRESS",
  /** How long one Orbio read is reused before re-reading. Short, so price and fees stay live. */
  verifyTtlMs: 60_000,
  /** After this age a kept result is flagged stale (Orbio unreachable). */
  verifyStaleMs: 60 * 60_000,
} as const;

/** $CREDIT uses 6 decimals (Orbio protocol page). */
export const CREDIT_DECIMALS = 6;

/**
 * Orbio public API (documented at https://www.orbio.so/launchpad/docs.md). Server-side only.
 * Graduation rule (confirmed): list `price.graduated === true`, then confirm each flagged agent
 * with the per-agent `curve.graduated`. Disagreements are hidden and logged.
 */
export const ORBIO_API = {
  /** ORBIO_API_BASE_URL (server-only) overrides this, so the smoke test can serve recorded responses. */
  baseUrl: (typeof process !== "undefined" && process.env.ORBIO_API_BASE_URL) || "https://www.orbio.so/api/protocol",
  pageSize: 200,
  timeoutMs: 10_000,
  /** Parallel per-agent confirmation requests. */
  confirmConcurrency: 4,
  /** Orbio-wide totals (/agents/analytics): reused for 5 minutes, flagged stale after an hour. */
  analyticsTtlMs: 5 * 60_000,
  analyticsStaleMs: 60 * 60_000,
  /** $MOOBOT price chart: Orbio samples once a minute, so it is re-read once a minute. */
  chartTtlMs: 60_000,
  chartStaleMs: 30 * 60_000,
} as const;

export const ORBIO_LINKS = {
  /** Orbio publishes no per-agent page URL, so agents link to the dashboard. */
  dashboard: "https://www.orbio.so/launchpad/dashboard",
  /** Orbio's own docs, including how an agent is paid. Fee shares are never restated here. */
  docs: "https://www.orbio.so/launchpad/docs",
  /** Orbio's live launch terms (fee split), as JSON. */
  liveTerms: "https://www.orbio.so/api/protocol/agents/terms",
} as const;

/**
 * Orbio's gateway (https://www.orbio.so/launchpad/docs.md): AI models and tools, paid from the
 * owner's Orbio balance with ORBIO_API_KEY (server-only secret). Used by the "Talk to MooBot" chat
 * (MOOBOT_CHAT=on) and by auto-posting to X (AUTO_POST=off|preview|on). Every call has a hard cap.
 */
export const GATEWAY = {
  keyEnv: "ORBIO_API_KEY",
  /** ORBIO_GATEWAY_BASE_URL (server-only) overrides this, so tests and local checks can use a stub. */
  baseUrl: (typeof process !== "undefined" && process.env.ORBIO_GATEWAY_BASE_URL) || "https://api.orbio.so/api/v1",
  timeoutMs: 25_000,
  chat: {
    env: "MOOBOT_CHAT",
    model: "anthropic/claude-haiku-4.5",
    /** US dollars per token (Orbio's model catalogue, checked 2026-10-04). One $CREDIT is one dollar. */
    pricePerInputToken: 0.000001,
    pricePerOutputToken: 0.000005,
    /**
     * Daily cap on chat spending in US dollars, reset at 00:00 UTC. null = no spending limit (the
     * owner's choice, 2026-10-04): only perVisitorPerDay limits use. Spend is still recorded for Status.
     */
    dailyBudgetUsd: null as number | null,
    /** Questions per visitor per UTC day. null = no limit (the owner's choice, 2026-10-04); then no visitor id is kept. */
    perVisitorPerDay: null as number | null,
    maxInputChars: 500,
    /** Messages of history sent with each question (visitor and MooBot together). */
    maxTurns: 6,
    maxTokens: 350,
    temperature: 0.3,
  },
  autopost: {
    env: "AUTO_POST",
    /**
     * Most one X post may cost, in $CREDIT: postMaxCost, plus perImageMaxCost for each image.
     * Orbio's quotes (GET /api/v1/tools, 2026-10-04): 0.0187 for text, 0.0352 with one image
     * (X bills each image upload as one more post).
     */
    postMaxCost: 0.02,
    perImageMaxCost: 0.0175,
    /** AUTO_POST_SKIP: comma-separated kinds never to post, e.g. "launch" if it was posted by hand. */
    skipEnv: "AUTO_POST_SKIP",
    /** Times a post X failed to publish is tried before giving up on it. */
    maxAttempts: 3,
    /** UTC hour after which the daily recap goes out. */
    recapHourUtc: 12,
    /** Minutes past 00:00 UTC after which the daily Bloom Pop board goes out. */
    boardAfterMinutes: 5,
  },
} as const;

/**
 * The MooBot Eco Bot (lib/ecobot): watches every agent on Orbio, researches what matters and
 * decides for itself what @M00FIELD posts. ECO_BOT=off|preview|on, off by default. Preview runs
 * the AI and research (that costs credits) but only saves drafts for the Status page.
 * No daily post limit (the owner's choice); posts are paced instead. Orbio itself allows an X
 * account 50 original posts a UTC day.
 */
export const ECOBOT = {
  env: "ECO_BOT",
  model: "anthropic/claude-sonnet-5.5",
  /** US dollars per token (Orbio's model catalogue, checked 2026-10-04). */
  pricePerInputToken: 0.000002,
  pricePerOutputToken: 0.00001,
  maxTokens: 900,
  temperature: 0.5,
  /** At least this long between any two posts on @M00FIELD (fixed posts included). */
  minGapMinutes: 30,
  /** Engineering limits for one run, so it can't loop forever. Not a cap on posts. */
  maxToolCalls: 6,
  budgetMs: 45_000,
  /** Signals (lib/ecobot/signals.ts). */
  floorUsd: 25_000,
  move1hPct: 25,
  move24hPct: 50,
  cooldownH: 6,
  milestonesUsd: [100_000, 250_000, 500_000, 1_000_000, 5_000_000, 10_000_000],
  nearGraduationBps: 9_000,
  hotLaunchUsd: 50_000,
  hotLaunchH: 24,
  comebackDrawdownPct: 40,
  comebackNearPct: 10,
  agentsStep: 100,
  ecoMcapMovePct: 10,
  creditMilestones: [100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000],
  digestHourUtc: 14,
  /** Signals shown to the editor per run, and hours a not-yet-posted one-off signal stays news. */
  maxSignals: 8,
  pendingTtlH: 24,
  /** Hourly price readings kept (just over a day). */
  historyHours: 26,
  recentPosts: 20,
} as const;

/** On-chain graduation log scanning. Unused while no launchpad contract is published. */
export const GRADUATION = {
  rule: "event" as "event" | "curve" | "dexPair",
  eventSignature: null as string | null,
  tokenArg: "token",
  creatorArg: "creator",
} as const;

// ---------------------------------------------------------------------------
// Scanner and caching
// ---------------------------------------------------------------------------

export const SCANNER = {
  /** Maximum block range per getLogs call. */
  blockChunk: 2_000n,
  /** Minimum time between scans. */
  intervalMs: 3 * 60_000,
} as const;

export const CACHE = {
  /** Masters list refresh interval. */
  mastersTtlMs: 3 * 60_000,
  /** Masters list is flagged stale after this age. */
  mastersStaleMs: 15 * 60_000,
  creditsTtlMs: 5 * 60_000,
  creditsStaleMs: 30 * 60_000,
  walletAgentsTtlMs: 2 * 60_000,
} as const;

// ---------------------------------------------------------------------------
// Rewards: displayed, not paid. Legal review comes before any real payout.
// ---------------------------------------------------------------------------

export const REWARDS = {
  /** Of the Orbio $CREDIT the MooBot agent receives: 20% runs the agent (taken first), 80% to the treasury. */
  agentOpsPct: 20,
  treasuryPct: 80,
  /** Round pool = min(roundPoolPctOfTreasury% of the treasury balance, roundPoolCapCredits). */
  roundPoolPctOfTreasury: 25,
  /** CONFIRM: hard cap per round, in whole $CREDIT. While null, the round pool shows "n/a". */
  roundPoolCapCredits: null as number | null,
  /** Split of each round pool. Must sum to 100. */
  roundSplit: { pitchesPct: 35, votersPct: 10, mastersPct: 10, treasuryPct: 45 },
  /** Top-3 pitches share the pitches bucket. Must sum to 100. */
  pitchPlaces: [50, 30, 20],
  /** CONFIRM: no wallet gets more than this % of the voters' bucket. */
  voterShareCapPct: 10,
  /** No payouts unless at least this many wallets voted. */
  minVoters: 5,
  /** Payouts under this many whole $CREDIT are skipped (they stay in the treasury). */
  minPayoutCredits: 100,
  /** An agent that placed in the top 3 gets `factor` of its share if it places again within `rounds` rounds. */
  repeatWinner: { rounds: 5, factor: 0.5 },
  /** A Master takes part by scoring at least this many pitches (or all, if fewer), or a tender that got a pitch. */
  mastersParticipation: { minScoredPitches: 3 },
} as const;

// ---------------------------------------------------------------------------
// Tournament and voting
// ---------------------------------------------------------------------------

export const TOURNAMENT = {
  roundLengthH: 72,
  /** A signed pitch, vote, score or tender must reach the server within this long of being signed. */
  signatureMaxAgeMs: 10 * 60_000,
  pitch: { titleMin: 6, titleMax: 80, summaryMin: 20, summaryMax: 500, demoMax: 200 },
  tender: { titleMin: 6, titleMax: 80, descriptionMin: 20, descriptionMax: 600, criteriaMax: 5, criterionMax: 40, minDays: 1, maxDays: 14, openPerMaster: 3 },
  /** Masters score pitches from 1 to scoreMax. */
  scoreMax: 10,
  /** Top places (by voting power) when a round ends: 1 is the winner, the rest are shortlisted. */
  shortlist: 3,
  /** MODERATOR_WALLETS (server-only): comma-separated wallets that may hide pitches, when signed in. */
  moderatorsEnv: "MODERATOR_WALLETS",
  /** How long the board is reused before re-reading the store. */
  boardTtlMs: 5_000,
} as const;

export const VOTING = {
  /** Configurable. Minimum $ORBIO held at the round snapshot to vote (whole tokens). The Docs read it from here. */
  minOrbio: 1_000,
  /** CONFIRM: how voting power is capped. */
  powerModel: "sqrt" as "sqrt" | "cap",
  /** CONFIRM: hard cap on voting power when powerModel === "cap" (whole tokens). */
  powerCap: 100_000,
  /** CONFIRM: optional $MOOBOT holder vote bonus (multiplier; 1 = no bonus). */
  moobotHolderBonus: 1,
} as const;

// ---------------------------------------------------------------------------
// Sign-in (signed message only)
// ---------------------------------------------------------------------------

export const AUTH = {
  /** Must appear verbatim in every sign-in message. */
  safetyLine: "This signature costs no gas and cannot move funds.",
  nonceTtlMs: 10 * 60_000,
  sessionTtlMs: 24 * 3_600_000,
} as const;

// ---------------------------------------------------------------------------
// MooBot tap system: cosmetic only
// ---------------------------------------------------------------------------

export const TAPS = {
  /** CONFIRM: taps in one session to reach Super form. */
  superThreshold: 100,
  /** CONFIRM: seconds MooBot stays in Super form. */
  superDurationS: 20,
  /** Server cap on taps per second per session. */
  maxTapsPerSecond: 10,
  /** Meter points lost per second while idle. */
  decayPerSecond: 2,
} as const;

/**
 * CONFIRM: $MOOBOT balance tiers for the holder aura (whole tokens, ascending). Cosmetic only:
 * it changes how MooBot looks, never voting power or rewards. Off until $MOOBOT is verified.
 */
export const HOLDER_AURA_TIERS = [
  { name: "Spark", minMooBot: 1 },
  { name: "Glow", minMooBot: 10_000 },
  { name: "Blaze", minMooBot: 100_000 },
  { name: "Radiant", minMooBot: 1_000_000 },
] as const;
