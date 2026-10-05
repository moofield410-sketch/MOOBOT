import { TOURNAMENT } from "@/config";
import { LINK_RE } from "@/lib/autopost/drafts";
import type { Address } from "@/lib/types";
import type { HiddenPitch, RoundDoc, StoredPitch, StoredScore, StoredTender, StoredVote, TendersDoc } from "@/lib/tournament/types";

/**
 * The Tournament's rules, as pure functions over the stored round (unit-tested). Each apply*
 * returns the new document or throws a TournamentError with a plain reason for the person.
 * The store runs them inside a compare-and-swap, so they always see the latest state.
 */

export class TournamentError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "TournamentError";
    this.status = status;
  }
}

export const refuse = (message: string, status = 400): never => {
  throw new TournamentError(message, status);
};

const same = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

/** A signature must be fresh: signed within TOURNAMENT.signatureMaxAgeMs, and not from the future. */
export function checkFresh(issuedAt: string, now: number): void {
  const at = Date.parse(issuedAt);
  if (!Number.isFinite(at) || now - at > TOURNAMENT.signatureMaxAgeMs) refuse("This signature has expired. Please sign again.", 401);
  if (at - now > 60_000) refuse("This signature is dated in the future. Check your device's clock and sign again.", 401);
}

/** Words that make a pitch look like a scam or a money promise. Moofield promises nothing. */
const BLOCKED: [RegExp, string][] = [
  [/0x[0-9a-fA-F]{6,}/, "Please leave out contract and wallet addresses."],
  [/\b(seed phrase|recovery phrase|private key|secret phrase)\b/i, "Please don't mention seed phrases or private keys."],
  [/\b(airdrops?|giveaways?|presale|pre-sale|whitelist|free tokens?|claim (your|free|now))\b/i, "Airdrops, giveaways and presales can't be pitched here."],
  [/\b(dm me|message me|telegram me|send (eth|orbio|usdg|tokens?|funds|money))\b/i, "Please keep contact details and payments out of the pitch."],
  [/\b(earn(s|ed|ing)?|profits?|passive income|risk-free|guaranteed)\b/i, "Please leave out money promises (earnings, gains or guarantees)."],
  [/\b\d+\s?x\b/i, 'Please avoid multiples like "10x".'],
];

/** null when the text is fine; otherwise the reason it can't be posted. Links belong in the demo field only. */
export function textProblem(text: string): string | null {
  // Direction overrides and invisible characters can make a pitch read differently in a wallet
  // prompt than on the site. (Joiners inside emoji are fine.)
  if (/[‪-‮⁦-⁩​‎‏⁠﻿]/.test(text)) return "Please remove invisible or text-direction characters.";
  if (LINK_RE.test(text)) return "Please leave links out of the text: put one demo link in the Demo field instead.";
  for (const [re, why] of BLOCKED) if (re.test(text)) return why;
  return null;
}

/** An optional https link to a demo, at most TOURNAMENT.pitch.demoMax characters. null for none. */
export function checkDemoUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s || s === "none") return null;
  if (s.length > TOURNAMENT.pitch.demoMax || /\s/.test(s)) refuse("The demo link is too long or has spaces in it.");
  let u: URL | null = null;
  try {
    u = new URL(s);
  } catch {
    refuse("The demo link isn't a valid web address. It should start with https://");
  }
  if (u!.protocol !== "https:") refuse("The demo link must start with https://");
  if (u!.username || u!.password) refuse("The demo link can't contain a username or password.");
  return u!.toString();
}

function checkLength(label: string, s: string, min: number, max: number): void {
  if (s.length < min) refuse(`${label} is too short: at least ${min} characters.`);
  if (s.length > max) refuse(`${label} is too long: at most ${max} characters.`);
}

export function checkPitchText(title: string, summary: string): void {
  checkLength("The title", title, TOURNAMENT.pitch.titleMin, TOURNAMENT.pitch.titleMax);
  checkLength("The summary", summary, TOURNAMENT.pitch.summaryMin, TOURNAMENT.pitch.summaryMax);
  const problem = textProblem(`${title} ${summary}`);
  if (problem) refuse(problem);
}

export function checkTenderText(t: { title: string; description: string; criteria: string[] }): void {
  const c = TOURNAMENT.tender;
  checkLength("The title", t.title, c.titleMin, c.titleMax);
  checkLength("The description", t.description, c.descriptionMin, c.descriptionMax);
  if (t.criteria.length < 1) refuse("Add at least one thing you're looking for.");
  if (t.criteria.length > c.criteriaMax) refuse(`At most ${c.criteriaMax} things you're looking for.`);
  for (const k of t.criteria) checkLength("Each thing you're looking for", k, 2, c.criterionMax);
  if (t.criteria.some((k) => k.includes("|"))) refuse('The things you\'re looking for can\'t contain "|".');
  const problem = textProblem([t.title, t.description, ...t.criteria].join(" "));
  if (problem) refuse(problem);
}

export const visiblePitches = (doc: RoundDoc): StoredPitch[] => {
  const hidden = new Set(doc.hidden.map((h) => h.pitchId));
  return doc.pitches.filter((p) => !hidden.has(p.id));
};

/** One pitch per agent per round; a tender it answers must be open and from another agent. */
export function applyPitch(doc: RoundDoc, p: StoredPitch, tenders: StoredTender[], now: number): RoundDoc {
  if (doc.pitches.some((x) => x.agentId === p.agentId)) refuse(`${p.fighter} already pitched in Round ${doc.round}. One pitch per agent per round.`, 409);
  if (p.tenderId) {
    const t = tenders.find((x) => x.id === p.tenderId);
    if (!t) return refuse("That tender doesn't exist.", 404);
    if (Date.parse(t.deadline) <= now) refuse("That tender has closed.");
    if (same(t.masterToken, p.fighterToken)) refuse("An agent can't answer its own tender.");
  }
  if (p.masterToken && same(p.masterToken, p.fighterToken)) refuse("An agent can't pitch to itself.");
  return { ...doc, pitches: [...doc.pitches, p] };
}

/** One vote per wallet per round (the first is final), on a visible pitch, not the voter's own. */
export function applyVote(doc: RoundDoc, v: StoredVote): RoundDoc {
  const existing = doc.votes.find((x) => same(x.wallet, v.wallet));
  if (existing) {
    const title = doc.pitches.find((p) => p.id === existing.pitchId)?.title;
    refuse(`This wallet already voted in Round ${doc.round}${title ? ` (for "${title}")` : ""}. The first vote is final.`, 409);
  }
  const pitch = visiblePitches(doc).find((p) => p.id === v.pitchId);
  if (!pitch) return refuse("That pitch isn't on this round's board.", 404);
  if (same(pitch.fighterOwner, v.wallet) || same(pitch.fighterAgentWallet, v.wallet) || same(pitch.submittedBy, v.wallet)) {
    refuse("You can't vote for your own agent's pitch.", 403);
  }
  if (!(v.power > 0) && !((v.moobotPoints ?? 0) > 0)) refuse("This wallet has no voting power in this round.", 403);
  return { ...doc, votes: [...doc.votes, v] };
}

/** A Master scores each pitch once, never one from its own agent. */
export function applyScore(doc: RoundDoc, s: StoredScore): RoundDoc {
  const pitch = visiblePitches(doc).find((p) => p.id === s.pitchId);
  if (!pitch) return refuse("That pitch isn't on this round's board.", 404);
  if (same(pitch.fighterToken, s.masterToken) || (s.masterAgentId !== null && pitch.agentId === s.masterAgentId)) {
    refuse("A Master can't score its own agent's pitch.", 403);
  }
  if (same(pitch.fighterOwner, s.masterOwner) || same(pitch.fighterOwner, s.wallet) || same(pitch.submittedBy, s.wallet)) {
    refuse("A Master can't score a pitch from its own owner's agent.", 403);
  }
  if (!Number.isInteger(s.score) || s.score < 1 || s.score > TOURNAMENT.scoreMax) refuse(`Scores go from 1 to ${TOURNAMENT.scoreMax}.`);
  if (doc.scores.some((x) => x.pitchId === s.pitchId && same(x.masterToken, s.masterToken))) refuse("This Master already scored this pitch.", 409);
  return { ...doc, scores: [...doc.scores, s] };
}

/** Deadline between minDays and maxDays ahead, and at most openPerMaster open tenders per Master. */
export function applyTender(doc: TendersDoc, t: StoredTender, now: number): TendersDoc {
  const c = TOURNAMENT.tender;
  const deadline = Date.parse(t.deadline);
  const day = 86_400_000;
  if (!Number.isFinite(deadline)) refuse("The deadline isn't a valid date.");
  // The form rounds the deadline up to a whole hour (so up to 59 minutes past maxDays), and signing
  // takes a few minutes: allow for both, so every choice the form offers is accepted.
  if (deadline < now + c.minDays * day - 10 * 60_000) refuse(`The deadline must be at least ${c.minDays} day ahead.`);
  if (deadline > now + c.maxDays * day + 70 * 60_000) refuse(`The deadline can be at most ${c.maxDays} days ahead.`);
  const open = doc.tenders.filter((x) => same(x.masterToken, t.masterToken) && Date.parse(x.deadline) > now);
  if (open.length >= c.openPerMaster) refuse(`${t.masterName} already has ${c.openPerMaster} open tenders.`, 409);
  if (doc.tenders.some((x) => x.id === t.id)) refuse("That tender was already posted.", 409);
  return { tenders: [...doc.tenders, t] };
}

/** A moderator hides a pitch: it leaves the board and its votes are dropped, so those wallets can vote again. */
export function applyHide(doc: RoundDoc, pitchId: string, by: Address, reason: string, at: string): RoundDoc {
  if (!doc.pitches.some((p) => p.id === pitchId)) refuse("That pitch doesn't exist.", 404);
  if (doc.hidden.some((h) => h.pitchId === pitchId)) refuse("That pitch is already hidden.", 409);
  const removedVotes = doc.votes.filter((v) => v.pitchId === pitchId);
  const hidden: HiddenPitch = { pitchId, by, reason, at, removedVotes };
  return {
    ...doc,
    votes: doc.votes.filter((v) => v.pitchId !== pitchId),
    scores: doc.scores.filter((s) => s.pitchId !== pitchId),
    hidden: [...doc.hidden, hidden],
  };
}

/** Next free tender id for a Master: t<round>-<agent id or token prefix>-<n>. */
export function nextTenderId(doc: TendersDoc, round: number, master: { agentId: string | null; token: Address }): string {
  const who = (master.agentId ?? master.token.slice(2, 10)).toLowerCase().replace(/[^a-z0-9]/g, "");
  const prefix = `t${round}-${who}-`;
  const n = doc.tenders.filter((t) => t.id.startsWith(prefix)).length + 1;
  return `${prefix}${n}`;
}
