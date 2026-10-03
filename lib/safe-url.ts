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
