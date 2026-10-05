import { runCompose } from "@/lib/ecobot/compose";
import { botFacts } from "@/lib/ecobot/facts";
import { toRow } from "@/lib/ecobot/history";
import { runMentions } from "@/lib/ecobot/mentions";
import { realSources, runEcoBot, type EcoSources } from "@/lib/ecobot/run";
import { ECO_JOBS, type EcoJob } from "@/lib/ecobot/store";
import { runStudy } from "@/lib/ecobot/study";
import type { ToolCtx } from "@/lib/ecobot/tools";
import type { GatewayFetch } from "@/lib/orbio-gateway";

/**
 * Runs one Eco Bot job by name (the route /api/cron/ecobot?job=…). news is the signal bot
 * (run.ts); mentions, compose and study are the persona jobs. Each fits one route call (60 s).
 */

export const isEcoJob = (v: string | null): v is EcoJob => v !== null && (ECO_JOBS as string[]).includes(v);

export async function runEcoJob(job: EcoJob, opts: { now?: () => number; fetch?: GatewayFetch; sources?: EcoSources; facts?: () => Promise<string[]> } = {}) {
  if (job === "news") return runEcoBot(opts);
  const src = opts.sources ?? realSources;
  const clock = opts.now ?? Date.now;
  // Every agent on Orbio, so the model can find tokens by name. A failed read just means no search.
  const agents = await src.agents().catch(() => []);
  const ctx: ToolCtx = { rows: new Map(agents.map(toRow).map((r) => [r.token, r] as const)) };
  const deps = { fetch: opts.fetch, agent: src.agent, chart: src.chart };
  const facts = opts.facts ?? (() => botFacts(clock()));
  const args = { now: clock, deps, ctx, facts };
  if (job === "mentions") return runMentions(args);
  if (job === "compose") return runCompose(args);
  return runStudy(args);
}
