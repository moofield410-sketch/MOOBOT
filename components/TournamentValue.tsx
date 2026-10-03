"use client";

import { useSchedule } from "@/components/ScheduleProvider";
import { formatDate } from "@/lib/format";

/**
 * A Tournament figure (open pitches, votes cast). It only means something once the Tournament
 * opens, so before that the tile says when it opens, in UTC.
 */
export function TournamentValue({ value }: { value: string }) {
  const { synced, schedule, timeline } = useSchedule();
  if (!synced || !schedule || !timeline) return <span className="text-soil/60">…</span>;
  if (!schedule.features.votingOpen) {
    const at = new Date(timeline.fullUnlockAt);
    const day = formatDate(at.getTime()).replace(/ \d{4}$/, "");
    return (
      <span className="block font-sans text-base font-medium leading-snug text-soil/80">
        Opens {day}, <span className="whitespace-nowrap">{at.toISOString().slice(11, 16)} UTC</span>
      </span>
    );
  }
  return <>{value}</>;
}
