// Netlify background function (the "-background" name makes it one): runs MooBot Eco Bot jobs one
// after another by calling the site's /api/cron/ecobot?job=… with CRON_SECRET. Background
// functions may run for 15 minutes, so each job gets the route's full minute. Started by the
// scheduled function ecobot.mjs; anyone else without CRON_SECRET is turned away.
//
// No wallet, no chain writes.

const KNOWN = new Set(["news", "mentions", "compose", "study"]);

export default async (req, context) => {
  const secret = process.env.CRON_SECRET;
  const site = context?.site?.url || process.env.URL;
  if (!secret || !site) {
    console.error("ecobot-background: CRON_SECRET or the site URL is missing; skipping.");
    return;
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    console.error("ecobot-background: refused a call without CRON_SECRET.");
    return;
  }

  let jobs = ["news"];
  try {
    const body = await req.json();
    if (Array.isArray(body?.jobs)) jobs = body.jobs.filter((j) => KNOWN.has(j));
  } catch {
    // No body (an older scheduler): just the news job.
  }

  for (const job of jobs) {
    const started = Date.now();
    try {
      const res = await fetch(new URL(`/api/cron/ecobot?job=${job}`, site), {
        headers: { authorization: `Bearer ${secret}` },
        // The route itself finishes within a minute (Netlify's limit for a normal function).
        signal: AbortSignal.timeout(65_000),
      });
      const body = await res.text();
      const ms = Date.now() - started;
      if (!res.ok) console.error(`ecobot-background: ${job} HTTP ${res.status} after ${ms} ms: ${body.slice(0, 500)}`);
      else console.log(`ecobot-background: ${job} OK in ${ms} ms: ${body.slice(0, 500)}`);
    } catch (err) {
      console.error(`ecobot-background: ${job} failed after ${Date.now() - started} ms:`, err instanceof Error ? err.message : err);
    }
  }
};
