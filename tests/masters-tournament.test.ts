import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENT_LIVE_AT } from "@/config";
import { scanGraduations } from "@/lib/indexer/graduations";
import { createIndexerState } from "@/lib/indexer/store";
import { filterMasters } from "@/lib/masters-filter";
import { currentRound, roundLengthMs } from "@/lib/rounds";
import { buildTimeline, HOUR_MS } from "@/lib/schedule";
import { SAMPLE_PROFILES } from "@/lib/sample/profiles";
import { SAMPLE_PITCHES, SAMPLE_VOTERS } from "@/lib/sample/tournament";
import { mockReader, mockTokenAddress } from "@/lib/sources/mock";
import { rankPitches, rankVoters } from "@/lib/tournament";
import type { Master } from "@/lib/types";

async function sampleMasters(): Promise<Master[]> {
  const state = createIndexerState();
  await scanGraduations(mockReader, state);
  return [...state.masters.values()].map((m) => {
    const id = Number(Object.keys(SAMPLE_PROFILES).find((n) => mockTokenAddress(Number(n)) === m.tokenAddress));
    return { ...m, ...SAMPLE_PROFILES[id] };
  });
}

describe("Masters search and filter", () => {
  it("searches by name, ticker and description, case-insensitively", async () => {
    const all = await sampleMasters();
    assert.deepEqual(filterMasters(all, { q: "panda" }).map((m) => m.ticker), ["PLCHLD"]);
    assert.deepEqual(filterMasters(all, { q: "mock" }).map((m) => m.ticker), ["MOCK"]);
    assert.deepEqual(filterMasters(all, { q: "PIXEL BANNERS" }).map((m) => m.ticker), ["LOREM"]);
    assert.equal(filterMasters(all, { q: "zzz-nothing" }).length, 0);
  });

  it("filters by open-to-pitches and category", async () => {
    const all = await sampleMasters();
    const open = filterMasters(all, { openOnly: true });
    assert.ok(open.length > 0 && open.length < all.length);
    assert.ok(open.every((m) => m.openToPitches));
    assert.ok(filterMasters(all, { category: "Tools" }).every((m) => m.category === "Tools"));
    assert.equal(filterMasters(all, { category: "all" }).length, all.length);
  });

  it("sorts by holders, liquidity, name and newest", async () => {
    const all = await sampleMasters();
    const holders = filterMasters(all, { sort: "holders" }).map((m) => m.holderCount!);
    assert.deepEqual(holders, [...holders].sort((a, b) => b - a));
    const names = filterMasters(all, { sort: "name" }).map((m) => m.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
    assert.equal(filterMasters(all).at(0)?.ticker, "MOCK");
  });

  it("sorts real Masters by market cap, with unknown (n/a) values last", async () => {
    const all = await sampleMasters();
    const real = all.slice(0, 3).map((m, i) => ({ ...m, isMock: false, marketCapUsd: [5_000, null, 90_000][i] }));
    assert.deepEqual(filterMasters(real, { sort: "marketCap" }).map((m) => m.marketCapUsd), [90_000, 5_000, null]);
  });

  it("does not mutate the input list", async () => {
    const all = await sampleMasters();
    const before = all.map((m) => m.ticker);
    filterMasters(all, { sort: "name" });
    assert.deepEqual(all.map((m) => m.ticker), before);
  });
});

describe("leaderboard ranking", () => {
  it("ranks every pitch by voting power, ties to the earliest submission", () => {
    const ranked = rankPitches(SAMPLE_PITCHES);
    assert.equal(ranked.length, SAMPLE_PITCHES.length);
    for (let i = 1; i < ranked.length; i++) {
      const [a, b] = [ranked[i - 1], ranked[i]];
      assert.ok(a.votingPower > b.votingPower || (a.votingPower === b.votingPower && a.submittedAt <= b.submittedAt));
    }
    const tie = rankPitches([
      { ...SAMPLE_PITCHES[0], id: "late", votingPower: 10, submittedAt: "2026-10-05T00:00:00Z" },
      { ...SAMPLE_PITCHES[1], id: "early", votingPower: 10, submittedAt: "2026-10-04T00:00:00Z" },
    ]);
    assert.deepEqual(tie.map((p) => p.id), ["early", "late"]);
    assert.deepEqual(ranked.map((p) => p.rank), ranked.map((_, i) => i + 1));
  });

  it("breaks voter ties by winners backed", () => {
    const ranked = rankVoters(SAMPLE_VOTERS);
    const tied = ranked.filter((v) => v.votingPower === 1_000);
    assert.equal(tied.length, 2);
    assert.ok(tied[0].backedWinners >= tied[1].backedWinners);
    assert.equal(ranked[0].rank, 1);
  });
});

describe("round countdown", () => {
  const t = buildTimeline(Date.parse(AGENT_LIVE_AT), 24);

  it("counts down to the first round before the full unlock", () => {
    const r = currentRound(t.agentLiveAt, t);
    assert.equal(r.status, "upcoming");
    assert.equal(r.countdownTo, t.fullUnlockAt);
    assert.equal(r.msRemaining, t.fullUnlockAt - t.agentLiveAt);
  });

  it("starts round 1 exactly at the unlock and rolls every 72 hours", () => {
    const r1 = currentRound(t.fullUnlockAt, t);
    assert.equal(r1.status, "live");
    assert.equal(r1.number, 1);
    assert.equal(r1.endsAt - r1.startsAt, 72 * HOUR_MS);

    const r2 = currentRound(t.fullUnlockAt + 72 * HOUR_MS, t);
    assert.equal(r2.number, 2);
    assert.equal(r2.startsAt, r1.endsAt);
  });

  it("compresses with the dev dry-run clock", () => {
    const fast = buildTimeline(0, 24, 1_000);
    assert.equal(roundLengthMs(fast), 72_000);
  });
});

describe("master of the day", () => {
  it("picks the same Master all day whatever the order, and rotates by day", async () => {
    const { masterOfTheDay } = await import("@/lib/spotlight");
    const ms = Array.from({ length: 9 }, (_, i) => ({ tokenAddress: `0x${String(i).padStart(40, "0")}` }) as unknown as import("@/lib/types").Master);
    const morning = Date.parse("2026-10-04T01:00:00Z");
    const evening = Date.parse("2026-10-04T23:00:00Z");
    assert.equal(masterOfTheDay(ms, morning), masterOfTheDay([...ms].reverse(), evening));
    const picks = new Set(Array.from({ length: 14 }, (_, d) => masterOfTheDay(ms, morning + d * 86_400_000)?.tokenAddress));
    assert.ok(picks.size > 1);
    assert.equal(masterOfTheDay([], morning), null);
  });
});
