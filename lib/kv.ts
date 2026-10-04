import { getStore } from "@netlify/blobs";
import { reportError } from "@/lib/monitoring";

/**
 * A tiny persistent JSON store. SERVER-SIDE ONLY. On Netlify it is Netlify Blobs (built in, no
 * setup, shared by every server instance and kept across deploys). Anywhere else (local dev,
 * tests) it falls back to memory, so nothing breaks without Netlify; it just isn't kept.
 */

const STORE = "moofield";

const g = globalThis as unknown as { __moofieldKv?: Map<string, unknown>; __moofieldKvMode?: "blobs" | "memory" };
const memory = (g.__moofieldKv ??= new Map());

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
    return;
  }
  await store.setJSON(key, value);
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
}
