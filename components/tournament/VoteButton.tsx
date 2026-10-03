"use client";

import { useSchedule } from "@/components/ScheduleProvider";
import { LockIcon } from "@/components/ui/Icons";
import { formatCountdown } from "@/lib/schedule";

/**
 * Vote submission is not built in this version, so the button is never active: before the
 * unlock it counts down to the Tournament opening, after it says "Voting coming soon".
 */
export function VoteButton() {
  const { synced, schedule, timeline, now } = useSchedule();

  let label = "Voting coming soon";
  if (synced && schedule && timeline && !schedule.features.votingOpen) {
    label = `Tournament opens in ${formatCountdown(timeline.fullUnlockAt - now)}`;
  }

  return (
    // The conic border marks the vote action; the button itself stays inactive (voting is not built).
    <span className="cta-glow w-full opacity-80 [animation-duration:10s]">
      <button type="button" aria-disabled="true" onClick={(e) => e.preventDefault()} className="btn-secondary w-full bg-milk px-3 py-2 text-xs">
        <LockIcon className="h-3.5 w-3.5" />
        <span className="font-mono tabular-nums">{label}</span>
      </button>
    </span>
  );
}
