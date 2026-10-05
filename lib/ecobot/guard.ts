import { LINK_RE } from "@/lib/autopost/drafts";

/**
 * The last check on every Eco Bot post, by fixed rules (the AI can't talk its way past these):
 * fits X, at most one cashtag, no links, no contract addresses, no hashtags, no hype, no advice,
 * no predictions. Three kinds:
 * - "news": the signal posts. Strictest: no @mentions, "accrued" not "earn", always ends with NFA.
 * - "original": composed posts (explainers, builder logs, Tournament calls). Explaining Orbio needs
 *   "stake ORBIO, earn CREDIT" and "sell it below $1", so only advice aimed at the reader is refused,
 *   and NFA is required only when the post talks about a price.
 * - "reply": answers to mentions. The same as "original".
 * Only @orbiodotso and @themeadowlab may be mentioned outside news.
 */

export const MAX_X_CHARS = 280;
export type PostKind = "news" | "original" | "reply";

/**
 * Length the way X counts it: most Latin text 1 per character, emoji and CJK 2, variation
 * selectors free. A close, slightly cautious approximation of X's own counter.
 */
export function xLength(text: string): number {
  let n = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c === 0xfe0f || c === 0xfe0e) continue;
    const light = c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037);
    n += light ? 1 : 2;
  }
  return n;
}

type Rule = [RegExp, string];

const ALWAYS: Rule[] = [
  [/0x[0-9a-fA-F]{40}/, "contains a contract address (never post one: people should check addresses themselves)"],
  [/(^|\s)#\w/, "contains a hashtag"],
  [/\bsafe\b/i, 'says "safe"'],
  [/\b(profits?|passive income|risk-free|guaranteed|easy money)\b/i, "talks about profit or guarantees"],
  [/\b(moon|mooning|pump|pumping|pumped|dump|dumping|dumped|gem|alpha|lfg|wagmi|ngmi|rocket|degen)\b/i, "uses hype words"],
  [/\b\d+x\b/i, 'promises multiples ("10x")'],
  [/\b(not too late|price target|targets?|undervalued|overvalued|underpriced|entry (point|zone|price)|good entry|bottom is in|next big)\b/i, "gives a price view or entry"],
  [/\bwill (go|rise|climb|pump|moon|hit|reach|break|explode|recover|bounce)\b/i, "predicts the price"],
  [/\b(will|gonna|going to|surely|definitely|guaranteed to)\s+(graduate|graduating|touch graduation)\b/i, "promises graduation (say it's the goal instead)"],
  [/\bworth (more|way more|much more)\b/i, "gives a valuation view"],
];

const NEWS_ONLY: Rule[] = [
  // In an explainer "hold it, send it, trade it" is plain English; in news it's hype.
  [/\bsend it\b/i, "uses hype words"],
  [/(^|[^\w])@\w/, "contains an @mention (automated mentions look like spam on X)"],
  [/\bearn(s|ed|ing)?\b/i, 'says "earn" (house wording: "accrued")'],
  [/\b(buy|buying|sell|selling|ape|aped|aping|hodl|hold your)\b/i, "tells people what to trade"],
];

const MENTIONS_OK = /^(orbiodotso|themeadowlab)$/i;

const PERSONA_ONLY: Rule[] = [
  // "earn" only for how the protocol works: "earn CREDIT", "earns AI credit".
  [/\bearn(s|ed|ing)?\b(?!\s+(\$?CREDIT|credits?|AI|inference|it|its|their|your|a share|graduation))/i, 'says "earn" outside "earn CREDIT" (house wording: "accrued")'],
  [
    /\b(buy|sell|ape|hold|hodl|grab)\s+(now|it now|this|more|some|the dip|a bag|before|while)\b|\b(should|must|time to|go|you need to|don'?t miss|get in and)\s+(buy|sell|ape|hold|grab|load)\b|\b(aped|aping|hodl|load up)\b/i,
    "tells people what to trade",
  ],
];

/**
 * Talks about a token's price, market cap or a move: then it needs NFA. "$1 of AI usage" and
 * "below list price" are how CREDIT works, not price talk.
 */
const PRICE_TALK = /\d\s?%|\$\d[\d.,]*\s?[KMB]\b|\bmarket ?cap\b|\bmcap\b|\b(price|chart)\s+(is|was|of|at|hit)\b|\bATH\b|\b(up|down)\s+\d/i;

/** Everything wrong with a post; empty means it may go out. */
export function checkPost(text: string, kind: PostKind = "news"): string[] {
  const problems: string[] = [];
  const t = text.trim();
  if (!t) return ["is empty"];
  if (xLength(t) > MAX_X_CHARS) problems.push(`is ${xLength(t)} characters, over X's ${MAX_X_CHARS}`);
  if ((t.match(/\$[A-Za-z][A-Za-z0-9_]*/g) ?? []).length > 1) problems.push("has more than one $cashtag (X refuses those)");
  if (LINK_RE.test(t)) problems.push("contains a link or a domain");
  for (const [re, why] of [...ALWAYS, ...(kind === "news" ? NEWS_ONLY : PERSONA_ONLY)]) if (re.test(t)) problems.push(why);
  if (kind !== "news") {
    const bad = [...t.matchAll(/(?:^|[^\w])@(\w+)/g)].map((m) => m[1]).filter((h) => !MENTIONS_OK.test(h));
    if (bad.length) problems.push(`mentions @${bad[0]} (only @orbiodotso and @themeadowlab may be tagged)`);
  }
  const needsNfa = kind === "news" || PRICE_TALK.test(t);
  if (needsNfa && !/\bNFA\b/.test(t)) problems.push(kind === "news" ? 'doesn\'t end with "NFA"' : 'talks about a price but doesn\'t end with "NFA"');
  return problems;
}

/** A thread or a poll post: every part is checked, problems named by part. */
export function checkParts(parts: string[], kind: PostKind): string[] {
  if (parts.length === 1) return checkPost(parts[0], kind);
  return parts.flatMap((p, i) => checkPost(p, kind).map((why) => `part ${i + 1} ${why}`));
}

/** X allows 2-4 poll options of at most 25 characters. */
export function checkPoll(options: string[]): string[] {
  const problems: string[] = [];
  if (options.length < 2 || options.length > 4) problems.push("a poll needs 2 to 4 options");
  options.forEach((o, i) => {
    if (!o.trim() || o.length > 25) problems.push(`poll option ${i + 1} must be 1 to 25 characters`);
    if (LINK_RE.test(o) || /0x[0-9a-fA-F]{6,}|[@#$]\w/.test(o)) problems.push(`poll option ${i + 1} has a link, address, tag or cashtag`);
  });
  return problems;
}
