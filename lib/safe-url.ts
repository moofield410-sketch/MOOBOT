/**
 * Logo URLs come from Orbio, where any agent creator can set them. Only absolute https: URLs are
 * passed to an <img>; anything else (http:, javascript:, data:, relative paths, junk) becomes null
 * and the initials avatar is shown instead.
 *
 * There is no Content-Security-Policy today. If one is ever added, its img-src must allow https:
 * (logos are hosted on Supabase, pbs.twimg.com, gmgn.ai and other one-off hosts).
 */
export const MAX_LOGO_URL_LENGTH = 2_048;

export function safeLogoUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (value === "" || value.length > MAX_LOGO_URL_LENGTH || !URL.canParse(value)) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname === "" || url.username || url.password) return null;
  return url.href;
}

/** A short, stable hash of a logo URL (FNV-1a), so a changed logo gets a new cache key. */
function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/**
 * Where the site shows an agent's logo: Moofield's own logo route (app/api/agents/[token]/logo),
 * which fetches Orbio's logo once and serves it from the site. That way logos from hosts that
 * refuse to be shown on other sites still appear, a page link to a picture (imgur, ImgBB, Google
 * Lens) is turned into the picture itself, and a dead host simply shows the initials.
 * null when Orbio has no usable logo for the agent.
 */
export function logoPath(token: string, raw: unknown): string | null {
  const url = safeLogoUrl(raw);
  if (!url || !/^0x[0-9a-fA-F]{40}$/.test(token)) return null;
  return `/api/agents/${token.toLowerCase()}/logo?v=${shortHash(url)}`;
}
