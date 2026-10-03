import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scanGraduations } from "@/lib/indexer/graduations";
import { createIndexerState } from "@/lib/indexer/store";
import { MOCK_AGENTS, MOCK_NON_GRADUATED_TOKEN, mockReader } from "@/lib/sources/mock";
import type { ChainReader } from "@/lib/sources/types";

describe("graduation scanner", () => {
  it("registers only graduated agents", async () => {
    const state = createIndexerState();
    const res = await scanGraduations(mockReader, state, 500n);

    const graduated = MOCK_AGENTS.filter((a) => a.graduatedBlock !== null);
    assert.equal(res.added, graduated.length);
    assert.equal(state.masters.size, 8);
    assert.equal(state.masters.has(MOCK_NON_GRADUATED_TOKEN), false);
    assert.ok([...state.masters.values()].every((m) => m.isMock));
  });

  it("is idempotent and resumes from the last scanned block", async () => {
    const state = createIndexerState();
    await scanGraduations(mockReader, state);
    const again = await scanGraduations(mockReader, state);
    assert.equal(again.added, 0);
    assert.equal(state.masters.size, 8);
  });

  it("keeps progress and records the error when a chunk fails", async () => {
    const state = createIndexerState();
    let calls = 0;
    const flaky: ChainReader = {
      ...mockReader,
      launchpadEvents: async (from, to) => {
        if (++calls === 3) throw new Error("RPC timeout");
        return mockReader.launchpadEvents(from, to);
      },
    };

    await assert.rejects(scanGraduations(flaky, state, 1_000n), /RPC timeout/);
    assert.equal(state.lastScanError, "RPC timeout");
    assert.equal(state.lastScannedBlock, mockReader.startBlock() + 2n * 1_000n - 1n);

    await scanGraduations(mockReader, state, 1_000n);
    assert.equal(state.lastScanError, null);
    assert.equal(state.masters.size, 8);
  });
});
