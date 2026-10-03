"use client";

import { useSchedule } from "@/components/ScheduleProvider";
import { CountdownTiles } from "@/components/ui/CountdownTiles";
import { TOURNAMENT } from "@/config";
import { currentRound } from "@/lib/rounds";

/** `hideWhileUpcoming`: render nothing before round 1 (when a lock card already shows the countdown). */
export function RoundCountdown({ hideWhileUpcoming = false }: { hideWhileUpcoming?: boolean }) {
  const { synced, timeline, now } = useSchedule();

  if (!synced || !timeline) {
    if (hideWhileUpcoming) return null;
    return (
      <div className="card p-6" aria-busy="true">
        <p className="text-sm text-soil/70">Checking the server clock…</p>
      </div>
    );
  }

  const r = currentRound(now, timeline);
  if (hideWhileUpcoming && r.status === "upcoming") return null;
  return (
    <div className="card flex flex-wrap items-center justify-between gap-6 p-6">
      <div>
        <p className="eyebrow mb-1.5">{r.status === "upcoming" ? "First round" : `Round ${r.number}`}</p>
        <p className="text-xl font-bold text-soil">{r.status === "upcoming" ? "Round 1 starts in" : "This round ends in"}</p>
        <p className="mt-1 text-sm text-soil/75">Rounds last {TOURNAMENT.roundLengthH} hours.</p>
      </div>
      <CountdownTiles ms={r.msRemaining} />
    </div>
  );
}
