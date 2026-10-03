/**
 * Schedule. Pure functions only, shared by the server and the browser.
 * Everything derives from the agent go-live time and the hours until the full unlock.
 * The browser never trusts its own clock: it passes in the server-corrected time.
 */

export type Stage = "warmup" | "agentLive" | "fullUnlock";

export interface Timeline {
  agentLiveAt: number;
  fullUnlockAt: number;
}

export interface Features {
  mastersVisible: boolean;
  creditDataVisible: boolean;
  moobotAwake: boolean;
  registrationOpen: boolean;
  votingVisible: boolean;
  votingOpen: boolean;
  rewardsLedgerOpen: boolean;
  creditMarketOpen: boolean;
}

export interface ScheduleState {
  stage: Stage;
  /** Timestamp of the next milestone, or null after the full unlock. */
  nextAt: number | null;
  nextLabel: string | null;
  msRemaining: number;
  features: Features;
}

export const HOUR_MS = 3_600_000;

export function buildTimeline(agentLiveAtMs: number, fullUnlockAfterH: number, hourMs: number = HOUR_MS): Timeline {
  if (!Number.isFinite(agentLiveAtMs)) throw new Error("AGENT_LIVE_AT is not a valid date");
  if (!(fullUnlockAfterH > 0)) throw new Error("FULL_UNLOCK_AFTER_H must be greater than 0");
  return { agentLiveAt: agentLiveAtMs, fullUnlockAt: agentLiveAtMs + fullUnlockAfterH * hourMs };
}

export function getStage(now: number, t: Timeline): Stage {
  if (now < t.agentLiveAt) return "warmup";
  if (now < t.fullUnlockAt) return "agentLive";
  return "fullUnlock";
}

/**
 * Only Tournament features (pitching, voting, rewards ledger) wait for the full unlock.
 * Masters, credit data and the Credit Market are open from the start.
 */
export function featuresFor(stage: Stage): Features {
  const live = stage !== "warmup";
  const full = stage === "fullUnlock";
  return {
    mastersVisible: true,
    creditDataVisible: true,
    moobotAwake: live,
    registrationOpen: full,
    votingVisible: live,
    votingOpen: full,
    rewardsLedgerOpen: full,
    creditMarketOpen: true,
  };
}

const NEXT: Record<Stage, { key: keyof Timeline; label: string } | null> = {
  warmup: { key: "agentLiveAt", label: "Go-live" },
  agentLive: { key: "fullUnlockAt", label: "The Tournament opens" },
  fullUnlock: null,
};

export function getSchedule(now: number, t: Timeline): ScheduleState {
  const stage = getStage(now, t);
  const next = NEXT[stage];
  const nextAt = next ? t[next.key] : null;
  return {
    stage,
    nextAt,
    nextLabel: next?.label ?? null,
    msRemaining: nextAt === null ? 0 : Math.max(0, nextAt - now),
    features: featuresFor(stage),
  };
}

/** "2d 04:05:06" or "04:05:06". */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3_600);
  const m = Math.floor((total % 3_600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const hms = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

/**
 * Clock offset from one request round trip (NTP-style midpoint).
 * correctedNow = Date.now() + offset
 */
export function clockOffset(sentAt: number, receivedAt: number, serverNow: number): number {
  return serverNow - (sentAt + receivedAt) / 2;
}
