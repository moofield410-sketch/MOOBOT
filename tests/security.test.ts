import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { errorMessage } from "@/lib/monitoring";
import { allow } from "@/lib/rate-limit";

/** What a visitor can see of an error, and the per-connection limit. */

const prev = process.env.RPC_URL;
afterEach(() => (prev === undefined ? delete process.env.RPC_URL : (process.env.RPC_URL = prev)));

describe("errorMessage", () => {
  it("never shows the RPC URL or its key, in any line", () => {
    process.env.RPC_URL = "https://robinhood-mainnet.g.alchemy.com/v2/SECRETKEY123456";
    const viemLike = new Error(
      "HTTP request failed.\n\nStatus: 429\nURL: https://robinhood-mainnet.g.alchemy.com/v2/SECRETKEY123456\nRequest body: {\"method\":\"eth_call\"}",
    );
    const shown = errorMessage(viemLike);
    assert.equal(shown, "HTTP request failed.");
    const inline = errorMessage(new Error("fetch to https://robinhood-mainnet.g.alchemy.com/v2/SECRETKEY123456 failed"));
    assert.ok(!inline.includes("SECRETKEY"), inline);
    assert.match(inline, /\[hidden\]|\[rpc\]/);
  });

  it("cuts other URLs to their site and masks keys", () => {
    assert.equal(errorMessage(new Error("GET https://api.example.com/v1/agents?key=abc failed")), "GET https://api.example.com failed");
    assert.ok(!errorMessage("bad key sk-orbio-ABCDEFGHIJKLMNOP").includes("ABCDEFGH"));
  });
});

describe("rate limit", () => {
  it("allows up to the limit in the window, then refuses, then allows again", () => {
    const k = `t:${Math.random()}`;
    for (let i = 0; i < 3; i++) assert.ok(allow(k, 3, 1_000, 10_000 + i));
    assert.equal(allow(k, 3, 1_000, 10_500), false);
    assert.ok(allow(k, 3, 1_000, 11_100));
  });
});
