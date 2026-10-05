// The MooBot runner, for GitHub Actions (.github/workflows/moobot.yml) or any machine:
//
//   node --import ./tests/setup/register.mjs scripts/moobot.ts [minutes]
//
// It runs the fixed posts and every Eco Bot job once (news, mentions, compose, study), then keeps
// watching: every few minutes it answers new mentions and lets compose and study run when they're
// due, until `minutes` (default 13) are up. Netlify then only serves the website, so the bot's
// thinking costs no Netlify credits. It shares the site's Netlify Blobs store (NETLIFY_SITE_ID and
// NETLIFY_BLOBS_TOKEN), so the Status page and the homepage feed show what it does. ECO_BOT,
// ECO_BOT_JOBS and AUTO_POST switch it exactly as on Netlify.
//
// No wallet, no chain writes.

import { runAutoPost } from "@/lib/autopost/run";
import { runEcoJob } from "@/lib/ecobot/jobs";
import { kvMode } from "@/lib/kv";
import type { EcoJob } from "@/lib/ecobot/store";

const minutes = Number(process.argv[2]) || 13;
const until = Date.now() + minutes * 60_000;
/** Between watch rounds. */
const WATCH_EVERY_MS = 3 * 60_000;
/** A watch round isn't started with less time than this left (a job may think for a few minutes). */
const ROUND_ROOM_MS = 4 * 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);

async function step(name: string, run: () => Promise<{ note?: string; error?: string | null } & Record<string, unknown>>) {
  const t = Date.now();
  try {
    const r = await run();
    const extra = "posted" in r && Array.isArray(r.posted) ? ` posted=${r.posted.length}` : "";
    console.log(`${stamp()} ${name}: ${r.note ?? "done"}${extra}${r.error ? ` · ERROR ${r.error}` : ""} (${Math.round((Date.now() - t) / 1000)} s)`);
  } catch (err) {
    console.error(`${stamp()} ${name}: crashed: ${err instanceof Error ? err.message : err}`);
  }
}

const job = (j: EcoJob) => step(j, () => runEcoJob(j) as Promise<{ note?: string; error?: string | null }>);

async function main() {
  // MOOBOT_DRY_RUN=1: a local try in preview, with throwaway memory (nothing shared, nothing posted).
  const dry = process.env.MOOBOT_DRY_RUN === "1" && process.env.ECO_BOT === "preview";
  if (kvMode() !== "blobs" && !dry) {
    console.error("moobot: NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN are needed to share the site's memory. Stopping.");
    process.exit(1);
  }
  console.log(`${stamp()} moobot: running for ${minutes} min (ECO_BOT=${process.env.ECO_BOT ?? ""}, ECO_BOT_JOBS=${process.env.ECO_BOT_JOBS ?? "all"})`);

  // One full round.
  await step("autopost", () => runAutoPost() as unknown as Promise<{ note?: string; error?: string | null }>);
  for (const j of ["news", "mentions", "compose", "study"] as const) await job(j);

  // Then keep watching: mentions every round; compose and study run when due (they return at once otherwise).
  while (until - Date.now() > ROUND_ROOM_MS) {
    await sleep(Math.min(WATCH_EVERY_MS, until - Date.now() - ROUND_ROOM_MS));
    if (until - Date.now() <= ROUND_ROOM_MS / 2) break;
    for (const j of ["mentions", "compose", "study"] as const) await job(j);
  }
  console.log(`${stamp()} moobot: done`);
}

await main();
