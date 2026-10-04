import { runAutoPost } from "@/lib/autopost/run";

export const dynamic = "force-dynamic";

/**
 * One auto-post run (lib/autopost/run.ts). On Netlify the scheduled function
 * netlify/functions/autopost.mjs calls it every 15 minutes (schedule in netlify.toml).
 * In production it requires Authorization: Bearer <CRON_SECRET>, like /api/cron/scan.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const report = await runAutoPost();
  return Response.json({ ok: report.error === null, ...report }, { status: report.error ? 502 : 200 });
}
