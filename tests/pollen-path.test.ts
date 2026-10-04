import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { seededRng } from "@/lib/bloom-pop";
import { ORBIT, buildPath, dashResult, hitRadius, orbitSpeed, spinDirection } from "@/lib/pollen-path";

const W = 368;
const START = { x: W / 2, y: 0 };

describe("pollen path", () => {
  it("builds the same path from the same seed, and a different one from another", () => {
    const a = buildPath(40, seededRng("pollen-path:2026-10-04"), W, START);
    const b = buildPath(40, seededRng("pollen-path:2026-10-04"), W, START);
    const c = buildPath(40, seededRng("pollen-path:2026-10-05"), W, START);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
  });

  it("keeps every bud on screen, above the last one and within reach", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const path = buildPath(80, seededRng(seed), W, START);
      for (let i = 1; i < path.length; i++) {
        const [p, q] = [path[i - 1], path[i]];
        assert.ok(q.x >= 56 && q.x <= W - 56, `bud ${i} x=${q.x}`);
        assert.ok(q.y < p.y, `bud ${i} is higher`);
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        assert.ok(d > ORBIT + hitRadius(i) && d <= 181, `bud ${i} distance ${d}`);
      }
    }
  });

  it("lands when Bumble dashes straight at the next bud, and misses when he faces away", () => {
    const path = buildPath(30, seededRng("reach"), W, START);
    for (let i = 0; i < path.length - 1; i++) {
      const toward = Math.atan2(path[i + 1].y - path[i].y, path[i + 1].x - path[i].x);
      assert.equal(dashResult(path[i], toward, path[i + 1], hitRadius(i), W), "hit");
      assert.equal(dashResult(path[i], toward + Math.PI, path[i + 1], hitRadius(i), W), "miss");
    }
  });

  it("gets harder as the path grows, within limits, and alternates the spin", () => {
    assert.ok(orbitSpeed(20) > orbitSpeed(0));
    assert.equal(orbitSpeed(1000), 3.8);
    assert.ok(hitRadius(20) < hitRadius(0));
    assert.ok(hitRadius(1000) >= 20);
    assert.equal(spinDirection(0), -spinDirection(1));
  });
});
