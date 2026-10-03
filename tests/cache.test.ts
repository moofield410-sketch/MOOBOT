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
