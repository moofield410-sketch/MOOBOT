import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { GET as cronAutopost } from "@/app/api/cron/autopost/route";
import { ECOBOT, GATEWAY } from "@/config";
import { boardDraft, graduationDraft, launchDraft, LINK_RE, MAX_POST_CHARS, recapDraft, type Draft } from "@/lib/autopost/drafts";
import { autoPostStatus, dueDrafts, runAutoPost, type AutoPostSources } from "@/lib/autopost/run";
import { dailyBoard, kindsFor, parseDay, rowsFor } from "@/lib/bloom-pop";
import { kvClearMemory, kvSet } from "@/lib/kv";
import type { MooBotState } from "@/lib/moobot";
import type { GatewayFetch } from "@/lib/orbio-gateway";
import type { Master } from "@/lib/types";
import { xAllowance } from "@/lib/xpost";

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
  assert.ok((d.text.match(/\$[A-Za-z][A-Za-z0-9]*/g) ?? []).length <= 1, `${d.key} has more than one cashtag`);
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
    assert.deepEqual(r, { mode: "off", posted: [], drafted: [], skipped: [], failed: [], error: null });
  });

  it("on posts each due post once, paced: the launch goes at once, then one post per gap", async () => {
    env(A.env, "on");
    env(GATEWAY.keyEnv, "test-key");
    const gap = ECOBOT.minGapMinutes * 60_000;
    const run = (t: number) => runAutoPost({ now: t, fetch: gateway(), sources: sources({ moobot: verified }) });

    const first = await run(AFTERNOON);
    assert.deepEqual(first.posted.map((p) => p.key), ["launch"]);
    assert.deepEqual(first.skipped, ["board:2026-10-05", "recap:2026-10-05"], "the rest waits for the pace");
    assert.equal(first.posted[0].url, "https://x.com/M00FIELD/status/1");
    assert.deepEqual((await run(AFTERNOON + gap / 2)).posted, [], "nothing inside the gap");
    assert.deepEqual((await run(AFTERNOON + gap)).posted.map((p) => p.key), ["board:2026-10-05"]);
    assert.deepEqual((await run(AFTERNOON + 2 * gap)).posted.map((p) => p.key), ["recap:2026-10-05"]);
    assert.deepEqual((await run(AFTERNOON + 3 * gap)).posted, [], "never twice");

    for (const p of posts) {
      assert.deepEqual(p.platforms, ["twitter"]);
      assert.equal(p.allow_links, false);
    }
    // Orbio quotes 0.0187 for text and 0.0352 with one image: each cap covers its quote and stays close to it.
    const [launch, board, recap] = posts.map((p) => Number(p.max_cost));
    assert.ok(launch >= 0.0352 && launch < 0.05, `launch cap ${launch}`);
    assert.ok(board >= 0.0352 && board < 0.05, `board cap ${board}`);
    assert.ok(recap >= 0.0187 && recap < 0.03, `recap cap ${recap}`);
    // The next day: the launch is never repeated.
    const tomorrow = await run(AFTERNOON + 86_400_000);
    assert.deepEqual(tomorrow.posted.map((p) => p.key), ["board:2026-10-06"]);
  });

  it("before the times of day, only what's due goes out", async () => {
    env(A.env, "on");
    env(GATEWAY.keyEnv, "test-key");
    const early = await runAutoPost({ now: Date.parse("2026-10-05T00:01:00Z"), fetch: gateway(), sources: sources() });
    assert.deepEqual(early.posted, []);
    const morning = await runAutoPost({ now: Date.parse("2026-10-05T08:00:00Z"), fetch: gateway(), sources: sources() });
    assert.deepEqual(morning.posted.map((p) => p.key), ["board:2026-10-05"]);
  });

  it("the first run only remembers the existing Masters; new ones get a shout-out each, paced, none lost", async () => {
    env(A.env, "on");
    env(GATEWAY.keyEnv, "test-key");
    env(A.skipEnv, "board");
    try {
      const night = Date.parse("2026-10-05T00:00:00Z");
      const gap = ECOBOT.minGapMinutes * 60_000;
      await runAutoPost({ now: night, fetch: gateway(), sources: sources({ masters: [master(1), master(2)] }) });
      assert.equal(posts.length, 0, "existing Masters are not announced");

      const many = [master(1), master(2), master(100), master(101), master(102)];
      const keys: string[] = [];
      for (let i = 1; i <= 4; i++) keys.push(...(await runAutoPost({ now: night + i * gap, fetch: gateway(), sources: sources({ masters: many }) })).posted.map((p) => p.key));
      assert.deepEqual(keys.sort(), [master(100), master(101), master(102)].map((m) => `grad:${m.tokenAddress}`).sort());
    } finally {
      env(A.skipEnv, undefined);
    }
  });

  it("with the Eco Bot running, the recap and graduation posts are left to it", async () => {
    env(A.env, "preview");
    env(ECOBOT.env, "preview");
    try {
      await runAutoPost({ now: AFTERNOON - 3_600_000, sources: sources({ masters: [master(1)] }) });
      const r = await runAutoPost({ now: AFTERNOON, sources: sources({ moobot: verified, masters: [master(1), master(9)] }) });
      assert.deepEqual(r.drafted, ["launch", "board:2026-10-05"]);
    } finally {
      env(ECOBOT.env, undefined);
    }
  });

  it("stops for the day when Orbio says the X allowance is used up", async () => {
    env(A.env, "on");
    env(GATEWAY.keyEnv, "test-key");
    const lastOne: GatewayFetch = async (url, init) => {
      posts.push(JSON.parse(init.body));
      return { status: 200, json: async () => ({ result: { status: "published", platforms: [{ platformPostUrl: "https://x.com/M00FIELD/status/9" }], remaining_today: { twitter: { posts_used: 50, posts_left: 0 } } }, cost: { credit: "0.0187" } }) };
    };
    await runAutoPost({ now: Date.parse("2026-10-05T08:00:00Z"), fetch: lastOne, sources: sources() });
    assert.equal(posts.length, 1);
    const r = await runAutoPost({ now: AFTERNOON, fetch: lastOne, sources: sources({ moobot: verified }) });
    assert.deepEqual(r.posted, [], "not even the launch: Orbio would refuse it");
    assert.equal((await xAllowance(AFTERNOON)).postsLeft, 0);
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

  it("a post Orbio refuses on its own (400) doesn't block the others, and Orbio's reason is kept", async () => {
    env(A.env, "on");
    env(GATEWAY.keyEnv, "test-key");
    const picky: GatewayFetch = async (url, init) => {
      const body = JSON.parse(init.body);
      if (body.media) return { status: 400, json: async () => ({ error: "quote 0.0352 exceeds max_cost" }) };
      return gateway()(url, init);
    };
    const r = await runAutoPost({ now: AFTERNOON, fetch: picky, sources: sources({ moobot: verified }) });
    assert.deepEqual(r.failed, ["launch", "board:2026-10-05"]);
    assert.deepEqual(r.posted.map((p) => p.key), ["recap:2026-10-05"], "a refusal doesn't use up the pace");
    assert.match(r.error ?? "", /launch: Orbio refused the request \(arguments or cost cap\): quote 0\.0352 exceeds max_cost/);
    assert.match((await autoPostStatus(AFTERNOON)).lastError ?? "", /exceeds max_cost/);
    // Fixed: the launch goes at once, the board after the gap, the recap isn't repeated.
    const next = await runAutoPost({ now: AFTERNOON + 900_000, fetch: gateway(), sources: sources({ moobot: verified }) });
    assert.deepEqual(next.posted.map((p) => p.key), ["launch"]);
    assert.equal(next.error, null);
    const later = await runAutoPost({ now: AFTERNOON + 900_000 + ECOBOT.minGapMinutes * 60_000, fetch: gateway(), sources: sources({ moobot: verified }) });
    assert.deepEqual(later.posted.map((p) => p.key), ["board:2026-10-05"]);
  });

  it("a post X fails to publish is retried with X's reason shown, then given up after a few tries", async () => {
    env(A.env, "on");
    env(GATEWAY.keyEnv, "test-key");
    env(A.skipEnv, "board");
    try {
      const xFails: GatewayFetch = async (url, init) => {
        const body = JSON.parse(init.body);
        if (!body.text.startsWith("🐄 Moofield daily")) return gateway()(url, init);
        return { status: 200, json: async () => ({ result: { post_id: null, status: "failed", platforms: [{ platform: "twitter", status: "failed", error: "Duplicate content" }] }, cost: { credit: null } }) };
      };
      let r = await runAutoPost({ now: AFTERNOON, fetch: xFails, sources: sources() });
      assert.deepEqual(r.failed, ["recap:2026-10-05"]);
      assert.match(r.error ?? "", /recap:2026-10-05: X didn't publish it \(Duplicate content\), will retry/);
      for (let i = 1; i < A.maxAttempts; i++) r = await runAutoPost({ now: AFTERNOON + i * 900_000, fetch: xFails, sources: sources() });
      assert.match(r.error ?? "", /gave up/);
      const after = await runAutoPost({ now: AFTERNOON + (A.maxAttempts + 2) * 900_000, fetch: xFails, sources: sources() });
      assert.deepEqual(after.failed, [], "not tried again once given up");
    } finally {
      env(A.skipEnv, undefined);
    }
  });

  it("a recap an earlier version marked 'failed' is tried again", async () => {
    env(A.env, "on");
    env(GATEWAY.keyEnv, "test-key");
    env(A.skipEnv, "board");
    try {
      await kvSet("autopost:log", {
        posted: { "recap:2026-10-05": { key: "recap:2026-10-05", at: new Date(AFTERNOON).toISOString(), status: "failed", url: null } },
        counts: {},
        lastRunAt: null,
        lastError: null,
      });
      const r = await runAutoPost({ now: AFTERNOON, fetch: gateway(), sources: sources() });
      assert.ok(r.posted.some((p) => p.key === "recap:2026-10-05" && p.status === "published"));
    } finally {
      env(A.skipEnv, undefined);
    }
  });

  it("AUTO_POST_SKIP=launch never posts the launch (for when it was posted by hand)", async () => {
    env(A.env, "on");
    env(GATEWAY.keyEnv, "test-key");
    env(A.skipEnv, "launch");
    try {
      const r = await runAutoPost({ now: AFTERNOON, fetch: gateway(), sources: sources({ moobot: verified }) });
      assert.ok(!r.posted.some((p) => p.key === "launch"));
      assert.ok(r.posted.some((p) => p.key === "board:2026-10-05"));
    } finally {
      env(A.skipEnv, undefined);
    }
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
