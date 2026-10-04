import { ECOBOT, GATEWAY } from "@/config";
import { utcDay } from "@/lib/field-fund-history";
import { kvGet, kvSet } from "@/lib/kv";
import { callTool, GatewayError, type GatewayFetch } from "@/lib/orbio-gateway";

/**
 * Posting to @M00FIELD through Orbio's social.post, shared by the fixed posts (lib/autopost) and
 * the Eco Bot (lib/ecobot). SERVER-SIDE ONLY. One pace for the whole account: at least
 * ECOBOT.minGapMinutes between posts, and nothing once Orbio says today's X allowance is used up.
 */

const PACE = "xbot:pace";

interface Pace {
  lastPostAt: number | null;
  /** Orbio's own count of original X posts left today (from the last post's remaining_today). */
  allowanceDay: string | null;
  postsLeft: number | null;
}

export async function readPace(): Promise<Pace> {
  return (await kvGet<Pace>(PACE)) ?? { lastPostAt: null, allowanceDay: null, postsLeft: null };
}

/** Whether a post may go out now. `urgent` (the $MOOBOT launch) skips the gap, never the allowance. */
export function paceCheck(p: Pace, now: number, urgent = false): { ok: true } | { ok: false; reason: string } {
  if (p.allowanceDay === utcDay(now) && p.postsLeft === 0) return { ok: false, reason: "Orbio's X posting allowance for today is used up (resets 00:00 UTC)" };
  const gap = ECOBOT.minGapMinutes * 60_000;
  if (!urgent && p.lastPostAt !== null && now - p.lastPostAt < gap) {
    return { ok: false, reason: `pacing: next post allowed in ${Math.ceil((gap - (now - p.lastPostAt)) / 60_000)} min` };
  }
  return { ok: true };
}

export async function canPostNow(now: number, urgent = false) {
  return paceCheck(await readPace(), now, urgent);
}

async function notePosted(now: number, postsLeft: number | null): Promise<void> {
  const p = await readPace();
  await kvSet(PACE, { lastPostAt: now, allowanceDay: postsLeft === null ? p.allowanceDay : utcDay(now), postsLeft: postsLeft ?? p.postsLeft });
}

export type Published =
  | { kind: "published"; status: string; url: string | null; postsLeft: number | null; costCredit: string | null }
  /** Orbio refused this post on its own (its arguments or quote). Nothing was charged. */
  | { kind: "refused"; reason: string }
  /** Orbio sent it but X didn't publish it. */
  | { kind: "failed"; reason: string | null };

/** X's reason for a failed post, wherever Orbio put it. */
export function failureReason(result: Record<string, unknown> | null, platforms: Record<string, unknown>[]): string | null {
  for (const o of [...platforms, result]) {
    for (const f of ["error", "errorMessage", "message", "reason"]) {
      const v = o?.[f];
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, 200);
      if (v && typeof v === "object" && typeof (v as Record<string, unknown>).message === "string") return String((v as Record<string, unknown>).message).slice(0, 200);
    }
  }
  return null;
}

/** Orbio's posts_left for X from a social.post result, if it sent one. */
function postsLeftOf(result: Record<string, unknown> | null): number | null {
  const rt = result?.remaining_today;
  if (!rt || typeof rt !== "object") return null;
  for (const v of Object.values(rt as Record<string, unknown>)) {
    const left = v && typeof v === "object" ? (v as Record<string, unknown>).posts_left : null;
    if (typeof left === "number") return left;
  }
  return null;
}

/** Most a post may cost: text, plus one more post's worth per image (X meters uploads as posts). */
export const postMaxCost = (images: number) => (GATEWAY.autopost.postMaxCost + GATEWAY.autopost.perImageMaxCost * images).toFixed(4);

/**
 * Sends one post. Records the pace on success. Throws for account-wide problems (key, balance,
 * account not connected, rate limit, outage): the caller stops and the next run tries again.
 */
export async function publishToX(text: string, media: { url: string; type: "image" }[] | undefined, now: number, f?: GatewayFetch): Promise<Published> {
  let r;
  try {
    r = await callTool(
      "social.post",
      { text, platforms: ["twitter"], ...(media?.length ? { media } : {}), allow_links: false, max_cost: postMaxCost(media?.length ?? 0) },
      f,
    );
  } catch (err) {
    if (err instanceof GatewayError && (err.status === 400 || err.status === 404)) return { kind: "refused", reason: err.message };
    throw err;
  }
  if (r.status === "running") {
    // Accepted and still publishing: count it as sent, never resubmit (Orbio's docs).
    await notePosted(now, null);
    return { kind: "published", status: "publishing", url: null, postsLeft: null, costCredit: null };
  }
  const result = r.result && typeof r.result === "object" ? (r.result as Record<string, unknown>) : null;
  const platforms = Array.isArray(result?.platforms) ? (result.platforms as Record<string, unknown>[]) : [];
  const status = String(result?.status ?? "published");
  if (status === "failed") return { kind: "failed", reason: failureReason(result, platforms) };
  const url = platforms.map((p) => p.platformPostUrl).find((u): u is string => typeof u === "string") ?? null;
  const postsLeft = postsLeftOf(result);
  await notePosted(now, postsLeft);
  return { kind: "published", status, url, postsLeft, costCredit: r.costCredit };
}

/** For the Status page. */
export async function xAllowance(now = Date.now()): Promise<{ postsLeft: number | null; lastPostAt: number | null }> {
  const p = await readPace();
  return { postsLeft: p.allowanceDay === utcDay(now) ? p.postsLeft : null, lastPostAt: p.lastPostAt };
}
