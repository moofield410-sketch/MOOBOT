import { getLeaderboard } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getLeaderboard(), { headers: { "Cache-Control": "no-store" } });
}
