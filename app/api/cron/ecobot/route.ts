import { runEcoBot } from "@/lib/ecobot/run";

export const dynamic = "force-dynamic";
/** The editor may research for up to ECOBOT.budgetMs; Netlify allows a normal function 60 seconds. */
export const maxDuration = 60;

/**
 * One Eco Bot run (lib/ecobot/run.ts). On Netlify, netlify/functions/ecobot.mjs (scheduled every
 * 15 minutes) starts netlify/functions/ecobot-background.mjs, which calls this route, because a
 * scheduled function itself only gets 30 seconds. In production it requires
 * Authorization: Bearer <CRON_SECRET>, like /api/cron/scan.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const report = await runEcoBot();
  return Response.json({ ok: report.error === null, ...report }, { status: report.error ? 502 : 200 });
}
