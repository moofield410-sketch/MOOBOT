import { getMasters } from "@/lib/registry";

export const dynamic = "force-dynamic";

/** Graduated agents (Masters): the Orbio API with real data, the mock scanner in preview mode. */
export async function GET() {
  return Response.json(await getMasters(), { headers: { "Cache-Control": "no-store" } });
}
