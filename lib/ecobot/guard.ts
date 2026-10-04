import { LINK_RE } from "@/lib/autopost/drafts";

/**
 * The last check on every Eco Bot post, by fixed rules (the AI can't talk its way past these):
 * fits X, at most one cashtag, no links, no contract addresses, no @mentions, no hashtags,
 * the house wording, no hype or advice, and it says NFA.
 */

export const MAX_X_CHARS = 280;

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

const RULES: [RegExp, string][] = [
  [/0x[0-9a-fA-F]{40}/, "contains a contract address (never post one: people should check addresses themselves)"],
  [/(^|[^\w])@\w/, "contains an @mention (automated mentions look like spam on X)"],
  [/(^|\s)#\w/, "contains a hashtag"],
  [/\bearn(s|ed|ing)?\b/i, 'says "earn" (house wording: "accrued")'],
  [/\bsafe\b/i, 'says "safe"'],
  [/\b(profits?|passive income|risk-free|guaranteed|easy money)\b/i, "talks about profit or guarantees"],
  [/\b(buy|buying|sell|selling|ape|aped|aping|hodl|hold your)\b/i, "tells people what to trade"],
  [/\b(moon|mooning|pump|pumping|pumped|dump|dumping|dumped|gem|alpha|lfg|wagmi|ngmi|send it|rocket|degen)\b/i, "uses hype words"],
  [/\b\d+x\b/i, 'promises multiples ("10x")'],
  [/\b(not too late|price target|targets?|undervalued|overvalued|entry (point|zone|price)|good entry|bottom is in|next big)\b/i, "gives a price view or entry"],
  [/\bwill (go|rise|climb|pump|moon|hit|reach|break|explode|recover|bounce)\b/i, "predicts the price"],
];

/** Everything wrong with a post; empty means it may go out. */
export function checkPost(text: string): string[] {
  const problems: string[] = [];
  const t = text.trim();
  if (!t) return ["is empty"];
  if (xLength(t) > MAX_X_CHARS) problems.push(`is ${xLength(t)} characters, over X's ${MAX_X_CHARS}`);
  if ((t.match(/\$[A-Za-z][A-Za-z0-9_]*/g) ?? []).length > 1) problems.push("has more than one $cashtag (X refuses those)");
  if (LINK_RE.test(t)) problems.push("contains a link or a domain");
  for (const [re, why] of RULES) if (re.test(t)) problems.push(why);
  if (!/\bNFA\b/.test(t)) problems.push('doesn\'t end with "NFA"');
  return problems;
}
