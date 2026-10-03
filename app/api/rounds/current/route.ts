import { currentRound } from "@/lib/rounds";
import { getSchedule } from "@/lib/schedule";
import { serverTimeline } from "@/lib/timeline.server";
import { getPastRounds } from "@/lib/tournament";

export const dynamic = "force-dynamic";

/**
 * Current round state from the server clock, plus the most recent finished round.
 * `tournamentUnlocked` is the schedule only: pitch and vote submission are not built yet,
 * which `pitchSubmission` / `voteSubmission` state explicitly.
 */
export function GET() {
  const now = Date.now();
  const timeline = serverTimeline();
  const past = getPastRounds();
  return Response.json(
    {
      serverNow: now,
      tournamentUnlocked: getSchedule(now, timeline).features.votingOpen,
      pitchSubmission: "planned",
      voteSubmission: "planned",
      round: currentRound(now, timeline),
      lastRound: past.data?.[0] ?? null,
      source: past.source,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
