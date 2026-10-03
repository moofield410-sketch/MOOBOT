import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AUTH } from "@/config";
import type { Address } from "@/lib/types";

/** HMAC-signed session tokens: base64url(payload).base64url(hmac). No database needed. */

export const SESSION_COOKIE = "moobot_session";

const g = globalThis as unknown as { __moobotDevSecret?: string };

/** SESSION_SECRET from the environment. In development only, falls back to a per-process random secret. */
export function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") return null;
  return (g.__moobotDevSecret ??= randomBytes(32).toString("hex"));
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const sign = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("base64url");

export function createSessionToken(address: Address, secret: string, now = Date.now()): string {
  const payload = b64(JSON.stringify({ a: address.toLowerCase(), e: now + AUTH.sessionTtlMs }));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): Address | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { a, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { a: string; e: number };
    return typeof a === "string" && typeof e === "number" && e > now ? (a as Address) : null;
  } catch {
    return null;
  }
}
