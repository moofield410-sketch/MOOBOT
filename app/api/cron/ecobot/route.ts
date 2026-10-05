import { isEcoJob, runEcoJob } from "@/lib/ecobot/jobs";

export const dynamic = "force-dynamic";
/** Each job fits ECOBOT.jobBudgetMs (news: ECOBOT.budgetMs); Netlify allows a normal function 60 seconds. */
export const maxDuration = 60;

/**
 * One Eco Bot job (lib/ecobot/jobs.ts), for running it by hand: ?job=news (the default),
 * mentions, compose or study. The scheduled runs happen on GitHub Actions (scripts/moobot.ts), so
 * the bot's thinking costs no Netlify credits. In production it requires
 * Authorization: Bearer <CRON_SECRET>, like /api/cron/scan.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const raw = new URL(req.url).searchParams.get("job");
  const job = raw === null ? "news" : raw;
  if (!isEcoJob(job)) return Response.json({ error: `Unknown job ${job}` }, { status: 400 });
  const report = await runEcoJob(job);
  return Response.json({ ok: report.error === null, job, ...report }, { status: report.error ? 502 : 200 });
}
