import { hexToBigInt, keccak256 } from "viem";
import type { Address, Hash } from "@/lib/types";
import type { ChainReader, LaunchpadEvent, TokenDetails } from "@/lib/sources/types";

/**
 * Clearly fake launchpad data. Every name is invented and every address starts
 * with 0xfa4e ("fake"), so nothing here can be mistaken for a real Orbio agent.
 */

const START_BLOCK = 1_000_000n;
const HEAD_BLOCK = 1_009_000n;

const addr = (n: number) => `0xfa4e${n.toString(16).padStart(36, "0")}` as Address;
export const mockTokenAddress = addr;
const owner = (n: number) => `0x0000fa4e${n.toString(16).padStart(32, "0")}` as Address;
const tx = (n: number) => `0xfa4e${n.toString(16).padStart(60, "0")}` as Hash;

interface MockAgent extends TokenDetails {
  id: number;
  launchedBlock: number;
  /** null = launched but never graduated. */
  graduatedBlock: number | null;
  graduatedAt: string | null;
}

export const MOCK_AGENTS: MockAgent[] = [
  { id: 1, name: "Placeholder Panda", ticker: "PLCHLD", liquidityUsd: 48_200, holderCount: 1_204, launchedBlock: 1_000_120, graduatedBlock: 1_000_900, graduatedAt: "2026-09-02T09:14:00Z" },
  { id: 2, name: "Dummy Dragonfly", ticker: "DUMMY", liquidityUsd: 22_750, holderCount: 611, launchedBlock: 1_000_400, graduatedBlock: 1_001_850, graduatedAt: "2026-09-05T17:40:00Z" },
  { id: 3, name: "Sample Sensei", ticker: "SMPL", liquidityUsd: 91_300, holderCount: 2_877, launchedBlock: 1_001_000, graduatedBlock: 1_002_700, graduatedAt: "2026-09-09T12:03:00Z" },
  { id: 4, name: "Lorem Ipsum Bot", ticker: "LOREM", liquidityUsd: 15_980, holderCount: 342, launchedBlock: 1_002_100, graduatedBlock: 1_003_900, graduatedAt: "2026-09-13T21:27:00Z" },
  { id: 5, name: "Fixture Falcon", ticker: "FIXTR", liquidityUsd: 63_400, holderCount: 1_955, launchedBlock: 1_003_300, graduatedBlock: 1_005_100, graduatedAt: "2026-09-18T06:51:00Z" },
  { id: 6, name: "Stub Samurai", ticker: "STUB", liquidityUsd: 37_120, holderCount: 980, launchedBlock: 1_004_600, graduatedBlock: 1_006_300, graduatedAt: "2026-09-22T14:09:00Z" },
  { id: 7, name: "Testbed Tortoise", ticker: "TSTBED", liquidityUsd: 9_870, holderCount: 205, launchedBlock: 1_005_800, graduatedBlock: 1_007_500, graduatedAt: "2026-09-26T19:33:00Z" },
  { id: 8, name: "Mockingbird Mk.II", ticker: "MOCK", liquidityUsd: 120_450, holderCount: 3_410, launchedBlock: 1_006_900, graduatedBlock: 1_008_600, graduatedAt: "2026-09-30T11:58:00Z" },
  // Launched but never graduated: must never appear in the Masters list.
  { id: 9, name: "Never Graduated Newt", ticker: "NOGRAD", liquidityUsd: 1_200, holderCount: 41, launchedBlock: 1_007_200, graduatedBlock: null, graduatedAt: null },
];

export const MOCK_NON_GRADUATED_TOKEN = addr(9);

function mockEvents(): LaunchpadEvent[] {
  const events: LaunchpadEvent[] = [];
  for (const a of MOCK_AGENTS) {
    events.push({
      kind: "launch",
      token: addr(a.id),
      creator: owner(a.id),
      blockNumber: BigInt(a.launchedBlock),
      txHash: tx(a.id * 2),
      timestamp: Date.parse("2026-09-01T00:00:00Z") + (a.launchedBlock - Number(START_BLOCK)) * 2_000,
    });
    if (a.graduatedBlock !== null && a.graduatedAt !== null) {
      events.push({
        kind: "graduation",
        token: addr(a.id),
        creator: owner(a.id),
        blockNumber: BigInt(a.graduatedBlock),
        txHash: tx(a.id * 2 + 1),
        timestamp: Date.parse(a.graduatedAt),
      });
    }
  }
  return events.sort((x, y) => Number(x.blockNumber - y.blockNumber));
}

/** Deterministic fake balance per address, so the same wallet always shows the same mock numbers. */
function mockBalance(seed: string): bigint {
  const h = hexToBigInt(keccak256(new TextEncoder().encode(seed)));
  return (h % 5_000_000n) * 10n ** 18n;
}

export const mockReader: ChainReader = {
  kind: "mock",
  startBlock: () => START_BLOCK,
  headBlock: async () => HEAD_BLOCK,
  launchpadEvents: async (from, to) =>
    mockEvents().filter((e) => e.blockNumber >= from && e.blockNumber <= to),
  tokenDetails: async (token) => {
    const a = MOCK_AGENTS.find((m) => addr(m.id) === token.toLowerCase());
    if (!a) throw new Error(`Unknown mock token ${token}`);
    return { name: a.name, ticker: a.ticker, liquidityUsd: a.liquidityUsd, holderCount: a.holderCount };
  },
  balanceOf: async (token, ownerAddr, blockNumber) =>
    token.address === null
      ? null
      : { raw: mockBalance(`${token.symbol}:${ownerAddr.toLowerCase()}:${blockNumber ?? "latest"}`), decimals: 18 },
};
