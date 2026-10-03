import { isAddress } from "viem";
import { readWalletBalances } from "@/lib/balances";
import type { Address } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * $ORBIO and $MOOBOT balances for any address. Optional ?block=<number> reads at a snapshot block.
 * Read-only: takes an address, never a signature or transaction.
 */
export async function GET(req: Request, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  if (!isAddress(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }

  const blockParam = new URL(req.url).searchParams.get("block");
  let block: bigint | undefined;
  if (blockParam !== null) {
    if (!/^\d+$/.test(blockParam)) return Response.json({ error: "Invalid block" }, { status: 400 });
    block = BigInt(blockParam);
  }

  const result = await readWalletBalances(address.toLowerCase() as Address, block);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
