// End-to-end check of the Tournament on the built site, with real wallet signatures.
// Usage: npm run build, then: node scripts/e2e-tournament.mjs        (a whole short round, then its result)
//        node scripts/e2e-tournament.mjs --serve                     (a live round to click through; stays up)
//
// Nothing real is touched: a local Orbio stub serves the agents (some owned by throwaway test keys),
// and a local JSON-RPC stub plays Robinhood Chain (blocks every 250 ms, $ORBIO balances from a
// transfer list, and old state "pruned", so voting power is rebuilt from the Transfer log like on
// the public RPC). The site runs with MOOFIELD_LOCAL_TEST=1 and a test clock (never on Netlify).

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { encodeAbiParameters, keccak256, toHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const SERVE = process.argv.includes("--serve");
const SITE_PORT = SERVE ? 3207 : 3187;
const ORBIO_PORT = 3188;
const RPC_PORT = 3189;
const CHAIN_ID = 4663;
const SAFETY = "This signature costs no gas and cannot move funds.";
const ORBIO_TOKEN = "0xaa07a0e9209e16ac99708c3ec70159c6ef3128a3";
const ZERO = "0x0000000000000000000000000000000000000000";
const E18 = 10n ** 18n;

// --- Test wallets (throwaway keys, in memory) --------------------------------------------------
const fighter = privateKeyToAccount(generatePrivateKey());
const masterOwner = privateKeyToAccount(generatePrivateKey());
const voters = Array.from({ length: 6 }, () => privateKeyToAccount(generatePrivateKey()));
const moderator = privateKeyToAccount(generatePrivateKey());
const lc = (a) => a.address.toLowerCase();
// A fixed browser wallet for --serve, so the UI test can sign with it (Fighter + voter).
const UI_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const ui = privateKeyToAccount(UI_KEY);

// --- Orbio stub ---------------------------------------------------------------------------------
const FIXTURE = JSON.parse(readFileSync("tests/fixtures/orbio-api.json", "utf8"));
const ANALYTICS = JSON.parse(readFileSync("tests/fixtures/orbio-analytics.json", "utf8"));
const base = FIXTURE.list.data[0];
const mkAgent = (id, owner, graduated, name) => ({
  ...base,
  agentId: String(id),
  token: `0x${String(id).padStart(40, "d")}`,
  name,
  symbol: name.replace(/\W/g, "").slice(0, 5).toUpperCase(),
  logo: null,
  owner,
  agentWallet: null,
  price: { ...base.price, graduated },
  description: `${name} (test agent)`,
});
const AGENTS = [
  ...FIXTURE.list.data,
  mkAgent(501, lc(fighter), false, "Test Fighter One"),
  mkAgent(502, lc(fighter), false, "Test Fighter Two"),
  mkAgent(503, lc(ui), false, "Browser Fighter"),
  mkAgent(900, lc(masterOwner), true, "Test Master"),
  mkAgent(901, lc(ui), true, "Browser Master"),
];
const curveOf = (a) =>
  FIXTURE.curves[a.agentId] ?? { address: a.token, graduated: a.price.graduated, quoteReserveWei: "1", tokenReserveWei: "0", graduationThresholdWei: "1", progressBps: a.price.graduated ? 10000 : 2000 };

const orbio = createServer((req, res) => {
  const u = new URL(req.url ?? "/", `http://127.0.0.1:${ORBIO_PORT}`);
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (u.pathname === "/api/protocol/agents") {
    const w = u.searchParams.get("wallet")?.toLowerCase();
    const offset = Number(u.searchParams.get("offset") ?? 0);
    const data = w ? AGENTS.filter((a) => a.owner === w || a.agentWallet === w) : offset === 0 ? AGENTS : [];
    return send(200, { ...FIXTURE.list, data, page: { limit: 200, offset, total: w ? data.length : AGENTS.length } });
  }
  if (u.pathname === "/api/protocol/agents/analytics") return send(200, ANALYTICS);
  if (/\/chart$/.test(u.pathname)) return send(200, { token: ZERO, range: "1h", enabled: [], trackedSince: null, bucketSeconds: 60, points: [] });
  const id = u.pathname.match(/^\/api\/protocol\/agents\/([^/]+)$/)?.[1]?.toLowerCase();
  const a = AGENTS.find((x) => x.agentId === id || x.token === id);
  if (a) return send(200, { ...a, curve: curveOf(a) });
  send(404, { error: "not found" });
});

// --- Chain stub (JSON-RPC) ----------------------------------------------------------------------
const T0 = Date.now() - 3 * 86_400_000;
const BLOCK_MS = 250;
const head = () => BigInt(Math.floor((Date.now() - T0) / BLOCK_MS));
const timeOf = (n) => Math.floor((T0 + Number(n) * BLOCK_MS) / 1000);
const PRUNE = 20n; // state older than this many blocks (5 s) is "pruned", like the public RPC after a few hours
const transfers = [];
const mint = (to, whole, block = 10n) => transfers.push({ block, from: ZERO, to: to.toLowerCase(), value: BigInt(whole) * E18 });
for (const [i, v] of voters.entries()) mint(v.address, i === 5 ? 50 : 4_000 * (i + 1));
mint(ui.address, 250_000);
const balanceAt = (owner, block) =>
  transfers.filter((t) => t.block <= block).reduce((b, t) => b + (t.to === owner ? t.value : 0n) - (t.from === owner ? t.value : 0n), 0n);
const TRANSFER_TOPIC = keccak256(toHex("Transfer(address,address,uint256)"));
const topicAddr = (a) => `0x${a.slice(2).padStart(64, "0")}`;
const hex = (n) => `0x${BigInt(n).toString(16)}`;
const blockTag = (tag) => (tag === "latest" || tag === undefined || tag === "pending" || tag === "safe" || tag === "finalized" ? head() : BigInt(tag));
const fakeBlock = (n) => ({
  number: hex(n),
  hash: keccak256(toHex(`block-${n}`)),
  parentHash: keccak256(toHex(`block-${n - 1n}`)),
  timestamp: hex(timeOf(n)),
  nonce: "0x0000000000000000",
  difficulty: "0x0",
  totalDifficulty: "0x0",
  gasLimit: "0x1c9c380",
  gasUsed: "0x0",
  miner: ZERO,
  extraData: "0x",
  logsBloom: `0x${"0".repeat(512)}`,
  transactionsRoot: keccak256("0x01"),
  stateRoot: keccak256("0x02"),
  receiptsRoot: keccak256("0x03"),
  sha3Uncles: keccak256("0x04"),
  mixHash: keccak256("0x05"),
  size: "0x200",
  baseFeePerGas: "0x0",
  transactions: [],
  uncles: [],
});
let rpcCalls = 0;
function rpcOne({ id, method, params }) {
  rpcCalls++;
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const err = (message) => ({ jsonrpc: "2.0", id, error: { code: -32000, message } });
  switch (method) {
    case "eth_chainId":
      return ok(hex(CHAIN_ID));
    case "eth_blockNumber":
      return ok(hex(head()));
    case "eth_getBlockByNumber": {
      const n = blockTag(params[0]);
      return ok(n > head() ? null : fakeBlock(n));
    }
    case "eth_call": {
      const [{ to, data }, tag] = params;
      if (to?.toLowerCase() !== ORBIO_TOKEN) return err("execution reverted");
      const n = blockTag(tag);
      if (head() - n > PRUNE) return err("missing trie node (pruned)");
      if (data.startsWith("0x313ce567")) return ok(encodeAbiParameters([{ type: "uint8" }], [18]));
      if (data.startsWith("0x70a08231")) return ok(encodeAbiParameters([{ type: "uint256" }], [balanceAt(`0x${data.slice(34, 74)}`.toLowerCase(), n)]));
      return err("execution reverted");
    }
    case "eth_getLogs": {
      const [f] = params;
      const from = BigInt(f.fromBlock);
      const to = blockTag(f.toBlock);
      if (to - from > 2_000_000n) return err("query exceeds max block range");
      const [, fromT, toT] = f.topics ?? [];
      const logs = transfers
        .filter((t) => t.block >= from && t.block <= to)
        .filter((t) => (!fromT || topicAddr(t.from) === fromT.toLowerCase()) && (!toT || topicAddr(t.to) === toT.toLowerCase()))
        .map((t, i) => ({
          address: ORBIO_TOKEN,
          topics: [TRANSFER_TOPIC, topicAddr(t.from), topicAddr(t.to)],
          data: encodeAbiParameters([{ type: "uint256" }], [t.value]),
          blockNumber: hex(t.block),
          blockHash: fakeBlock(t.block).hash,
          transactionHash: keccak256(toHex(`tx-${t.block}-${i}`)),
          transactionIndex: "0x0",
          logIndex: hex(i),
          removed: false,
        }));
      return ok(logs);
    }
    default:
      return err(`method ${method} not supported by the stub`);
  }
}
const rpc = createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    const parsed = JSON.parse(body);
    const out = Array.isArray(parsed) ? parsed.map(rpcOne) : rpcOne(parsed);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(out));
  });
});

await Promise.all([new Promise((r) => orbio.listen(ORBIO_PORT, "127.0.0.1", r)), new Promise((r) => rpc.listen(RPC_PORT, "127.0.0.1", r))]);

// --- The site -----------------------------------------------------------------------------------
// Short run: 1 "hour" = 2 s, so Round 1 (72 h) lasts 144 s and opens 20 s after start.
// --serve: real hours, and Round 1 started 10 minutes ago.
const HOUR_MS = SERVE ? 3_600_000 : 2_000;
const unlockAt = SERVE ? Date.now() - 10 * 60_000 : Date.now() + 20_000;
const agentLiveAt = new Date(unlockAt - 24 * HOUR_MS).toISOString();
const roundEnd = unlockAt + 72 * HOUR_MS;
const SITE = `http://localhost:${SITE_PORT}`;

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(SITE_PORT)], {
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    MOOFIELD_LOCAL_TEST: "1",
    DEV_AGENT_LIVE_AT: agentLiveAt,
    DEV_HOUR_MS: String(HOUR_MS),
    ORBIO_API_BASE_URL: `http://127.0.0.1:${ORBIO_PORT}/api/protocol`,
    RPC_URL: `http://127.0.0.1:${RPC_PORT}`,
    SESSION_SECRET: "e2e-test-secret-e2e-test-secret-e2e-test-secret",
    MODERATOR_WALLETS: [lc(moderator), lc(ui)].join(","),
    MOOBOT_TOKEN_ADDRESS: "",
  },
});
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));
const stopAll = () => {
  server.kill();
  orbio.close();
  rpc.close();
};
process.on("SIGINT", () => (stopAll(), process.exit(130)));

for (let i = 0; i < 80; i++) {
  try {
    if ((await fetch(`${SITE}/api/schedule`)).ok) break;
  } catch {
    await sleep(500);
  }
}


// --- Helpers ------------------------------------------------------------------------------------
const failures = [];
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "✔" : "✖"} ${label}${!ok && extra ? `  (${extra})` : ""}`);
  if (!ok) failures.push(label);
};
const FIELDS = {
  pitch: ["Agent ID", "Pitch to", "Title", "Summary", "Demo"],
  vote: ["Pitch"],
  score: ["Pitch", "Master", "Score"],
  tender: ["Master", "Title", "Description", "Looking for", "Deadline"],
};
const NOTE = {
  pitch: "Submits this pitch to the Moofield Tournament. One pitch per agent per round.",
  vote: "Casts your vote in the Moofield Tournament. Your first vote in a round is final.",
  score: "Scores this pitch as a Master in the Moofield Tournament.",
  tender: "Posts this tender as a Master in the Moofield Tournament.",
};
const { getAddress } = await import("viem");
const message = (kind, who, fields, round = 1, at = Date.now()) =>
  [
    `Moofield ${kind}`,
    "",
    SAFETY,
    NOTE[kind],
    "",
    `Address: ${getAddress(who.address)}`,
    `Chain ID: ${CHAIN_ID}`,
    `Round: ${round}`,
    ...FIELDS[kind].map((f) => `${f}: ${fields[f]}`),
    `Issued at: ${new Date(at).toISOString()}`,
  ].join("\n");
async function act(kind, who, fields, opts = {}) {
  const msg = message(kind, who, fields, opts.round, opts.at);
  const signature = await who.signMessage({ message: msg });
  const res = await fetch(`${SITE}/api/tournament/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: msg, signature }) });
  return { status: res.status, body: await res.json() };
}
const pitch = (agentId, title, extra = {}) => ({
  "Agent ID": agentId,
  "Pitch to": "open pitch (any Master)",
  Title: title,
  Summary: "A short daily summary of what changed for holders, posted where the Master's community reads it.",
  Demo: "none",
  ...extra,
});
const get = async (path) => (await fetch(`${SITE}${path}`)).json();
const page = async (path) => (await fetch(`${SITE}${path}`)).text();

if (SERVE) {
  // Something to click on: two pitches from other agents, a tender, a few votes.
  await act("pitch", fighter, pitch("501", "Daily holder digest", { Demo: "https://demo.example.com/digest" }));
  await act("pitch", fighter, pitch("502", "Weekly Master scorecard"));
  const masterToken = AGENTS.find((a) => a.agentId === "900").token;
  await act("tender", masterOwner, {
    Master: masterToken,
    Title: "A weekly holder report",
    Description: "Tell holders what changed this week, in plain words, in one short post.",
    "Looking for": "Short | Plain words",
    Deadline: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  });
  for (const i of [0, 1, 2]) await act("vote", voters[i], { Pitch: i === 0 ? "r1-501" : "r1-502" });
  await act("score", masterOwner, { Pitch: "r1-502", Master: masterToken, Score: "7" });
  console.log(`Tournament test site: ${SITE}  (Round 1 live; browser key ${ui.address}, moderator)`);
  console.log(`Orbio stub :${ORBIO_PORT}, chain stub :${RPC_PORT}. Ctrl+C to stop.`);
  await new Promise(() => {});
}

try {
  // Before the unlock: refused.
  const early = await act("pitch", fighter, pitch("501", "Daily holder digest"));
  check("before the unlock, pitches are refused", early.status === 403, JSON.stringify(early.body));

  console.log(`… waiting ${Math.ceil((unlockAt - Date.now()) / 1000)} s for the Tournament to open`);
  await sleep(Math.max(0, unlockAt - Date.now() + 1_500));

  // Sign-in works across requests (stateless nonce).
  const nonce = await get(`/api/auth/nonce?address=${moderator.address}`);
  const sig = await moderator.signMessage({ message: nonce.message });
  const verify = await fetch(`${SITE}/api/auth/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: nonce.message, signature: sig }) });
  const cookie = verify.headers.get("set-cookie")?.split(";")[0] ?? "";
  check("sign-in issues a session", verify.status === 200 && cookie.startsWith("moobot_session="), String(verify.status));
  const replay = await fetch(`${SITE}/api/auth/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: nonce.message, signature: sig }) });
  check("a sign-in can't be replayed", replay.status === 401);

  // Pitches.
  const p1 = await act("pitch", fighter, pitch("501", "Daily holder digest", { Demo: "https://demo.example.com/digest" }));
  check("Fighter pitches for agent 501", p1.status === 200 && p1.body.pitch?.id === "r1-501", JSON.stringify(p1.body));
  const p2 = await act("pitch", fighter, pitch("502", "Weekly Master scorecard"));
  check("same wallet pitches for its second agent", p2.status === 200, JSON.stringify(p2.body));
  const dup = await act("pitch", fighter, pitch("501", "Another idea"));
  check("one pitch per agent per round", dup.status === 409, JSON.stringify(dup.body));
  const notMine = await act("pitch", voters[0], pitch("501", "Stolen agent"));
  check("only the agent's own wallet can pitch for it", notMine.status === 403, JSON.stringify(notMine.body));
  const scam = await act("pitch", fighter, pitch("503", "Free airdrop"));
  check("scam wording is refused", scam.status === 400 || scam.status === 403, JSON.stringify(scam.body));

  // Tender + an answer to it.
  const masterToken = AGENTS.find((a) => a.agentId === "900").token;
  const tender = await act("tender", masterOwner, {
    Master: masterToken,
    Title: "A weekly holder report",
    Description: "Tell holders what changed this week, in plain words, in one short post.",
    "Looking for": "Short | Plain words",
    Deadline: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  });
  check("a Master posts a tender", tender.status === 200 && tender.body.tender?.id === "t1-900-1", JSON.stringify(tender.body));

  // Scores.
  const s1 = await act("score", masterOwner, { Pitch: "r1-501", Master: masterToken, Score: "8" });
  check("the Master scores a pitch", s1.status === 200, JSON.stringify(s1.body));
  const s2 = await act("score", masterOwner, { Pitch: "r1-501", Master: masterToken, Score: "9" });
  check("a Master scores a pitch once", s2.status === 409);

  // Votes (power rebuilt from transfers: the stub prunes old state).
  const v0 = await act("vote", voters[0], { Pitch: "r1-501" });
  check("a holder votes", v0.status === 200 && v0.body.vote?.power === Math.floor(Math.sqrt(4_000)), JSON.stringify(v0.body));
  // Voter 1 buys more after the snapshot: their power stays at the snapshot balance.
  mint(voters[1].address, 1_000_000, head());
  const results = await Promise.all([1, 2, 3, 4].flatMap((i) => [act("vote", voters[i], { Pitch: "r1-502" }), act("vote", voters[i], { Pitch: "r1-502" })]));
  check("simultaneous votes: one per wallet kept", results.filter((r) => r.status === 200).length === 4, results.map((r) => r.status).join(","));
  const me1 = await get(`/api/tournament/me?address=${voters[1].address}`);
  check("buying after the snapshot doesn't add power", me1.power?.balance === 8_000, JSON.stringify(me1.power));
  const low = await act("vote", voters[5], { Pitch: "r1-501" });
  check("under the minimum can't vote", low.status === 403, JSON.stringify(low.body));
  const own = await act("vote", fighter, { Pitch: "r1-501" });
  check("no vote for your own agent's pitch", own.status === 403);
  const stale = await act("vote", voters[3], { Pitch: "r1-501" }, { at: Date.now() - 11 * 60_000 });
  check("an old signature is refused", stale.status === 401 || stale.status === 409);

  // Moderation.
  const hideNoSession = await fetch(`${SITE}/api/tournament/hide`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pitchId: "r1-502", reason: "test" }) });
  check("hiding needs a moderator session", hideNoSession.status === 401);

  // Board, pages, audit.
  const state = await get("/api/tournament");
  const board = state.data?.pitches?.map((p) => [p.id, p.votes, p.scoreAvg]);
  check("the board ranks by voting power", JSON.stringify(board) === JSON.stringify([["r1-502", 4, null], ["r1-501", 1, 8]]), JSON.stringify(board));
  check("the snapshot block is recorded", Boolean(state.data?.snapshot?.block), JSON.stringify(state.data?.snapshot));
  check("tenders are listed with their bids", state.data?.tenders?.[0]?.id === "t1-900-1");
  const audit = await get("/api/tournament/audit?round=1");
  check("the audit log has every signed vote", audit.votes?.length === 5 && audit.votes.every((v) => v.signature && v.message.includes(SAFETY)));
  const tPage = await page("/tournament");
  check("/tournament shows the pitches", tPage.includes("Daily holder digest") && tPage.includes("Weekly Master scorecard") && tPage.includes("Voting power snapshot"));
  const lPage = await page("/leaderboard");
  check("/leaderboard shows the ranking", lPage.includes("Weekly Master scorecard"));
  const status = await page("/status");
  check("/status shows the test-clock warning", status.includes("a test clock is on"));

  // Moderator hides pitch 501: its voter gets the vote back.
  const hide = await fetch(`${SITE}/api/tournament/hide`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ pitchId: "r1-501", reason: "Test hide" }) });
  check("a moderator hides a pitch", hide.status === 200, String(hide.status));
  const revote = await act("vote", voters[0], { Pitch: "r1-502" });
  check("its voter can vote again", revote.status === 200, JSON.stringify(revote.body));

  // The round ends.
  console.log(`… waiting ${Math.ceil((roundEnd - Date.now()) / 1000)} s for Round 1 to end`);
  await sleep(Math.max(0, roundEnd - Date.now() + 1_500));
  const late = await act("vote", voters[5], { Pitch: "r1-502" }, { round: 1 });
  check("after the round, votes for it are refused", late.status === 409 || late.status === 403, JSON.stringify(late.body));
  const after = await get("/api/tournament");
  const r1 = after.data?.past?.find((r) => r.number === 1);
  check("Round 1 has a result", r1?.winnerPitchId === "r1-502" && r1.votesCast === 5, JSON.stringify(r1));
  check("Round 2 is running", after.data?.round?.number === 2 && after.data.round.status === "live");
  const recap = await page("/tournament/recaps/1");
  check("the recap page shows the champion", recap.includes("Weekly Master scorecard"));
  const ledger = await get(`/api/tournament/me?address=${voters[2].address}`);
  check("the voter's ledger lists Round 1", ledger.ledger?.some((e) => e.round === 1 && e.role === "voter"), JSON.stringify(ledger.ledger));
  const fl = await get(`/api/tournament/me?address=${fighter.address}`);
  check("the Fighter's ledger shows the win", fl.ledger?.some((e) => e.label.includes("placed #1")), JSON.stringify(fl.ledger));
} catch (err) {
  console.error(err);
  failures.push("crashed");
} finally {
  stopAll();
}

console.log(`\nchain stub calls: ${rpcCalls}`);
if (failures.length) {
  console.error(`\n${failures.length} Tournament check(s) failed:\n  ${failures.join("\n  ")}\n\nServer log tail:\n${log.slice(-3000)}`);
  process.exit(1);
}
console.log("\nAll Tournament checks passed.");
