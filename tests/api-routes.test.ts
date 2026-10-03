import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";
import { GET as agents } from "@/app/api/agents/route";
import { GET as authNonce } from "@/app/api/auth/nonce/route";
import { GET as credits } from "@/app/api/credits/route";
import { GET as cronScan } from "@/app/api/cron/scan/route";
import { GET as leaderboard } from "@/app/api/leaderboard/route";
import { GET as pitches } from "@/app/api/pitches/route";
import { GET as roundsCurrent } from "@/app/api/rounds/current/route";
import { GET as schedule } from "@/app/api/schedule/route";
import { GET as tenders } from "@/app/api/tenders/route";
import { GET as wallet } from "@/app/api/wallet/[address]/route";
import { GET as walletAgents } from "@/app/api/wallet/[address]/agents/route";
import { ORBIO_API, USE_MOCK_DATA } from "@/config";
import { clearCache } from "@/lib/cache";
import { SAMPLE_PAST_ROUNDS, SAMPLE_PITCHES, SAMPLE_TENDERS, SAMPLE_VOTERS } from "@/lib/sample/tournament";

/**
 * Route tests with real data on (USE_MOCK_DATA = false). Orbio is never called for real:
 * fetch is stubbed with recorded Orbio responses (tests/fixtures/orbio-api.json).
 */

type Fixture = {
  list: { data: { agentId: string; token: string; owner: string; agentWallet: string }[]; page: { total: number } };
  curves: Record<string, unknown>;
};
const FIXTURE = JSON.parse(readFileSync("tests/fixtures/orbio-api.json", "utf8")) as Fixture;
const [GRADUATED, MISMATCH, NOT_GRADUATED] = FIXTURE.list.data;

/** Answers the Orbio endpoints Moofield reads, from the recorded fixture. */
function orbioStub(url: string): Response {
  const u = new URL(url);
  const path = u.pathname.replace(/^.*\/api\/protocol/, "");
  if (path === "/agents") {
    const w = u.searchParams.get("wallet")?.toLowerCase();
    const offset = Number(u.searchParams.get("offset") ?? 0);
    const data = w
      ? FIXTURE.list.data.filter((a) => a.owner === w || a.agentWallet === w)
      : offset === 0
        ? FIXTURE.list.data
        : [];
    return Response.json({ ...FIXTURE.list, data, page: { limit: 200, offset, total: w ? data.length : FIXTURE.list.page.total } });
  }
  const id = path.match(/^\/agents\/([^/]+)$/)?.[1];
  const agent = FIXTURE.list.data.find((a) => a.agentId === id);
  if (agent) return Response.json({ ...agent, curve: FIXTURE.curves[agent.agentId] });
  return Response.json({ error: "not found" }, { status: 404 });
}

const realFetch = globalThis.fetch;
const orbioCalls: string[] = [];
let orbioDown = false;

const json = async (res: Response) => {
  assert.equal(res.headers.get("cache-control"), "no-store");
  return res.json();
};

const ADDR = "0x1234567890abcdef1234567890abcdef12345678";

describe("API routes with real data", { skip: USE_MOCK_DATA ? "USE_MOCK_DATA is on" : false }, () => {
  before(() => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.startsWith(ORBIO_API.baseUrl)) throw new Error(`Unexpected network call in tests: ${url}`);
      orbioCalls.push(url);
      return orbioDown ? new Response("down", { status: 503 }) : orbioStub(url);
    }) as typeof fetch;
  });
  after(() => {
    globalThis.fetch = realFetch;
  });
  beforeEach(() => {
    clearCache();
    orbioCalls.length = 0;
  });

  it("/api/agents lists only agents confirmed graduated by Orbio, never sample Masters", async () => {
    const body = await json(await agents());
    assert.equal(body.source, "orbio");
    assert.deepEqual(body.data.map((m: { tokenAddress: string }) => m.tokenAddress), [GRADUATED.token]);
    const m = body.data[0];
    assert.equal(m.isMock, false);
    assert.equal(m.holderCount, null, "holders are n/a, not invented");
    assert.equal(m.liquidityUsd, null, "liquidity is n/a, not invented");
    assert.equal(m.category, null);
    assert.equal(m.openToPitches, false);
    assert.ok(!body.data.some((x: { tokenAddress: string }) => x.tokenAddress === MISMATCH.token), "mismatch is hidden");
    assert.ok(!body.data.some((x: { tokenAddress: string }) => x.tokenAddress === NOT_GRADUATED.token));
    assert.ok(orbioCalls.some((u) => u.includes("/agents?")), "read from the Orbio API");
  });

  it("/api/cron/scan refreshes the Masters from Orbio", async () => {
    const res = await cronScan(new Request("http://x/api/cron/scan"));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { ok: true, source: "orbio", masters: 1 });
    assert.ok(orbioCalls.some((u) => u.endsWith("/agents/1")), "confirmed per agent");

    // The refreshed list is served from the cache without calling Orbio again.
    orbioCalls.length = 0;
    const listed = await json(await agents());
    assert.equal(listed.data.length, 1);
    assert.equal(orbioCalls.length, 0);
  });

  it("/api/cron/scan reports Orbio failures without throwing", async () => {
    orbioDown = true;
    try {
      const res = await cronScan(new Request("http://x/api/cron/scan"));
      assert.equal(res.status, 502);
      assert.match((await res.json()).error, /503/);
    } finally {
      orbioDown = false;
    }
  });

  it("/api/credits is unavailable until the MooBot agent exists (no invented numbers)", async () => {
    const body = await json(await credits());
    assert.equal(body.data, null);
    assert.equal(body.source, "unavailable");
  });

  it("/api/pitches, /api/tenders and /api/leaderboard are real and empty", async () => {
    const p = await json(pitches());
    const t = await json(tenders());
    const l = await json(leaderboard());
    assert.deepEqual([p.source, t.source, l.source], ["live", "live", "live"]);
    assert.deepEqual(p.data, []);
    assert.deepEqual(t.data, []);
    assert.deepEqual(l.data, { pitches: [], voters: [] });
  });

  it("never returns any sample Tournament record", async () => {
    const all = JSON.stringify([await json(pitches()), await json(tenders()), await json(leaderboard()), await json(roundsCurrent())]);
    const ids = [
      ...SAMPLE_PITCHES.flatMap((x) => [x.id, x.title, x.fighter]),
      ...SAMPLE_TENDERS.flatMap((x) => [x.id, x.title]),
      ...SAMPLE_PAST_ROUNDS.flatMap((x) => [x.id, x.winnerTitle]),
      ...SAMPLE_VOTERS.map((x) => x.wallet),
    ];
    for (const id of ids) assert.ok(!all.includes(id), `sample value leaked: ${id}`);
  });

  it("/api/rounds/current follows the server timeline, with no finished round yet", async () => {
    const body = await json(roundsCurrent());
    assert.ok(typeof body.serverNow === "number");
    assert.ok(["upcoming", "live"].includes(body.round.status));
    assert.equal(body.round.endsAt - body.round.startsAt, 72 * 3_600_000);
    assert.equal(typeof body.tournamentUnlocked, "boolean");
    assert.equal(body.votingOpen, undefined, "no label that claims voting is open");
    assert.equal(body.voteSubmission, "planned");
    assert.equal(body.pitchSubmission, "planned");
    assert.equal(body.lastRound, null);
    assert.equal(body.source, "live");
  });

  it("/api/schedule reports server time and the 24-hour gap", async () => {
    const body = await json(schedule());
    assert.ok(body.serverNow > 0);
    assert.equal(body.timeline.fullUnlockAt - body.timeline.agentLiveAt, 24 * 3_600_000);
    assert.equal(body.timeline.launchAt, undefined);
  });

  it("/api/auth/nonce returns a message with the exact safety line", async () => {
    const bad = authNonce(new Request("http://x/api/auth/nonce?address=0xnope"));
    assert.equal(bad.status, 400);
    const body = await json(authNonce(new Request(`http://x/api/auth/nonce?address=${ADDR}`)));
    assert.ok(body.message.split("\n").includes("This signature costs no gas and cannot move funds."));
  });

  it("/api/wallet/[address]/agents reads the wallet's tokens from Orbio", async () => {
    const res = await walletAgents(new Request("http://x"), { params: Promise.resolve({ address: GRADUATED.owner }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.source, "orbio");
    assert.deepEqual(
      body.data.map((a: { agentId: string; graduated: boolean }) => [a.agentId, a.graduated]),
      [["1", true], ["3", false]],
    );
    assert.ok(orbioCalls.some((u) => u.includes(`wallet=${GRADUATED.owner}`)));
  });

  it("/api/wallet rejects invalid addresses and, without RPC_URL, reports balances as not connected", async () => {
    const bad = await wallet(new Request("http://x/api/wallet/0xnope"), { params: Promise.resolve({ address: "0xnope" }) });
    assert.equal(bad.status, 400);

    const prev = process.env.RPC_URL;
    delete process.env.RPC_URL;
    try {
      const ok = await wallet(new Request(`http://x/api/wallet/${ADDR}?block=1000500`), { params: Promise.resolve({ address: ADDR }) });
      assert.equal(ok.status, 200);
      const body = await ok.json();
      assert.equal(body.source, "chain");
      assert.equal(body.data.block, "1000500");
      assert.equal(body.data.orbio.status, "not-configured");
      assert.equal(body.data.orbio.formatted, null, "no invented balance");
      assert.equal(body.data.moobot.status, "not-launched", "no $MOOBOT contract yet");
      assert.equal(body.data.moobot.formatted, null);
      assert.equal(body.data.aura, null);
      assert.equal(body.data.meetsVotingMinimum, null);
    } finally {
      if (prev !== undefined) process.env.RPC_URL = prev;
    }
  });
});
