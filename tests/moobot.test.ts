import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { GET as moobotRoute } from "@/app/api/moobot/route";
import { HOLDER_AURA_TIERS, MOOBOT_TOKEN } from "@/config";
import { readWalletBalances } from "@/lib/balances";
import { clearCache } from "@/lib/cache";
import { getCredits } from "@/lib/credits";
import { auraTier, checkTokenAddress, getMooBot } from "@/lib/moobot";
import { receivedFrom } from "@/lib/rewards";
import { OrbioHttpError, type Fetcher } from "@/lib/sources/orbio-api";
import type { ChainReader } from "@/lib/sources/types";
import type { Address } from "@/lib/types";

/**
 * The $MOOBOT launch switch. A real Orbio agent token from data/orbio_agents.csv stands in for
 * $MOOBOT: errand (agent 106). Its Orbio response is recorded in tests/fixtures; nothing is fetched live.
 */
const ERRAND = JSON.parse(readFileSync("tests/fixtures/orbio-agent-errand.json", "utf8"));
const LOWER = "0xeb2ecf641a1f04b8df37c24eabca8f5a47cfaacb";
const CHECKSUM = "0xeb2ecF641A1F04b8df37c24eAbCA8F5A47CFAACb";
const WALLET = "0x1234567890abcdef1234567890abcdef12345678" as Address;

const setToken = (v: string | undefined) => {
  if (v === undefined) delete process.env[MOOBOT_TOKEN.env];
  else process.env[MOOBOT_TOKEN.env] = v;
};

/** Orbio stub: errand by token address, 404 for anything else. */
const calls: string[] = [];
const orbio: Fetcher = async (url) => {
  calls.push(url);
  if (url.toLowerCase().endsWith(`/agents/${LOWER}`)) return ERRAND;
  throw new OrbioHttpError(404);
};

beforeEach(() => {
  clearCache();
  calls.length = 0;
  setToken(undefined);
});
afterEach(() => setToken(undefined));

describe("$MOOBOT address check", () => {
  it("accepts a lowercase address and returns it checksummed", () => {
    assert.deepEqual(checkTokenAddress(LOWER), { ok: true, address: CHECKSUM });
    assert.deepEqual(checkTokenAddress(`  ${LOWER}  `), { ok: true, address: CHECKSUM });
  });

  it("accepts a correct checksum and rejects a wrong one (a typo)", () => {
    assert.equal(CHECKSUM.toLowerCase(), LOWER);
    assert.deepEqual(checkTokenAddress(CHECKSUM), { ok: true, address: CHECKSUM });
    const typo = CHECKSUM.replace("cF641", "cf641");
    const r = checkTokenAddress(typo);
    assert.equal(r.ok, false);
    assert.match((r as { reason: string }).reason, /checksum/);
  });

  it("rejects anything that is not 0x plus 40 hex characters", () => {
    for (const bad of ["", "eb2ecf641a1f04b8df37c24eabca8f5a47cfaacb", `${LOWER}00`, LOWER.slice(0, 41), `0x${"g".repeat(40)}`, "moobot"]) {
      assert.equal(checkTokenAddress(bad).ok, false, bad);
    }
  });
});

describe("$MOOBOT launch switch", () => {
  it("is 'not-launched' when MOOBOT_TOKEN_ADDRESS is empty, without calling Orbio", async () => {
    assert.deepEqual(await getMooBot(orbio), { status: "not-launched" });
    setToken("   ");
    assert.deepEqual(await getMooBot(orbio), { status: "not-launched" });
    assert.equal(calls.length, 0);
  });

  it("rejects an invalid address and never calls Orbio", async () => {
    setToken(CHECKSUM.replace("cF641", "cf641"));
    const s = await getMooBot(orbio);
    assert.equal(s.status, "invalid");
    assert.equal(calls.length, 0);
  });

  it("is 'not-found' (features off) when Orbio has no such agent", async () => {
    setToken("0x0000000000000000000000000000000000000001");
    assert.deepEqual(await getMooBot(orbio), { status: "not-found", address: "0x0000000000000000000000000000000000000001" });
  });

  it("is 'not-found' when Orbio answers for a different token", async () => {
    setToken(LOWER);
    const s = await getMooBot(async () => ({ ...ERRAND, token: "0x00000000000000000000000000000000000000a1" }));
    assert.equal(s.status, "not-found");
  });

  it("is 'verified' for a real agent token, with the explorer link and the agent's figures", async () => {
    setToken(LOWER);
    const s = await getMooBot(orbio);
    assert.equal(s.status, "verified");
    if (s.status !== "verified") return;
    assert.equal(s.address, CHECKSUM);
    assert.equal(s.explorerUrl, `https://robin.etherscan.io/token/${CHECKSUM}`);
    assert.ok(calls[0].endsWith(`/agents/${LOWER}`), "looked up by token address");
    assert.deepEqual(s.agent, {
      agentId: "106",
      name: "errand",
      symbol: "ERRAND",
      priceMicroUsd: ERRAND.price?.priceMicroUsd ?? null,
      marketCapMicroUsd: ERRAND.price?.marketCapMicroUsd ?? null,
      curveProgressBps: ERRAND.curve?.progressBps ?? null,
      graduated: ERRAND.curve?.graduated ?? ERRAND.price?.graduated ?? null,
      stakedWei: ERRAND.stake.stakedWei,
      claimedFeesWei: ERRAND.stake.claimedFeesWei,
      protocolFeeWei: ERRAND.stake.protocolFeeWei,
      creditOwedAtoms: ERRAND.credit.owedAtoms,
      creditClaimedAtoms: ERRAND.credit.claimedAtoms,
      creditMintedAtoms: ERRAND.credit.mintedAtoms ?? null,
      gatewayCreditAtoms: ERRAND.converted.usdgAtoms,
    });
  });

  it("keeps Orbio's nulls as null (shown as n/a, never 0)", async () => {
    setToken(LOWER);
    const s = await getMooBot(async () => ({ ...ERRAND, stake: null, credit: { owedAtoms: null, claimedAtoms: null } }));
    assert.equal(s.status, "verified");
    if (s.status !== "verified") return;
    assert.equal(s.agent.stakedWei, null);
    assert.equal(s.agent.claimedFeesWei, null);
    assert.equal(s.agent.creditOwedAtoms, null);
  });

  it("stays off if Orbio is unreachable with no earlier answer, and keeps a verified answer (stale) after one", async () => {
    setToken(LOWER);
    const down: Fetcher = async () => {
      throw new Error("fetch failed");
    };
    assert.equal((await getMooBot(down)).status, "unverified");

    clearCache();
    let now = 0;
    assert.equal((await getMooBot(orbio, () => now)).status, "verified");
    // Past its refresh time it's served at once while it reloads in the background...
    now = MOOBOT_TOKEN.verifyTtlMs + 1;
    const served = await getMooBot(down, () => now);
    assert.equal(served.status, "verified");
    // ...and once it's old and Orbio still can't be reached, it's kept but flagged stale.
    now = MOOBOT_TOKEN.verifyStaleMs + 1;
    const kept = await getMooBot(down, () => now);
    assert.equal(kept.status, "verified");
    assert.equal(kept.status === "verified" && kept.stale, true);
  });

  it("/api/moobot reports the state (empty, then verified) through our own API", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) =>
      String(input).toLowerCase().endsWith(`/agents/${LOWER}`) ? Response.json(ERRAND) : new Response("{}", { status: 404 })) as typeof fetch;
    try {
      const empty = await (await moobotRoute()).json();
      assert.deepEqual(empty, { status: "not-launched" });
      setToken(LOWER);
      const res = await moobotRoute();
      assert.equal(res.headers.get("cache-control"), "no-store");
      const body = await res.json();
      assert.equal(body.status, "verified");
      assert.equal(body.address, CHECKSUM);
      assert.equal(body.agent.agentId, "106");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("$MOOBOT features", () => {
  /** A reader that records which token address it was asked for. */
  function fakeReader(rawMooBot: bigint) {
    const asked: (Address | null)[] = [];
    const reader: ChainReader = {
      kind: "chain",
      startBlock: () => 0n,
      headBlock: async () => 0n,
      launchpadEvents: async () => [],
      tokenDetails: async () => ({ name: "", ticker: "", liquidityUsd: null, holderCount: null }),
      balanceOf: async (token) => {
        asked.push(token.address);
        if (token.address === null) return null;
        return { raw: token.symbol === "MOOBOT" ? rawMooBot : 5_000n * 10n ** 18n, decimals: 18 };
      },
    };
    return { reader, asked };
  }

  it("empty state: no $MOOBOT balance, no aura and no $MOOBOT numbers anywhere", async () => {
    const { reader, asked } = fakeReader(12_000n * 10n ** 18n);
    const env = await readWalletBalances(WALLET, undefined, { reader, moobot: () => getMooBot(orbio) });
    const b = env.data!;
    assert.equal(b.moobot.status, "not-launched");
    assert.equal(b.moobot.raw, null);
    assert.equal(b.moobot.formatted, null);
    assert.equal(b.moobot.decimals, null);
    assert.equal(b.aura, null);
    assert.equal(asked.length, 1, "only $ORBIO was read; $MOOBOT was never queried");
    assert.equal(b.orbio.status, "ok");

    const api = JSON.stringify(await (await moobotRoute()).json());
    assert.ok(!/\d/.test(api), `/api/moobot must contain no numbers when empty: ${api}`);
    assert.equal((await getCredits()).data, null, "no MooBot agent $CREDIT figures");
  });

  it("verified: reads the $MOOBOT balance from the verified contract and sets the holder aura", async () => {
    setToken(LOWER);
    const { reader, asked } = fakeReader(12_000n * 10n ** 18n);
    const env = await readWalletBalances(WALLET, undefined, { reader, moobot: () => getMooBot(orbio) });
    const b = env.data!;
    assert.equal(b.moobot.status, "ok");
    assert.equal(b.moobot.formatted, "12000");
    assert.ok(asked.includes(CHECKSUM), "read from the verified $MOOBOT contract");
    assert.equal(b.aura, "Glow");
  });

  it("not found on Orbio: $MOOBOT stays off in the wallet", async () => {
    setToken("0x0000000000000000000000000000000000000001");
    const { reader } = fakeReader(12_000n * 10n ** 18n);
    const b = (await readWalletBalances(WALLET, undefined, { reader, moobot: () => getMooBot(orbio) })).data!;
    assert.equal(b.moobot.status, "not-launched");
    assert.equal(b.aura, null);
  });

  it("aura tiers follow HOLDER_AURA_TIERS (cosmetic)", () => {
    const unit = 10n ** 18n;
    assert.equal(auraTier(0n, 18), null);
    assert.equal(auraTier(BigInt(HOLDER_AURA_TIERS[0].minMooBot) * unit - 1n, 18), null);
    for (const t of HOLDER_AURA_TIERS) assert.equal(auraTier(BigInt(t.minMooBot) * unit, 18)?.name, t.name);
    assert.equal(auraTier(10n ** 30n * unit, 18)?.name, HOLDER_AURA_TIERS.at(-1)!.name);
  });

  it("Credits: the MooBot agent's $CREDIT comes from the verified agent's Orbio record", async () => {
    setToken(LOWER);
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) =>
      String(input).toLowerCase().endsWith(`/agents/${LOWER}`) ? Response.json(ERRAND) : new Response("{}", { status: 404 })) as typeof fetch;
    try {
      const c = await getCredits();
      assert.equal(c.source, "orbio");
      // Received = the gateway balance credited from the converted fee share + staking $CREDIT claimed.
      assert.equal(c.data?.receivedAtoms, (BigInt(ERRAND.converted.usdgAtoms) + BigInt(ERRAND.credit.claimedAtoms)).toString());
      assert.equal(c.data?.gatewayAtoms, ERRAND.converted.usdgAtoms);
      assert.equal(c.data?.claimedAtoms, ERRAND.credit.claimedAtoms);
      assert.equal(c.data?.waitingAtoms, ERRAND.credit.owedAtoms, "accrued but unclaimed stays apart");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("Field Fund total", () => {
  it("adds the gateway balance and claimed staking , and is n/a only when Orbio has neither", () => {
    assert.equal(receivedFrom({ gatewayCreditAtoms: "103593327", creditClaimedAtoms: "0" }), 103_593_327n);
    assert.equal(receivedFrom({ gatewayCreditAtoms: "1000000", creditClaimedAtoms: "2500000" }), 3_500_000n);
    assert.equal(receivedFrom({ gatewayCreditAtoms: null, creditClaimedAtoms: "2500000" }), 2_500_000n);
    assert.equal(receivedFrom({ gatewayCreditAtoms: null, creditClaimedAtoms: null }), null);
  });
});
