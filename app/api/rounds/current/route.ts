import { currentRound } from "@/lib/rounds";
import { getSchedule } from "@/lib/schedule";
import { serverTimeline } from "@/lib/timeline.server";
import { getPastRounds } from "@/lib/tournament";

export const dynamic = "force-dynamic";

/**
 * Current round state from the server clock, plus the most recent finished round.
 * Pitches and votes are accepted while a round is live (signed messages, see /api/tournament).
 */
export async function GET() {
  const now = Date.now();
  const timeline = serverTimeline();
  const past = await getPastRounds();
  const live = currentRound(now, timeline).status === "live";
  return Response.json(
    {
      serverNow: now,
      tournamentUnlocked: getSchedule(now, timeline).features.votingOpen,
      pitchSubmission: live ? "open" : "not-open-yet",
      voteSubmission: live ? "open" : "not-open-yet",
      round: currentRound(now, timeline),
      lastRound: past.data?.[0] ?? null,
      source: past.source,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
