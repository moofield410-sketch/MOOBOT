import type { Address, Hash } from "@/lib/types";

export interface LaunchpadEvent {
  kind: "launch" | "graduation";
  token: Address;
  creator: Address;
  blockNumber: bigint;
  txHash: Hash;
  /** Unix ms of the block. */
  timestamp: number;
}

export interface TokenDetails {
  name: string;
  ticker: string;
  liquidityUsd: number | null;
  holderCount: number | null;
}

export type TokenSymbol = "ORBIO" | "MOOBOT";

/**
 * Everything the site reads from chain or Orbio data, in one interface.
 * Read-only by design: there is deliberately no method that writes or signs.
 */
export interface ChainReader {
  kind: "mock" | "chain";
  startBlock(): bigint;
  headBlock(): Promise<bigint>;
  launchpadEvents(fromBlock: bigint, toBlock: bigint): Promise<LaunchpadEvent[]>;
  tokenDetails(token: Address): Promise<TokenDetails>;
  /** Returns null when there is no token address (yet) or no balance source is connected. */
  balanceOf(
    token: { symbol: TokenSymbol; address: Address | null },
    owner: Address,
    blockNumber?: bigint,
  ): Promise<{ raw: bigint; decimals: number } | null>;
}
