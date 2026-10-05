import { createPublicClient, erc20Abi, fallback, getAddress, http, parseAbiItem, type AbiEvent, type PublicClient } from "viem";
import { robinhood } from "viem/chains";
import { CHAIN, CONTRACTS, GRADUATION } from "@/config";
import type { Address, Hash } from "@/lib/types";
import type { ChainReader, LaunchpadEvent } from "@/lib/sources/types";

/**
 * Real chain reader. Uses a viem *public* client only: reads, never writes.
 * Most methods throw until the CONFIRM values in config.ts are filled in.
 */

let client: PublicClient | null = null;

function rpc(): PublicClient {
  const c = publicClientOrNull();
  if (!c) throw new Error(`${CHAIN.rpcUrlEnv} is not set`);
  return c;
}

/**
 * The RPC endpoints from RPC_URL: one URL, or several separated by commas, best first (put an
 * archive node first: it can read balances at any old block). Anything that isn't an http(s) URL
 * is ignored.
 */
export function rpcUrls(raw: string | undefined = process.env[CHAIN.rpcUrlEnv]): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\/\S+$/.test(s));
}

/**
 * Server-side public client on the confirmed chain, or null while RPC_URL is not set. With more
 * than one endpoint, a request that fails or times out on one is sent to the next, in order.
 */
export function publicClientOrNull(): PublicClient | null {
  const urls = rpcUrls();
  if (urls.length === 0) return null;
  client ??= createPublicClient({
    chain: robinhood,
    transport:
      urls.length === 1
        ? http(urls[0], { timeout: 10_000, retryCount: 2 })
        : fallback(
            urls.map((u) => http(u, { timeout: 10_000, retryCount: 1 })),
            { retryCount: 1 },
          ),
  }) as PublicClient;
  return client;
}

function graduationEvent(): AbiEvent {
  if (GRADUATION.rule !== "event") {
    throw new Error(`Graduation rule "${GRADUATION.rule}" is not implemented yet`);
  }
  if (!GRADUATION.eventSignature) throw new Error("GRADUATION.eventSignature is not configured");
  return parseAbiItem(GRADUATION.eventSignature) as AbiEvent;
}

export const chainReader: ChainReader = {
  kind: "chain",

  startBlock() {
    if (CONTRACTS.launchpadDeployBlock === null) throw new Error("CONTRACTS.launchpadDeployBlock is not configured");
    return CONTRACTS.launchpadDeployBlock;
  },

  headBlock: () => rpc().getBlockNumber(),

  async launchpadEvents(fromBlock, toBlock) {
    if (CONTRACTS.launchpad.length === 0) throw new Error("CONTRACTS.launchpad is not configured");
    const logs = await rpc().getLogs({ address: CONTRACTS.launchpad, event: graduationEvent(), fromBlock, toBlock });

    const blockTimes = new Map<bigint, number>();
    const events: LaunchpadEvent[] = [];
    for (const log of logs) {
      if (log.blockNumber === null || log.transactionHash === null) continue; // pending
      const args = (log as unknown as { args: Record<string, unknown> }).args;
      const token = args[GRADUATION.tokenArg];
      const creator = args[GRADUATION.creatorArg];
      if (typeof token !== "string" || typeof creator !== "string") {
        throw new Error("Graduation event args do not match GRADUATION.tokenArg / creatorArg");
      }
      if (!blockTimes.has(log.blockNumber)) {
        const block = await rpc().getBlock({ blockNumber: log.blockNumber });
        blockTimes.set(log.blockNumber, Number(block.timestamp) * 1000);
      }
      events.push({
        kind: "graduation",
        token: getAddress(token).toLowerCase() as Address,
        creator: getAddress(creator).toLowerCase() as Address,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash as Hash,
        timestamp: blockTimes.get(log.blockNumber)!,
      });
    }
    return events;
  },

  async tokenDetails(token) {
    const [name, ticker] = await Promise.all([
      rpc().readContract({ address: token, abi: erc20Abi, functionName: "name" }),
      rpc().readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
    ]);
    // CONFIRM: liquidity and holder count need an indexer or Orbio API.
    return { name, ticker, liquidityUsd: null, holderCount: null };
  },

  async balanceOf({ address }, owner, blockNumber) {
    // No token address yet, or no RPC connected yet: "not configured", not an error.
    if (!address || !publicClientOrNull()) return null;
    const [raw, decimals] = await Promise.all([
      rpc().readContract({ address, abi: erc20Abi, functionName: "balanceOf", args: [owner], blockNumber }),
      rpc().readContract({ address, abi: erc20Abi, functionName: "decimals" }),
    ]);
    return { raw, decimals };
  },
};
