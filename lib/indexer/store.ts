import type { Master } from "@/lib/types";

/**
 * Indexer state. In-memory for now (survives dev hot reloads via globalThis).
 * Replace with the Postgres `agents` table (section 7) without changing callers.
 */
export interface IndexerState {
  masters: Map<string, Master>;
  lastScannedBlock: bigint | null;
  lastHeadBlock: bigint | null;
  lastScanAt: number | null;
  lastScanError: string | null;
}

export function createIndexerState(): IndexerState {
  return { masters: new Map(), lastScannedBlock: null, lastHeadBlock: null, lastScanAt: null, lastScanError: null };
}

const g = globalThis as unknown as { __moobotIndexer?: IndexerState };

export function indexerState(): IndexerState {
  return (g.__moobotIndexer ??= createIndexerState());
}
