import { getStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

/** RPC health, indexer lag and last graduation scan. */
export async function GET() {
  return Response.json(await getStatus(), { headers: { "Cache-Control": "no-store" } });
}
