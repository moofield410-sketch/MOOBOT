import { ECOBOT } from "@/config";
import { utcDay } from "@/lib/field-fund-history";
import { kvGet, kvSet } from "@/lib/kv";

/**
 * What the Eco Bot jobs keep in KV, shared by news (run.ts), mentions, compose and study: the post
 * log the Status page reads, what was spent per UTC day, and one lock per job.
 */

export type EcoJob = "news" | "mentions" | "compose" | "study";
export const ECO_JOBS: EcoJob[] = ["news", "mentions", "compose", "study"];

export interface EcoPost {
  at: string;
  text: string;
  /** The signal key for news; "compose:<kind>" for composed posts; "reply:<post id>" for replies. */
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

export interface EcoLog {
  lastRunAt: string | null;
  lastError: string | null;
  /** What the bot did last time it looked, in plain words, for the Status page. */
  lastNote: string | null;
  lastDecision: { at: string; why: string; signals: string[]; research: string[]; text: string | null } | null;
  lastCurveHour: string | null;
  lastShown: { hash: string; at: number } | null;
  /** Original posts (news and composed), newest first. */
  posts: EcoPost[];
  drafts: EcoDraft[];
  replies: EcoPost[];
  replyDrafts: EcoDraft[];
  /** Per job: when it last ran and what it did. */
  jobs: Partial<Record<EcoJob, { at: string; note: string; error: string | null }>>;
}

export interface EcoSpend {
  day: string;
  modelUsd: number;
  researchCredit: number;
  postCredit: number;
  editorRuns: number;
  replyRuns: number;
  composeRuns: number;
  studyRuns: number;
  /** Model dollars plus tool credit spent by the study job (recorded only; there's no limit). */
  studyUsd: number;
}

export const K = {
  history: "ecobot:history",
  state: "ecobot:state",
  log: "ecobot:log",
  lock: (job: EcoJob) => (job === "news" ? "ecobot:lock" : `ecobot:lock:${job}`),
  draftPace: "ecobot:draft-pace",
  mentions: "ecobot:mentions",
  compose: "ecobot:compose",
  study: "ecobot:study",
  spend: (d: string) => `ecobot:spend:${d}`,
};

export const emptyLog = (): EcoLog => ({
  lastRunAt: null,
  lastError: null,
  lastNote: null,
  lastDecision: null,
  lastCurveHour: null,
  lastShown: null,
  posts: [],
  drafts: [],
  replies: [],
  replyDrafts: [],
  jobs: {},
});

export const emptySpend = (day: string): EcoSpend => ({ day, modelUsd: 0, researchCredit: 0, postCredit: 0, editorRuns: 0, replyRuns: 0, composeRuns: 0, studyRuns: 0, studyUsd: 0 });

export async function readLog(): Promise<EcoLog> {
  return { ...emptyLog(), ...(await kvGet<EcoLog>(K.log)) };
}

export async function writeLog(log: EcoLog): Promise<void> {
  await kvSet(K.log, log);
}

export async function readSpend(day: string): Promise<EcoSpend> {
  return { ...emptySpend(day), ...(await kvGet<EcoSpend>(K.spend(day))) };
}

/** Adds to today's spend record. */
export async function addSpend(now: number, add: Partial<Omit<EcoSpend, "day">>): Promise<EcoSpend> {
  const day = utcDay(now);
  const s = await readSpend(day);
  for (const [k, v] of Object.entries(add) as [keyof Omit<EcoSpend, "day">, number][]) s[k] += v || 0;
  await kvSet(K.spend(day), s);
  return s;
}

/** A run that dies mid-way frees the lock after this long. */
const LOCK_MS = 10 * 60_000;

/** Takes the job's lock; false if another run of the same job is still working. */
export async function takeLock(job: EcoJob, now: number): Promise<boolean> {
  const lock = await kvGet<{ at: number }>(K.lock(job));
  if (lock && now - lock.at < LOCK_MS) return false;
  await kvSet(K.lock(job), { at: now });
  return true;
}

export async function freeLock(job: EcoJob): Promise<void> {
  await kvSet(K.lock(job), { at: 0 });
}

/** Records a job's outcome on the shared log (re-read first: another job may have written since). */
export async function noteJob(job: EcoJob, at: number, note: string, error: string | null, update?: (log: EcoLog) => void): Promise<void> {
  const log = await readLog();
  log.jobs = { ...log.jobs, [job]: { at: new Date(at).toISOString(), note, error } };
  update?.(log);
  await writeLog(log);
}

/** The bot's own latest original posts (or drafts in preview), newest first, as prompt lines. */
export function recentLines(log: EcoLog, preview: boolean, n: number = ECOBOT.recentPosts): string[] {
  return (preview ? log.drafts : log.posts).map((p) => `${p.at.slice(0, 16)}Z ${p.text}`).slice(0, n);
}

/** The ECO_BOT_JOBS switch: which jobs may run. Unset or empty = all. */
export function jobEnabled(job: EcoJob): boolean {
  const v = process.env[ECOBOT.jobsEnv]?.trim().toLowerCase();
  if (!v) return true;
  return v.split(/[\s,]+/).includes(job);
}
