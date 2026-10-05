/**
 * A small per-server-instance rate limiter (a sliding window in memory). SERVER-SIDE ONLY. It
 * can't see other instances, so it isn't a hard global limit, but it stops one connection from
 * hammering the expensive paths (fresh chain reads) through the instance it's talking to.
 */

const g = globalThis as unknown as { __moofieldRate?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__moofieldRate ??= new Map());

/** True if `key` may do one more thing now: at most `max` in the last `windowMs`. */
export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep memory bounded: forget the oldest keys when there are too many.
  if (hits.size > 20_000) for (const k of [...hits.keys()].slice(0, 5_000)) hits.delete(k);
  return true;
}

/** The visitor's IP as Netlify reports it. */
export function clientIp(req: Request): string {
  return req.headers.get("x-nf-client-connection-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
