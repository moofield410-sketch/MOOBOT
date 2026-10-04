import { getPitches } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getPitches(), { headers: { "Cache-Control": "no-store" } });
}
