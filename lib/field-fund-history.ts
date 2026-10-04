import { kvGet, kvUpdate } from "@/lib/kv";
import { CREDIT } from "@/lib/rewards";
import type { DailyCredits } from "@/lib/types";

/**
 * Field Fund history, built automatically. Every time the site reads the MooBot agent's $CREDIT
 * from Orbio (visits, and the 3-minute scheduled refresh), the running total received is saved for
 * today's UTC date. A day's figure is that day's last total minus the previous recorded day's,
 * so nothing is estimated: days before the first snapshot simply don't appear.
 */

const KEY = "field-fund/daily-totals";
/** About a year of days. */
const KEEP_DAYS = 400;

/** UTC date → running total received ($CREDIT atoms, as a string). */
export type DailyTotals = Record<string, string>;

export const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Stores today's running total (no write when it hasn't changed). */
export async function recordFieldFundTotal(receivedAtoms: bigint, now = Date.now()): Promise<void> {
  const day = utcDay(now);
  const value = receivedAtoms.toString();
  await kvUpdate<DailyTotals>(KEY, (current) => {
    const totals = { ...(current ?? {}) };
    if (totals[day] === value) return null;
    totals[day] = value;
    const days = Object.keys(totals).sort();
    for (const old of days.slice(0, Math.max(0, days.length - KEEP_DAYS))) delete totals[old];
    return totals;
  });
}

/** Whole $CREDIT received per day, oldest first, for the last `limit` recorded days. */
export function dailyFromTotals(totals: DailyTotals, limit = 30): DailyCredits[] {
  const days = Object.keys(totals)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && /^\d+$/.test(totals[d]))
    .sort();
  const out: DailyCredits[] = [];
  for (let i = 1; i < days.length; i++) {
    const diff = BigInt(totals[days[i]]) - BigInt(totals[days[i - 1]]);
    // A total never goes down; if Orbio ever reports less, that day is shown as 0, not negative.
    out.push({ day: days[i], credits: Number((diff > 0n ? diff : 0n) / CREDIT) });
  }
  return out.slice(-limit);
}

export async function getFieldFundHistory(): Promise<DailyCredits[]> {
  return dailyFromTotals((await kvGet<DailyTotals>(KEY)) ?? {});
}
