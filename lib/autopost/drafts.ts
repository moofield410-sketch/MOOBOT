import { ORBIO_SOCIAL, SITE } from "@/config";
import { formatInt } from "@/lib/format";

/**
 * The posts Moofield writes to @M00FIELD by itself (lib/autopost/run.ts sends them). Fixed
 * templates filled with the site's own data, no AI, so every word is known in advance and tested
 * (tests/autopost.test.ts): at most 280 characters (a free X account), and no links or domains
 * (X bills a post with a link at $0.200 instead of $0.015, and Orbio refuses it without allow_links).
 */

export type DraftKind = "launch" | "board" | "recap" | "graduation";

export interface Draft {
  /** Unique per post, so nothing is posted twice: "launch", "board:2026-10-05", "grad:0x…". */
  key: string;
  kind: DraftKind;
  text: string;
  /** Public https image URLs (Orbio fetches them). X takes up to 4. */
  media?: { url: string; type: "image" }[];
}

export const MAX_POST_CHARS = 280;

/** Anything X would treat as a link: a URL, www., or a bare domain like moofield.lol. */
export const LINK_RE = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|lol|xyz|io|so|app|net|org|ai|gg|co|fun|me|dev|tv|fi|finance|money|bot)\b/i;

const shortDate = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const image = (siteUrl: string | null, path: string) => (siteUrl ? [{ url: new URL(path, siteUrl).toString(), type: "image" as const }] : undefined);

/** The once-ever launch post. `address` must be the verified contract from getMooBot(), nothing else. */
export function launchDraft(address: string, siteUrl: string | null): Draft {
  return {
    key: "launch",
    kind: "launch",
    text: `${SITE.ticker} is live. 🐄 MooBot is awake and the meadow is open.

Official contract:
${address}

Copy it only from our website or this account's pinned post. Ignore DMs and look-alike tokens.`,
    media: image(siteUrl, "/posters/moofield-token-live.png"),
  };
}

export function boardDraft(day: string, siteUrl: string | null): Draft {
  return {
    key: `board:${day}`,
    kind: "board",
    text: `🌼 Today's Bloom Pop field is out (${shortDate(day)}).

Same field for everyone, a new one every day. Help MooBot plant the meadow: match three seeds to make them bloom.

Play it on our website. Just for fun, scores have no value.`,
    media: image(siteUrl, `/play/${day}/board`),
  };
}

export interface RecapFacts {
  /** Agents on the Orbio launchpad now, and how many launched on the previous UTC day. */
  agents: number | null;
  launchedYesterday: number | null;
  /** Field Fund $CREDIT received in total, already formatted ("16.76"). Null before launch. */
  fieldFund: string | null;
  /** $MOOBOT price, formatted ("$0.000833"), and its change over the last day in percent. */
  moobotPrice: string | null;
  moobotChangePct: number | null;
}

/** The daily numbers post. Any figure that's unavailable is left out (never shown as 0). Null if nothing is known. */
export function recapDraft(day: string, f: RecapFacts): Draft | null {
  const lines: string[] = [];
  if (f.agents !== null) lines.push(`• Agents on Orbio: ${formatInt(f.agents)}${f.launchedYesterday !== null ? ` (+${formatInt(f.launchedYesterday)} yesterday)` : ""}`);
  if (f.fieldFund !== null) lines.push(`• Field Fund: ${f.fieldFund} $CREDIT received`);
  if (f.moobotPrice !== null) {
    const ch = f.moobotChangePct;
    lines.push(`• ${SITE.ticker}: ${f.moobotPrice}${ch !== null ? ` (${ch > 0 ? "+" : ""}${ch.toFixed(1)}% in 24h)` : ""}`);
  }
  if (lines.length === 0) return null;
  return {
    key: `recap:${day}`,
    kind: "recap",
    text: `🐄 Moofield daily · ${shortDate(day)}

${lines.join("\n")}

Read live from Orbio. Not financial advice.`,
  };
}

/** Only plain characters from an agent's self-chosen name or ticker, and never anything link-like or an @mention. */
function clean(s: string | null, max: number): string | null {
  if (!s) return null;
  const t = s.replace(/[@#]/g, "").replace(/[^\p{L}\p{N} .'&-]/gu, "").replace(/\s+/g, " ").trim().slice(0, max).trim();
  return t && !LINK_RE.test(t) ? t : null;
}

export function graduationDraft(m: { tokenAddress: string; name: string | null; ticker: string | null }): Draft {
  // toMaster() fills a missing symbol with "n/a"; that is not a ticker.
  const ticker = (m.ticker === "n/a" ? null : clean(m.ticker, 12)?.replace(/[^A-Za-z0-9]/g, "")) || null;
  const name = clean(m.name, 40);
  const who =
    ticker && name && name.toLowerCase() !== ticker.toLowerCase() ? `$${ticker} (${name})` : ticker ? `$${ticker}` : name ?? "a new agent";
  return {
    key: `grad:${m.tokenAddress.toLowerCase()}`,
    kind: "graduation",
    text: `🎓 Welcome to the Masters, ${who}!

It just graduated on ${ORBIO_SOCIAL.xHandle} and joins the Moofield Masters directory, where new agents will pitch it features in The Tournament.`,
  };
}
