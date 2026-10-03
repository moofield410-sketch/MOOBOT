import { AGENT_LIVE_AT, FULL_UNLOCK_AFTER_H } from "@/config";
import { buildTimeline, HOUR_MS, type Timeline } from "@/lib/schedule";

/**
 * Server-side timeline. In development you can dry-run the schedule on a short
 * clock with DEV_AGENT_LIVE_AT and DEV_HOUR_MS (see .env.example). Both are ignored in production.
 */

const g = globalThis as unknown as { __moobotDevStart?: number };

export function serverTimeline(): Timeline {
  const isProd = process.env.NODE_ENV === "production";
  let agentLiveAt = Date.parse(AGENT_LIVE_AT);
  let hourMs = HOUR_MS;

  if (!isProd) {
    const devLive = process.env.DEV_AGENT_LIVE_AT;
    if (devLive === "now") {
      g.__moobotDevStart ??= Date.now();
      agentLiveAt = g.__moobotDevStart;
    } else if (devLive) {
      agentLiveAt = Date.parse(devLive);
    }
    const devHour = Number(process.env.DEV_HOUR_MS);
    if (Number.isFinite(devHour) && devHour > 0) hourMs = devHour;
  }

  return buildTimeline(agentLiveAt, FULL_UNLOCK_AFTER_H, hourMs);
}
