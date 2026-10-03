import { getPitches } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getPitches(), { headers: { "Cache-Control": "no-store" } });
}
