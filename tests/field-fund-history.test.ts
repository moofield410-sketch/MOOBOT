import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { dailyFromTotals, getFieldFundHistory, recordFieldFundTotal } from "@/lib/field-fund-history";
import { kvClearMemory } from "@/lib/kv";

const C = 1_000_000n; // one $CREDIT in atoms
const at = (day: string, hour = 12) => Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);

describe("field fund history", () => {
  beforeEach(() => kvClearMemory());

  it("turns running totals into per-day amounts, oldest first", () => {
    const days = dailyFromTotals({ "2026-10-06": String(250n * C), "2026-10-04": String(100n * C), "2026-10-05": String(160n * C) });
    assert.deepEqual(days, [
      { day: "2026-10-05", credits: 60 },
      { day: "2026-10-06", credits: 90 },
    ]);
  });

  it("never shows a negative day and ignores junk keys", () => {
    assert.deepEqual(dailyFromTotals({ "2026-10-04": "500", "2026-10-05": "100", junk: "9", "2026-10-06": "x" }), [{ day: "2026-10-05", credits: 0 }]);
  });

  it("keeps the last total of each day and builds the chart by itself", async () => {
    await recordFieldFundTotal(10n * C, at("2026-10-04", 1));
    await recordFieldFundTotal(40n * C, at("2026-10-04", 23));
    assert.deepEqual(await getFieldFundHistory(), []); // one day: nothing to compare yet
    await recordFieldFundTotal(70n * C, at("2026-10-05"));
    assert.deepEqual(await getFieldFundHistory(), [{ day: "2026-10-05", credits: 30 }]);
  });
});
