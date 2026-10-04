import { ECOBOT } from "@/config";
import type { OrbioAgent } from "@/lib/sources/orbio-api";

/**
 * The Eco Bot's own price history for every agent on Orbio: the first reading of each UTC hour,
 * for just over a day. Orbio's list gives today's price only, and the per-agent chart would mean a
 * thousand requests, so the bot keeps this itself (in KV, one small record).
 */

/** One agent as the bot sees it. */
export interface AgentRow {
  token: string;
  agentId: string;
  name: string | null;
  symbol: string | null;
  priceMicro: number | null;
  mcapUsd: number | null;
  graduated: boolean;
  /** Launch time, ms. */
  launchedAt: number | null;
  /** X handle from Orbio's socials, checked; null if none or not a plain handle. */
  handle: string | null;
}

const NOT_HANDLES = new Set(["i", "home", "intent", "search", "share", "hashtag", "explore", "settings"]);

/** "https://x.com/errandboard/status/1" or "@errandboard" → "errandboard". Anything else → null. */
export function xHandle(link: string | null): string | null {
  if (!link) return null;
  const s = link.trim();
  const m = s.match(/^@?([A-Za-z0-9_]{1,15})$/) ?? s.match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?:[/?#]|$)/i);
  const h = m?.[1] ?? null;
  return h && !NOT_HANDLES.has(h.toLowerCase()) ? h : null;
}

export function toRow(a: OrbioAgent): AgentRow {
  const price = a.price?.priceMicroUsd ? Number(a.price.priceMicroUsd) : NaN;
  const mcap = a.price?.marketCapMicroUsd ? Number(a.price.marketCapMicroUsd) / 1e6 : NaN;
  const launched = Number(a.launchedAt);
  return {
    token: a.token,
    agentId: a.agentId,
    name: a.name,
    symbol: a.symbol,
    priceMicro: Number.isFinite(price) && price > 0 ? price : null,
    mcapUsd: Number.isFinite(mcap) && mcap > 0 ? mcap : null,
    graduated: a.price?.graduated === true,
    launchedAt: Number.isFinite(launched) && launched > 0 ? launched * 1000 : null,
    handle: xHandle(a.twitter),
  };
}

export interface History {
  /** UTC hour ids ("2026-10-04T12"), oldest first, and when each was read (ms). */
  hours: string[];
  times: number[];
  /** Price (micro-USD) per token per hour, aligned with `hours`. null = no reading. */
  price: Record<string, (number | null)[]>;
}

export const emptyHistory = (): History => ({ hours: [], times: [], price: {} });

/** The key the whole ecosystem's combined market cap is kept under, next to the tokens. */
export const ECO_KEY = "__eco_mcap";

/**
 * Adds this run's readings. A new hour gets a new column (the first reading of that hour is kept,
 * so the gaps between columns are close to an hour); old columns beyond ECOBOT.historyHours drop off.
 */
export function updateHistory(h: History, readings: Record<string, number | null>, now: number): History {
  const hour = new Date(now).toISOString().slice(0, 13);
  if (h.hours[h.hours.length - 1] === hour) {
    // Same hour: only fill in tokens that had no reading yet this hour.
    const i = h.hours.length - 1;
    const price = { ...h.price };
    for (const [t, p] of Object.entries(readings)) {
      const row = price[t] ?? Array(h.hours.length).fill(null);
      if (row[i] == null && p != null) price[t] = [...row.slice(0, i), p];
      else price[t] = row;
    }
    return { ...h, price };
  }
  const keep = Math.max(0, h.hours.length + 1 - ECOBOT.historyHours);
  const hours = [...h.hours.slice(keep), hour];
  const times = [...h.times.slice(keep), now];
  const price: Record<string, (number | null)[]> = {};
  for (const t of new Set([...Object.keys(h.price), ...Object.keys(readings)])) {
    const old = (h.price[t] ?? Array(h.hours.length).fill(null)).slice(keep);
    const row = [...old, readings[t] ?? null];
    if (row.some((v) => v != null)) price[t] = row;
  }
  return { hours, times, price };
}

/**
 * Percent change of `current` against the reading taken closest to `hoursAgo` hours ago, if there is
 * one within `toleranceH`. Also returns how long ago that reading really was, to say it honestly.
 */
export function changeSince(h: History, token: string, current: number | null, hoursAgo: number, now: number, toleranceH = hoursAgo * 0.35): { pct: number; spanMin: number } | null {
  const row = h.price[token];
  if (!row || current == null) return null;
  const target = now - hoursAgo * 3_600_000;
  let best = -1;
  for (let i = 0; i < h.times.length; i++) {
    if (row[i] == null || now - h.times[i] < 30 * 60_000) continue;
    if (best < 0 || Math.abs(h.times[i] - target) < Math.abs(h.times[best] - target)) best = i;
  }
  if (best < 0 || Math.abs(h.times[best] - target) > toleranceH * 3_600_000) return null;
  const then = row[best]!;
  return then > 0 ? { pct: ((current - then) / then) * 100, spanMin: Math.round((now - h.times[best]) / 60_000) } : null;
}

/** The deepest fall from an earlier high in the last day: the high, and how far it fell (percent). */
export function drawdown(h: History, token: string): { peak: number; fallPct: number } | null {
  const row = h.price[token];
  if (!row) return null;
  let peak = 0;
  let worst: { peak: number; fallPct: number } | null = null;
  for (const v of row) {
    if (v == null) continue;
    if (v > peak) peak = v;
    else if (peak > 0) {
      const fall = ((peak - v) / peak) * 100;
      if (!worst || fall > worst.fallPct) worst = { peak, fallPct: fall };
    }
  }
  return worst;
}
