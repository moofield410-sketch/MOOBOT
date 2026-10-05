// Netlify scheduled function: starts one round of MooBot Eco Bot jobs every 15 minutes (schedule
// in netlify.toml, offset from the other jobs). Scheduled functions stop after 30 seconds and the
// jobs may research for longer, so this only hands off to the background function
// ecobot-background.mjs, which calls /api/cron/ecobot once per job. news, mentions and compose run
// every time (compose keeps its own gap); study runs once an hour, in the first slot of the hour.
// ECO_BOT and ECO_BOT_JOBS decide what each job does (lib/ecobot/jobs.ts).
//
// No wallet, no chain writes.

export default async (req, context) => {
  const secret = process.env.CRON_SECRET;
  const site = context?.site?.url || process.env.URL;
  if (!secret || !site) {
    console.error("ecobot: CRON_SECRET or the site URL is missing; skipping.");
    return;
  }
  const jobs = ["news", "mentions", "compose"];
  if (new Date().getUTCMinutes() < 15) jobs.push("study");
  try {
    // A background function answers 202 at once and keeps working on its own.
    const res = await fetch(new URL("/.netlify/functions/ecobot-background", site), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ jobs }),
      signal: AbortSignal.timeout(20_000),
    });
    console.log(`ecobot: started ${jobs.join(", ")} (HTTP ${res.status})`);
  } catch (err) {
    console.error("ecobot: could not start the background run:", err instanceof Error ? err.message : err);
  }
};
