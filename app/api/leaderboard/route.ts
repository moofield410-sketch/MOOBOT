import { getLeaderboard } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getLeaderboard(), { headers: { "Cache-Control": "no-store" } });
}
