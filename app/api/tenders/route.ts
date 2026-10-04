import { getTenders } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getTenders(), { headers: { "Cache-Control": "no-store" } });
}
