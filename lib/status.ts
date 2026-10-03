import { configErrors, dataMode, missingConfirmItems } from "@/lib/config-check";
import { indexerState } from "@/lib/indexer/store";
import { getMooBot } from "@/lib/moobot";
import { errorMessage } from "@/lib/monitoring";
import { getReader } from "@/lib/sources";
import { orbioFetchState } from "@/lib/sources/orbio-api";
import type { SystemStatus } from "@/lib/types";
import { CHAIN } from "@/config";

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
      rpc = { status: "ok", latencyMs: Date.now() - t0, headBlock: head.toString() };
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
