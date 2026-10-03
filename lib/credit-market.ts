import { USE_MOCK_DATA } from "@/config";
import { SAMPLE_CREDIT_MARKET } from "@/lib/sample/credits";
import type { CreditMarket, DataEnvelope } from "@/lib/types";

/** Credit Market data. Sample data only in mock mode; otherwise "Coming soon", never invented. */
export function getCreditMarket(): DataEnvelope<CreditMarket> {
  if (!USE_MOCK_DATA) return { data: null, source: "unavailable", updatedAt: null, stale: false };
  return { data: SAMPLE_CREDIT_MARKET, source: "mock", updatedAt: new Date().toISOString(), stale: false };
}

/** Average of the last `days` entries. */
export function averagePerDay(history: { credits: number }[], days = 7): number {
  const slice = history.slice(-days);
  if (slice.length === 0) return 0;
  return Math.round(slice.reduce((s, d) => s + d.credits, 0) / slice.length);
}
