import { ECOBOT } from "@/config";
import { changeSince, drawdown, ECO_KEY, type AgentRow, type History } from "@/lib/ecobot/history";
import type { OrbioTotals } from "@/lib/sources/orbio-api";

/**
 * What might be worth a post, found by fixed rules from Orbio's data. The editor (agent.ts) then
 * decides what, if anything, to post. Every signal has a key: one-off news ("grad:0x…") waits in
 * `pending` until posted, passed on or stale; recurring ones ("move:0x…:up") are rechecked every run
 * and rest for a cooldown after use. The very first run only records where things stand.
 */

export type SignalKind =
  | "mover"
  | "milestone"
  | "graduation"
  | "near-graduation"
  | "hot-launch"
  | "top10"
  | "comeback"
  | "eco"
  | "digest";

export interface Signal {
  key: string;
  kind: SignalKind;
  /** Higher = more newsworthy. */
  score: number;
  token?: string;
  /** What the editor sees: plain numbers and names, already rounded. */
  facts: Record<string, string | number | boolean | null>;
  /** Recurring signals rest this long after use; one-off ones (no cooldown) are posted once. */
  cooldownH?: number;
}

export interface BotState {
  initializedAt: number | null;
  graduated: string[];
  top10: string[];
  /** Highest market cap milestone (index into ECOBOT.milestonesUsd) each token has reached. */
  milestone: Record<string, number>;
  nearGraduation: string[];
  hotLaunch: string[];
  agentsLevel: number;
  creditLevel: number;
  recordLaunches: number;
  lastDigestDay: string | null;
  /** One-off signals not posted yet, with when they were found. */
  pending: Record<string, { signal: Signal; at: number }>;
  /** Recurring signal keys resting until this time (ms). */
  cooldown: Record<string, number>;
}

export const emptyState = (): BotState => ({
  initializedAt: null,
  graduated: [],
  top10: [],
  milestone: {},
  nearGraduation: [],
  hotLaunch: [],
  agentsLevel: 0,
  creditLevel: -1,
  recordLaunches: 0,
  lastDigestDay: null,
  pending: {},
  cooldown: {},
});

export interface SignalInput {
  rows: AgentRow[];
  history: History;
  state: BotState;
  totals: OrbioTotals | null;
  /** Confirmed graduated tokens (the site's Masters list), or null if unavailable this run. */
  graduated: string[] | null;
  /** Bonding-curve progress (basis points) for the tokens checked this run. */
  curve: Record<string, number>;
  now: number;
}

const usd = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K` : `$${n.toFixed(0)}`;
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(n >= 100 || n <= -100 ? 0 : 1)}%`;
const span = (min: number) => (min < 90 ? `${min} min` : `${(min / 60).toFixed(min < 600 ? 1 : 0)} h`);
const price = (micro: number) => {
  const v = micro / 1e6;
  return v >= 1 ? `$${v.toFixed(2)}` : `$${v.toPrecision(3)}`;
};

function tokenFacts(r: AgentRow): Signal["facts"] {
  return {
    token: r.token,
    name: r.name,
    symbol: r.symbol,
    marketCap: r.mcapUsd != null ? usd(r.mcapUsd) : null,
    price: r.priceMicro != null ? price(r.priceMicro) : null,
    graduated: r.graduated,
    hasXAccount: r.handle !== null,
  };
}

/** How much a market cap counts towards newsworthiness: 1 at the floor, rising slowly. */
const weight = (mcap: number) => 1 + Math.log10(Math.max(1, mcap / ECOBOT.floorUsd));

export function detectSignals(input: SignalInput): { signals: Signal[]; state: BotState } {
  const { rows, history: h, totals, now } = input;
  const state: BotState = structuredClone(input.state);
  const day = new Date(now).toISOString().slice(0, 10);
  const priced = rows.filter((r) => r.mcapUsd != null && r.priceMicro != null);
  const top10 = [...priced].sort((a, b) => b.mcapUsd! - a.mcapUsd!).slice(0, 10).map((r) => r.token);
  const level = (mcap: number) => ECOBOT.milestonesUsd.reduce((lv, m, i) => (mcap >= m ? i : lv), -1);
  const creditClaimed = totals?.creditClaimedAtoms ? Number(totals.creditClaimedAtoms) / 1e6 : null;
  const creditLevel = (c: number) => ECOBOT.creditMilestones.reduce((lv, m, i) => (c >= m ? i : lv), -1);

  // First run: remember where everything stands, announce nothing.
  if (state.initializedAt === null) {
    state.initializedAt = now;
    state.graduated = input.graduated ?? rows.filter((r) => r.graduated).map((r) => r.token);
    state.top10 = top10;
    for (const r of priced) state.milestone[r.token] = level(r.mcapUsd!);
    state.nearGraduation = Object.entries(input.curve).filter(([, bps]) => bps >= ECOBOT.nearGraduationBps).map(([t]) => t);
    state.hotLaunch = priced.filter((r) => r.mcapUsd! >= ECOBOT.hotLaunchUsd).map((r) => r.token);
    state.agentsLevel = Math.floor((totals?.agents ?? 0) / ECOBOT.agentsStep);
    state.creditLevel = creditClaimed != null ? creditLevel(creditClaimed) : -1;
    state.recordLaunches = Math.max(0, ...(totals?.launchesByDay.map((d) => d.launches) ?? []));
    state.lastDigestDay = new Date(now).getUTCHours() >= ECOBOT.digestHourUtc ? day : null;
    return { signals: [], state };
  }

  const once = (s: Signal) => {
    if (!state.pending[s.key]) state.pending[s.key] = { signal: s, at: now };
  };
  const recurring: Signal[] = [];
  const resting = (key: string) => (state.cooldown[key] ?? 0) > now;

  for (const r of priced) {
    const mcap = r.mcapUsd!;
    const facts = tokenFacts(r);

    // Big moves, on tokens big enough to matter (now or before the move).
    const c1 = changeSince(h, r.token, r.priceMicro, 1, now);
    const c24 = changeSince(h, r.token, r.priceMicro, 24, now, 4);
    const best = [
      c1 && Math.abs(c1.pct) >= ECOBOT.move1hPct ? { ...c1, strength: Math.abs(c1.pct) / ECOBOT.move1hPct } : null,
      c24 && Math.abs(c24.pct) >= ECOBOT.move24hPct ? { ...c24, strength: Math.abs(c24.pct) / ECOBOT.move24hPct } : null,
    ]
      .filter((x) => x !== null)
      .sort((a, b) => b.strength - a.strength)[0];
    if (best) {
      const before = mcap / (1 + best.pct / 100);
      if (Math.max(mcap, before) >= ECOBOT.floorUsd) {
        const key = `move:${r.token}:${best.pct > 0 ? "up" : "down"}`;
        if (!resting(key)) {
          recurring.push({
            key,
            kind: "mover",
            score: 4 * best.strength * weight(Math.max(mcap, before)),
            token: r.token,
            facts: { ...facts, change: pct(best.pct), over: span(best.spanMin), change1h: c1 ? pct(c1.pct) : null, change24h: c24 ? pct(c24.pct) : null, marketCapBefore: usd(before) },
            cooldownH: ECOBOT.cooldownH,
          });
        }
      }
    }

    // First time over a market cap milestone.
    const lv = level(mcap);
    if (lv > (state.milestone[r.token] ?? -1)) {
      if (mcap >= ECOBOT.floorUsd) once({ key: `mcap:${r.token}:${lv}`, kind: "milestone", score: 6 + lv, token: r.token, facts: { ...facts, milestone: usd(ECOBOT.milestonesUsd[lv]) } });
      state.milestone[r.token] = lv;
    }

    // A young token that is already big.
    if (r.launchedAt && now - r.launchedAt < ECOBOT.hotLaunchH * 3_600_000 && mcap >= ECOBOT.hotLaunchUsd && !state.hotLaunch.includes(r.token)) {
      once({ key: `hot:${r.token}`, kind: "hot-launch", score: 6 * weight(mcap), token: r.token, facts: { ...facts, launchedHoursAgo: Math.round((now - r.launchedAt) / 3_600_000) } });
      state.hotLaunch.push(r.token);
    }

    // Comeback: fell hard from a high in the last day, now nearly back.
    const dd = drawdown(h, r.token);
    if (dd && dd.fallPct >= ECOBOT.comebackDrawdownPct && r.priceMicro! >= dd.peak * (1 - ECOBOT.comebackNearPct / 100) && mcap >= ECOBOT.floorUsd) {
      const key = `comeback:${r.token}`;
      if (!resting(key)) recurring.push({ key, kind: "comeback", score: 5 * weight(mcap), token: r.token, facts: { ...facts, fellFromHigh: `-${dd.fallPct.toFixed(0)}%`, nowVsHigh: pct(((r.priceMicro! - dd.peak) / dd.peak) * 100) }, cooldownH: 24 });
    }
  }

  // New graduations (confirmed Masters).
  if (input.graduated) {
    const known = new Set(state.graduated);
    for (const t of input.graduated) {
      if (known.has(t)) continue;
      const r = rows.find((x) => x.token === t);
      once({ key: `grad:${t}`, kind: "graduation", score: 9, token: t, facts: r ? tokenFacts(r) : { token: t } });
      state.graduated.push(t);
    }
  }

  // Close to graduating.
  for (const [t, bps] of Object.entries(input.curve)) {
    if (bps < ECOBOT.nearGraduationBps || state.nearGraduation.includes(t) || state.graduated.includes(t)) continue;
    const r = rows.find((x) => x.token === t);
    once({ key: `near-grad:${t}`, kind: "near-graduation", score: 5, token: t, facts: { ...(r ? tokenFacts(r) : { token: t }), curveProgress: `${(bps / 100).toFixed(0)}%` } });
    state.nearGraduation.push(t);
  }

  // New entries in the top 10 by market cap.
  if (state.top10.length) {
    for (const t of top10) {
      if (state.top10.includes(t)) continue;
      const r = rows.find((x) => x.token === t)!;
      const key = `top10:${t}`;
      if (!resting(key)) recurring.push({ key, kind: "top10", score: 5, token: t, facts: { ...tokenFacts(r), rank: top10.indexOf(t) + 1 }, cooldownH: 24 });
    }
  }
  state.top10 = top10;

  // The ecosystem as a whole.
  if (totals) {
    if (totals.agents != null) {
      const lv = Math.floor(totals.agents / ECOBOT.agentsStep);
      if (lv > state.agentsLevel) once({ key: `eco:agents:${lv * ECOBOT.agentsStep}`, kind: "eco", score: 6, facts: { what: "agents launched on Orbio passed a round number", agents: totals.agents, passed: lv * ECOBOT.agentsStep } });
      state.agentsLevel = Math.max(state.agentsLevel, lv);
    }
    const today = totals.launchesByDay.find((d) => d.day === day);
    if (today && today.launches > state.recordLaunches && state.recordLaunches > 0) {
      once({ key: `eco:launch-record:${day}`, kind: "eco", score: 6, facts: { what: "most agent launches on Orbio in a single day so far", launchesToday: today.launches, previousRecord: state.recordLaunches } });
    }
    if (today) state.recordLaunches = Math.max(state.recordLaunches, today.launches);
    if (creditClaimed != null) {
      const lv = creditLevel(creditClaimed);
      if (lv > state.creditLevel) once({ key: `eco:credit:${lv}`, kind: "eco", score: 5, facts: { what: "$CREDIT claimed by Orbio agents passed a milestone", creditClaimed: Math.round(creditClaimed), passed: ECOBOT.creditMilestones[lv] } });
      state.creditLevel = Math.max(state.creditLevel, lv);
    }
    const eco = totals.marketCapMicroUsd ? Number(totals.marketCapMicroUsd) / 1e6 : null;
    const c = changeSince(h, ECO_KEY, eco, 24, now, 4);
    if (eco && c && Math.abs(c.pct) >= ECOBOT.ecoMcapMovePct) {
      const key = `eco:mcap:${c.pct > 0 ? "up" : "down"}`;
      if (!resting(key)) recurring.push({ key, kind: "eco", score: 6, facts: { what: "combined market cap of all Orbio agents moved a lot", combinedMarketCap: usd(eco), change: pct(c.pct), over: span(c.spanMin) }, cooldownH: 12 });
    }
  }

  // The daily digest.
  if (new Date(now).getUTCHours() >= ECOBOT.digestHourUtc && state.lastDigestDay !== day) {
    const moves = priced
      .map((r) => ({ r, c: changeSince(h, r.token, r.priceMicro, 24, now, 4) }))
      .filter((x) => x.c && Math.max(x.r.mcapUsd!, x.r.mcapUsd! / (1 + x.c.pct / 100)) >= ECOBOT.floorUsd)
      .sort((a, b) => b.c!.pct - a.c!.pct);
    const label = (x: (typeof moves)[number]) => `${x.r.symbol ?? x.r.name ?? "?"} ${pct(x.c!.pct)} (${usd(x.r.mcapUsd!)})`;
    once({
      key: `digest:${day}`,
      kind: "digest",
      score: 8,
      facts: {
        what: "daily Orbio digest",
        day,
        agents: totals?.agents ?? null,
        launchesToday: totals?.launchesByDay.find((d) => d.day === day)?.launches ?? null,
        combinedMarketCap: totals?.marketCapMicroUsd ? usd(Number(totals.marketCapMicroUsd) / 1e6) : null,
        topGainers: moves.slice(0, 3).map(label).join("; ") || null,
        topLosers: moves.slice(-3).reverse().filter((x) => x.c!.pct < 0).map(label).join("; ") || null,
      },
    });
    state.lastDigestDay = day;
  }

  // Stale one-off news drops out (a digest only lasts its own day).
  for (const [k, p] of Object.entries(state.pending)) {
    const stale = p.signal.kind === "digest" ? !k.endsWith(day) : now - p.at > ECOBOT.pendingTtlH * 3_600_000;
    if (stale) delete state.pending[k];
  }
  for (const [k, until] of Object.entries(state.cooldown)) if (until <= now) delete state.cooldown[k];

  const signals = [...Object.values(state.pending).map((p) => p.signal), ...recurring].sort((a, b) => b.score - a.score).slice(0, ECOBOT.maxSignals);
  return { signals, state };
}

/** After the editor's decision: posted and passed-on signals are done (one-off) or rest (recurring). */
export function resolveSignals(state: BotState, keys: string[], shown: Signal[], now: number): BotState {
  const next = structuredClone(state);
  for (const key of keys) {
    const s = shown.find((x) => x.key === key);
    if (!s) continue;
    if (s.cooldownH) next.cooldown[key] = now + s.cooldownH * 3_600_000;
    else delete next.pending[key];
  }
  return next;
}
