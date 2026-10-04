import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { GET as cronAutopost } from "@/app/api/cron/autopost/route";
import { GATEWAY } from "@/config";
import { boardDraft, graduationDraft, launchDraft, LINK_RE, MAX_POST_CHARS, recapDraft, type Draft } from "@/lib/autopost/drafts";
import { autoPostStatus, dueDrafts, runAutoPost, type AutoPostSources } from "@/lib/autopost/run";
import { dailyBoard, kindsFor, parseDay, rowsFor } from "@/lib/bloom-pop";
import { kvClearMemory } from "@/lib/kv";
import type { MooBotState } from "@/lib/moobot";
import type { GatewayFetch } from "@/lib/orbio-gateway";
import type { Master } from "@/lib/types";

/** Auto-posts to @M00FIELD. A fake Orbio gateway stands in for social.post; nothing is posted. */
const A = GATEWAY.autopost;
const OFFICIAL = "0xeb2ecF641A1F04b8df37c24eAbCA8F5A47CFAACb";
const SITE_URL = "https://moofield.example";

/** The same wording audit the route checks apply to every page (scripts/smoke-routes.mjs). */
const BANNED = [/\bearn(s|ed|ing)?\b/i, /\bsafe\b/i, /profit/i, /passive income/i, /risk-free/i, /after launch/i, /agent goes live/i];

const env = (k: string, v: string | undefined) => (v === undefined ? delete process.env[k] : (process.env[k] = v));

const master = (n: number, extra: Partial<Master> = {}): Master =>
  ({ tokenAddress: `0x${n.toString(16).padStart(40, "0")}`, name: `Agent ${n}`, ticker: `AG${n}`, ...extra }) as Master;

function sources(o: { moobot?: MooBotState; masters?: Master[] | null } = {}): AutoPostSources {
  return {
    moobot: async () => o.moobot ?? { status: "not-launched" },
    totals: async () => ({
      data: { agents: 1152, launchesByDay: [{ day: "2026-10-04", launches: 50 }], marketCapMicroUsd: null, orbioMicroUsd: null, stakedWei: null, creatorFeesWei: null, convertedUsdgAtoms: null, creditAccruedAtoms: null, creditClaimedAtoms: null },
      source: "orbio",
      updatedAt: null,
      stale: false,
    }),
    credits: async () => ({ data: null, source: "unavailable", updatedAt: null, stale: false }),
    masters: async () => ({ data: o.masters === undefined ? [master(1), master(2)] : o.masters, source: "orbio", updatedAt: null, stale: false }),
    chart: async () => ({ status: "off" }),
  };
}

const verified = { status: "verified", address: OFFICIAL, explorerUrl: null, agent: { agentId: "106" }, checkedAt: null, stale: false } as unknown as MooBotState;

let posts: Record<string, unknown>[] = [];
const gateway = (status = 200): GatewayFetch => async (url, init) => {
  assert.equal(url, `${GATEWAY.baseUrl}/tools/social.post`);
  const body = JSON.parse(init.body);
  posts.push(body);
  return { status, json: async () => ({ id: "t1", tool: "social.post", result: { post_id: `p${posts.length}`, status: "published", platforms: [{ platform: "twitter", status: "published", platformPostUrl: `https://x.com/M00FIELD/status/${posts.length}` }] }, cost: { credit: "0.015" } }) };
};

// 2026-10-05 13:00 UTC: after the board (00:05) and the recap (12:00).
const AFTERNOON = Date.parse("2026-10-05T13:00:00Z");

beforeEach(() => {
  kvClearMemory();
  posts = [];
  env(A.env, undefined);
  env(GATEWAY.keyEnv, undefined);
  env("URL", SITE_URL);
});
afterEach(() => {
  env(A.env, undefined);
  env(GATEWAY.keyEnv, undefined);
  env("URL", undefined);
});

function checkDraft(d: Draft) {
  assert.ok(d.text.length <= MAX_POST_CHARS, `${d.key} is ${d.text.length} characters`);
  assert.doesNotMatch(d.text, LINK_RE, `${d.key} contains a link`);
  for (const re of BANNED) assert.doesNotMatch(d.text, re, `${d.key} matches ${re}`);
  for (const m of d.media ?? []) assert.ok(m.url.startsWith("https://"), "media must be public https");
}

describe("Auto-post drafts", () => {
  it("every template fits a free X post, has no link and passes the wording audit", () => {
    checkDraft(launchDraft(OFFICIAL, SITE_URL));
    checkDraft(boardDraft("2026-10-05", SITE_URL));
    checkDraft(recapDraft("2026-10-05", { agents: 123_456, launchedYesterday: 9_999, fieldFund: "1,234,567.89", moobotPrice: "$0.000833", moobotChangePct: -12.345 })!);
    checkDraft(graduationDraft({ tokenAddress: master(1).tokenAddress, name: "A".repeat(200), ticker: "B".repeat(50) }));
  });

  it("the launch post carries exactly the address it is given, and the poster", () => {
    const d = launchDraft(OFFICIAL, SITE_URL);
    assert.equal(d.key, "launch");
    assert.equal(d.text.match(/0x[0-9a-fA-F]{40}/g)?.join(), OFFICIAL);
    assert.deepEqual(d.media, [{ url: `${SITE_URL}/posters/moofield-token-live.png`, type: "image" }]);
  });

  it("the recap leaves out what isn't known, and is skipped when nothing is", () => {
    const d = recapDraft("2026-10-05", { agents: 1152, launchedYesterday: null, fieldFund: null, moobotPrice: null, moobotChangePct: null })!;
    assert.match(d.text, /Agents on Orbio: 1,152\n/);
    assert.doesNotMatch(d.text, /Field Fund|\$MOOBOT|yesterday|n\/a| 0 /);
    assert.equal(recapDraft("2026-10-05", { agents: null, launchedYesterday: null, fieldFund: null, moobotPrice: null, moobotChangePct: null }), null);
  });

  it("an agent can't sneak a link, a mention or a hashtag into a shout-out", () => {
    const d = graduationDraft({ tokenAddress: master(1).tokenAddress, name: "Visit scam.xyz now @everyone #free", ticker: "$WIN" });
    assert.equal(d.text.split("\n")[0], "🎓 Welcome to the Masters, $WIN!");
    checkDraft(d);
    const unnamed = graduationDraft({ tokenAddress: master(2).tokenAddress, name: "Unnamed agent", ticker: "n/a" });
    assert.match(unnamed.text, /Welcome to the Masters, Unnamed agent!/);
  });
});

describe("Bloom Pop board picture", () => {
  it("is the same board the game starts the day with", () => {
    const g = dailyBoard("2026-10-05");
    assert.equal(g.cells.length, rowsFor(1));
    assert.ok(g.cells.flat().every((k) => k >= 0 && k < kindsFor(1)));
    assert.deepEqual(dailyBoard("2026-10-05"), g, "same day, same board");
    assert.notDeepEqual(dailyBoard("2026-10-06"), g);
  });

  it("only exists for days that have started", () => {
    const now = Date.parse("2026-10-05T10:00:00Z");
    assert.equal(parseDay("2026-10-05", now), "2026-10-05");
    assert.equal(parseDay("2026-10-06", now), null);
    assert.equal(parseDay("2026-02-30", now), null);
    assert.equal(parseDay("today", now), null);
  });
});

describe("Auto-post runs", () => {
  it("preview (the default) saves drafts and never calls Orbio", async () => {
    const r = await runAutoPost({ now: AFTERNOON, fetch: gateway(), sources: sources({ moobot: verified }) });
    assert.equal(r.mode, "preview");
    assert.deepEqual(r.drafted, ["launch", "board:2026-10-05", "recap:2026-10-05"]);
    assert.equal(posts.length, 0);
    const s = await autoPostStatus(AFTERNOON);
    assert.deepEqual(s.drafts.map((d) => d.key).sort(), ["board:2026-10-05", "launch", "recap:2026-10-05"]);
    assert.equal(s.postsToday, 0);
  });

  it("off does nothing at all", async () => {
    env(A.env, "off");
    const r = await runAutoPost({ now: AFTERNOON, fetch: gateway(), sources: sources({ moobot: verified }) });
    assert.deepEqual(r, { mode: "off", posted: [], drafted: [], skipped: [], error: null });
  });

  it("on posts each due post once, with no links allowed and the cost capped", async () => {
    env(A.env, "on");
    env(GATEWAY.keyEnv, "test-key");
    const r = await runAutoPost({ now: AFTERNOON, fetch: gateway(), sources: sources({ moobot: verified }) });
    assert.deepEqual(r.posted.map((p) => p.key), ["launch", "board:2026-10-05", "recap:2026-10-05"]);
    assert.equal(r.posted[0].url, "https://x.com/M00FIELD/status/1");
    for (const p of posts) {
      assert.deepEqual(p.platforms, ["twitter"]);
      assert.equal(p.allow_links, false);
      assert.equal(p.max_cost, A.postMaxCost);
    }
    // The next run, and the next day's run, never repeat the launch.
    await runAutoPost({ now: AFTERNOON + 15 * 60_000, fetch: gateway(), sources: sources({ moobot: verified }) });
    assert.equal(posts.length, 3);
    const tomorrow = await runAutoPost({ now: AFTERNOON + 86_400_000, fetch: gateway(), sources: sources({ moobot: verified }) });
    assert.deepEqual(tomorrow.posted.map((p) => p.key), ["board:2026-10-06", "recap:2026-10-06"]);
  });

  it("before the times of day, only what's due goes out", async () => {
    env(A.env, "on");
    env(GATEWAY.keyEnv, "test-key");
    const early = await runAutoPost({ now: Date.parse("2026-10-05T00:01:00Z"), fetch: gateway(), sources: sources() });
    assert.deepEqual(early.posted, []);
    const morning = await runAutoPost({ now: Date.parse("2026-10-05T08:00:00Z"), fetch: gateway(), sources: sources() });
    assert.deepEqual(morning.posted.map((p) => p.key), ["board:2026-10-05"]);
  });

  it("the first run only remembers the existing Masters; new ones get a shout-out, at most the daily cap", async () => {
    env(A.env, "on");
    env(GATEWAY.keyEnv, "test-key");
    const night = Date.parse("2026-10-05T00:00:00Z");
    await runAutoPost({ now: night, fetch: gateway(), sources: sources({ masters: [master(1), master(2)] }) });
    assert.equal(posts.length, 0, "existing Masters are not announced");

    const many = [master(1), master(2), ...Array.from({ length: A.graduationsPerDay + 2 }, (_, i) => master(100 + i))];
    const r = await runAutoPost({ now: night + 60_000, fetch: gateway(), sources: sources({ masters: many }) });
    assert.equal(r.posted.filter((p) => p.key.startsWith("grad:")).length, A.graduationsPerDay);
    assert.equal(r.skipped.length, 2);
    // The held-back ones come the next day.
    const next = await runAutoPost({ now: night + 86_400_000 + 60_000, fetch: gateway(), sources: sources({ masters: many }) });
    assert.equal(next.posted.filter((p) => p.key.startsWith("grad:")).length, 2);
  });

  it("never more than the daily post cap in total", async () => {
    env(A.env, "on");
    env(GATEWAY.keyEnv, "test-key");
    await runAutoPost({ now: Date.parse("2026-10-05T00:00:00Z"), fetch: gateway(), sources: sources({ masters: [] }) });
    const many = Array.from({ length: 30 }, (_, i) => master(500 + i));
    // Launch, board, recap and 30 new Masters over several runs in one day: the total cap still holds.
    for (let i = 1; i < 10; i++) await runAutoPost({ now: AFTERNOON + i * 60_000, fetch: gateway(), sources: sources({ moobot: verified, masters: many }) });
    assert.ok(posts.length <= A.postsPerDay, `${posts.length} posts`);
  });

  it("a refused post is reported and retried next run, never marked as sent", async () => {
    env(A.env, "on");
    env(GATEWAY.keyEnv, "test-key");
    const r = await runAutoPost({ now: AFTERNOON, fetch: gateway(402), sources: sources() });
    assert.match(r.error ?? "", /balance/);
    assert.equal((await autoPostStatus(AFTERNOON)).recent.length, 0);
    const retry = await runAutoPost({ now: AFTERNOON + 900_000, fetch: gateway(), sources: sources() });
    assert.ok(retry.posted.some((p) => p.key === "board:2026-10-05"));
  });

  it("on without a key posts nothing and says why", async () => {
    env(A.env, "on");
    const r = await runAutoPost({ now: AFTERNOON, fetch: gateway(), sources: sources() });
    assert.match(r.error ?? "", /ORBIO_API_KEY/);
    assert.equal(posts.length, 0);
  });

  it("dueDrafts doesn't announce a launch that isn't verified", async () => {
    const { drafts } = await dueDrafts(AFTERNOON, sources({ moobot: { status: "not-found", address: OFFICIAL } as MooBotState }));
    assert.ok(!drafts.some((d) => d.kind === "launch"));
  });
});

describe("Auto-post cron route", () => {
  it("refuses calls without CRON_SECRET in production", async () => {
    const prev = process.env.NODE_ENV;
    const secret = process.env.CRON_SECRET;
    try {
      (process.env as Record<string, string>).NODE_ENV = "production";
      process.env.CRON_SECRET = "s".repeat(40);
      assert.equal((await cronAutopost(new Request("http://x/api/cron/autopost"))).status, 401);
      assert.equal((await cronAutopost(new Request("http://x/api/cron/autopost", { headers: { authorization: "Bearer wrong" } }))).status, 401);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prev;
      if (secret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = secret;
    }
  });
});

describe("Launch poster", () => {
  it("is a real PNG in public/", () => {
    const png = readFileSync("public/posters/moofield-token-live.png");
    assert.equal(png.subarray(1, 4).toString(), "PNG");
  });
});
