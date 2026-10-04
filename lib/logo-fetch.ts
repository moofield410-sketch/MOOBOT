import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { safeLogoUrl } from "@/lib/safe-url";

/**
 * Fetches an agent's logo for Moofield's logo route. SERVER-SIDE ONLY. The URL always comes from
 * the agent's Orbio record (never from a visitor), and it is still treated as untrusted:
 *
 * - https only, at most 3 redirects, each one checked again, and never to a private network address;
 * - at most MAX_BYTES, images only (an SVG is served by the route with scripts switched off);
 * - a link to a web page instead of a picture (imgur, ImgBB and the like) is followed once to the
 *   picture the page itself announces (og:image or twitter:image), and a Google Lens "search by
 *   image" link is unwrapped to the picture it points at.
 */

export const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 8_000;
const IMAGE_TYPES = /^image\/(png|jpe?g|webp|gif|avif|svg\+xml)$/;
/** Some image hosts refuse requests that don't look like a browser. */
const UA = "Mozilla/5.0 (compatible; MoofieldLogoBot/1.0; +https://moofield.lol)";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

export interface Logo {
  body: Uint8Array;
  type: string;
}

/** Private, loopback, link-local and other non-public addresses (IPv4 and IPv6). */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") || v6.startsWith("ff");
}

export type Resolver = (host: string) => Promise<string[]>;
const dnsResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((r) => r.address);

async function checkHost(url: URL, resolve: Resolver): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("not a public host");
  const addresses = isIP(host) ? [host] : await resolve(host);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new Error("not a public host");
}

/** A Google Lens "search by image" link carries the picture's own URL in its query. */
export function unwrapLogoUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (/(^|\.)lens\.google\.com$/.test(u.hostname)) return safeLogoUrl(u.searchParams.get("url")) ?? raw;
    // imgur.com/abc123 (a single image page) has the image at i.imgur.com/abc123.png.
    if (u.hostname === "imgur.com" && /^\/[A-Za-z0-9]{5,10}$/.test(u.pathname)) return `https://i.imgur.com${u.pathname}.png`;
  } catch {
    // Left as is; the fetch below fails on it.
  }
  return raw;
}

/** The picture a web page announces for itself (og:image or twitter:image), if any. */
export function pageImage(html: string, base: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const name of ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) {
    for (const tag of tags) {
      const key = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
      const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
      if (key === name && content) {
        try {
          return safeLogoUrl(new URL(content.replace(/&amp;/g, "&"), base).href);
        } catch {
          // Not a URL; keep looking.
        }
      }
    }
  }
  return null;
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error("too large");
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error("too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** The image type from the first bytes, for hosts that send pictures as "application/octet-stream". */
export function sniffImageType(b: Uint8Array): string | null {
  const at = (i: number, ...v: number[]) => v.every((x, j) => b[i + j] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

/** One request with redirects followed by hand, so every hop is checked. */
async function get(url: string, resolve: Resolver, fetcher: typeof fetch, ua: string): Promise<Response & { finalUrl: string }> {
  let current = url;
  for (let hop = 0; hop <= 3; hop++) {
    const u = new URL(current);
    if (u.protocol !== "https:") throw new Error("https only");
    await checkHost(u, resolve);
    const res = await fetcher(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": ua, accept: "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,text/html;q=0.5" },
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) throw new Error("redirect without a location");
      current = new URL(next, current).href;
      continue;
    }
    return Object.assign(res, { finalUrl: current });
  }
  throw new Error("too many redirects");
}

/** The logo image, or null when it can't be fetched as an image (dead host, a page with no picture, too big). */
export async function fetchLogo(raw: string, deps: { resolve?: Resolver; fetch?: typeof fetch } = {}): Promise<Logo | null> {
  const resolve = deps.resolve ?? dnsResolver;
  const fetcher = deps.fetch ?? fetch;
  const start = safeLogoUrl(unwrapLogoUrl(raw));
  if (!start) return null;
  let url: string = start;
  for (let page = 0; page < 2; page++) {
    let next: string | null = null;
    for (const ua of [UA, BROWSER_UA]) {
      let res: Response & { finalUrl: string };
      try {
        res = await get(url, resolve, fetcher, ua);
      } catch {
        return null;
      }
      if (res.status === 403 && ua === UA) continue; // try again looking like a browser
      if (!res.ok) return null;
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      try {
        if (IMAGE_TYPES.test(type)) return { body: await readCapped(res), type: type === "image/jpg" ? "image/jpeg" : type };
        if (type === "" || type === "application/octet-stream" || type === "binary/octet-stream") {
          const body = await readCapped(res);
          const sniffed = sniffImageType(body);
          return sniffed ? { body, type: sniffed } : null;
        }
        if (type === "text/html" && page === 0) {
          next = pageImage(new TextDecoder().decode(await readCapped(res)), res.finalUrl);
          if (!next) return null;
          break;
        }
      } catch {
        return null;
      }
      return null;
    }
    if (!next) return null;
    url = next;
  }
  return null;
}
