import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AUTH } from "@/config";
import { sessionSecret } from "@/lib/auth/session";
import { kvSetIf } from "@/lib/kv";
import type { Address } from "@/lib/types";

/**
 * Single-use sign-in nonces, bound to an address and a time. Each nonce carries its own proof
 * (an HMAC with SESSION_SECRET), so any server instance can check it: on Netlify the nonce
 * request and the verify request often land on different instances. Single use is marked in KV.
 */

const mac = (secret: string, address: string, issuedAt: number, rand: string) =>
  createHmac("sha256", secret).update(`${address.toLowerCase()}|${issuedAt}|${rand}`).digest("base64url");

/** null when sign-in isn't configured (no SESSION_SECRET in production). */
export function issueNonce(address: Address, now = Date.now()): { nonce: string; issuedAt: string } | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const rand = randomBytes(16).toString("hex");
  return { nonce: `${rand}.${mac(secret, address, now, rand)}`, issuedAt: new Date(now).toISOString() };
}

export type NonceResult = { ok: true } | { ok: false; reason: string };

/** Checks a nonce without using it up: its proof, its address and its age. Costs nothing (no storage, no chain). */
export function checkNonce(nonce: string, address: Address, issuedAt: string, now = Date.now()): NonceResult {
  const secret = sessionSecret();
  if (!secret) return { ok: false, reason: "Sign-in is not configured yet" };
  const [rand, given] = nonce.split(".");
  const at = Date.parse(issuedAt);
  if (!rand || !given || !/^[0-9a-f]{32}$/.test(rand) || !Number.isFinite(at)) return { ok: false, reason: "Unknown sign-in request" };
  const expected = Buffer.from(mac(secret, address, at, rand));
  const got = Buffer.from(given);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    return { ok: false, reason: "Sign-in request was issued to a different address or time" };
  }
  if (now - at > AUTH.nonceTtlMs || at - now > 60_000) return { ok: false, reason: "Sign-in request expired" };
  return { ok: true };
}

/** Consumes a nonce. It can only ever be used once, by the address it was issued to, within the TTL. */
export async function consumeNonce(nonce: string, address: Address, issuedAt: string, now = Date.now()): Promise<NonceResult> {
  const checked = checkNonce(nonce, address, issuedAt, now);
  if (!checked.ok) return checked;
  const rand = nonce.split(".")[0];
  const fresh = await kvSetIf(`auth:nonce:${rand}`, { usedAt: now }, null);
  return fresh ? { ok: true } : { ok: false, reason: "This sign-in request was already used" };
}
