// Pollen Path: Bumble the bee circles a flower; tap to dash straight out from it. Reach the next
// bud and it blooms, the path grows and Bumble circles the new flower. Miss and the run ends.
// Pure rules and numbers live here (tested); components/home/PollenPath.tsx is input and drawing.

import type { Rng } from "@/lib/bloom-pop";

export type Point = { x: number; y: number };

/** How far Bumble circles from the flower's center. */
export const ORBIT = 38;
/** Bumble's own size, for hit tests. */
export const BEE_R = 9;
/** Dash speed, logical pixels per second. */
export const DASH_SPEED = 560;
/** How far past the target a dash may go before it counts as a miss. */
export const OVERSHOOT = 140;

/** Petal colors, in the same family as the Bloom Pop seeds. */
export const PETALS = [
  { name: "Daisy", fill: "#fffdf7", ring: "#e3dccb", heart: "#f2b705" },
  { name: "Clover", fill: "#b48ad9", ring: "#8f5fc0", heart: "#fff3c4" },
  { name: "Buttercup", fill: "#f6c945", ring: "#d9a514", heart: "#8a6a45" },
  { name: "Bluebell", fill: "#7fb8e6", ring: "#4f93cf", heart: "#fffdf7" },
  { name: "Poppy", fill: "#ec7a62", ring: "#d4553b", heart: "#2b2f2a" },
] as const;

/** Rotation speed in radians per second: it speeds up as the path grows, then levels off. */
export function orbitSpeed(level: number) {
  return Math.min(3.8, 2.2 + level * 0.06);
}

/** How close (center to center) the dash must pass to land on a bud: buds shrink as the path grows. */
export function hitRadius(level: number) {
  return Math.max(20, 30 - level * 0.35) + BEE_R;
}

/** Each flower turns the other way from the one before, so the timing keeps changing. */
export const spinDirection = (index: number) => (index % 2 === 0 ? 1 : -1);

/** The bud after `prev`: higher up, 130-180 px away, never closer than 56 px to the sides. */
export function nextFlower(prev: Point, rng: Rng, width: number, level: number): Point {
  const margin = 56;
  const dist = 130 + Math.min(50, level * 1.5) * rng();
  for (let tries = 0; tries < 12; tries++) {
    // Within 55° of straight up.
    const a = -Math.PI / 2 + (rng() * 2 - 1) * (55 * Math.PI) / 180;
    const x = prev.x + Math.cos(a) * dist;
    if (x >= margin && x <= width - margin) return { x, y: prev.y + Math.sin(a) * dist };
  }
  // Fallback: lean toward the middle.
  const x = Math.min(width - margin, Math.max(margin, prev.x + (width / 2 - prev.x) * 0.6));
  return { x, y: prev.y - Math.sqrt(Math.max(0, dist ** 2 - (x - prev.x) ** 2)) };
}

/** A full path of `count` flowers from the ground up. The same `rng` seed gives the same path. */
export function buildPath(count: number, rng: Rng, width: number, start: Point): Point[] {
  const path = [start];
  while (path.length < count) path.push(nextFlower(path[path.length - 1], rng, width, path.length));
  return path;
}

/** Where Bumble is while circling `flower` at `angle`. */
export const orbitPoint = (flower: Point, angle: number): Point => ({ x: flower.x + Math.cos(angle) * ORBIT, y: flower.y + Math.sin(angle) * ORBIT });

/**
 * Where a dash from `flower` at `angle` ends: "hit" if it passes within `reach` of `target`, else
 * "miss" once it's gone OVERSHOOT past the target's distance or off the sides of a `width`-wide field.
 */
export function dashResult(flower: Point, angle: number, target: Point, reach: number, width: number): "hit" | "miss" {
  const start = orbitPoint(flower, angle);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const limit = Math.hypot(target.x - start.x, target.y - start.y) + OVERSHOOT;
  for (let d = 0; d <= limit; d += 3) {
    const x = start.x + dx * d;
    const y = start.y + dy * d;
    if ((x - target.x) ** 2 + (y - target.y) ** 2 <= reach ** 2) return "hit";
    if (x < -BEE_R || x > width + BEE_R) return "miss";
  }
  return "miss";
}
