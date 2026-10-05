import { configErrors, dataMode, missingConfirmItems } from "@/lib/config-check";
import { indexerState } from "@/lib/indexer/store";
import { getMooBot } from "@/lib/moobot";
import { errorMessage } from "@/lib/monitoring";
import { getReader } from "@/lib/sources";
import { orbioFetchState } from "@/lib/sources/orbio-api";
import type { SystemStatus } from "@/lib/types";
import { erc20Abi } from "viem";
import { CHAIN, CONTRACTS } from "@/config";
import { publicClientOrNull, rpcUrls } from "@/lib/sources/chain";

/** About three days of Robinhood Chain blocks (~100 ms each): a whole Tournament round. */
const ROUND_OF_BLOCKS = 2_600_000n;

/**
 * Whether the RPC still answers a balance from a round ago. With an archive node every vote's
 * power is read directly at the snapshot block; without one it's rebuilt from transfer logs,
 * which gets slow late in a round. One cheap read.
 */
async function keepsOldState(head: bigint): Promise<boolean | null> {
  const client = publicClientOrNull();
  const token = CONTRACTS.orbioToken;
  if (!client || !token || head <= ROUND_OF_BLOCKS) return null;
  try {
    await client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [token], blockNumber: head - ROUND_OF_BLOCKS });
    return true;
  } catch {
    return false;
  }
}

export async function getStatus(): Promise<SystemStatus> {
  const reader = getReader();
  const state = indexerState();
  let rpc: SystemStatus["rpc"];

  if (reader.kind === "mock") {
    rpc = { status: "mock", latencyMs: null, headBlock: (await reader.headBlock()).toString() };
  } else if (!process.env[CHAIN.rpcUrlEnv]) {
    rpc = { status: "not-configured", latencyMs: null, headBlock: null };
  } else {
    const t0 = Date.now();
    try {
      const head = await reader.headBlock();
      rpc = { status: "ok", latencyMs: Date.now() - t0, headBlock: head.toString(), archive: await keepsOldState(head), endpoints: rpcUrls().length };
    } catch (err) {
      rpc = { status: "down", latencyMs: null, headBlock: null, error: errorMessage(err) };
    }
  }

  const head = rpc.headBlock !== null ? BigInt(rpc.headBlock) : state.lastHeadBlock;
  const lag = head !== null && state.lastScannedBlock !== null ? head - state.lastScannedBlock : null;

  return {
    mode: dataMode(),
    rpc,
    indexer: {
      lastScannedBlock: state.lastScannedBlock?.toString() ?? null,
      lagBlocks: lag?.toString() ?? null,
      lastScanAt: state.lastScanAt ? new Date(state.lastScanAt).toISOString() : null,
      lastScanError: state.lastScanError,
    },
    orbio: reader.kind === "mock" ? null : { ...orbioFetchState() },
    moobot: await getMooBot(),
    configErrors: configErrors(),
    missingConfirm: missingConfirmItems(),
    checkedAt: new Date().toISOString(),
  };
}
