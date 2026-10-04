/**
 * Bloom Pop: the pure grid logic for the home page seed shooter (components/home/BloomPop.tsx).
 * A hex grid of seeds, `COLS` wide. Every other row is shifted half a cell right; which rows are
 * shifted flips each time Crowley the crow pushes a new row in from the top (`shifted`).
 * No DOM here, so it is tested directly (tests/bloom-pop.test.ts).
 */

export const COLS = 11;
export const EMPTY = -1;

/** Seed kinds, in palette order: leaf, sun, dew drop, clover flower, berry. */
export const SEED_KINDS = 5;

export type Grid = { cells: number[][]; shifted: boolean };
export type Cell = [row: number, col: number];
export type Rng = () => number;

export function isOffset(g: Grid, r: number) {
  return (r % 2 === 1) !== g.shifted;
}

function randomRow(colors: number, rng: Rng) {
  return Array.from({ length: COLS }, () => Math.floor(rng() * colors));
}

export function createGrid(rows: number, colors: number, rng: Rng = Math.random): Grid {
  return { cells: Array.from({ length: rows }, () => randomRow(colors, rng)), shifted: false };
}

export function get(g: Grid, r: number, c: number) {
  return g.cells[r]?.[c] ?? EMPTY;
}

export function set(g: Grid, r: number, c: number, v: number) {
  while (g.cells.length <= r) g.cells.push(Array(COLS).fill(EMPTY));
  g.cells[r][c] = v;
}

export function neighbors(g: Grid, r: number, c: number): Cell[] {
  // A shifted row touches columns c and c+1 above and below; an unshifted row touches c-1 and c.
  const d = isOffset(g, r) ? 0 : -1;
  const out: Cell[] = [
    [r, c - 1],
    [r, c + 1],
    [r - 1, c + d],
    [r - 1, c + d + 1],
    [r + 1, c + d],
    [r + 1, c + d + 1],
  ];
  return out.filter(([nr, nc]) => nr >= 0 && nc >= 0 && nc < COLS);
}

/** Every seed connected to (r, c) with the same kind, including (r, c). */
export function matchGroup(g: Grid, r: number, c: number): Cell[] {
  const kind = get(g, r, c);
  if (kind === EMPTY) return [];
  const seen = new Set([`${r},${c}`]);
  const queue: Cell[] = [[r, c]];
  for (let i = 0; i < queue.length; i++) {
    for (const [nr, nc] of neighbors(g, ...queue[i])) {
      const key = `${nr},${nc}`;
      if (!seen.has(key) && get(g, nr, nc) === kind) {
        seen.add(key);
        queue.push([nr, nc]);
      }
    }
  }
  return queue;
}

/** Seeds no longer connected to the top row: they fall. */
export function floating(g: Grid): Cell[] {
  const seen = new Set<string>();
  const queue: Cell[] = [];
  for (let c = 0; c < COLS; c++) {
    if (get(g, 0, c) !== EMPTY) {
      seen.add(`0,${c}`);
      queue.push([0, c]);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    for (const [nr, nc] of neighbors(g, ...queue[i])) {
      const key = `${nr},${nc}`;
      if (!seen.has(key) && get(g, nr, nc) !== EMPTY) {
        seen.add(key);
        queue.push([nr, nc]);
      }
    }
  }
  const out: Cell[] = [];
  g.cells.forEach((row, r) => row.forEach((v, c) => v !== EMPTY && !seen.has(`${r},${c}`) && out.push([r, c])));
  return out;
}

/** Crowley's move: a fresh row slides in at the top and everything moves down one row. */
export function pushRow(g: Grid, colors: number, rng: Rng = Math.random) {
  g.cells.unshift(randomRow(colors, rng));
  g.shifted = !g.shifted;
}

/** Seed kinds still on the board, so the launcher never loads a kind you can't match. */
export function kindsInGrid(g: Grid): number[] {
  const kinds = new Set<number>();
  for (const row of g.cells) for (const v of row) if (v !== EMPTY) kinds.add(v);
  return [...kinds].sort((a, b) => a - b);
}

export function lowestRow(g: Grid) {
  for (let r = g.cells.length - 1; r >= 0; r--) if (g.cells[r].some((v) => v !== EMPTY)) return r;
  return -1;
}

export function isEmpty(g: Grid) {
  return lowestRow(g) === -1;
}

/** Geometry for a seed radius `radius`, with the grid starting `top` px down. */
export function layout(radius: number, top: number) {
  const rowH = radius * Math.sqrt(3);
  return {
    width: radius * (2 * COLS + 1),
    rowH,
    center(g: Grid, r: number, c: number) {
      return { x: radius + c * 2 * radius + (isOffset(g, r) ? radius : 0), y: top + radius + r * rowH };
    },
  };
}

/**
 * The empty cell a flying seed at (x, y) settles into: the nearest empty cell that is on the top
 * row or touches a seed, so a shot never floats free.
 */
export function snapCell(g: Grid, x: number, y: number, radius: number, top: number): Cell {
  const { center, rowH } = layout(radius, top);
  const near = Math.max(0, Math.round((y - top - radius) / rowH));
  let best: Cell = [near, 0];
  let bestD = Infinity;
  for (let r = Math.max(0, near - 1); r <= near + 1; r++) {
    for (let c = 0; c < COLS; c++) {
      if (get(g, r, c) !== EMPTY) continue;
      if (r > 0 && !neighbors(g, r, c).some(([nr, nc]) => get(g, nr, nc) !== EMPTY)) continue;
      const p = center(g, r, c);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = [r, c];
      }
    }
  }
  return best;
}

/** Shots in a row that pop nothing before Crowley the crow drops a new row. */
export const MISSES_PER_ROW = 5;

/** Seed kinds by index: color, glyph ink and name (the glyph keeps them apart without color). */
export const SEEDS = [
  { name: "Leaf", fill: "#5daa4a", ink: "#fffdf7" },
  { name: "Sun", fill: "#f2b705", ink: "#6b4700" },
  { name: "Dew", fill: "#4fa3d9", ink: "#fffdf7" },
  { name: "Clover", fill: "#8a5bb8", ink: "#fffdf7" },
  { name: "Berry", fill: "#e0654f", ink: "#fffdf7" },
] as const;
