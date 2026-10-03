import { getAddress, isAddress } from "viem";
import { AUTH, CHAIN } from "@/config";
import type { Address } from "@/lib/types";

/**
 * Sign-in message. Sign-in is by signed message only: no transaction, no approval.
 * The safety line must appear verbatim on its own line.
 */

export interface SignInFields {
  address: Address;
  chainId: number;
  nonce: string;
  issuedAt: string;
}

export function buildSignInMessage(f: SignInFields): string {
  return [
    "Moofield sign-in",
    "",
    AUTH.safetyLine,
    "",
    `Address: ${getAddress(f.address)}`,
    `Chain ID: ${f.chainId}`,
    `Nonce: ${f.nonce}`,
    `Issued at: ${f.issuedAt}`,
  ].join("\n");
}

/** Parses a message built by buildSignInMessage. Returns null if anything is off. */
export function parseSignInMessage(message: string): SignInFields | null {
  const lines = message.split("\n");
  if (lines.length !== 8 || lines[0] !== "Moofield sign-in" || lines[2] !== AUTH.safetyLine) return null;
  const field = (i: number, label: string) => (lines[i].startsWith(`${label}: `) ? lines[i].slice(label.length + 2) : null);
  const address = field(4, "Address");
  const chainId = Number(field(5, "Chain ID"));
  const nonce = field(6, "Nonce");
  const issuedAt = field(7, "Issued at");
  if (!address || !isAddress(address) || !nonce || !issuedAt || Number.isNaN(Date.parse(issuedAt))) return null;
  if (chainId !== CHAIN.id) return null;
  const parsed: SignInFields = { address: address.toLowerCase() as Address, chainId, nonce, issuedAt };
  // Reject anything that doesn't round-trip exactly (extra spaces, altered casing of labels, etc.).
  return buildSignInMessage(parsed) === message ? parsed : null;
}
