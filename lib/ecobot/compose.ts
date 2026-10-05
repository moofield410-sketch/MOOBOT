import { ECOBOT } from "@/config";
import { checkParts, checkPoll } from "@/lib/ecobot/guard";
import { memoryBrief, readMemory, takePostIdea, writeMemory } from "@/lib/ecobot/memory";
import { ecoBotMode } from "@/lib/ecobot/mode";
import { extractJson, persona } from "@/lib/ecobot/persona";
import { addSpend, freeLock, jobEnabled, K, noteJob, readLog, recentLines, takeLock, type EcoDraft, type EcoPost } from "@/lib/ecobot/store";
import { researchLoop, rewriteTurn, type LoopOpts, type ToolCtx, type ToolDeps, type ToolName } from "@/lib/ecobot/tools";
import { utcDay } from "@/lib/field-fund-history";
import { kvGet, kvSet } from "@/lib/kv";
import { errorMessage, reportError } from "@/lib/monitoring";
import { canPostNow, publishToX } from "@/lib/xpost";

/**
 * The compose job: MooBot's own posts, beyond the news signals. Explainers first, then builder
 * logs, spotlights on other agents, Tournament calls, big-picture takes, market mood and polls,
 * never the same kind twice in a row. SERVER-SIDE ONLY. At most ECOBOT.compose.perDay a day, at
 * least compose.gapMinutes apart, and the shared pace for @M00FIELD still applies. In preview,
 * posts are drafts on the Status page.
 */

const C = ECOBOT.compose;
const TOOLS: ToolName[] = ["orbio_find", "orbio_agent", "x_posts", "x_account", "x_search", "web_search", "web_read"];

export const COMPOSE_KINDS = {
  explainer: "Teach ONE concept to a newcomer: what CREDIT is, activation, why credit trades below $1, how creator fees feed an agent, what graduation means, square-root voting, what a Stock Token is, how an agent pays for itself. Concrete, no jargon left unexplained.",
  builder: "A builder log: what you did and learned recently, what your credits paid for (use today's spend from the live facts), what you want to try next. Honest and specific.",
  spotlight: "Spotlight another Orbio agent: research what it actually built or shipped (its own posts, its Orbio record) and explain why it's interesting. Lift it up. Not a price post.",
  tournament: "A Tournament call: invite Fighters to pitch, Masters to score and tender, holders of 1,000+ ORBIO to vote, with the round's real deadline from the live facts. Free signatures, no gas. \"Don't be shy\" energy, concrete steps, honest that rewards are shown, not paid yet.",
  bigpicture: "A big-picture take: AI agents with wallets, inference as a commodity, where Robinhood Chain is heading, how AI model prices are moving. Backed by facts you read, not vibes.",
  mood: "The ecosystem's mood: what people on X are discussing about Orbio and its agents, the overall direction of the launchpad. Describe it, never call it. Facts only.",
  poll: "Ask the herd: a question with a poll (2 to 4 options of at most 25 characters) about what they want next from Moofield or the agents, or what confuses them about Orbio.",
} as const;
export type ComposeKind = keyof typeof COMPOSE_KINDS;
const ALL_KINDS = Object.keys(COMPOSE_KINDS) as ComposeKind[];

interface ComposeState {
  lastAt: number | null;
  day: string | null;
  count: number;
  /** Kinds composed, newest first. */
  kinds: ComposeKind[];
}

const emptyState = (): ComposeState => ({ lastAt: null, day: null, count: 0, kinds: [] });

/** The kinds that may go next: not one of the last two, and a Tournament call only while a round is live. */
export function allowedKinds(recent: ComposeKind[], roundLive: boolean): ComposeKind[] {
  const out = ALL_KINDS.filter((k) => !recent.slice(0, 2).includes(k) && (k !== "tournament" || roundLive));
  return out.length ? out : ["explainer"];
}

/** Which kind to suggest: a saved post idea of an allowed kind first, else the least recently used allowed kind (explainers win ties). */
export function suggestKind(allowed: ComposeKind[], recent: ComposeKind[], ideas: { kind: string }[]): ComposeKind {
  const fromIdea = ideas.map((i) => i.kind as ComposeKind).find((k) => allowed.includes(k));
  if (fromIdea) return fromIdea;
  const age = (k: ComposeKind) => {
    const i = recent.indexOf(k);
    return i < 0 ? Infinity : i;
  };
  return [...allowed].sort((a, b) => age(b) - age(a) || (a === "explainer" ? -1 : b === "explainer" ? 1 : 0))[0];
}

export function composePrompt(facts: string[], brief: string): string {
  return `${persona(facts, brief)}

Right now you are writing ONE original post for your X account. Kinds of post:
${ALL_KINDS.map((k) => `- ${k}: ${COMPOSE_KINDS[k]}`).join("\n")}

You get the kinds allowed now, a suggested kind and your recent posts. Research first when the post needs facts you don't have (an agent's real update, what people say, a docs page). Don't repeat an angle from your recent posts. If nothing good comes out, post nothing: a weak post is worse than none.

Format:
- One post of at most 260 characters, or a short thread (the first post plus up to ${C.maxThread - 1} follow-ups) when a concept truly needs it.
- A poll is one post plus 2 to 4 options of at most 25 characters (no thread with a poll).
- At most one emoji per post, one cow touch per post.

Answer with ONLY a JSON object:
{"post": {"text": "...", "thread": ["..."] (optional), "poll": {"options": ["...", "..."]} (optional)} or null, "kind": "<kind>", "usedIdea": "<the saved post idea you used, word for word>" or null, "why": "<one short sentence>"}`;
}

export interface ComposeReport {
  note: string;
  kind: ComposeKind | null;
  text: string | null;
  error: string | null;
}

interface Parsed {
  parts: string[];
  poll: string[] | null;
  kind: ComposeKind | null;
  usedIdea: string | null;
  why: string;
}

export function parseCompose(content: string | null, allowed: ComposeKind[]): Parsed | null {
  const o = extractJson(content);
  if (!o) return null;
  const p = o.post && typeof o.post === "object" ? (o.post as Record<string, unknown>) : null;
  const why = typeof o.why === "string" ? o.why.slice(0, 300) : "";
  const kind = typeof o.kind === "string" && (allowed as string[]).includes(o.kind) ? (o.kind as ComposeKind) : null;
  if (!p || typeof p.text !== "string" || !p.text.trim()) return { parts: [], poll: null, kind, usedIdea: null, why: why || "Nothing worth posting." };
  const pollRaw = p.poll && typeof p.poll === "object" ? (p.poll as Record<string, unknown>).options : null;
  const poll = Array.isArray(pollRaw) ? pollRaw.filter((x): x is string => typeof x === "string").map((x) => x.trim()) : null;
  const thread = !poll && Array.isArray(p.thread) ? p.thread.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];
  return { parts: [p.text.trim(), ...thread].slice(0, C.maxThread), poll: poll?.length ? poll : null, kind, usedIdea: typeof o.usedIdea === "string" ? o.usedIdea : null, why };
}

const problemsOf = (p: Parsed) => [...checkParts(p.parts, "original"), ...(p.poll ? checkPoll(p.poll) : [])];

export async function runCompose(opts: { now?: () => number; deps: Omit<ToolDeps, "now">; ctx: ToolCtx; facts: () => Promise<string[]> }): Promise<ComposeReport> {
  const clock = opts.now ?? Date.now;
  const start = clock();
  const mode = ecoBotMode();
  const report: ComposeReport = { note: "", kind: null, text: null, error: null };
  if (mode === "off") return { ...report, note: "off" };
  if (!jobEnabled("compose")) return { ...report, note: "compose is switched off (ECO_BOT_JOBS)" };

  let state = { ...emptyState(), ...(await kvGet<ComposeState>(K.compose)) };
  const day = utcDay(start);
  if (state.day !== day) state = { ...state, day, count: 0 };
  if (state.count >= C.perDay) return { ...report, note: "today's composed posts are done" };
  if (state.lastAt !== null && start - state.lastAt < C.gapMinutes * 60_000) {
    return { ...report, note: `next composed post in ${Math.ceil((C.gapMinutes * 60_000 - (start - state.lastAt)) / 60_000)} min` };
  }
  if (mode === "on") {
    const pace = await canPostNow(start);
    if (!pace.ok) return { ...report, note: `waiting (${pace.reason})` };
  }
  if (!(await takeLock("compose", start))) return { ...report, note: "another run is still working" };

  const deps: ToolDeps = { ...opts.deps, now: clock };
  const deadline = start + ECOBOT.jobBudgetMs;
  let newPost: EcoPost | null = null;
  let newDraft: EcoDraft | null = null;
  try {
    const facts = await opts.facts();
    const roundLive = facts.some((f) => f.startsWith("The Tournament is open"));
    const allowed = allowedKinds(state.kinds, roundLive);
    let mem = await readMemory();
    const suggested = suggestKind(allowed, state.kinds, mem.postIdeas);
    const log = await readLog();
    const lopts: LoopOpts = { model: ECOBOT.models.compose, maxTokens: C.maxTokens, temperature: C.temperature, tools: TOOLS, maxToolCalls: C.maxToolCalls, deadline };
    const user = JSON.stringify({ now: new Date(start).toISOString(), allowedKinds: allowed, suggestedKind: suggested, recentPosts: recentLines(log, mode !== "on", 12) });
    const loop = await researchLoop(composePrompt(facts, memoryBrief(mem, { postIdeas: true })), user, lopts, opts.ctx, deps);
    let modelUsd = loop.modelUsd;
    let p = parseCompose(loop.answer, allowed);
    if (p?.parts.length) {
      const problems = problemsOf(p);
      if (problems.length && deadline - clock() > 5_000) {
        const rw = await rewriteTurn(loop.messages, loop.answer, `Your post can't go out: ${problems.join("; ")}. Rewrite it to fix every point (same JSON), or set post to null.`, lopts, deps);
        modelUsd += rw.modelUsd;
        p = parseCompose(rw.answer, allowed) ?? p;
      }
      if (p.parts.length && problemsOf(p).length) p = { ...p, parts: [], why: `Dropped: ${problemsOf(p).join("; ")}.` };
    }
    await addSpend(start, { modelUsd, researchCredit: loop.researchCredit, composeRuns: 1 });

    if (!p || !p.parts.length) {
      report.note = p?.why ? `wrote nothing: ${p.why}` : "wrote nothing (no valid answer)";
      // Try again after the gap, not every 15 minutes.
      state.lastAt = start;
      return report;
    }
    const kind = p.kind ?? suggested;
    report.kind = kind;
    report.text = p.parts.join("\n\n— ");
    if (mode === "on") {
      const r = await publishToX(p.parts[0], undefined, clock(), deps.fetch, { thread: p.parts.slice(1), ...(p.poll ? { poll: { options: p.poll, duration_minutes: 1440 } } : {}) });
      if (r.kind === "published") {
        newPost = { at: new Date(clock()).toISOString(), text: report.text, signal: `compose:${kind}`, url: r.url, status: r.status };
        await addSpend(clock(), { postCredit: Number(r.costCredit) || 0 });
        report.note = `posted (${kind})`;
      } else {
        report.error = `the post wasn't published: ${r.reason ?? "X gave no reason"}`;
        report.note = "post failed";
      }
    } else {
      newDraft = { at: new Date(start).toISOString(), text: `${report.text}${p.poll ? `\n[poll: ${p.poll.join(" / ")}]` : ""}`, signal: `compose:${kind}`, why: p.why, research: loop.research };
      report.note = `drafted (${kind}, preview)`;
    }
    if (newPost || newDraft) {
      state = { ...state, lastAt: start, count: state.count + 1, kinds: [kind, ...state.kinds].slice(0, 10) };
      if (p.usedIdea) {
        mem = takePostIdea(mem, p.usedIdea);
        await writeMemory(mem);
      }
    }
  } catch (err) {
    report.error = errorMessage(err);
    report.note = "failed";
    reportError(err, { where: "ecobot compose" });
  } finally {
    await kvSet(K.compose, state);
    await noteJob("compose", start, report.note, report.error, (log) => {
      if (newPost) log.posts = [newPost, ...log.posts].slice(0, ECOBOT.recentPosts);
      if (newDraft) log.drafts = [newDraft, ...log.drafts].slice(0, 10);
    });
    await freeLock("compose");
  }
  return report;
}
