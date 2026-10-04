import type { Master } from "@/lib/types";

/** FNV-1a: a small, stable string hash. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Master of the day: picked automatically from the live Masters list for each UTC date. The list is
 * sorted by token address first, so every server and every visitor picks the same Master all day,
 * whatever order Orbio returns. New Masters join the rotation by themselves.
 */
export function masterOfTheDay(masters: Master[], now = Date.now()): Master | null {
  if (masters.length === 0) return null;
  const day = new Date(now).toISOString().slice(0, 10);
  const sorted = [...masters].sort((a, b) => a.tokenAddress.localeCompare(b.tokenAddress));
  return sorted[hash(`master-of-the-day:${day}`) % sorted.length];
}
