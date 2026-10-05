import { publishedAutoPosts } from "@/lib/autopost/run";
import { readLog } from "@/lib/ecobot/store";
import { reportError } from "@/lib/monitoring";

/**
 * The homepage's "From X" feed, from the site's own record of what it posted to @M00FIELD (the
 * fixed posts and the MooBot Eco Bot's), so it needs no X API and no X widget, and always shows.
 * Only posts that really went out (with a link to X) are listed; replies stay on X. SERVER-SIDE ONLY.
 */

export interface FeedPost {
  at: string;
  /** The first post; for a thread, the rest are counted in `more`. */
  text: string;
  more: number;
  url: string;
  image: string | null;
  /** "news", "explainer", "recap"… for a small label. */
  kind: string;
}

/** Composed threads are stored as their parts joined with this (lib/ecobot/compose.ts). */
const THREAD_JOIN = "\n\n— ";

const URL_OK = /^https:\/\/(x|twitter)\.com\//;

export async function getFeed(limit = 6): Promise<FeedPost[]> {
  try {
    const [eco, fixed] = await Promise.all([readLog(), publishedAutoPosts()]);
    const posts: FeedPost[] = [];
    for (const p of eco.posts) {
      if (!p.url || !URL_OK.test(p.url) || p.status === "failed") continue;
      const [first, ...rest] = p.text.split(THREAD_JOIN);
      posts.push({ at: p.at, text: first, more: rest.length, url: p.url, image: null, kind: p.signal.startsWith("compose:") ? p.signal.slice(8) : "news" });
    }
    for (const p of fixed) {
      if (!p.url || !URL_OK.test(p.url) || !p.text) continue;
      posts.push({ at: p.at, text: p.text, more: 0, url: p.url, image: p.image ?? null, kind: p.key.split(":")[0] });
    }
    return posts.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  } catch (err) {
    reportError(err, { where: "feed" });
    return [];
  }
}
