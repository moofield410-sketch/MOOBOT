import { errorMessage, reportError } from "@/lib/monitoring";
import type { DataEnvelope, DataSourceKind } from "@/lib/types";

/**
 * In-memory read-through cache with last-known-good fallback.
 * Swap for Redis/KV later; the DataEnvelope contract stays the same.
 */

interface Entry {
  value: unknown;
  source: DataSourceKind;
  fetchedAt: number;
}

const g = globalThis as unknown as { __moobotCache?: Map<string, Entry> };
const store = (g.__moobotCache ??= new Map());

export interface CacheOptions {
  ttlMs: number;
  staleMs: number;
  now?: () => number;
}

export async function cached<T>(
  key: string,
  opts: CacheOptions,
  loader: () => Promise<{ value: T; source: DataSourceKind }>,
): Promise<DataEnvelope<T>> {
  const now = opts.now ?? Date.now;
  const hit = store.get(key);

  if (hit && now() - hit.fetchedAt < opts.ttlMs) {
    return envelope<T>(hit, now(), opts.staleMs);
  }

  try {
    const { value, source } = await loader();
    const entry: Entry = { value, source, fetchedAt: now() };
    store.set(key, entry);
    return envelope<T>(entry, now(), opts.staleMs);
  } catch (err) {
    reportError(err, { cacheKey: key });
    if (hit) return { ...envelope<T>(hit, now(), opts.staleMs), stale: true, error: errorMessage(err) };
    return { data: null, source: "unavailable", updatedAt: null, stale: true, error: errorMessage(err) };
  }
}

function envelope<T>(e: Entry, now: number, staleMs: number): DataEnvelope<T> {
  return {
    data: e.value as T,
    source: e.source,
    updatedAt: new Date(e.fetchedAt).toISOString(),
    stale: now - e.fetchedAt > staleMs,
  };
}

/** Stores a freshly loaded value (for scheduled refreshes), keeping the same envelope rules. */
export function prime(key: string, value: unknown, source: DataSourceKind, now: () => number = Date.now): void {
  store.set(key, { value, source, fetchedAt: now() });
}

export function invalidate(key: string): void {
  store.delete(key);
}

export function clearCache(): void {
  store.clear();
}
