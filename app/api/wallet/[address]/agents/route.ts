import { isAddress } from "viem";
import { CACHE, USE_MOCK_DATA } from "@/config";
import { cached } from "@/lib/cache";
import { getMasters } from "@/lib/registry";
import { fetchAgentsByWallet } from "@/lib/sources/orbio-api";
import type { Address, OwnedAgent } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Launchpad agents owned or operated by a wallet, and whether each graduated.
 * Preview mode: matched against the sample Masters. Real mode: Orbio's `wallet` filter (server-side, cached).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  if (!isAddress(address)) return Response.json({ error: "Invalid address" }, { status: 400 });
  const wallet = address.toLowerCase() as Address;

  const result = await cached<OwnedAgent[]>(`wallet-agents:${wallet}`, { ttlMs: CACHE.walletAgentsTtlMs, staleMs: CACHE.mastersStaleMs }, async () => {
    if (USE_MOCK_DATA) {
      const masters = (await getMasters()).data ?? [];
      const owned = masters
        .filter((m) => m.ownerWallet.toLowerCase() === wallet)
        .map((m) => ({ agentId: m.orbioAgentId, name: m.name, ticker: m.ticker, tokenAddress: m.tokenAddress, graduated: true, explorerUrl: null, logoUrl: m.logoUrl }));
      return { value: owned, source: "mock" };
    }
    return { value: await fetchAgentsByWallet(wallet), source: "orbio" };
  });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
