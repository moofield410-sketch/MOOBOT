import { getSchedule } from "@/lib/schedule";
import { serverTimeline } from "@/lib/timeline.server";

export const dynamic = "force-dynamic";

/** Server time and unlock state. The browser derives its countdown from this, never from its own clock. */
export function GET() {
  const now = Date.now();
  const timeline = serverTimeline();
  return Response.json(
    { serverNow: now, timeline, ...getSchedule(now, timeline) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
