import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import { cached, clearCache } from "@/lib/cache";
import { logoPath, safeLogoUrl } from "@/lib/safe-url";
import { confirmGraduated, fetchAgentsByWallet, fetchAllAgents, fetchGraduatedMasters, parseAgent, toMaster, type Fetcher } from "@/lib/sources/orbio-api";

/**
 * Recorded shapes from the real Orbio API (GET https://www.orbio.so/api/protocol/agents and
 * /agents/{id}, 2026-10-03), trimmed to the fields Moofield reads. Field names are verbatim.
 */
const listAgent = (id: string, token: string, graduated: boolean, logo: string | null = null) => ({
  agentId: id,
  token,
  name: `Agent ${id}`,
  symbol: `A${id}`,
  logo,
  decimals: 18,
  totalSupply: "1000000000000000000000000000",
  owner: "0xa7dea7ab4ab13f7f7a7da5db66102fb9ad53e131",
  agentWallet: "0xa7dea7ab4ab13f7f7a7da5db66102fb9ad53e131",
  receiver: "0xb3c4fec650ee602261570528a9c5c4b41c18db20",
  feeBps: 500,
  launchedAt: "1790477219",
  launchTx: "0xa6eaaf0b52fefc9afb885de21cd87540a1ae726a72c08ecc02fcb92ee22aa7e0",
  price: { source: graduated ? "pool" : "curve", graduated, orbioPerToken: null, priceMicroUsd: "479", marketCapMicroUsd: "479928647265" },
  curve: null,
  stake: { orbioWei: "0", claimedFeesWei: "0", protocolFeeWei: "0", stakedWei: "0", withdrawnWei: "0" },
  credit: { owedAtoms: null, claimedAtoms: "0", activatedAtoms: "0", mintedAtoms: null },
  links: { token: `https://robin.etherscan.io/token/${token}` },
  socials: { twitter: null, telegram: null, discord: null, website: null, farcaster: null },
  description: "Recorded test agent",
});

const detail = (a: ReturnType<typeof listAgent>, curveGraduated: boolean) => ({
  ...a,
  curve: {
    address: "0x1b4461ffd80a29fd79764c05a7b84b32156f3cd8",
    graduated: curveGraduated,
    quoteReserveWei: "1",
    tokenReserveWei: "0",
    graduationThresholdWei: "264112936947239365305859",
    progressBps: curveGraduated ? 10_000 : 9_000,
  },
  beneficiary: "0x000000000000000000000000a7dea7ab4ab13f7f7a7da5db66102fb9ad53e131",
});

const tok = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
const LOGO = "https://ungjdxribocbyrxvogqh.supabase.co/storage/v1/object/public/test/agent-1.png";
const A1 = listAgent("1", tok(1), true, LOGO);
const A2 = listAgent("2", tok(2), true); // list says graduated, curve disagrees
const A3 = listAgent("3", tok(3), false);

function fakeFetcher(): { fetcher: Fetcher; calls: string[] } {
  const calls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    if (url.includes("/agents?")) {
      if (url.includes("wallet=")) return { data: [A1, A3], page: { total: 2 } };
      return { source: "stored", live: true, chainId: 4663, page: { limit: 200, offset: 0, total: 3 }, data: [A1, A2, A3] };
    }
    if (url.endsWith("/agents/1")) return detail(A1, true);
    if (url.endsWith("/agents/2")) return detail(A2, false);
    throw new Error(`unexpected ${url}`);
  };
  return { fetcher, calls };
}

describe("Orbio API mapping", () => {
  it("parses the real field names", () => {
    const a = parseAgent(detail(A1, true))!;
    assert.equal(a.agentId, "1");
    assert.equal(a.price?.graduated, true);
    assert.equal(a.price?.source, "pool");
    assert.equal(a.curve?.graduated, true);
    assert.equal(a.curve?.progressBps, 10_000);
    assert.equal(a.owner, "0xa7dea7ab4ab13f7f7a7da5db66102fb9ad53e131");
  });

  it("rejects records missing required fields", () => {
    assert.equal(parseAgent({ agentId: "1" }), null);
    assert.equal(parseAgent({ ...A1, token: "not-an-address" }), null);
  });

  it("maps to a Master with n/a fields Orbio doesn't provide, and real links", () => {
    const m = toMaster(parseAgent(A1)!);
    assert.equal(m.holderCount, null);
    assert.equal(m.liquidityUsd, null);
    assert.equal(m.graduatedAt, null);
    assert.equal(m.launchedAt, "2026-09-27T02:46:59.000Z");
    assert.equal(m.marketCapUsd, 479_928.647265);
    assert.equal(m.explorerUrl, `https://robin.etherscan.io/token/${tok(1)}`);
    assert.equal(m.orbioUrl, "https://www.orbio.so/launchpad/dashboard");
    assert.equal(m.isMock, false);
  });

  it("pages through the agent list", async () => {
    const page = (offset: number) => Array.from({ length: offset === 0 ? 200 : 5 }, (_, i) => listAgent(String(offset + i), tok(offset + i + 1), false));
    const calls: string[] = [];
    const { agents, total } = await fetchAllAgents(async (url) => {
      calls.push(url);
      const offset = Number(new URL(url).searchParams.get("offset"));
      return { data: page(offset), page: { total: 205 } };
    });
    assert.equal(agents.length, 205);
    assert.equal(total, 205);
    assert.equal(calls.length, 2);
  });
});

describe("Master logos", () => {
  it("parses `logo`, and a null logo stays null", () => {
    assert.equal(parseAgent(A1)!.logo, LOGO);
    assert.equal(parseAgent(A3)!.logo, null);
    assert.equal(parseAgent({ ...A3, logo: "" })!.logo, null);
    assert.equal(toMaster(parseAgent(A3)!).logoUrl, null);
  });

  it("safeLogoUrl accepts only https URLs", () => {
    assert.equal(safeLogoUrl(LOGO), LOGO);
    assert.equal(safeLogoUrl("https://pbs.twimg.com/profile_images/1/a.jpg"), "https://pbs.twimg.com/profile_images/1/a.jpg");
    for (const bad of [
      "http://example.com/a.png",
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:image/png;base64,iVBORw0KGgo=",
      "/logos/a.png",
      "logos/a.png",
      "//example.com/a.png",
      "https://",
      "https://user:pass@example.com/a.png",
      "ftp://example.com/a.png",
      "not a url",
      "",
      "   ",
      `https://example.com/${"a".repeat(2_048)}`,
      null,
      undefined,
      42,
      { href: LOGO },
    ]) {
      assert.equal(safeLogoUrl(bad), null, `should reject ${String(bad).slice(0, 40)}`);
    }
  });

  it("rejects an unsafe logo from Orbio before it reaches a Master", () => {
    assert.equal(toMaster(parseAgent({ ...A1, logo: "javascript:alert(1)" })!).logoUrl, null);
    assert.equal(toMaster(parseAgent({ ...A1, logo: "http://example.com/a.png" })!).logoUrl, null);
  });

  it("carries the logo through the list path and the per-agent path, served from the site's logo route", async () => {
    const { fetcher } = fakeFetcher();
    const { masters } = await fetchGraduatedMasters(fetcher);
    const path = logoPath(masters[0].tokenAddress, LOGO);
    assert.match(path!, /^\/api\/agents\/0x[0-9a-f]{40}\/logo\?v=[0-9a-z]+$/);
    assert.equal(masters[0].logoUrl, path);
    assert.equal(toMaster(parseAgent(detail(A1, true))!).logoUrl, path);
    const owned = await fetchAgentsByWallet(tok(99) as `0x${string}`, fetcher);
    assert.deepEqual(owned.map((a) => a.logoUrl), [path, null]);
    // A changed logo gets a new address, so caches never show the old one.
    assert.notEqual(logoPath(masters[0].tokenAddress, `${LOGO}?new`), path);
  });

  it("reads the recorded fixture's logo for agent 1", () => {
    const fixture = JSON.parse(readFileSync("tests/fixtures/orbio-api.json", "utf8")) as { list: { data: unknown[] } };
    const [one, two] = fixture.list.data.map((raw) => toMaster(parseAgent(raw)!));
    assert.equal(one.logoUrl, logoPath(one.tokenAddress, "https://example.com/orbio-test/rec1.png"));
    assert.equal(two.logoUrl, null);
  });
});

describe("graduation rule", () => {
  it("lists an agent only when the list flag and the per-agent curve agree", async () => {
    const { fetcher, calls } = fakeFetcher();
    const r = await fetchGraduatedMasters(fetcher);
    assert.deepEqual(r.masters.map((m) => m.orbioAgentId), ["1"]);
    assert.equal(r.mismatches, 1);
    // Only flagged agents are confirmed; agent 3 (not graduated) is never fetched individually.
    assert.ok(!calls.some((u) => u.endsWith("/agents/3")));
  });

  it("reports mismatches so they can be logged", async () => {
    const { fetcher } = fakeFetcher();
    const { confirmed, mismatches } = await confirmGraduated([parseAgent(A1)!, parseAgent(A2)!], fetcher);
    assert.deepEqual(confirmed.map((a) => a.agentId), ["1"]);
    assert.deepEqual(mismatches, [{ agentId: "2", token: tok(2), curveGraduated: false }]);
  });

  it("marks a wallet's owned tokens as graduated using the same rule", async () => {
    const { fetcher } = fakeFetcher();
    const owned = await fetchAgentsByWallet(tok(99) as `0x${string}`, fetcher);
    assert.deepEqual(owned.map((a) => [a.agentId, a.graduated]), [["1", true], ["3", false]]);
  });
});

describe("stale fallback", () => {
  beforeEach(() => clearCache());

  it("keeps the last good Masters list when Orbio fails", async () => {
    let now = 0;
    const opts = { ttlMs: 100, staleMs: 1_000, now: () => now };
    const { fetcher } = fakeFetcher();
    const first = await cached("orbio-test", opts, async () => ({ value: (await fetchGraduatedMasters(fetcher)).masters, source: "orbio" }));
    assert.equal(first.data?.length, 1);

    now = 500;
    const second = await cached("orbio-test", opts, async () => ({
      value: (await fetchGraduatedMasters(async () => {
        throw new Error("Orbio API returned 503");
      })).masters,
      source: "orbio",
    }));
    assert.equal(second.data?.length, 1);
    assert.equal(second.stale, true);
    assert.match(second.error ?? "", /503/);
  });
});
