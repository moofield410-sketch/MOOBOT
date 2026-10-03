import { FULL_UNLOCK_AFTER_H, TOURNAMENT } from "@/config";
import type { Timeline } from "@/lib/schedule";

/**
 * Tournament round clock, derived from the schedule (pure, client-safe).
 * Round 1 starts at the full unlock and each round lasts TOURNAMENT.roundLengthH.
 * The hour length is read from the timeline, so the dev dry-run clock compresses rounds too.
 */

export interface RoundState {
  status: "upcoming" | "live";
  number: number;
  startsAt: number;
  endsAt: number;
  /** What the countdown points at: round start while upcoming, round end while live. */
  countdownTo: number;
  msRemaining: number;
}

export function roundLengthMs(t: Timeline): number {
  const hourMs = (t.fullUnlockAt - t.agentLiveAt) / FULL_UNLOCK_AFTER_H;
  return TOURNAMENT.roundLengthH * hourMs;
}

export function currentRound(now: number, t: Timeline): RoundState {
  const len = roundLengthMs(t);
  if (now < t.fullUnlockAt) {
    return {
      status: "upcoming",
      number: 1,
      startsAt: t.fullUnlockAt,
      endsAt: t.fullUnlockAt + len,
      countdownTo: t.fullUnlockAt,
      msRemaining: t.fullUnlockAt - now,
    };
  }
  const index = Math.floor((now - t.fullUnlockAt) / len);
  const startsAt = t.fullUnlockAt + index * len;
  const endsAt = startsAt + len;
  return { status: "live", number: index + 1, startsAt, endsAt, countdownTo: endsAt, msRemaining: endsAt - now };
}
