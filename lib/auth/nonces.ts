import { randomBytes } from "node:crypto";
import { AUTH } from "@/config";
import type { Address } from "@/lib/types";

/**
 * Single-use sign-in nonces, bound to an address. In memory, so this works on one server
 * instance only; move to Redis/KV before running several instances.
 */

interface Entry {
  address: string;
  issuedAt: number;
}

const MAX_ENTRIES = 10_000;
const g = globalThis as unknown as { __moobotNonces?: Map<string, Entry> };
const store = (g.__moobotNonces ??= new Map());

function prune(now: number) {
  for (const [k, v] of store) if (now - v.issuedAt > AUTH.nonceTtlMs) store.delete(k);
  while (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
}

export function issueNonce(address: Address, now = Date.now()): { nonce: string; issuedAt: string } {
  prune(now);
  const nonce = randomBytes(16).toString("hex");
  store.set(nonce, { address: address.toLowerCase(), issuedAt: now });
  return { nonce, issuedAt: new Date(now).toISOString() };
}

export type NonceResult = { ok: true } | { ok: false; reason: string };

/** Consumes a nonce. It can only ever be used once, by the address it was issued to, within the TTL. */
export function consumeNonce(nonce: string, address: Address, issuedAt: string, now = Date.now()): NonceResult {
  const e = store.get(nonce);
  if (!e) return { ok: false, reason: "Unknown or already used sign-in request" };
  store.delete(nonce);
  if (now - e.issuedAt > AUTH.nonceTtlMs) return { ok: false, reason: "Sign-in request expired" };
  if (e.address !== address.toLowerCase()) return { ok: false, reason: "Sign-in request was issued to a different address" };
  if (Date.parse(issuedAt) !== e.issuedAt) return { ok: false, reason: "Sign-in request time does not match" };
  return { ok: true };
}
