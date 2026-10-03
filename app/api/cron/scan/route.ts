import { USE_MOCK_DATA } from "@/config";
import { invalidate } from "@/lib/cache";
import { scanIfDue } from "@/lib/indexer/graduations";
import { errorMessage } from "@/lib/monitoring";
import { refreshMasters } from "@/lib/registry";
import { mockReader } from "@/lib/sources/mock";

export const dynamic = "force-dynamic";

/**
 * Forced refresh of the Masters list. On Netlify the scheduled function
 * netlify/functions/refresh-orbio.mjs calls it every 3 minutes (schedule in netlify.toml). Without
 * it the list still refreshes on demand, when a visitor loads it and the cached copy is older than
 * CACHE.mastersTtlMs. In production it requires Authorization: Bearer <CRON_SECRET>.
 * Real mode: refreshes graduated agents from the Orbio API. Preview mode: runs the mock scanner.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    if (!USE_MOCK_DATA) {
      const masters = await refreshMasters();
      return Response.json({ ok: true, source: "orbio", masters });
    }
    const result = await scanIfDue(mockReader, true);
    if (result && result.added > 0) invalidate("masters");
    return Response.json({ ok: true, source: "mock", added: result?.added ?? 0 });
  } catch (err) {
    return Response.json({ ok: false, error: errorMessage(err) }, { status: 502 });
  }
}
