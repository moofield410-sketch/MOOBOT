import { ECOBOT } from "@/config";
import { decide, type Decision } from "@/lib/ecobot/agent";
import { ECO_KEY, emptyHistory, toRow, updateHistory, type AgentRow, type History } from "@/lib/ecobot/history";
import { ecoBotMode, type EcoBotMode } from "@/lib/ecobot/mode";
import { detectSignals, emptyState, resolveSignals, type BotState, type Signal } from "@/lib/ecobot/signals";
import { utcDay } from "@/lib/field-fund-history";
import { kvGet, kvSet } from "@/lib/kv";
import { errorMessage, reportError } from "@/lib/monitoring";
import { gatewayKey, type GatewayFetch } from "@/lib/orbio-gateway";
import { getOrbioTotals } from "@/lib/orbio-totals";
import { getMasters } from "@/lib/registry";
import { fetchAgentByToken, fetchAgentChart, fetchAllAgents, type ChartRange, type OrbioAgent, type OrbioTotals, type PriceChart } from "@/lib/sources/orbio-api";
import type { Address } from "@/lib/types";
import { canPostNow, paceCheck, publishToX } from "@/lib/xpost";

/**
 * One Eco Bot run (every 15 minutes, netlify/functions/ecobot.mjs → ecobot-background.mjs →
 * /api/cron/ecobot). SERVER-SIDE ONLY. Read all of Orbio, update the bot's own price history,
 * find signals, and, if a post may go out now and there's something new, let the editor decide.
 * Quiet runs (nothing new, or waiting for the pace) don't call the AI and cost nothing.
 */

export interface EcoSources {
  agents(): Promise<OrbioAgent[]>;
  totals(): Promise<OrbioTotals | null>;
  /** Confirmed graduated tokens, or null if unavailable. */
  graduated(): Promise<string[] | null>;
  agent(token: string): Promise<OrbioAgent | null>;
  chart(token: string, range: ChartRange): Promise<PriceChart>;
}

const realSources: EcoSources = {
  // Orbio is usually quick, but one slow page shouldn't cost the whole run: try once more.
  agents: async () => (await fetchAllAgents().catch(() => fetchAllAgents())).agents,
  totals: async () => (await getOrbioTotals()).data,
  graduated: async () => {
    const m = await getMasters();
    return m.data && m.source === "orbio" ? m.data.map((x) => x.tokenAddress.toLowerCase()) : null;
  },
  agent: (token) => fetchAgentByToken(token.toLowerCase() as Address),
  chart: (token, range) => fetchAgentChart(token.toLowerCase() as Address, range),
};

export interface EcoPost {
  at: string;
  text: string;
  signal: string;
  url: string | null;
  status: string;
}

export interface EcoDraft {
  at: string;
  text: string;
  signal: string;
  why: string;
  research: string[];
}

interface EcoLog {
  lastRunAt: string | null;
  lastError: string | null;
  /** What the bot did last time it looked, in plain words, for the Status page. */
  lastNote: string | null;
  lastDecision: { at: string; why: string; signals: string[]; research: string[]; text: string | null } | null;
  lastCurveHour: string | null;
  lastShown: { hash: string; at: number } | null;
  posts: EcoPost[];
  drafts: EcoDraft[];
}

export interface EcoSpend {
  day: string;
  modelUsd: number;
  researchCredit: number;
  postCredit: number;
  editorRuns: number;
}

const K = { history: "ecobot:history", state: "ecobot:state", log: "ecobot:log", lock: "ecobot:lock", draftPace: "ecobot:draft-pace", spend: (d: string) => `ecobot:spend:${d}` };
const emptyLog = (): EcoLog => ({ lastRunAt: null, lastError: null, lastNote: null, lastDecision: null, lastCurveHour: null, lastShown: null, posts: [], drafts: [] });

export interface EcoReport {
  mode: EcoBotMode;
  note: string;
  signals: string[];
  decision: Pick<Decision, "post" | "why" | "research"> | null;
  posted: EcoPost | null;
  error: string | null;
}

/** A run that dies mid-way frees the lock after this long. */
const LOCK_MS = 10 * 60_000;
/** Don't show the editor the very same signals again within this time. */
const SAME_SIGNALS_MS = 2 * 3_600_000;

export async function runEcoBot(opts: { now?: () => number; fetch?: GatewayFetch; sources?: EcoSources } = {}): Promise<EcoReport> {
  const clock = opts.now ?? Date.now;
  const start = clock();
  const mode = ecoBotMode();
  const report: EcoReport = { mode, note: "", signals: [], decision: null, posted: null, error: null };
  if (mode === "off") return { ...report, note: "off" };

  const lock = await kvGet<{ at: number }>(K.lock);
  if (lock && start - lock.at < LOCK_MS) return { ...report, note: "another run is still working" };
  await kvSet(K.lock, { at: start });

  const src = opts.sources ?? realSources;
  const log = { ...emptyLog(), ...(await kvGet<EcoLog>(K.log)) };
  const day = utcDay(start);

  try {
    if (!gatewayKey()) throw new Error("ECO_BOT is on but ORBIO_API_KEY is not set");

    // 1. Everything on Orbio right now.
    const [agents, totals, graduated] = await Promise.all([src.agents(), src.totals().catch(() => null), src.graduated().catch(() => null)]);
    const rows = agents.map(toRow);
    const byToken = new Map(rows.map((r) => [r.token, r] as const));
    const readings: Record<string, number | null> = Object.fromEntries(rows.map((r) => [r.token, r.priceMicro]));
    readings[ECO_KEY] = totals?.marketCapMicroUsd ? Number(totals.marketCapMicroUsd) / 1e6 : null;
    const history = updateHistory((await kvGet<History>(K.history)) ?? emptyHistory(), readings, start);
    await kvSet(K.history, history);

    // 2. Curve progress for the biggest tokens still on their curve, once an hour (one request each).
    const hour = new Date(start).toISOString().slice(0, 13);
    const curve: Record<string, number> = {};
    if (log.lastCurveHour !== hour) {
      const onCurve = rows.filter((r) => !r.graduated && (r.mcapUsd ?? 0) >= ECOBOT.floorUsd).sort((a, b) => b.mcapUsd! - a.mcapUsd!).slice(0, 12);
      const details = await Promise.all(onCurve.map((r) => src.agent(r.token).catch(() => null)));
      details.forEach((a, i) => {
        if (a?.curve?.progressBps != null && a.curve.graduated !== true) curve[onCurve[i].token] = a.curve.progressBps;
      });
      log.lastCurveHour = hour;
    }

    // 3. Signals. The state (what's already known) is saved even if nothing is posted.
    let state = (await kvGet<BotState>(K.state)) ?? emptyState();
    const firstRun = state.initializedAt === null;
    const found = detectSignals({ rows, history, state, totals, graduated, curve, now: start });
    state = found.state;
    await kvSet(K.state, state);
    const signals = found.signals;
    report.signals = signals.map((s) => s.key);

    // 4. Only think when a post could go out now and there's something new to look at.
    const pace = mode === "on" ? await canPostNow(start) : paceCheck({ lastPostAt: (await kvGet<{ at: number }>(K.draftPace))?.at ?? null, allowanceDay: null, postsLeft: null }, start);
    const hash = signals.map((s) => s.key).sort().join("|");
    if (firstRun) report.note = "first run: learned where everything stands";
    else if (!signals.length) report.note = "nothing new";
    else if (!pace.ok) report.note = `waiting (${pace.reason})`;
    else if (log.lastShown?.hash === hash && start - log.lastShown.at < SAME_SIGNALS_MS) report.note = "nothing new since the last look";
    else {
      const d = await decide(signals, { ecosystem: ecosystem(rows, totals, start), recentPosts: recent(log, mode), rows: byToken, deadline: start + ECOBOT.budgetMs }, {
        fetch: opts.fetch,
        agent: src.agent,
        chart: src.chart,
        now: clock,
      });
      log.lastShown = { hash, at: start };
      report.decision = { post: d.post, why: d.why, research: d.research };
      const spend = { ...emptySpend(day), ...(await kvGet<EcoSpend>(K.spend(day))) };
      spend.modelUsd += d.modelUsd;
      spend.researchCredit += d.researchCredit;
      spend.editorRuns++;

      let done = d.skip;
      if (d.post && mode === "on") {
        const r = await publishToX(d.post.text, undefined, clock(), opts.fetch);
        if (r.kind === "published") {
          const p: EcoPost = { at: new Date(clock()).toISOString(), text: d.post.text, signal: d.post.signal, url: r.url, status: r.status };
          log.posts = [p, ...log.posts].slice(0, ECOBOT.recentPosts);
          spend.postCredit += Number(r.costCredit) || 0;
          report.posted = p;
          done = [d.post.signal, ...d.skip];
          report.note = "posted";
        } else {
          report.error = `the post wasn't published: ${r.reason ?? "X gave no reason"}`;
          report.note = "post failed, will try again";
        }
      } else if (d.post) {
        log.drafts = [{ at: new Date(start).toISOString(), text: d.post.text, signal: d.post.signal, why: d.why, research: d.research }, ...log.drafts].slice(0, 10);
        await kvSet(K.draftPace, { at: start });
        done = [d.post.signal, ...d.skip];
        report.note = "drafted (preview)";
      } else report.note = "decided nothing is worth a post";

      log.lastDecision = { at: new Date(start).toISOString(), why: d.why, signals: report.signals, research: d.research, text: d.post?.text ?? null };
      state = resolveSignals(state, done, signals, start);
      await kvSet(K.state, state);
      await kvSet(K.spend(day), spend);
    }
    log.lastError = report.error;
  } catch (err) {
    report.error = errorMessage(err);
    log.lastError = report.error;
    report.note = "failed";
    reportError(err, { where: "ecobot" });
  } finally {
    log.lastRunAt = new Date(start).toISOString();
    log.lastNote = report.note;
    await kvSet(K.log, log);
    await kvSet(K.lock, { at: 0 });
  }
  return report;
}

const emptySpend = (day: string): EcoSpend => ({ day, modelUsd: 0, researchCredit: 0, postCredit: 0, editorRuns: 0 });

function ecosystem(rows: AgentRow[], totals: OrbioTotals | null, now: number): Record<string, string | number | null> {
  const day = utcDay(now);
  return {
    agentsOnOrbio: totals?.agents ?? rows.length,
    graduated: rows.filter((r) => r.graduated).length,
    combinedMarketCapUsd: totals?.marketCapMicroUsd ? Math.round(Number(totals.marketCapMicroUsd) / 1e6) : null,
    launchesToday: totals?.launchesByDay.find((d) => d.day === day)?.launches ?? null,
  };
}

/** The bot's own latest posts (or drafts in preview), newest first. */
function recent(log: EcoLog, mode: EcoBotMode): string[] {
  return (mode === "on" ? log.posts : log.drafts).map((p) => `${p.at.slice(0, 16)}Z ${p.text}`).slice(0, ECOBOT.recentPosts);
}

export interface EcoStatus {
  mode: EcoBotMode;
  lastRunAt: string | null;
  lastNote: string | null;
  lastError: string | null;
  lastDecision: EcoLog["lastDecision"];
  posts: EcoPost[];
  drafts: EcoDraft[];
  spend: EcoSpend;
  pending: number;
}

/** For the Status page. */
export async function ecoBotStatus(now = Date.now()): Promise<EcoStatus> {
  const day = utcDay(now);
  const [log, spend, state] = await Promise.all([kvGet<EcoLog>(K.log), kvGet<EcoSpend>(K.spend(day)), kvGet<BotState>(K.state)]);
  const l = { ...emptyLog(), ...log };
  return {
    mode: ecoBotMode(),
    lastRunAt: l.lastRunAt,
    lastNote: l.lastNote,
    lastError: l.lastError,
    lastDecision: l.lastDecision,
    posts: l.posts.slice(0, 5),
    drafts: l.drafts.slice(0, 4),
    spend: { ...emptySpend(day), ...spend },
    pending: state ? Object.keys(state.pending).length : 0,
  };
}

export type { Signal };
