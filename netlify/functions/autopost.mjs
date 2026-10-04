// Netlify scheduled function: runs auto-posting to @M00FIELD every 15 minutes (schedule in
// netlify.toml) by calling the site's own /api/cron/autopost route with CRON_SECRET.
//
// What it does depends on AUTO_POST (see lib/autopost/run.ts): "off" nothing, "preview" (the
// default) saves drafts for the Status page only, "on" posts through Orbio's social.post tool.
//
// No wallet, no chain writes.

export default async (req, context) => {
  const secret = process.env.CRON_SECRET;
  const site = context?.site?.url || process.env.URL;
  if (!secret || !site) {
    console.error("autopost: CRON_SECRET or the site URL is missing; skipping.");
    return;
  }

  const started = Date.now();
  try {
    const res = await fetch(new URL("/api/cron/autopost", site), {
      headers: { authorization: `Bearer ${secret}` },
      // Scheduled functions stop after 30 seconds.
      signal: AbortSignal.timeout(25_000),
    });
    const body = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) console.error(`autopost: HTTP ${res.status} after ${ms} ms: ${body.slice(0, 300)}`);
    else console.log(`autopost: OK in ${ms} ms: ${body.slice(0, 300)}`);
  } catch (err) {
    console.error(`autopost: request failed after ${Date.now() - started} ms:`, err instanceof Error ? err.message : err);
  }
};
