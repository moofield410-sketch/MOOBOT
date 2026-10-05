import { after } from "next/server.js";
import { kvClearMemory, kvGet, kvMode, kvSet } from "@/lib/kv";
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
  /**
   * Stale-while-revalidate: once the value is older than ttlMs (but not yet staleMs), serve it at
   * once and reload it in the background, so no visitor waits on a slow source (Orbio's full
   * agent list takes many seconds). For data where seconds matter (the Tournament board), leave it off.
   */
  background?: boolean;
  /**
   * Also keep the last good value in the shared store (Netlify Blobs), so a server instance that
   * has just started (empty memory) reads it in a fraction of a second instead of reloading it
   * from the source. Values must be plain JSON.
   */
  shared?: boolean;
}

const sharedKey = (key: string) => `cache:${key}`;

/** Saves an entry for every instance; a failed save only costs the next instance a reload. */
async function share(key: string, entry: Entry): Promise<void> {
  try {
    await kvSet(sharedKey(key), entry);
  } catch (err) {
    reportError(err, { cacheKey: key, shared: "write" });
  }
}

/** Keys being reloaded in the background right now, so one slow reload isn't started twice. */
const reloading = new Set<string>();

/** Runs `work` after the response is sent when inside a request; anywhere else, just starts it. */
function later(work: () => Promise<void>): void {
  try {
    after(work);
  } catch {
    void work();
  }
}

export async function cached<T>(
  key: string,
  opts: CacheOptions,
  loader: () => Promise<{ value: T; source: DataSourceKind }>,
): Promise<DataEnvelope<T>> {
  const now = opts.now ?? Date.now;
  let hit = store.get(key);
  // A fresh instance: take the last good value another instance saved, if it isn't too old.
  if (!hit && opts.shared) {
    const saved = await kvGet<Entry>(sharedKey(key)).catch(() => null);
    if (saved && typeof saved.fetchedAt === "number" && now() - saved.fetchedAt < opts.staleMs) {
      store.set(key, saved);
      hit = saved;
    }
  }

  if (hit && now() - hit.fetchedAt < opts.ttlMs) {
    return envelope<T>(hit, now(), opts.staleMs);
  }

  if (opts.background && hit && now() - hit.fetchedAt < opts.staleMs) {
    if (!reloading.has(key)) {
      reloading.add(key);
      later(async () => {
        try {
          const { value, source } = await loader();
          const entry: Entry = { value, source, fetchedAt: now() };
          store.set(key, entry);
          if (opts.shared) await share(key, entry);
        } catch (err) {
          reportError(err, { cacheKey: key, background: true });
        } finally {
          reloading.delete(key);
        }
      });
    }
    return envelope<T>(hit, now(), opts.staleMs);
  }

  try {
    const { value, source } = await loader();
    const entry: Entry = { value, source, fetchedAt: now() };
    store.set(key, entry);
    if (opts.shared) await share(key, entry);
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

/** Forgets this instance's memory only (like a freshly started server); shared copies stay. For tests. */
export function clearLocalCache(): void {
  store.clear();
  reloading.clear();
}

export function clearCache(): void {
  store.clear();
  reloading.clear();
  // Tests and local runs: the shared copies live in KV memory there, and must go too.
  if (kvMode() === "memory") kvClearMemory();
}
