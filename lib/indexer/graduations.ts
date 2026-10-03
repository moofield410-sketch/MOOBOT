import { SCANNER } from "@/config";
import { errorMessage } from "@/lib/monitoring";
import type { ChainReader } from "@/lib/sources/types";
import { indexerState, type IndexerState } from "@/lib/indexer/store";

/**
 * Graduation scanner. Walks launchpad logs from the last scanned block to the
 * chain head in chunks, and registers a Master only for graduation events.
 * Masters are never added by hand.
 */

export interface ScanResult {
  fromBlock: bigint;
  toBlock: bigint;
  added: number;
}

export async function scanGraduations(
  reader: ChainReader,
  state: IndexerState = indexerState(),
  chunk: bigint = SCANNER.blockChunk,
): Promise<ScanResult> {
  let added = 0;
  try {
    const startFrom = state.lastScannedBlock === null ? reader.startBlock() : state.lastScannedBlock + 1n;
    const head = await reader.headBlock();
    state.lastHeadBlock = head;

    for (let from = startFrom; from <= head; from += chunk) {
      const to = from + chunk - 1n < head ? from + chunk - 1n : head;
      const events = await reader.launchpadEvents(from, to);

      for (const ev of events) {
        if (ev.kind !== "graduation") continue;
        const key = ev.token.toLowerCase();
        if (state.masters.has(key)) continue;

        const details = await reader.tokenDetails(ev.token);
        state.masters.set(key, {
          tokenAddress: ev.token,
          name: details.name,
          ticker: details.ticker,
          ownerWallet: ev.creator,
          agentWallet: null,
          orbioAgentId: null,
          launchedAt: null,
          launchTx: null,
          marketCapUsd: null,
          explorerUrl: null,
          orbioUrl: null,
          logoUrl: null,
          graduatedAt: new Date(ev.timestamp).toISOString(),
          gradTx: ev.txHash,
          gradBlock: ev.blockNumber.toString(),
          liquidityUsd: details.liquidityUsd,
          holderCount: details.holderCount,
          contactRoute: null,
          openToPitches: false,
          description: null,
          category: null,
          isMock: reader.kind === "mock",
        });
        added++;
      }
      // Record progress per chunk so a failure resumes where it stopped.
      state.lastScannedBlock = to;
    }

    state.lastScanAt = Date.now();
    state.lastScanError = null;
    return { fromBlock: startFrom, toBlock: head, added };
  } catch (err) {
    state.lastScanError = errorMessage(err);
    throw err;
  }
}

const g = globalThis as unknown as { __moobotScan?: Promise<ScanResult> | null };

/** Runs a scan if the last one is older than SCANNER.intervalMs. Concurrent callers share one scan. */
export async function scanIfDue(reader: ChainReader, force = false): Promise<ScanResult | null> {
  const state = indexerState();
  const due = force || state.lastScanAt === null || Date.now() - state.lastScanAt >= SCANNER.intervalMs;
  if (!due) return null;
  g.__moobotScan ??= scanGraduations(reader, state).finally(() => {
    g.__moobotScan = null;
  });
  return g.__moobotScan;
}
