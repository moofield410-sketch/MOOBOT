import { getTenders } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getTenders(), { headers: { "Cache-Control": "no-store" } });
}
