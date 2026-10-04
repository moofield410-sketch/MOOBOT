import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { GET as chartRoute } from "@/app/api/moobot/chart/route";
import { MOOBOT_TOKEN } from "@/config";
import { clearCache } from "@/lib/cache";
import { stepDecimals } from "@/lib/format";
import { getMooBotChart } from "@/lib/moobot";
import { getOrbioTotals } from "@/lib/orbio-totals";
import { OrbioHttpError, parseAnalytics, parseChart, type Fetcher } from "@/lib/sources/orbio-api";

/**
 * Orbio's public analytics (GET /agents/analytics) and price chart (GET /agents/{id}/chart),
 * recorded 2026-10-04 and trimmed. errand (agent 106) stands in for $MOOBOT. Nothing is fetched live.
 */
const ANALYTICS = JSON.parse(readFileSync("tests/fixtures/orbio-analytics.json", "utf8"));
const CHART = JSON.parse(readFileSync("tests/fixtures/orbio-chart-errand.json", "utf8"));
const ERRAND = JSON.parse(readFileSync("tests/fixtures/orbio-agent-errand.json", "utf8"));
const LOWER = "0xeb2ecf641a1f04b8df37c24eabca8f5a47cfaacb";

const setToken = (v: string | undefined) => {
  if (v === undefined) delete process.env[MOOBOT_TOKEN.env];
  else process.env[MOOBOT_TOKEN.env] = v;
};

const calls: string[] = [];
const orbio: Fetcher = async (url) => {
  calls.push(url);
  if (url.endsWith("/agents/analytics")) return ANALYTICS;
  if (url.includes(`/agents/${LOWER}/chart?range=`)) return { ...CHART, range: new URL(url).searchParams.get("range") };
  if (url.endsWith(`/agents/${LOWER}`)) return ERRAND;
  throw new OrbioHttpError(404);
};

beforeEach(() => {
  clearCache();
  calls.length = 0;
  setToken(undefined);
});
afterEach(() => setToken(undefined));

describe("Orbio at a glance (analytics)", () => {
  it("reads the real field names, and calls Orbio's creditEarnedAtoms 'accrued'", () => {
    const t = parseAnalytics(ANALYTICS);
    assert.equal(t.agents, 1152);
    assert.equal(t.marketCapMicroUsd, ANALYTICS.marketCapMicroUsd);
    assert.equal(t.orbioMicroUsd, ANALYTICS.orbioMicroUsd);
    assert.equal(t.stakedWei, ANALYTICS.totals.stakedWei);
    assert.equal(t.creatorFeesWei, ANALYTICS.totals.creatorFeesWei);
    assert.equal(t.convertedUsdgAtoms, ANALYTICS.totals.convertedUsdgAtoms);
    assert.equal(t.creditAccruedAtoms, ANALYTICS.totals.creditEarnedAtoms);
    assert.equal(t.creditClaimedAtoms, ANALYTICS.totals.creditClaimedAtoms);
    assert.deepEqual(
      t.launchesByDay,
      ANALYTICS.days.map((d: { day: string; launches: number }) => ({ day: d.day, launches: d.launches })),
    );
  });

  it("keeps missing values as null (n/a, never 0) and drops malformed days", () => {
    const t = parseAnalytics({ totals: { agents: null }, days: [{ day: "2026-10-04", launches: 3 }, { day: "soon", launches: 1 }, { day: "2026-10-05" }] });
    assert.equal(t.agents, null);
    assert.equal(t.marketCapMicroUsd, null);
    assert.equal(t.creditAccruedAtoms, null);
    assert.deepEqual(t.launchesByDay, [{ day: "2026-10-04", launches: 3 }]);
  });

  it("rejects a response without totals", () => {
    assert.throws(() => parseAnalytics({ error: "nope" }), /unexpected analytics shape/);
  });

  it("is cached for everyone, and works before $MOOBOT launches", async () => {
    const a = await getOrbioTotals(orbio);
    const b = await getOrbioTotals(orbio);
    assert.equal(a.data?.agents, 1152);
    assert.equal(a.source, "orbio");
    assert.equal(b.data?.agents, 1152);
    assert.equal(calls.length, 1);
  });

  it("shows nothing invented when Orbio is down", async () => {
    const down: Fetcher = async () => {
      throw new OrbioHttpError(502);
    };
    const r = await getOrbioTotals(down);
    assert.equal(r.data, null);
    assert.equal(r.source, "unavailable");
  });
});

describe("$MOOBOT price chart", () => {
  it("parses points oldest first and drops ones without a price", () => {
    const c = parseChart(
      {
        trackedSince: "2026-09-30T05:46:00+00:00",
        points: [
          { at: "2026-10-04T09:26:00+00:00", priceMicroUsd: "842" },
          { at: "2026-10-04T09:25:00+00:00", priceMicroUsd: "840" },
          { at: "2026-10-04T09:27:00+00:00", priceMicroUsd: null },
          { at: "not a time", priceMicroUsd: "1" },
        ],
      },
      "1h",
    );
    assert.deepEqual(c.points.map((p) => p.priceMicroUsd), ["840", "842"]);
    assert.equal(c.trackedSince, "2026-09-30T05:46:00+00:00");
  });

  it("reads Orbio's empty answer for an untracked token as no points", () => {
    const c = parseChart({ token: "0x0000000000000000000000000000000000000001", enabled: [], trackedSince: null, points: [] }, "1d");
    assert.deepEqual(c, { range: "1d", trackedSince: null, points: [] });
  });

  it("stays off, without calling Orbio, until the $MOOBOT contract is set", async () => {
    assert.deepEqual(await getMooBotChart("1h", orbio), { status: "off" });
    assert.equal(calls.length, 0);
  });

  it("stays off when the contract isn't on Orbio", async () => {
    setToken("0x0000000000000000000000000000000000000001");
    assert.deepEqual(await getMooBotChart("1h", orbio), { status: "off" });
    assert.ok(!calls.some((u) => u.includes("/chart")));
  });

  it("reads the verified token's chart for the asked range, cached per range", async () => {
    setToken(LOWER);
    const r = await getMooBotChart("4h", orbio);
    assert.equal(r.status, "ok");
    if (r.status !== "ok") return;
    assert.equal(r.chart.range, "4h");
    assert.equal(r.chart.points.length, CHART.points.length);
    assert.ok(calls.some((u) => u.endsWith(`/agents/${LOWER}/chart?range=4h`)));
    await getMooBotChart("4h", orbio);
    assert.equal(calls.filter((u) => u.includes("/chart")).length, 1);
  });

  it("the route refuses ranges Orbio doesn't offer", async () => {
    const res = await chartRoute(new Request("http://localhost/api/moobot/chart?range=1w"));
    assert.equal(res.status, 400);
    const ok = await chartRoute(new Request("http://localhost/api/moobot/chart"));
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { status: "off" });
  });

  it("tick labels get enough decimals to tell neighbours apart", () => {
    assert.equal(stepDecimals(0.00002), 5);
    assert.equal(stepDecimals(0.00001), 5);
    assert.equal(stepDecimals(0.5), 1);
    assert.equal(stepDecimals(1), 0);
    assert.equal(stepDecimals(200), 0);
  });
});
