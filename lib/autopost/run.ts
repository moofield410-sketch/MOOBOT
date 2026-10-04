import { GATEWAY } from "@/config";
import { boardDraft, graduationDraft, launchDraft, recapDraft, type Draft } from "@/lib/autopost/drafts";
import { getCredits } from "@/lib/credits";
import { utcDay } from "@/lib/field-fund-history";
import { formatMicroUsd } from "@/lib/format";
import { kvGet, kvSet } from "@/lib/kv";
import { errorMessage, reportError } from "@/lib/monitoring";
import { getMooBot, getMooBotChart, type MooBotChartState, type MooBotState } from "@/lib/moobot";
import { callTool, gatewayKey, GatewayError, type GatewayFetch } from "@/lib/orbio-gateway";
import { getOrbioTotals } from "@/lib/orbio-totals";
import { getMasters } from "@/lib/registry";
import { formatCredits } from "@/lib/rewards";
import type { OrbioTotals } from "@/lib/sources/orbio-api";
import type { CreditStats, DataEnvelope, Master } from "@/lib/types";

/**
 * Auto-posting to @M00FIELD through Orbio's social.post tool. SERVER-SIDE ONLY. Run every
 * 15 minutes by netlify/functions/autopost.mjs (via /api/cron/autopost).
 *
 * AUTO_POST=off      nothing happens.
 * AUTO_POST=preview  (the default) the posts that would go out are saved as drafts for the Status
 *                    page. Nothing is posted and nothing is spent.
 * AUTO_POST=on       they are posted, at most GATEWAY.autopost.postsPerDay a day, each capped at
 *                    postMaxCost $CREDIT. Needs ORBIO_API_KEY and the X account connected in Orbio.
 */

const A = GATEWAY.autopost;

export type AutoPostMode = "off" | "preview" | "on";

export function autoPostMode(): AutoPostMode {
  const v = process.env[A.env]?.trim().toLowerCase();
  return v === "off" || v === "on" ? v : "preview";
}

export interface PostRecord {
  key: string;
  at: string;
  status: string;
  url: string | null;
}

interface Log {
  /** Posted (mode "on") by key. Preview never writes here, so switching on still posts today's posts and the launch. */
  posted: Record<string, PostRecord>;
  /** Posts and graduation shout-outs sent per UTC day. */
  counts: Record<string, { posts: number; graduations: number }>;
  lastRunAt: string | null;
  lastError: string | null;
}

export interface DraftRecord extends Draft {
  at: string;
}

const LOG = "autopost:log";
const DRAFTS = "autopost:drafts";
const SEEN = "autopost:seen-masters";
const emptyLog = (): Log => ({ posted: {}, counts: {}, lastRunAt: null, lastError: null });

export interface AutoPostSources {
  moobot(): Promise<MooBotState>;
  totals(): Promise<DataEnvelope<OrbioTotals>>;
  credits(): Promise<DataEnvelope<CreditStats>>;
  masters(): Promise<DataEnvelope<Master[]>>;
  chart(): Promise<MooBotChartState>;
}

const realSources: AutoPostSources = {
  moobot: () => getMooBot(),
  totals: () => getOrbioTotals(),
  credits: () => getCredits(),
  masters: () => getMasters(),
  chart: () => getMooBotChart("1d"),
};

/** The site's public address, for image URLs. Netlify sets URL. */
const siteUrl = () => process.env.URL ?? null;

async function recapFacts(src: AutoPostSources, now: number) {
  const [totals, credits, chart] = await Promise.all([src.totals(), src.credits(), src.chart()]);
  const t = totals.data;
  const yesterday = utcDay(now - 86_400_000);
  const points = chart.status === "ok" ? chart.chart.points : [];
  const first = points[0] ? Number(points[0].priceMicroUsd) : null;
  const last = points[points.length - 1] ? Number(points[points.length - 1].priceMicroUsd) : null;
  return {
    agents: t?.agents ?? null,
    launchedYesterday: t?.launchesByDay.find((d) => d.day === yesterday)?.launches ?? null,
    fieldFund: credits.data ? formatCredits(credits.data.receivedAtoms) : null,
    moobotPrice: last !== null ? formatMicroUsd(String(last)) : null,
    moobotChangePct: first && last !== null && points.length > 1 ? ((last - first) / first) * 100 : null,
  };
}

/**
 * New graduated Masters since the last run. The very first run only remembers the current list
 * (so the Masters that already exist aren't all announced at once) and returns nothing.
 */
async function newMasters(src: AutoPostSources): Promise<Master[]> {
  const env = await src.masters();
  if (!env.data || env.source !== "orbio") return [];
  const seen = await kvGet<string[]>(SEEN);
  const all = env.data.map((m) => m.tokenAddress.toLowerCase());
  if (seen === null) {
    await kvSet(SEEN, all);
    return [];
  }
  const known = new Set(seen);
  return env.data.filter((m) => !known.has(m.tokenAddress.toLowerCase()));
}

/** Everything due right now, most important first. Already-posted keys are skipped by the caller. */
export async function dueDrafts(now: number, src: AutoPostSources = realSources): Promise<{ drafts: Draft[]; graduated: Master[] }> {
  const day = utcDay(now);
  const minutes = (now - Date.parse(`${day}T00:00:00Z`)) / 60_000;
  const drafts: Draft[] = [];

  const moobot = await src.moobot();
  if (moobot.status === "verified") drafts.push(launchDraft(moobot.address, siteUrl()));
  if (minutes >= A.boardAfterMinutes) drafts.push(boardDraft(day, siteUrl()));
  if (minutes >= A.recapHourUtc * 60) {
    const recap = recapDraft(day, await recapFacts(src, now));
    if (recap) drafts.push(recap);
  }
  const graduated = await newMasters(src);
  drafts.push(...graduated.map(graduationDraft));
  return { drafts, graduated };
}

export interface RunReport {
  mode: AutoPostMode;
  posted: PostRecord[];
  drafted: string[];
  /** Held back by the daily caps; tried again later. */
  skipped: string[];
  /** Refused by Orbio for that post alone; tried again next run. */
  failed: string[];
  error: string | null;
}

/** The cap sent with each post: text, plus one more post's worth for each image (X meters uploads as posts). */
export const maxCost = (d: Draft) => (A.postMaxCost + A.perImageMaxCost * (d.media?.length ?? 0)).toFixed(4);

/** Kinds listed in AUTO_POST_SKIP are never posted or drafted, e.g. "launch" after posting it by hand. */
export function skippedKinds(): Set<string> {
  return new Set((process.env[A.skipEnv] ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}

/** One auto-post run. Never throws: problems are logged and retried on the next run. */
export async function runAutoPost(opts: { now?: number; fetch?: GatewayFetch; sources?: AutoPostSources } = {}): Promise<RunReport> {
  const now = opts.now ?? Date.now();
  const mode = autoPostMode();
  const report: RunReport = { mode, posted: [], drafted: [], skipped: [], failed: [], error: null };
  if (mode === "off") return report;

  const log = (await kvGet<Log>(LOG)) ?? emptyLog();
  const day = utcDay(now);
  const count = (log.counts[day] ??= { posts: 0, graduations: 0 });

  try {
    const { drafts, graduated } = await dueDrafts(now, opts.sources ?? realSources);
    const skip = skippedKinds();
    const pending = drafts.filter((d) => !log.posted[d.key] && !skip.has(d.kind));

    if (mode === "preview") {
      const saved = (await kvGet<DraftRecord[]>(DRAFTS)) ?? [];
      const fresh = pending.filter((d) => !saved.some((s) => s.key === d.key));
      await kvSet(DRAFTS, [...fresh.map((d) => ({ ...d, at: new Date(now).toISOString() })), ...saved].slice(0, 20));
      report.drafted = pending.map((d) => d.key);
    } else {
      if (!gatewayKey()) throw new Error("AUTO_POST is on but ORBIO_API_KEY is not set");
      const problems: string[] = [];
      for (const d of pending) {
        if (count.posts >= A.postsPerDay || (d.kind === "graduation" && count.graduations >= A.graduationsPerDay)) {
          report.skipped.push(d.key);
          continue;
        }
        let r;
        try {
          r = await callTool(
            "social.post",
            { text: d.text, platforms: ["twitter"], ...(d.media ? { media: d.media } : {}), allow_links: false, max_cost: maxCost(d) },
            opts.fetch,
          );
        } catch (err) {
          // Refused for this post only (its arguments or quote): note it and carry on with the others.
          // Anything else (key, balance, account, rate limit, outage) stops the run until the next one.
          if (err instanceof GatewayError && (err.status === 400 || err.status === 404)) {
            problems.push(`${d.key}: ${err.message}`);
            report.failed.push(d.key);
            continue;
          }
          throw err;
        }
        const result = r.status === "settled" && r.result && typeof r.result === "object" ? (r.result as Record<string, unknown>) : null;
        const platforms = Array.isArray(result?.platforms) ? (result.platforms as Record<string, unknown>[]) : [];
        const url = platforms.map((p) => p.platformPostUrl).find((u): u is string => typeof u === "string") ?? null;
        // A "running" answer was accepted: record it so it is never sent twice (Orbio's docs).
        const rec: PostRecord = { key: d.key, at: new Date(now).toISOString(), status: r.status === "running" ? "publishing" : String(result?.status ?? "published"), url };
        log.posted[d.key] = rec;
        count.posts++;
        if (d.kind === "graduation") count.graduations++;
        report.posted.push(rec);
      }
      if (problems.length) report.error = problems.join(" · ");
    }

    // Masters drafted (preview) or announced (on) are remembered; ones held back by the daily cap or refused come back next run.
    if (graduated.length) {
      const held = new Set([...report.skipped, ...report.failed]);
      const seen = (await kvGet<string[]>(SEEN)) ?? [];
      await kvSet(SEEN, [...seen, ...graduated.map((m) => m.tokenAddress.toLowerCase()).filter((t) => !held.has(`grad:${t}`))]);
    }
    log.lastError = report.error;
  } catch (err) {
    report.error = errorMessage(err);
    log.lastError = report.error;
    reportError(err, { where: "autopost" });
  }

  log.lastRunAt = new Date(now).toISOString();
  // Keep 60 days of history (the launch record is kept forever).
  const cutoff = utcDay(now - 60 * 86_400_000);
  for (const d of Object.keys(log.counts)) if (d < cutoff) delete log.counts[d];
  for (const [k, v] of Object.entries(log.posted)) if (k !== "launch" && v.at.slice(0, 10) < cutoff) delete log.posted[k];
  await kvSet(LOG, log);
  return report;
}

export interface AutoPostStatus {
  mode: AutoPostMode;
  keySet: boolean;
  lastRunAt: string | null;
  lastError: string | null;
  recent: PostRecord[];
  drafts: DraftRecord[];
  postsToday: number;
}

/** For the Status page. */
export async function autoPostStatus(now = Date.now()): Promise<AutoPostStatus> {
  const log = (await kvGet<Log>(LOG)) ?? emptyLog();
  return {
    mode: autoPostMode(),
    keySet: gatewayKey() !== null,
    lastRunAt: log.lastRunAt,
    lastError: log.lastError,
    recent: Object.values(log.posted).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10),
    drafts: ((await kvGet<DraftRecord[]>(DRAFTS)) ?? []).slice(0, 6),
    postsToday: log.counts[utcDay(now)]?.posts ?? 0,
  };
}
