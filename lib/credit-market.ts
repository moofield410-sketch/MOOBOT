import { USE_MOCK_DATA } from "@/config";
import { getFieldFundHistory } from "@/lib/field-fund-history";
import { SAMPLE_CREDIT_MARKET } from "@/lib/sample/credits";
import type { CreditMarket, DataEnvelope } from "@/lib/types";

/**
 * Credit Market data. Preview mode: sample data. Real mode: the daily history the site records by
 * itself (lib/field-fund-history.ts); "unavailable" until there are two recorded days. Never invented.
 */
export async function getCreditMarket(): Promise<DataEnvelope<CreditMarket>> {
  if (USE_MOCK_DATA) return { data: SAMPLE_CREDIT_MARKET, source: "mock", updatedAt: new Date().toISOString(), stale: false };
  const history = await getFieldFundHistory().catch(() => []);
  if (history.length === 0) return { data: null, source: "unavailable", updatedAt: null, stale: false };
  return {
    data: { history, received24h: history.at(-1)?.credits ?? 0, movements: [] },
    source: "orbio",
    updatedAt: new Date().toISOString(),
    stale: false,
  };
}

/** Average of the last `days` entries. */
export function averagePerDay(history: { credits: number }[], days = 7): number {
  const slice = history.slice(-days);
  if (slice.length === 0) return 0;
  return Math.round(slice.reduce((s, d) => s + d.credits, 0) / slice.length);
}
