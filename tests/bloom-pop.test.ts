import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COLS, EMPTY, type Grid, floating, isEmpty, kindsInGrid, layout, matchGroup, neighbors, pushRow, snapCell } from "@/lib/bloom-pop";

/** Build a grid from strings: one char per column, "." for empty, digits for seed kinds. */
function grid(rows: string[], shifted = false): Grid {
  return { cells: rows.map((s) => [...s.padEnd(COLS, ".")].map((ch) => (ch === "." ? EMPTY : Number(ch)))), shifted };
}

describe("bloom pop grid", () => {
  it("finds neighbors for unshifted and shifted rows", () => {
    const g = grid(["...........", "...........", "..........."]);
    // Row 1 is shifted right: it touches columns c and c+1 above and below.
    assert.deepEqual(new Set(neighbors(g, 1, 3).map(String)), new Set(["1,2", "1,4", "0,3", "0,4", "2,3", "2,4"].map(String)));
    // Row 2 is not shifted: it touches columns c-1 and c (rows below the grid count: shots land there).
    assert.deepEqual(new Set(neighbors(g, 2, 3).map(String)), new Set(["2,2", "2,4", "1,2", "1,3", "3,2", "3,3"].map(String)));
  });

  it("matches a connected group of one kind only", () => {
    const g = grid(["0012", "0.1", "3"]);
    assert.equal(matchGroup(g, 0, 0).length, 3);
    assert.equal(matchGroup(g, 0, 2).length, 2);
    assert.equal(matchGroup(g, 1, 1).length, 0);
  });

  it("drops seeds that lose their link to the top row", () => {
    const g = grid(["1..........", "2..........", "3.........."]);
    g.cells[1][0] = EMPTY;
    // Row 2 col 0 touched only row 1 col 0 (row 2 is unshifted: neighbors above are col -1 and 0).
    assert.deepEqual(floating(g), [[2, 0]]);
  });

  it("pushes a row in from the top and flips the shift", () => {
    const g = grid(["0"]);
    pushRow(g, 3, () => 0.99);
    assert.equal(g.cells.length, 2);
    assert.equal(g.shifted, true);
    assert.ok(g.cells[0].every((v) => v === 2));
    assert.equal(g.cells[1][0], 0);
  });

  it("only loads kinds still on the board", () => {
    assert.deepEqual(kindsInGrid(grid(["4.2", "..2"])), [2, 4]);
    assert.ok(isEmpty(grid(["...."])));
  });

  it("snaps a shot to an attached empty cell", () => {
    const g = grid(["00000000000"]);
    const { center } = layout(16, 0);
    const target = center(g, 1, 5);
    assert.deepEqual(snapCell(g, target.x + 2, target.y + 3, 16, 0), [1, 5]);
  });
});

describe("bloom pop daily field", () => {
  it("gives everyone the same board for a day, and a different one the next day", async () => {
    const { createGrid, seededRng } = await import("@/lib/bloom-pop");
    const a = createGrid(6, 4, seededRng("2026-10-04"));
    const b = createGrid(6, 4, seededRng("2026-10-04"));
    const c = createGrid(6, 4, seededRng("2026-10-05"));
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
  });

  it("accepts only real, non-future share links", async () => {
    const { parseShare } = await import("@/lib/bloom-pop");
    const now = Date.parse("2026-10-04T15:00:00Z");
    assert.deepEqual(parseShare("2026-10-04", "1240", now), { day: "2026-10-04", score: 1240 });
    assert.equal(parseShare("2026-10-05", "10", now), null);
    assert.equal(parseShare("2026-02-30", "10", now), null);
    assert.equal(parseShare("2026-10-04", "-5", now), null);
    assert.equal(parseShare("2026-10-04", "12345678", now), null);
  });
});
