import {
  AGENT_LIVE_AT,
  CHAIN,
  CONTRACTS,
  FULL_UNLOCK_AFTER_H,
  HOLDER_AURA_TIERS,
  MOOBOT_TOKEN,
  REWARDS,
  SOCIAL,
  USE_MOCK_DATA,
} from "@/config";

const sum = (v: Record<string, number> | readonly number[]) => Object.values(v).reduce((a, b) => a + b, 0);
const pctOk = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;

type RewardsConfig = {
  agentOpsPct: number;
  treasuryPct: number;
  roundPoolPctOfTreasury: number;
  roundPoolCapCredits: number | null;
  roundSplit: Record<string, number>;
  pitchPlaces: readonly number[];
  voterShareCapPct: number;
  minVoters: number;
  minPayoutCredits: number;
  repeatWinner: { rounds: number; factor: number };
  mastersParticipation: { minScoredPitches: number };
};

/** Errors in a REWARDS block. Exported separately so tests can check broken configs. */
export function rewardsErrors(r: RewardsConfig = REWARDS): string[] {
  const errors: string[] = [];
  if (r.agentOpsPct + r.treasuryPct !== 100) errors.push(`REWARDS agentOpsPct + treasuryPct is ${r.agentOpsPct + r.treasuryPct}, expected 100`);
  if (sum(r.roundSplit) !== 100) errors.push(`REWARDS.roundSplit sums to ${sum(r.roundSplit)}, expected 100`);
  if (sum(r.pitchPlaces) !== 100) errors.push(`REWARDS.pitchPlaces sums to ${sum(r.pitchPlaces)}, expected 100`);
  const pcts = [r.agentOpsPct, r.treasuryPct, r.roundPoolPctOfTreasury, r.voterShareCapPct, ...Object.values(r.roundSplit), ...r.pitchPlaces];
  if (!pcts.every(pctOk)) errors.push("Every REWARDS percentage must be between 0 and 100");
  if (r.roundPoolCapCredits !== null && !(r.roundPoolCapCredits > 0)) errors.push("REWARDS.roundPoolCapCredits must be positive or null");
  if (!(r.minVoters >= 1 && r.minPayoutCredits >= 0)) errors.push("REWARDS guards must be non-negative (minVoters >= 1)");
  if (!(r.repeatWinner.rounds >= 0 && r.repeatWinner.factor >= 0 && r.repeatWinner.factor <= 1)) {
    errors.push("REWARDS.repeatWinner.factor must be between 0 and 1");
  }
  if (!(r.mastersParticipation.minScoredPitches >= 1)) errors.push("REWARDS.mastersParticipation.minScoredPitches must be at least 1");
  return errors;
}

/** Hard errors: the config is internally inconsistent. */
export function configErrors(): string[] {
  const errors: string[] = [];
  if (Number.isNaN(Date.parse(AGENT_LIVE_AT))) errors.push("AGENT_LIVE_AT is not a valid ISO date");
  if (!(FULL_UNLOCK_AFTER_H > 0)) errors.push("FULL_UNLOCK_AFTER_H must be greater than 0");
  errors.push(...rewardsErrors());
  for (let i = 1; i < HOLDER_AURA_TIERS.length; i++) {
    if (HOLDER_AURA_TIERS[i].minMooBot <= HOLDER_AURA_TIERS[i - 1].minMooBot) {
      errors.push("HOLDER_AURA_TIERS must be strictly ascending");
    }
  }
  return errors;
}

/** CONFIRM items still unset. */
export function missingConfirmItems(): string[] {
  const missing: string[] = [];
  if (CHAIN.explorerUrl === null) missing.push("CHAIN.explorerUrl");
  if (!process.env[CHAIN.rpcUrlEnv]) missing.push(`${CHAIN.rpcUrlEnv} (env)`);
  if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) missing.push("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID (env)");
  // Under 32 characters sign-in stays off (lib/auth/session.ts), so a short one counts as missing.
  if ((process.env.SESSION_SECRET?.trim().length ?? 0) < 32) missing.push("SESSION_SECRET (env, at least 32 characters)");
  if (CONTRACTS.launchpad.length === 0) missing.push("CONTRACTS.launchpad (not published by Orbio)");
  if (!process.env[MOOBOT_TOKEN.env]?.trim()) missing.push(`${MOOBOT_TOKEN.env} (env, set on launch day)`);
  if (REWARDS.roundPoolCapCredits === null) missing.push("REWARDS.roundPoolCapCredits");
  if (!SOCIAL.x) missing.push("SOCIAL.x (the official X account, for the footer and the From X section)");
  return missing;
}

/** "live": Masters from the Orbio API and balances from the chain. "mock": sample data (preview). */
export function dataMode(): "mock" | "live" {
  return USE_MOCK_DATA ? "mock" : "live";
}
