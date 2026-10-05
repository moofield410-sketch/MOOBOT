import { ORBIO_API } from "@/config";
import { cached } from "@/lib/cache";
import { defaultFetcher, fetchAnalytics, type Fetcher, type OrbioTotals } from "@/lib/sources/orbio-api";
import type { DataEnvelope } from "@/lib/types";

/**
 * Orbio at a glance: totals across every agent on the launchpad, from Orbio's public analytics
 * (no key, no credits). SERVER-SIDE ONLY. Works before $MOOBOT launches; cached for everyone.
 */
export function getOrbioTotals(fetcher: Fetcher = defaultFetcher, now?: () => number): Promise<DataEnvelope<OrbioTotals>> {
  return cached<OrbioTotals>("orbio:analytics", { ttlMs: ORBIO_API.analyticsTtlMs, staleMs: ORBIO_API.analyticsStaleMs, now, background: true, shared: true }, async () => ({
    value: await fetchAnalytics(fetcher),
    source: "orbio",
  }));
}
