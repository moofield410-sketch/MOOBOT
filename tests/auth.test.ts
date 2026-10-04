import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { AUTH, CHAIN } from "@/config";
import { buildSignInMessage, parseSignInMessage } from "@/lib/auth/message";
import { consumeNonce, issueNonce } from "@/lib/auth/nonces";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { verifySignIn } from "@/lib/auth/verify";

// A throwaway key generated in memory, used only to sign test messages offline.
const account = privateKeyToAccount(generatePrivateKey());

async function signedRequest(now = Date.now()) {
  const { nonce, issuedAt } = issueNonce(account.address, now)!;
  const message = buildSignInMessage({ address: account.address, chainId: CHAIN.id, nonce, issuedAt });
  const signature = await account.signMessage({ message });
  return { message, signature };
}

describe("sign-in message", () => {
  it("contains the safety sentence exactly, on its own line", () => {
    const message = buildSignInMessage({ address: account.address, chainId: CHAIN.id, nonce: "abc", issuedAt: new Date(0).toISOString() });
    assert.equal(AUTH.safetyLine, "This signature costs no gas and cannot move funds.");
    assert.ok(message.split("\n").includes("This signature costs no gas and cannot move funds."));
    assert.ok(message.includes(`Chain ID: ${CHAIN.id}`));
  });

  it("round-trips and rejects edited messages", () => {
    const fields = { address: account.address, chainId: CHAIN.id, nonce: "abc", issuedAt: new Date(0).toISOString() };
    const message = buildSignInMessage(fields);
    assert.equal(parseSignInMessage(message)?.nonce, "abc");
    assert.equal(parseSignInMessage(message.replace(AUTH.safetyLine, "This signature is free.")), null);
    assert.equal(parseSignInMessage(message.replace(`Chain ID: ${CHAIN.id}`, "Chain ID: 1")), null);
    assert.equal(parseSignInMessage(`${message}\nExtra: line`), null);
  });
});

describe("nonces", () => {
  it("can be used only once", async () => {
    const now = Date.now();
    const { nonce, issuedAt } = issueNonce(account.address, now)!;
    assert.deepEqual(await consumeNonce(nonce, account.address, issuedAt, now), { ok: true });
    assert.equal((await consumeNonce(nonce, account.address, issuedAt, now)).ok, false);
  });

  it("expire after the TTL", async () => {
    const now = Date.now();
    const { nonce, issuedAt } = issueNonce(account.address, now)!;
    assert.equal((await consumeNonce(nonce, account.address, issuedAt, now + AUTH.nonceTtlMs + 1)).ok, false);
  });

  it("are bound to the address and time they were issued for", async () => {
    const now = Date.now();
    const { nonce, issuedAt } = issueNonce(account.address, now)!;
    assert.equal((await consumeNonce(nonce, "0x0000000000000000000000000000000000000001", issuedAt, now)).ok, false);
    assert.equal((await consumeNonce(nonce, account.address, new Date(now - 1000).toISOString(), now)).ok, false);
  });

  it("need no server memory: another instance (same secret) accepts them", async () => {
    const now = Date.now();
    const { nonce, issuedAt } = issueNonce(account.address, now)!;
    const g = globalThis as unknown as { __moobotNonces?: unknown };
    assert.equal(g.__moobotNonces, undefined);
    assert.deepEqual(await consumeNonce(nonce, account.address, issuedAt, now), { ok: true });
  });
});

describe("verifySignIn", () => {
  it("accepts a valid signature from an offline test key", async () => {
    const { message, signature } = await signedRequest();
    const r = await verifySignIn(message, signature);
    assert.deepEqual(r, { ok: true, address: account.address.toLowerCase() });
  });

  it("rejects a replayed sign-in", async () => {
    const { message, signature } = await signedRequest();
    assert.equal((await verifySignIn(message, signature)).ok, true);
    assert.equal((await verifySignIn(message, signature)).ok, false);
  });

  it("rejects a tampered message or a signature from another key", async () => {
    const { message, signature } = await signedRequest();
    const tampered = message.replace(/Nonce: \w+/, "Nonce: 00");
    assert.equal((await verifySignIn(tampered, signature)).ok, false);

    const other = privateKeyToAccount(generatePrivateKey());
    const fresh = await signedRequest();
    const wrongSig = await other.signMessage({ message: fresh.message });
    const r = await verifySignIn(fresh.message, wrongSig);
    assert.equal(r.ok, false);
  });
});

describe("session tokens", () => {
  const secret = "x".repeat(32);

  it("verify with the right secret and expire", () => {
    const now = Date.now();
    const token = createSessionToken(account.address, secret, now);
    assert.equal(verifySessionToken(token, secret, now), account.address.toLowerCase());
    assert.equal(verifySessionToken(token, "y".repeat(32), now), null);
    assert.equal(verifySessionToken(token, secret, now + AUTH.sessionTtlMs + 1), null);
  });

  it("reject a forged payload", () => {
    const token = createSessionToken(account.address, secret);
    const [, mac] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ a: "0x0000000000000000000000000000000000000001", e: Date.now() + 1e9 })).toString("base64url")}.${mac}`;
    assert.equal(verifySessionToken(forged, secret), null);
  });
});
