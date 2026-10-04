// Starts the built site and checks that every page route renders.
// Usage: npm run test:routes   (builds first, then runs this script)
//
// The site runs with real data on (USE_MOCK_DATA = false). So the check never depends on the
// live Orbio API, it starts a local stub that serves recorded Orbio responses
// (tests/fixtures/orbio-api.json, tests/fixtures/orbio-agent-errand.json) and points the site at
// it with ORBIO_API_BASE_URL. The site is started three times to cover the $MOOBOT launch switch:
// MOOBOT_TOKEN_ADDRESS empty, set to a real agent token (errand, from data/orbio_agents.csv), and
// set to an address Orbio doesn't know.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";

const STUB_PORT = 3198;

const FIXTURE = JSON.parse(readFileSync("tests/fixtures/orbio-api.json", "utf8"));
const ERRAND = JSON.parse(readFileSync("tests/fixtures/orbio-agent-errand.json", "utf8"));
const ANALYTICS = JSON.parse(readFileSync("tests/fixtures/orbio-analytics.json", "utf8"));
const CHART = JSON.parse(readFileSync("tests/fixtures/orbio-chart-errand.json", "utf8"));
const [GRADUATED, MISMATCH, NOT_GRADUATED] = FIXTURE.list.data;
const UNKNOWN_TOKEN = "0x0000000000000000000000000000000000000001";

/**
 * Local Orbio stub: GET /api/protocol/agents (list, ?wallet=), /agents/{id or token},
 * /agents/analytics and /agents/{token}/chart?range=.
 */
const stub = createServer((req, res) => {
  const u = new URL(req.url ?? "/", `http://127.0.0.1:${STUB_PORT}`);
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (u.pathname === "/api/protocol/agents") {
    const w = u.searchParams.get("wallet")?.toLowerCase();
    const offset = Number(u.searchParams.get("offset") ?? 0);
    const data = w ? FIXTURE.list.data.filter((a) => a.owner === w || a.agentWallet === w) : offset === 0 ? FIXTURE.list.data : [];
    return send(200, { ...FIXTURE.list, data, page: { limit: 200, offset, total: w ? data.length : FIXTURE.list.page.total } });
  }
  if (u.pathname === "/api/protocol/agents/analytics") return send(200, ANALYTICS);
  const chartOf = u.pathname.match(/^\/api\/protocol\/agents\/([^/]+)\/chart$/)?.[1]?.toLowerCase();
  if (chartOf) {
    const range = u.searchParams.get("range");
    if (!["1h", "4h", "1d"].includes(range)) return send(400, { error: "range must be one of 1h, 4h, 1d." });
    if (chartOf === ERRAND.token) return send(200, { ...CHART, range });
    return send(200, { token: chartOf, range, enabled: [], trackedSince: null, bucketSeconds: 60, points: [] });
  }
  const id = u.pathname.match(/^\/api\/protocol\/agents\/([^/]+)$/)?.[1]?.toLowerCase();
  if (id === ERRAND.token) return send(200, ERRAND);
  const agent = FIXTURE.list.data.find((a) => a.agentId === id || a.token === id);
  if (agent) return send(200, { ...agent, curve: FIXTURE.curves[agent.agentId] });
  send(404, { error: "not found" });
});
await new Promise((resolve) => stub.listen(STUB_PORT, "127.0.0.1", resolve));

/** [path, expected status, text that must appear in the HTML] */
const PAGES = [
  ["/", 200, "Every pitch needs a power-up."],
  ["/", 200, "No pitches yet, be the first"],
  ["/masters", 200, "Graduated agents"],
  ["/masters", 200, GRADUATED.name],
  ["/tournament", 200, "Pitch, vote, win"],
  ["/tournament", 200, "The Tournament opens in"],
  ["/tournament", 200, "No pitches yet, be the first"],
  ["/tournament", 200, "Pitch submission opens soon"],
  ["/tournament", 200, "No tenders yet"],
  ["/tournament", 200, "Round 1 ends 8 Oct 2026, 12:00 UTC"],
  ["/leaderboard", 200, "Who&#x27;s leading this round"],
  ["/leaderboard", 200, "No votes yet"],
  ["/credits", 200, "Where the $CREDIT goes"],
  ["/credits", 200, "The site keeps its own day-by-day record"],
  // n/a figures carry their reason (server-rendered into the tooltip).
  ["/credits", 200, "Appears once the official $MOOBOT contract is confirmed on Orbio."],
  ["/", 200, "Appears once the official $MOOBOT contract is confirmed on Orbio."],
  ["/masters", 200, "Orbio doesn&#x27;t publish this yet."],
  ["/docs", 200, "How Moofield works"],
  ["/docs/getting-started", 200, "Getting started"],
  ["/docs/pitching", 200, "How pitching works"],
  ["/docs/voting", 200, "How voting works"],
  ["/docs/rewards", 200, "Worked example"],
  ["/docs/faq", 200, "FAQ"],
  ["/docs/glossary", 200, "Glossary"],
  ["/docs/safety", 200, "Safety and transparency"],
  ["/docs/safety", 200, "How to verify the official $MOOBOT contract"],
  ["/docs/safety", 200, "Ignore any other address."],
  ["/docs/roadmap", 200, "Roadmap"],
  ["/status", 200, "System status"],
  ["/terms", 200, "Terms of use"],
  ["/privacy", 200, "Privacy"],
  ["/wallet", 200, "Your wallet"],
  ["/", 200, "Official updates"],
  ["/", 200, "Pollen Path"],
  ["/", 200, "@M00FIELD"],
  // Orbio at a glance: live before $MOOBOT launches (recorded analytics: 1,152 agents).
  ["/", 200, "Orbio at a glance"],
  ["/", 200, "1,152"],
  ["/", 200, "New agents launched per day"],
  ["/credits", 200, "Paid to agents as gateway balance"],
  ["/tournament/recaps", 200, "No recaps yet"],
  ["/tournament/recaps/1", 404, "Page not found"],
  ["/play/2026-10-04/1240", 200, "1,240"],
  ["/play/2999-01-01/10", 404, "Page not found"],
  ["/docs/not-a-page", 404, "Page not found"],
  // Not graduated, or the list and the per-agent curve disagree: never a Master.
  ["/masters/" + NOT_GRADUATED.token, 404, "Page not found"],
  ["/masters/" + MISMATCH.token, 404, "Page not found"],
  // Sample (mock) tokens, graduated and not: never shown with real data on.
  ["/masters/0xfa4e000000000000000000000000000000000001", 404, "Page not found"],
  ["/masters/0xfa4e000000000000000000000000000000000009", 404, "Page not found"],
  ["/nope", 404, "Page not found"],
];

/**
 * Text that must never appear on any page: removed developer wording, the preview banner,
 * and sample (invented) Masters, pitches and Fighters.
 */
const FORBIDDEN = [
  "arrives in a later update",
  "Mock data",
  "READ-ONLY",
  "Read-only</span>",
  "after launch",
  "trading fees",
  "Opens at launch",
  "Voting is off for this pitch",
  "Preview mode",
  "preview-banner",
  "sample data",
  "Sample data",
  "Placeholder Panda",
  "Dummy Dragonfly",
  "Sample Sensei",
  "Lorem Ipsum Bot",
  "Fixture Falcon",
  "Stub Samurai",
  "Testbed Tortoise",
  "Mockingbird",
  "Never Graduated Newt",
  "Pixel Pathfinder",
  "Byte Buddy",
  "Echo Engine",
  "Ledger Lark",
  "Nimbus Notes",
  "Patch Pup",
  "Quill Bot",
  "Signal Sprout",
  "Weekly holder digest",
  // Wording audit (AUDIT.md): no running-agent claim, no market, no promises.
  "agent goes live",
  "The agent is live",
  "The Credit Market",
  "Voting opens in",
  "profit",
  "passive income",
  "risk-free",
];

/** Audit word checks that need a regex ("earn" must not match "learn"). */
const FORBIDDEN_RE = [/\bearn(s|ed|ing)?\b/i, /\bsafe\b/i];

/** Text every page must contain (footer): the disclaimer. */
const EVERYWHERE = ["Independent community project, not affiliated with Orbio. Not financial advice."];

/** Page text without scripts, styles and tags (so code identifiers like "safeIcon" don't count). */
const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

/** A $MOOBOT amount, e.g. "12,000 $MOOBOT". None may appear while $MOOBOT is not launched. */
const MOOBOT_NUMBER = /\d[\d,.]*\s*(?:&nbsp;)?\$MOOBOT/;

/** Checks on the footer's Community list: X links only the confirmed account; Telegram and Discord stay "Coming soon". */
const CONFIRMED_X = "https://x.com/M00FIELD";
function communityProblems(html) {
  const problems = [];
  const block = html.slice(html.indexOf(">Community<"), html.indexOf("</footer>"));
  const item = (label) => block.slice(block.indexOf(label) - 400, block.indexOf(label) + 120);
  const xLinks = block.match(/https:\/\/(?:x|twitter)\.com\/[^"]*/g) ?? [];
  if (xLinks.some((u) => u !== CONFIRMED_X)) problems.push("footer links an X account that isn't confirmed");
  if (!xLinks.includes(CONFIRMED_X)) problems.push("footer is missing the official X account");
  for (const label of ["Telegram", "Discord"]) if (!item(label).includes("Coming soon")) problems.push(`${label} should stay Coming soon`);
  return problems;
}

const failures = [];

/** Starts `next start` with extra env, runs `checks(base, page)`, then stops it. */
async function runSite(label, port, env, checks) {
  console.log(`\n— ${label}`);
  const base = `http://localhost:${port}`;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ORBIO_API_BASE_URL: `http://127.0.0.1:${STUB_PORT}/api/protocol`, MOOBOT_TOKEN_ADDRESS: "", ...env },
  });
  let serverLog = "";
  server.stdout.on("data", (d) => (serverLog += d));
  server.stderr.on("data", (d) => (serverLog += d));

  /** Fetches a page and records problems. `extra(html)` returns more problems. */
  const page = async (path, status, mustInclude = [], extra = () => []) => {
    const res = await fetch(base + path);
    const html = await res.text();
    const problems = [];
    if (res.status !== status) problems.push(`status ${res.status}, expected ${status}`);
    for (const text of [mustInclude].flat()) if (!html.includes(text)) problems.push(`missing text "${text}"`);
    for (const bad of FORBIDDEN) if (html.includes(bad)) problems.push(`contains "${bad}"`);
    for (const re of FORBIDDEN_RE) if (re.test(visibleText(html))) problems.push(`contains ${re}: "${visibleText(html).match(re)[0]}"`);
    // Dynamic 404s stream the layout in the client payload, so footer checks run on 200 pages.
    if (status === 200) {
      for (const must of EVERYWHERE) if (!html.includes(must)) problems.push(`missing "${must}"`);
      problems.push(...communityProblems(html));
    }
    problems.push(...extra(html));
    console.log(`${problems.length ? "✖" : "✔"} ${path}${problems.length ? `  (${problems.join("; ")})` : ""}`);
    if (problems.length) failures.push(`${label}: ${path}`);
  };

  const expectJson = async (path, check) => {
    const body = await (await fetch(base + path)).json();
    const problem = check(body);
    console.log(`${problem ? "✖" : "✔"} ${path}${problem ? `  (${problem}: ${JSON.stringify(body).slice(0, 200)})` : ""}`);
    if (problem) failures.push(`${label}: ${path}`);
  };

  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) {
      try {
        up = (await fetch(`${base}/api/schedule`)).ok;
      } catch {
        await sleep(500);
      }
    }
    if (!up) throw new Error(`Server did not start.\n${serverLog}`);
    await checks({ base, page, expectJson });
  } catch (err) {
    console.error(err);
    failures.push(`${label}: startup`);
  } finally {
    server.kill();
  }
}

// 1. $MOOBOT not launched (the default): every page, and no $MOOBOT numbers anywhere.
await runSite("MOOBOT_TOKEN_ADDRESS empty", 3199, {}, async ({ base, page, expectJson }) => {
  const agents = await (await fetch(`${base}/api/agents`)).json();
  if (agents.source !== "orbio" || agents.data?.length !== 1 || agents.data[0].tokenAddress !== GRADUATED.token) {
    throw new Error(`/api/agents should list exactly the one confirmed graduated agent from Orbio, got ${JSON.stringify(agents).slice(0, 300)}`);
  }
  const noMooBotNumbers = (html) => (MOOBOT_NUMBER.test(html) ? [`shows a $MOOBOT number: "${html.match(MOOBOT_NUMBER)[0]}"`] : []);
  for (const [path, status, text] of PAGES) await page(path, status, text, path.startsWith("/docs") ? () => [] : noMooBotNumbers);
  for (const m of agents.data) await page(`/masters/${m.tokenAddress}`, 200, [m.name, "Orbio doesn&#x27;t publish this yet."], noMooBotNumbers);

  await expectJson("/api/moobot", (b) => (b.status === "not-launched" && Object.keys(b).length === 1 ? null : "expected exactly {status: not-launched}"));
  await expectJson("/api/moobot/chart?range=1h", (b) => (b.status === "off" && Object.keys(b).length === 1 ? null : "expected exactly {status: off}"));
  // The Bloom Pop score card (the preview image for shared scores) is a real PNG.
  const card = await fetch(`${base}/play/2026-10-04/1240/opengraph-image`);
  if (card.status !== 200 || !card.headers.get("content-type")?.startsWith("image/png")) {
    failures.push(`MOOBOT_TOKEN_ADDRESS empty: score card image returned ${card.status} ${card.headers.get("content-type")}`);
    console.log("✖ /play/…/opengraph-image");
  } else console.log("✔ /play/…/opengraph-image");
  await expectJson(`/api/wallet/${GRADUATED.owner}`, (b) =>
    b.data.moobot.status === "not-launched" && b.data.moobot.raw === null && b.data.moobot.formatted === null && b.data.aura === null
      ? null
      : "expected no $MOOBOT balance and no aura",
  );
  await page("/credits", 200, ["MooBot agent on Orbio", "Not launched yet"]);
  await page("/status", 200, ["$MOOBOT contract", "Not launched yet"], (html) =>
    html.includes("the configured $MOOBOT contract was rejected") ? ["shows a rejection warning with no address set"] : [],
  );
});

// 2. $MOOBOT set to a real agent token that exists on Orbio: features on.
await runSite("MOOBOT_TOKEN_ADDRESS = errand (agent 106)", 3197, { MOOBOT_TOKEN_ADDRESS: ERRAND.token }, async ({ page, expectJson }) => {
  await expectJson("/api/moobot", (b) =>
    b.status === "verified" &&
    b.address.toLowerCase() === ERRAND.token &&
    b.explorerUrl === `https://robin.etherscan.io/token/${b.address}` &&
    b.agent.agentId === "106" &&
    b.agent.creditOwedAtoms === ERRAND.credit.owedAtoms
      ? null
      : "expected verified errand with explorer link",
  );
  for (const range of ["1h", "4h", "1d"]) {
    await expectJson(`/api/moobot/chart?range=${range}`, (b) =>
      b.status === "ok" && b.chart.range === range && b.chart.points.length === CHART.points.length && b.chart.points[0].priceMicroUsd === CHART.points[0].priceMicroUsd
        ? null
        : "expected errand's recorded price points",
    );
  }
  await expectJson("/api/moobot/chart?range=1w", (b) => (typeof b.error === "string" ? null : "expected a range error"));
  await page("/credits", 200, ["Agent #106 · errand", "Staked", "Creator fees claimed", "Protocol fee", "$CREDIT owed", "$ORBIO", "live launch terms"], (html) =>
    html.includes("Not launched yet") ? ["still says Not launched yet"] : [],
  );
  await page("/status", 200, ["Verified on Orbio", "#106"], (html) => (html.includes("was rejected") ? ["shows a rejection warning"] : []));
});

// 3. $MOOBOT set to an address Orbio doesn't know: clear warning, features stay off.
await runSite("MOOBOT_TOKEN_ADDRESS not on Orbio", 3196, { MOOBOT_TOKEN_ADDRESS: UNKNOWN_TOKEN }, async ({ page, expectJson }) => {
  await expectJson("/api/moobot", (b) => (b.status === "not-found" ? null : "expected not-found"));
  await expectJson("/api/moobot/chart?range=1h", (b) => (b.status === "off" ? null : "expected the chart off"));
  await expectJson(`/api/wallet/${GRADUATED.owner}`, (b) => (b.data.moobot.status === "not-launched" && b.data.aura === null ? null : "expected $MOOBOT off"));
  await page("/status", 200, ["Warning: the configured $MOOBOT contract was rejected", "was not found on the Orbio API", "Address rejected (not on Orbio)"]);
  await page("/credits", 200, ["Not launched yet"]);
});

stub.close();

if (failures.length) {
  console.error(`\n${failures.length} route check(s) failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("\nAll route checks passed.");
