import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REWARDS } from "@/config";
import { configErrors, rewardsErrors } from "@/lib/config-check";
import { splitByPercent, splitByWeight } from "@/lib/splits";

describe("config checks", () => {
  it("the shipped config has no errors", () => {
    assert.deepEqual(configErrors(), []);
  });

  it("REWARDS splits each sum to 100", () => {
    assert.equal(REWARDS.agentOpsPct + REWARDS.treasuryPct, 100);
    assert.equal(Object.values(REWARDS.roundSplit).reduce((a, b) => a + b, 0), 100);
    assert.equal(REWARDS.pitchPlaces.reduce((a, b) => a + b, 0), 100);
  });

  it("flags a round split that does not sum to 100", () => {
    const broken = { ...REWARDS, roundSplit: { pitchesPct: 35, votersPct: 10, mastersPct: 10, treasuryPct: 40 } };
    assert.ok(rewardsErrors(broken).some((e) => e.includes("roundSplit")));
  });

  it("flags broken 20/80, pitch places and out-of-range values", () => {
    assert.ok(rewardsErrors({ ...REWARDS, agentOpsPct: 25 }).some((e) => e.includes("agentOpsPct")));
    assert.ok(rewardsErrors({ ...REWARDS, pitchPlaces: [50, 30, 30] }).some((e) => e.includes("pitchPlaces")));
    assert.ok(rewardsErrors({ ...REWARDS, roundPoolCapCredits: -1 }).length > 0);
    assert.ok(rewardsErrors({ ...REWARDS, repeatWinner: { rounds: 5, factor: 2 } }).length > 0);
  });
});

describe("generic splits", () => {
  for (const amount of [0n, 1n, 7n, 99n, 1_234_567n, 10n ** 30n + 3n]) {
    it(`splitByPercent sums exactly for ${amount}`, () => {
      const s = splitByPercent(amount, REWARDS.roundSplit, "treasuryPct");
      assert.equal(s.pitchesPct + s.votersPct + s.mastersPct + s.treasuryPct, amount);
    });
  }

  it("splitByWeight always sums exactly", () => {
    assert.equal(splitByWeight(10n, [1n, 1n, 1n]).reduce((a, b) => a + b, 0n), 10n);
    assert.deepEqual(splitByWeight(5n, [0n, 0n]), [0n, 0n]);
  });
});
