import { getAddress, isAddress } from "viem";
import { AUTH, CHAIN } from "@/config";
import type { Address } from "@/lib/types";

/**
 * Tournament actions are free signed messages (no transaction, no approval), in the same style
 * as sign-in. The wallet shows the person exactly what they sign, so every field is plain text.
 * A message is accepted only if it rebuilds to exactly the same text (parseAction).
 * Client-safe: the forms build the message the wallet signs with buildAction.
 */

export type ActionKind = "pitch" | "vote" | "score" | "tender";

/** The field lines of each action, in order. Address, Chain ID and Round come first; Issued at last. */
const FIELDS = {
  pitch: ["Agent ID", "Pitch to", "Title", "Summary", "Demo"],
  vote: ["Pitch"],
  score: ["Pitch", "Master", "Score"],
  tender: ["Master", "Title", "Description", "Looking for", "Deadline"],
} as const satisfies Record<ActionKind, readonly string[]>;

/** One plain sentence under the safety line, so the wallet prompt says what the signature does. */
const NOTE: Record<ActionKind, string> = {
  pitch: "Submits this pitch to the Moofield Tournament. One pitch per agent per round.",
  vote: "Casts your vote in the Moofield Tournament. Your first vote in a round is final.",
  score: "Scores this pitch as a Master in the Moofield Tournament.",
  tender: "Posts this tender as a Master in the Moofield Tournament.",
};

export type ActionFields<K extends ActionKind> = { [F in (typeof FIELDS)[K][number]]: string };

export interface Action<K extends ActionKind = ActionKind> {
  kind: K;
  address: Address;
  chainId: number;
  round: number;
  fields: ActionFields<K>;
  issuedAt: string;
}

const HEADER = (kind: ActionKind) => `Moofield ${kind}`;

/** Text as it may appear on one message line: whitespace (newlines included) collapsed to single spaces. */
export function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function buildAction<K extends ActionKind>(a: Action<K>): string {
  const fields = FIELDS[a.kind] as readonly string[];
  const values = a.fields as Record<string, string>;
  return [
    HEADER(a.kind),
    "",
    AUTH.safetyLine,
    NOTE[a.kind],
    "",
    `Address: ${getAddress(a.address)}`,
    `Chain ID: ${a.chainId}`,
    `Round: ${a.round}`,
    ...fields.map((f) => `${f}: ${oneLine(values[f] ?? "")}`),
    `Issued at: ${a.issuedAt}`,
  ].join("\n");
}

/** Parses a message built by buildAction for `kind`. Returns null if anything is off. */
export function parseAction<K extends ActionKind>(kind: K, message: string): Action<K> | null {
  const fields = FIELDS[kind] as readonly string[];
  const lines = message.split("\n");
  if (lines.length !== 9 + fields.length || lines[0] !== HEADER(kind) || lines[2] !== AUTH.safetyLine) return null;
  const value = (i: number, label: string) => (lines[i]?.startsWith(`${label}: `) ? lines[i].slice(label.length + 2) : null);
  const address = value(5, "Address");
  const chainId = Number(value(6, "Chain ID"));
  const round = Number(value(7, "Round"));
  const issuedAt = value(8 + fields.length, "Issued at");
  if (!address || !isAddress(address) || chainId !== CHAIN.id || !Number.isInteger(round) || round < 1) return null;
  if (!issuedAt || Number.isNaN(Date.parse(issuedAt))) return null;
  const values: Record<string, string> = {};
  for (const [i, f] of fields.entries()) {
    const v = value(8 + i, f);
    if (v === null) return null;
    values[f] = v;
  }
  const parsed: Action<K> = { kind, address: address.toLowerCase() as Address, chainId, round, fields: values as ActionFields<K>, issuedAt };
  // Reject anything that doesn't round-trip exactly (extra spaces, edited labels, another note).
  return buildAction(parsed) === message ? parsed : null;
}

/** How "Pitch to" reads: an open pitch, a Master's token, or a tender id. */
export function pitchTarget(t: { masterToken: Address | null; tenderId: string | null }): string {
  if (t.tenderId) return `tender ${t.tenderId}`;
  if (t.masterToken) return `Master ${getAddress(t.masterToken)}`;
  return "open pitch (any Master)";
}

export function parsePitchTarget(s: string): { masterToken: Address | null; tenderId: string | null } | null {
  if (s === "open pitch (any Master)") return { masterToken: null, tenderId: null };
  const tender = s.match(/^tender ([a-z0-9-]{3,64})$/);
  if (tender) return { masterToken: null, tenderId: tender[1] };
  const master = s.match(/^Master (0x[0-9a-fA-F]{40})$/);
  if (master && isAddress(master[1])) return { masterToken: master[1].toLowerCase() as Address, tenderId: null };
  return null;
}

export const NO_DEMO = "none";
export const CRITERIA_SEPARATOR = " | ";
