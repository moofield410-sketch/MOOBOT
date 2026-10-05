import { CACHE, USE_MOCK_DATA } from "@/config";
import { cached, prime } from "@/lib/cache";
import { scanIfDue } from "@/lib/indexer/graduations";
import { indexerState } from "@/lib/indexer/store";
import { SAMPLE_PROFILES } from "@/lib/sample/profiles";
import { mockReader, mockTokenAddress } from "@/lib/sources/mock";
import { fetchGraduatedMasters } from "@/lib/sources/orbio-api";
import type { DataEnvelope, Master } from "@/lib/types";

/** Profile fields a Master sets about itself. Sample profiles only in mock mode. */
function withProfile(m: Master): Master {
  if (!m.isMock) return m;
  const id = Object.keys(SAMPLE_PROFILES).map(Number).find((n) => mockTokenAddress(n) === m.tokenAddress);
  const p = id === undefined ? undefined : SAMPLE_PROFILES[id];
  return p ? { ...m, description: p.description, category: p.category, openToPitches: p.openToPitches } : m;
}

/**
 * Master registry: graduated agents only.
 * Preview mode: the mock graduation scanner. Real mode: the Orbio API (server-side, cached,
 * with the last good list kept and flagged stale if Orbio is unreachable).
 */
export async function getMasters(): Promise<DataEnvelope<Master[]>> {
  return cached("masters", { ttlMs: CACHE.mastersTtlMs, staleMs: CACHE.mastersStaleMs, background: true, shared: true }, async () => {
    if (USE_MOCK_DATA) {
      await scanIfDue(mockReader);
      const masters = [...indexerState().masters.values()]
        .map(withProfile)
        .sort((a, b) => (b.graduatedAt ?? "").localeCompare(a.graduatedAt ?? ""));
      return { value: masters, source: "mock" as const };
    }
    return { value: await loadOrbioMasters(), source: "orbio" as const };
  });
}

async function loadOrbioMasters(): Promise<Master[]> {
  const { masters } = await fetchGraduatedMasters();
  return masters.sort((a, b) => (b.marketCapUsd ?? -1) - (a.marketCapUsd ?? -1));
}

/**
 * Scheduled refresh (real mode): fetches Orbio now and replaces the cached list.
 * If Orbio fails, this throws and the last good list stays in the cache.
 */
export async function refreshMasters(): Promise<number> {
  const masters = await loadOrbioMasters();
  prime("masters", masters, "orbio");
  return masters.length;
}

export async function getMaster(token: string): Promise<{ master: Master | null; meta: DataEnvelope<Master[]> }> {
  const env = await getMasters();
  const master = env.data?.find((m) => m.tokenAddress.toLowerCase() === token.toLowerCase()) ?? null;
  return { master, meta: env };
}
