// Netlify scheduled function: refreshes the Orbio Masters list every 3 minutes (schedule in
// netlify.toml) by calling the site's own /api/cron/scan route with CRON_SECRET.
//
// The Masters cache lives in the memory of the Next.js server function. This call refreshes the
// warm instance that answers it, so visitors usually get fresh data without waiting on Orbio.
// Any other instance still refreshes on demand once its copy is older than CACHE.mastersTtlMs.
//
// Read-only: it sends one GET to this site. No wallet, no chain writes.

export default async (req, context) => {
  const secret = process.env.CRON_SECRET;
  const site = context?.site?.url || process.env.URL;
  if (!secret || !site) {
    console.error("refresh-orbio: CRON_SECRET or the site URL is missing; skipping.");
    return;
  }

  const started = Date.now();
  try {
    const res = await fetch(new URL("/api/cron/scan", site), {
      headers: { authorization: `Bearer ${secret}` },
      // Scheduled functions stop after 30 seconds.
      signal: AbortSignal.timeout(25_000),
    });
    const body = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) console.error(`refresh-orbio: HTTP ${res.status} after ${ms} ms: ${body.slice(0, 300)}`);
    else console.log(`refresh-orbio: OK in ${ms} ms: ${body.slice(0, 300)}`);
  } catch (err) {
    console.error(`refresh-orbio: request failed after ${Date.now() - started} ms:`, err instanceof Error ? err.message : err);
  }
};
