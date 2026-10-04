import { getStore } from "@netlify/blobs";
import { reportError } from "@/lib/monitoring";

/**
 * A tiny persistent JSON store. SERVER-SIDE ONLY. On Netlify it is Netlify Blobs (built in, no
 * setup, shared by every server instance and kept across deploys). Anywhere else (local dev,
 * tests) it falls back to memory, so nothing breaks without Netlify; it just isn't kept.
 */

const STORE = "moofield";

const g = globalThis as unknown as {
  __moofieldKv?: Map<string, unknown>;
  __moofieldKvVersions?: Map<string, number>;
  __moofieldKvMode?: "blobs" | "memory";
};
const memory = (g.__moofieldKv ??= new Map());
/** Memory mode's stand-in for Blobs etags: a version number per key. */
const versions = (g.__moofieldKvVersions ??= new Map());

function blobs() {
  if (g.__moofieldKvMode === "memory") return null;
  try {
    const store = getStore({ name: STORE, consistency: "strong" });
    g.__moofieldKvMode = "blobs";
    return store;
  } catch (err) {
    // MissingBlobsEnvironmentError: not running on Netlify. Use memory from now on.
    if (err instanceof Error && err.name === "MissingBlobsEnvironmentError") {
      g.__moofieldKvMode = "memory";
      return null;
    }
    throw err;
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const store = blobs();
  if (!store) return (memory.get(key) as T | undefined) ?? null;
  return ((await store.get(key, { type: "json" })) as T | null) ?? null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const store = blobs();
  if (!store) {
    memory.set(key, structuredClone(value));
    versions.set(key, (versions.get(key) ?? 0) + 1);
    return;
  }
  await store.setJSON(key, value);
}

/** "blobs" on Netlify, "memory" anywhere else (nothing is kept across restarts there). */
export function kvMode(): "blobs" | "memory" {
  blobs();
  return g.__moofieldKvMode ?? "memory";
}

/** A value with its version tag (a Blobs etag), for a conditional write. etag is null when the key doesn't exist. */
export async function kvGetVersioned<T>(key: string): Promise<{ value: T | null; etag: string | null }> {
  const store = blobs();
  if (!store) {
    if (!memory.has(key)) return { value: null, etag: null };
    return { value: structuredClone(memory.get(key)) as T, etag: String(versions.get(key) ?? 0) };
  }
  const hit = await store.getWithMetadata(key, { type: "json" });
  return hit ? { value: hit.data as T, etag: hit.etag ?? null } : { value: null, etag: null };
}

/**
 * Writes only if nobody changed the key since it was read: `etag` from kvGetVersioned, or null to
 * write only if the key doesn't exist yet. Returns false (nothing written) if someone got there first.
 */
export async function kvSetIf(key: string, value: unknown, etag: string | null): Promise<boolean> {
  const store = blobs();
  if (!store) {
    const current = memory.has(key) ? String(versions.get(key) ?? 0) : null;
    if (current !== etag) return false;
    memory.set(key, structuredClone(value));
    versions.set(key, (versions.get(key) ?? 0) + 1);
    return true;
  }
  const res = etag === null ? await store.setJSON(key, value, { onlyIfNew: true }) : await store.setJSON(key, value, { onlyIfMatch: etag });
  return res.modified;
}

export class KvConflictError extends Error {
  constructor(key: string) {
    super(`Too many people changed ${key} at once. Please try again.`);
    this.name = "KvConflictError";
  }
}

/**
 * Safe read-modify-write for a value many people change at once (compare-and-swap). `update` gets
 * the current value and returns the new one plus a result, or throws to refuse the change. If
 * someone else wrote in between, it re-reads and runs `update` again, so every rule check inside
 * it always sees the latest value.
 */
export async function kvCas<T, R>(key: string, update: (current: T | null) => { value: T; result: R }, tries = 8): Promise<R> {
  for (let i = 0; i < tries; i++) {
    const { value, etag } = await kvGetVersioned<T>(key);
    const next = update(value);
    if (await kvSetIf(key, next.value, etag)) return next.result;
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 60 * (i + 1)));
  }
  throw new KvConflictError(key);
}

/** Read-modify-write that never throws: a failed write is logged and the site carries on. */
export async function kvUpdate<T>(key: string, update: (current: T | null) => T | null): Promise<void> {
  try {
    const current = await kvGet<T>(key);
    const next = update(current);
    if (next !== null) await kvSet(key, next);
  } catch (err) {
    reportError(err, { kvKey: key });
  }
}

/** Test helper. */
export function kvClearMemory() {
  memory.clear();
  versions.clear();
}
