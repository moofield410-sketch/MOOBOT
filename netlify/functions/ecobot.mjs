// Netlify scheduled function: starts one MooBot Eco Bot run every 15 minutes (schedule in
// netlify.toml, offset from the other jobs). Scheduled functions stop after 30 seconds and the bot
// may research for longer, so this only hands off to the background function ecobot-background.mjs,
// which calls /api/cron/ecobot. ECO_BOT decides what the run does (lib/ecobot/run.ts).
//
// No wallet, no chain writes.

export default async (req, context) => {
  const secret = process.env.CRON_SECRET;
  const site = context?.site?.url || process.env.URL;
  if (!secret || !site) {
    console.error("ecobot: CRON_SECRET or the site URL is missing; skipping.");
    return;
  }
  try {
    // A background function answers 202 at once and keeps working on its own.
    const res = await fetch(new URL("/.netlify/functions/ecobot-background", site), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(20_000),
    });
    console.log(`ecobot: started (HTTP ${res.status})`);
  } catch (err) {
    console.error("ecobot: could not start the background run:", err instanceof Error ? err.message : err);
  }
};
