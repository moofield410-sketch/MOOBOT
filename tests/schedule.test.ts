// Run the formatting checks in a non-UTC zone: output must not depend on the visitor's time zone.
process.env.TZ = "America/Los_Angeles";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENT_LIVE_AT, FULL_UNLOCK_AFTER_H } from "@/config";
import { formatDate, formatHms, formatUpdated, formatUtcDateTime } from "@/lib/format";
import { currentRound } from "@/lib/rounds";
import { buildTimeline, clockOffset, formatCountdown, getSchedule, getStage, HOUR_MS } from "@/lib/schedule";

const t = buildTimeline(Date.parse(AGENT_LIVE_AT), FULL_UNLOCK_AFTER_H);

describe("go-live schedule", () => {
  it("the agent goes live at 12:00 UTC on 4 October 2026", () => {
    assert.equal(AGENT_LIVE_AT, "2026-10-04T12:00:00Z");
    assert.equal(new Date(t.agentLiveAt).toISOString(), "2026-10-04T12:00:00.000Z");
  });

  it("full features open exactly 24 hours after go-live, at 12:00 UTC on 5 October 2026", () => {
    assert.equal(FULL_UNLOCK_AFTER_H, 24);
    assert.equal(t.fullUnlockAt - t.agentLiveAt, 24 * HOUR_MS);
    assert.equal(new Date(t.fullUnlockAt).toISOString(), "2026-10-05T12:00:00.000Z");
  });

  it("has no launch stage: warmup, then agent live, then full unlock", () => {
    assert.equal(getStage(t.agentLiveAt - 1, t), "warmup");
    assert.equal(getStage(t.agentLiveAt, t), "agentLive");
    assert.equal(getStage(t.fullUnlockAt - 1, t), "agentLive");
    assert.equal(getStage(t.fullUnlockAt, t), "fullUnlock");
    assert.deepEqual(Object.keys(t).sort(), ["agentLiveAt", "fullUnlockAt"]);
  });

  it("unlocks features only at the right stage", () => {
    const at = (ms: number) => getSchedule(ms, t).features;
    assert.equal(at(t.agentLiveAt - 1).moobotAwake, false);
    assert.equal(at(t.agentLiveAt - 1).mastersVisible, true);
    assert.equal(at(t.agentLiveAt).moobotAwake, true);
    assert.equal(at(t.fullUnlockAt).votingOpen, true);
    assert.equal(at(t.fullUnlockAt).rewardsLedgerOpen, true);
  });

  it("keeps only the Tournament (pitching, voting, rewards ledger) locked until go-live + 24h", () => {
    const at = (ms: number) => getSchedule(ms, t).features;
    for (const ms of [t.agentLiveAt - 1, t.agentLiveAt, t.fullUnlockAt - 1]) {
      assert.equal(at(ms).registrationOpen, false, "pitching locked");
      assert.equal(at(ms).votingOpen, false, "voting locked");
      assert.equal(at(ms).rewardsLedgerOpen, false, "rewards ledger locked");
      assert.equal(at(ms).mastersVisible, true, "Masters live");
      assert.equal(at(ms).creditDataVisible, true, "credit data live");
      assert.equal(at(ms).creditMarketOpen, true, "Credit Market live");
    }
    assert.equal(at(t.fullUnlockAt).registrationOpen, true);
    assert.equal(getSchedule(t.agentLiveAt, t).nextLabel, "The Tournament opens");
  });

  it("counts down to the next milestone", () => {
    const before = getSchedule(t.agentLiveAt - 90_000, t);
    assert.equal(before.nextAt, t.agentLiveAt);
    assert.equal(before.nextLabel, "Go-live");
    assert.equal(before.msRemaining, 90_000);
    assert.equal(getSchedule(t.agentLiveAt, t).nextAt, t.fullUnlockAt);
    assert.equal(getSchedule(t.fullUnlockAt + 5, t).nextAt, null);
  });

  it("round 1 starts at the full unlock and lasts 72 hours", () => {
    const r1 = currentRound(t.fullUnlockAt, t);
    assert.equal(r1.number, 1);
    assert.equal(r1.startsAt, Date.parse("2026-10-05T12:00:00Z"));
    assert.equal(r1.endsAt, Date.parse("2026-10-08T12:00:00Z"));
    assert.equal(currentRound(t.agentLiveAt, t).status, "upcoming");
  });

  it("supports a compressed dry-run clock and rejects invalid input", () => {
    assert.equal(buildTimeline(0, 24, 60_000).fullUnlockAt, 24 * 60_000);
    assert.throws(() => buildTimeline(NaN, 24));
    assert.throws(() => buildTimeline(0, 0));
  });

  it("formats countdowns", () => {
    assert.equal(formatHms(12 * 3_600_000 + 34 * 60_000 + 56_000), "12:34:56");
    assert.equal(formatHms(31 * 3_600_000 + 9_000), "31:00:09");
    assert.equal(formatHms(-1), "00:00:00");
    assert.equal(formatCountdown(3_661_000), "01:01:01");
    assert.equal(formatCountdown(90_061_000), "1d 01:01:01");
    assert.equal(formatCountdown(-5), "00:00:00");
  });

  it("corrects a skewed device clock from the server time", () => {
    assert.equal(clockOffset(1_000, 1_200, 1_100 + 600_000), 600_000);
  });
});

describe("UTC formatting", () => {
  it("runs in a non-UTC zone for this test", () => {
    assert.notEqual(new Date(t.agentLiveAt).getTimezoneOffset(), 0);
  });

  it("always shows times in UTC, regardless of the visitor's zone", () => {
    assert.equal(formatUtcDateTime(t.agentLiveAt), "4 Oct 2026, 12:00 UTC");
    assert.equal(formatUtcDateTime(t.fullUnlockAt), "5 Oct 2026, 12:00 UTC");
    assert.equal(formatUtcDateTime("2026-10-03T23:30:00Z"), "3 Oct 2026, 23:30 UTC");
    assert.equal(formatDate("2026-10-03T23:30:00Z"), "3 Oct 2026");
    assert.equal(formatUpdated("2026-10-04T00:05:00Z"), "Updated 4 Oct 2026, 00:05 UTC");
  });
});
