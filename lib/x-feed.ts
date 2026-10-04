import { SOCIAL, X_FEED } from "@/config";
import { cached } from "@/lib/cache";
import { reportError } from "@/lib/monitoring";
import { safeLogoUrl } from "@/lib/safe-url";

/**
 * The "From X" section: the official account's latest posts. SERVER-SIDE ONLY (it reads the
 * X_BEARER_TOKEN secret and calls the X API). The browser only ever gets the parsed posts.
 * Which of the three looks is used is decided here (see X_FEED in config.ts).
 */

export type XSegment = { type: "text"; value: string } | { type: "link"; value: string; href: string };

export interface XPost {
  id: string;
  url: string;
  createdAt: string | null;
  /** The post text split into plain text and links (URLs, @mentions, #hashtags). */
  segments: XSegment[];
  /** First photo (or a video's preview image). Already checked: https only. */
  media: { url: string; width: number | null; height: number | null; alt: string | null } | null;
  metrics: { replies: number; reposts: number; likes: number } | null;
}

export interface XProfile {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  verified: boolean;
}

export type XFeedState =
  /** SOCIAL.x isn't set yet: the section says the account is coming soon. */
  | { mode: "off"; handle: string }
  | { mode: "follow"; handle: string; url: string }
  | { mode: "featured"; handle: string; url: string; postUrls: string[] }
  | { mode: "live"; handle: string; url: string; profile: XProfile; posts: XPost[]; updatedAt: string | null; stale: boolean };

/** GETs a URL from the X API with the bearer token. Injected in tests. */
export type XFetcher = (url: string, token: string, revalidateS: number) => Promise<unknown>;

export class XHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`X API returned ${status}`);
    this.name = "XHttpError";
    this.status = status;
  }
}

/** X_API_BASE_URL (server-only, testing only) points at a recorded stub, like ORBIO_API_BASE_URL. */
const api = () => process.env.X_API_BASE_URL || "https://api.x.com/2";

/**
 * Persistent Next.js fetch cache (shared by every server instance, unlike the in-memory cache),
 * so X is called at most once per `revalidateS` however many visitors there are. That keeps the
 * pay-per-use bill predictable.
 */
export const defaultXFetcher: XFetcher = async (url, token, revalidateS) => {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    cache: "force-cache",
    next: { revalidate: revalidateS },
    signal: AbortSignal.timeout(X_FEED.timeoutMs),
  });
  if (!res.ok) throw new XHttpError(res.status);
  return res.json();
};

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);
const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

/** "@moofield" or "https://x.com/moofield" → "moofield". Only valid X usernames pass. */
export function xUsername(input: string | null): string | null {
  if (!input) return null;
  const m = input.trim().match(/^(?:https:\/\/(?:www\.)?(?:x|twitter)\.com\/)?@?([A-Za-z0-9_]{1,15})\/?$/);
  return m ? m[1] : null;
}

/** Keeps only real post URLs of the official account, normalised to x.com. */
export function featuredPostUrls(urls: readonly string[], username: string): string[] {
  return urls.flatMap((u) => {
    const m = u.trim().match(/^https:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,25})\/?(?:\?.*)?$/);
    return m && m[1].toLowerCase() === username.toLowerCase() ? [`https://x.com/${m[1]}/status/${m[2]}`] : [];
  });
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const decode = (s: string) => s.replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e]);

/**
 * Splits post text into text and links using the API's entities. Entity offsets count Unicode code
 * points, so the text is indexed as an array of code points (emoji count as one). Links to the
 * post's own media are dropped, since the image is shown instead.
 */
export function toSegments(rawText: string, rawEntities: unknown): XSegment[] {
  const chars = Array.from(rawText);
  const e = obj(rawEntities);
  type Span = { start: number; end: number; seg: XSegment | null };
  const spans: Span[] = [];

  for (const u of arr(e?.urls)) {
    const o = obj(u);
    const start = num(o?.start);
    const end = num(o?.end);
    if (start === null || end === null) continue;
    if (str(o?.media_key)) {
      spans.push({ start, end, seg: null });
      continue;
    }
    // Same https-only check as logos. An unsafe link stays as plain text.
    const href = safeLogoUrl(o?.expanded_url) ?? safeLogoUrl(o?.url);
    if (href) spans.push({ start, end, seg: { type: "link", value: str(o?.display_url) ?? href, href } });
  }
  for (const m of arr(e?.mentions)) {
    const o = obj(m);
    const start = num(o?.start);
    const end = num(o?.end);
    const user = xUsername(str(o?.username));
    if (start !== null && end !== null && user) spans.push({ start, end, seg: { type: "link", value: `@${user}`, href: `https://x.com/${user}` } });
  }
  for (const h of arr(e?.hashtags)) {
    const o = obj(h);
    const start = num(o?.start);
    const end = num(o?.end);
    const tag = str(o?.tag);
    if (start !== null && end !== null && tag && /^\w+$/u.test(tag)) {
      spans.push({ start, end, seg: { type: "link", value: `#${tag}`, href: `https://x.com/hashtag/${encodeURIComponent(tag)}` } });
    }
  }

  spans.sort((a, b) => a.start - b.start);
  const out: XSegment[] = [];
  const pushText = (s: string) => {
    if (!s) return;
    const last = out.at(-1);
    if (last?.type === "text") last.value += s;
    else out.push({ type: "text", value: s });
  };
  let i = 0;
  for (const s of spans) {
    if (s.start < i || s.end > chars.length || s.end <= s.start) continue; // overlapping or out of range
    pushText(decode(chars.slice(i, s.start).join("")));
    if (s.seg) out.push(s.seg);
    i = s.end;
  }
  pushText(decode(chars.slice(i).join("")));
  // Trailing whitespace left behind by a removed media link.
  const last = out.at(-1);
  if (last?.type === "text") {
    last.value = last.value.trimEnd();
    if (!last.value) out.pop();
  }
  return out;
}

export function parseProfile(raw: unknown): XProfile | null {
  const d = obj(obj(raw)?.data);
  const id = str(d?.id);
  const username = xUsername(str(d?.username));
  if (!id || !username) return null;
  const avatar = safeLogoUrl(d?.profile_image_url);
  return {
    id,
    username,
    name: str(d?.name) ?? username,
    // The API gives the 48px "_normal" size; "_bigger" (73px) stays sharp on high-DPI screens.
    avatarUrl: avatar ? avatar.replace(/_normal(\.\w+)$/, "_bigger$1") : null,
    verified: d?.verified === true || (str(d?.verified_type) ?? "none") !== "none",
  };
}

export function parsePosts(raw: unknown, username: string, limit: number): XPost[] {
  const body = obj(raw);
  const media = new Map<string, Record<string, unknown>>();
  for (const m of arr(obj(body?.includes)?.media)) {
    const o = obj(m);
    const key = str(o?.media_key);
    if (o && key) media.set(key, o);
  }

  const posts: XPost[] = [];
  for (const t of arr(body?.data)) {
    const o = obj(t);
    const id = str(o?.id);
    const text = typeof o?.text === "string" ? o.text : null;
    if (!o || !id || !/^\d+$/.test(id) || text === null) continue;

    const firstKey = str(arr(obj(o.attachments)?.media_keys)[0]);
    const m = firstKey ? media.get(firstKey) : undefined;
    const mediaUrl = m ? safeLogoUrl(m.type === "photo" ? m.url : m.preview_image_url) : null;
    const pm = obj(o.public_metrics);
    const created = str(o.created_at);

    posts.push({
      id,
      url: `https://x.com/${username}/status/${id}`,
      createdAt: created && !Number.isNaN(Date.parse(created)) ? new Date(created).toISOString() : null,
      segments: toSegments(text, o.entities),
      media: mediaUrl ? { url: mediaUrl, width: num(m?.width), height: num(m?.height), alt: str(m?.alt_text) } : null,
      metrics: pm ? { replies: num(pm.reply_count) ?? 0, reposts: num(pm.retweet_count) ?? 0, likes: num(pm.like_count) ?? 0 } : null,
    });
    if (posts.length >= limit) break;
  }
  return posts;
}

/** The raw token setting, read at call time so a redeploy with a new value takes effect. */
export function xTokenSetting(): string | null {
  return process.env[X_FEED.tokenEnv]?.trim() || null;
}

/** Live posts, or null when the token is missing or X has never answered (the caller falls back). */
async function livePosts(username: string, fetcher: XFetcher, now?: () => number) {
  const token = xTokenSetting();
  if (!token) return null;

  const profile = await cached<XProfile | null>(`x:profile:${username}`, { ttlMs: X_FEED.profileTtlMs, staleMs: X_FEED.staleMs * 7, now }, async () => {
    const raw = await fetcher(`${api()}/users/by/username/${username}?user.fields=profile_image_url,verified,verified_type`, token, X_FEED.profileTtlMs / 1000);
    const p = parseProfile(raw);
    if (!p) reportError(new Error("X account not found: the X feed falls back to the follow card"), { username });
    return { value: p, source: "x" };
  });
  if (!profile.data) return null;
  const user = profile.data;

  const query = new URLSearchParams({
    max_results: "5",
    exclude: "replies,retweets",
    "tweet.fields": "created_at,public_metrics,entities,attachments",
    expansions: "attachments.media_keys",
    "media.fields": "type,url,preview_image_url,width,height,alt_text",
  });
  const posts = await cached<XPost[]>(`x:posts:${user.id}`, { ttlMs: X_FEED.ttlMs, staleMs: X_FEED.staleMs, now }, async () => ({
    value: parsePosts(await fetcher(`${api()}/users/${user.id}/tweets?${query}`, token, X_FEED.ttlMs / 1000), user.username, X_FEED.maxPosts),
    source: "x",
  }));
  if (!posts.data) return null;
  return { profile: user, posts: posts.data, updatedAt: posts.updatedAt, stale: posts.stale };
}

/** `account` and `featured` default to config; tests pass their own. */
export async function getXFeed({
  fetcher = defaultXFetcher,
  now,
  account = SOCIAL.x,
  featured = X_FEED.featuredPosts,
}: { fetcher?: XFetcher; now?: () => number; account?: string | null; featured?: readonly string[] } = {}): Promise<XFeedState> {
  const username = xUsername(account);
  if (!username) return { mode: "off", handle: xUsername(SOCIAL.xHandle) ?? "moofield" };
  const url = `https://x.com/${username}`;

  const live = await livePosts(username, fetcher, now);
  if (live && live.posts.length > 0) return { mode: "live", handle: live.profile.username, url, ...live };

  const postUrls = featuredPostUrls(featured, username);
  if (postUrls.length > 0) return { mode: "featured", handle: username, url, postUrls };
  return { mode: "follow", handle: username, url };
}
