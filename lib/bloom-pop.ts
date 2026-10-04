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

/** Rows of seeds a level starts with. */
export function rowsFor(level: number) {
  return Math.min(4 + level, 10);
}
/** Seed kinds in play on a level (level 1 leaves one out, to start easy). */
export function kindsFor(level: number) {
  return level === 1 ? 4 : SEED_KINDS;
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

/**
 * A repeatable random sequence from a text seed (FNV-1a hash into mulberry32). The daily field
 * uses the UTC date as the seed, so every visitor gets the same board and the same seeds that day.
 */
export function seededRng(seed: string): Rng {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The daily field's id: the UTC date, YYYY-MM-DD. */
export const dailyFieldId = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The daily field's starting board for a day: exactly what every visitor sees on level 1. */
export function dailyBoard(day: string): Grid {
  return createGrid(rowsFor(1), kindsFor(1), seededRng(`bloom-pop:${day}`));
}

/** A real UTC day (YYYY-MM-DD) that has already started, or null. */
export function parseDay(day: string, now = Date.now()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isNaN(t) || dailyFieldId(t) !== day || t > now ? null : day;
}

/** Share links carry a self-reported score; anything outside this range is rejected. */
export const MAX_SHARE_SCORE = 9_999_999;

/** Checks a shared /play/<day>/<score> link: a real past-or-present UTC day and a whole score. */
export function parseShare(day: string, score: string, now = Date.now()): { day: string; score: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{1,7}$/.test(score)) return null;
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t) || dailyFieldId(t) !== day || t > now) return null;
  const n = Number(score);
  return n <= MAX_SHARE_SCORE ? { day, score: n } : null;
}
