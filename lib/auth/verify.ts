import { verifyMessage, type Hex } from "viem";
import { AUTH } from "@/config";
import { parseSignInMessage } from "@/lib/auth/message";
import { consumeNonce } from "@/lib/auth/nonces";
import { publicClientOrNull } from "@/lib/sources/chain";
import type { Address } from "@/lib/types";

export type VerifyResult = { ok: true; address: Address } | { ok: false; reason: string };

/**
 * Verifies a sign-in: exact message format with the safety line, single-use nonce, and a valid
 * signature. With RPC_URL set, the public client also verifies smart-contract wallets.
 */
export async function verifySignIn(message: string, signature: string, now = Date.now()): Promise<VerifyResult> {
  if (!message.includes(AUTH.safetyLine)) return { ok: false, reason: "Message is missing the safety line" };
  const fields = parseSignInMessage(message);
  if (!fields) return { ok: false, reason: "Message is not a valid Moofield sign-in" };
  if (!/^0x[0-9a-fA-F]+$/.test(signature)) return { ok: false, reason: "Invalid signature format" };

  // The signature first, then the nonce: a wrong signature must not write anything to storage.
  const client = publicClientOrNull();
  const valid = client
    ? await client.verifyMessage({ address: fields.address, message, signature: signature as Hex })
    : await verifyMessage({ address: fields.address, message, signature: signature as Hex });
  if (!valid) return { ok: false, reason: "Signature does not match the address" };

  const nonce = await consumeNonce(fields.nonce, fields.address, fields.issuedAt, now);
  return nonce.ok ? { ok: true, address: fields.address } : nonce;
}
