import { ECOBOT } from "@/config";
import { decide, type Decision } from "@/lib/ecobot/agent";
import { ECO_KEY, emptyHistory, toRow, updateHistory, type AgentRow, type History } from "@/lib/ecobot/history";
import { ecoBotMode, type EcoBotMode } from "@/lib/ecobot/mode";
import { detectSignals, emptyState, resolveSignals, type BotState, type Signal } from "@/lib/ecobot/signals";
import { utcDay } from "@/lib/field-fund-history";
import { kvGet, kvSet } from "@/lib/kv";
import { memoryBrief as memoryBriefFor, readMemory } from "@/lib/ecobot/memory";
import { freeLock, jobEnabled, K, readLog, readSpend, recentLines, takeLock, writeLog, type EcoDraft, type EcoLog, type EcoPost, type EcoSpend } from "@/lib/ecobot/store";
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

export const realSources: EcoSources = {
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

export interface EcoReport {
  mode: EcoBotMode;
  note: string;
  signals: string[];
  decision: Pick<Decision, "post" | "why" | "research"> | null;
  posted: EcoPost | null;
  error: string | null;
}

/** Don't show the editor the very same signals again within this time. */
const SAME_SIGNALS_MS = 2 * 3_600_000;

export async function runEcoBot(opts: { now?: () => number; fetch?: GatewayFetch; sources?: EcoSources } = {}): Promise<EcoReport> {
  const clock = opts.now ?? Date.now;
  const start = clock();
  const mode = ecoBotMode();
  const report: EcoReport = { mode, note: "", signals: [], decision: null, posted: null, error: null };
  if (mode === "off") return { ...report, note: "off" };
  if (!jobEnabled("news")) return { ...report, note: "news is switched off (ECO_BOT_JOBS)" };
  if (!(await takeLock("news", start))) return { ...report, note: "another run is still working" };

  const src = opts.sources ?? realSources;
  const log = await readLog();
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
      const memoryBrief = memoryBriefFor(await readMemory());
      const d = await decide(signals, { ecosystem: ecosystem(rows, totals, start), recentPosts: recentLines(log, mode !== "on"), rows: byToken, deadline: start + ECOBOT.budgetMs, memoryBrief }, {
        fetch: opts.fetch,
        agent: src.agent,
        chart: src.chart,
        now: clock,
      });
      log.lastShown = { hash, at: start };
      report.decision = { post: d.post, why: d.why, research: d.research };
      const spend = await readSpend(day);
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
    log.jobs = { ...log.jobs, news: { at: log.lastRunAt, note: report.note, error: report.error } };
    await writeLog(log);
    await freeLock("news");
  }
  return report;
}

export function ecosystem(rows: AgentRow[], totals: OrbioTotals | null, now: number): Record<string, string | number | null> {
  const day = utcDay(now);
  return {
    agentsOnOrbio: totals?.agents ?? rows.length,
    graduated: rows.filter((r) => r.graduated).length,
    combinedMarketCapUsd: totals?.marketCapMicroUsd ? Math.round(Number(totals.marketCapMicroUsd) / 1e6) : null,
    launchesToday: totals?.launchesByDay.find((d) => d.day === day)?.launches ?? null,
  };
}

export interface EcoStatus {
  mode: EcoBotMode;
  lastRunAt: string | null;
  lastNote: string | null;
  lastError: string | null;
  lastDecision: EcoLog["lastDecision"];
  posts: EcoPost[];
  drafts: EcoDraft[];
  replies: EcoPost[];
  replyDrafts: EcoDraft[];
  jobs: EcoLog["jobs"];
  spend: EcoSpend;
  pending: number;
  memory: { facts: number; lessons: number; ideas: number; postIdeas: number; updatedAt: string | null; latestFacts: string[]; };
}

/** For the Status page. */
export async function ecoBotStatus(now = Date.now()): Promise<EcoStatus> {
  const day = utcDay(now);
  const [l, spend, state, mem] = await Promise.all([readLog(), readSpend(day), kvGet<BotState>(K.state), readMemory()]);
  return {
    mode: ecoBotMode(),
    lastRunAt: l.lastRunAt,
    lastNote: l.lastNote,
    lastError: l.lastError,
    lastDecision: l.lastDecision,
    posts: l.posts.slice(0, 5),
    drafts: l.drafts.slice(0, 4),
    replies: l.replies.slice(0, 5),
    replyDrafts: l.replyDrafts.slice(0, 4),
    jobs: l.jobs,
    spend,
    pending: state ? Object.keys(state.pending).length : 0,
    memory: {
      facts: mem.facts.length,
      lessons: mem.lessons.length,
      ideas: mem.ideas.length,
      postIdeas: mem.postIdeas.length,
      updatedAt: mem.updatedAt,
      // Model-written facts only: community ideas are other people's words and stay off this public page.
      latestFacts: mem.facts.slice(0, 3).map((f) => f.text),
    },
  };
}

export type { Signal };
export type { EcoPost, EcoDraft, EcoSpend };
