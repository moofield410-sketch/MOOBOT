import { getTournamentState } from "@/lib/tournament";

export const dynamic = "force-dynamic";

/** The running round, its snapshot block, the ranked pitches, voters, tenders and finished rounds. */
export async function GET() {
  return Response.json({ serverNow: Date.now(), ...(await getTournamentState()) }, { headers: { "Cache-Control": "no-store" } });
}
