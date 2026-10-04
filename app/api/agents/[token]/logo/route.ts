import { isAddress } from "viem";
import { fetchLogo, unwrapLogoUrl } from "@/lib/logo-fetch";
import { safeLogoUrl } from "@/lib/safe-url";
import { reportError } from "@/lib/monitoring";
import { fetchAgentByToken } from "@/lib/sources/orbio-api";
import type { Address } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Each server keeps the logo URL Orbio gave for a token for a while, so a burst of visitors costs one Orbio read. */
const g = globalThis as unknown as { __moofieldLogoSrc?: Map<string, { src: string | null; at: number }> };
const sources = (g.__moofieldLogoSrc ??= new Map());
const SOURCE_TTL_MS = 10 * 60_000;

async function logoSource(token: Address): Promise<string | null> {
  const hit = sources.get(token);
  if (hit && Date.now() - hit.at < SOURCE_TTL_MS) return hit.src;
  const agent = await fetchAgentByToken(token);
  const src = agent?.logo ?? null;
  if (sources.size > 5_000) sources.clear();
  sources.set(token, { src, at: Date.now() });
  return src;
}

/** Netlify's CDN keeps a found logo for a day (and serves it while refreshing for a week); a missing one for an hour. */
const FOUND = { "Cache-Control": "public, max-age=86400", "Netlify-CDN-Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };
const MISSING = { "Cache-Control": "public, max-age=3600", "Netlify-CDN-Cache-Control": "public, s-maxage=3600" };

/**
 * GET /api/agents/{token}/logo: the agent's logo from its Orbio record, served from Moofield (see
 * lib/logo-fetch.ts for the checks). Only ever fetches the URL in the token's own Orbio record,
 * never one a visitor passes in. If the server can't fetch it (some hosts only answer browsers),
 * the browser is sent to the logo's own https address to try itself. 404 when Orbio has no usable
 * logo: the page then shows initials.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!isAddress(token)) return new Response("Invalid token", { status: 400 });
  try {
    const src = await logoSource(token.toLowerCase() as Address);
    const logo = src ? await fetchLogo(src) : null;
    if (!logo) {
      const direct = src ? safeLogoUrl(unwrapLogoUrl(src)) : null;
      return direct ? new Response(null, { status: 302, headers: { ...MISSING, Location: direct } }) : new Response(null, { status: 404, headers: MISSING });
    }
    return new Response(logo.body as BodyInit, {
      headers: {
        ...FOUND,
        "Content-Type": logo.type,
        "X-Content-Type-Options": "nosniff",
        // An SVG can carry scripts: served with everything switched off, it is only ever a picture.
        "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (err) {
    reportError(err, { route: "agents/logo", token });
    return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  }
}
