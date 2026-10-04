import { isAddress } from "viem";
import { CHAIN } from "@/config";
import { buildSignInMessage } from "@/lib/auth/message";
import { issueNonce } from "@/lib/auth/nonces";
import type { Address } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Issues a single-use sign-in message for an address. The wallet signs it; nothing else happens. */
export function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!address || !isAddress(address)) return Response.json({ error: "Invalid address" }, { status: 400 });
  const issued = issueNonce(address as Address);
  if (!issued) return Response.json({ error: "Sign-in is not configured yet" }, { status: 503 });
  const { nonce, issuedAt } = issued;
  const message = buildSignInMessage({ address: address as Address, chainId: CHAIN.id, nonce, issuedAt });
  return Response.json({ message }, { headers: { "Cache-Control": "no-store" } });
}
