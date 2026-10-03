import { getCredits } from "@/lib/credits";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getCredits(), { headers: { "Cache-Control": "no-store" } });
}
