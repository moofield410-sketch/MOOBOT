import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { cached, clearCache } from "@/lib/cache";

describe("cache with last-known-good fallback", () => {
  beforeEach(() => clearCache());

  it("serves fresh data, then falls back to stale data when the source fails", async () => {
    let now = 0;
    const opts = { ttlMs: 100, staleMs: 1_000, now: () => now };

    const first = await cached("k", opts, async () => ({ value: 42, source: "mock" }));
    assert.equal(first.data, 42);
    assert.equal(first.stale, false);
    assert.equal(first.source, "mock");

    now = 200; // past TTL, source now fails
    const second = await cached("k", opts, async () => {
      throw new Error("source down");
    });
    assert.equal(second.data, 42);
    assert.equal(second.stale, true);
    assert.equal(second.error, "source down");
    assert.equal(second.updatedAt, new Date(0).toISOString());
  });

  it("reports unavailable when the source fails with no previous data", async () => {
    const res = await cached("empty", { ttlMs: 100, staleMs: 1_000 }, async () => {
      throw new Error("nope");
    });
    assert.equal(res.data, null);
    assert.equal(res.source, "unavailable");
    assert.equal(res.stale, true);
  });

  it("flags data as stale after staleMs even without errors", async () => {
    let now = 0;
    const opts = { ttlMs: 10_000, staleMs: 50, now: () => now };
    await cached("s", opts, async () => ({ value: 1, source: "mock" }));
    now = 60;
    assert.equal((await cached("s", opts, async () => ({ value: 2, source: "mock" }))).stale, true);
  });
});

describe("background reload (stale-while-revalidate)", () => {
  it("serves the old value at once after its refresh time and reloads it behind", async () => {
    const { cached } = await import("@/lib/cache");
    let now = 0;
    let loads = 0;
    let release!: () => void;
    const slow = () =>
      new Promise<{ value: number; source: "orbio" }>((r) => {
        loads++;
        release = () => r({ value: loads, source: "orbio" });
      });
    const key = `bg:${Math.random()}`;
    const first = cached(key, { ttlMs: 10, staleMs: 1_000, now: () => now, background: true }, slow);
    release();
    assert.equal((await first).data, 1);
    now = 50;
    const t0 = Date.now();
    const served = await cached(key, { ttlMs: 10, staleMs: 1_000, now: () => now, background: true }, slow);
    assert.equal(served.data, 1, "the old value, without waiting");
    assert.ok(Date.now() - t0 < 50);
    // A second visitor while it reloads doesn't start another reload.
    await cached(key, { ttlMs: 10, staleMs: 1_000, now: () => now, background: true }, slow);
    assert.equal(loads, 2);
    release();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal((await cached(key, { ttlMs: 10, staleMs: 1_000, now: () => now, background: true }, slow)).data, 2, "the reloaded value");
  });
});

describe("shared copy (a freshly started server)", () => {
  it("reads the last good value another instance saved, without calling the slow source", async () => {
    const { cached, clearCache, clearLocalCache } = await import("@/lib/cache");
    clearCache();
    let calls = 0;
    const load = async () => ({ value: { masters: ++calls }, source: "orbio" as const });
    const opts = { ttlMs: 60_000, staleMs: 600_000, shared: true, background: true, now: () => 1_000 };
    await cached("masters-test", opts, load);
    clearLocalCache(); // a new instance: empty memory, same shared store
    const r = await cached("masters-test", { ...opts, now: () => 2_000 }, load);
    assert.deepEqual(r.data, { masters: 1 });
    assert.equal(calls, 1, "the slow source wasn't called again");
  });

  it("ignores a shared copy that is too old", async () => {
    const { cached, clearCache, clearLocalCache } = await import("@/lib/cache");
    clearCache();
    let calls = 0;
    const load = async () => ({ value: ++calls, source: "orbio" as const });
    await cached("old-test", { ttlMs: 10, staleMs: 100, shared: true, now: () => 0 }, load);
    clearLocalCache();
    const r = await cached("old-test", { ttlMs: 10, staleMs: 100, shared: true, now: () => 1_000 }, load);
    assert.equal(r.data, 2);
  });
});
