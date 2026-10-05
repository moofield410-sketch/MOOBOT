"use client";

import { useSchedule } from "@/components/ScheduleProvider";
import { LockIcon } from "@/components/ui/Icons";
import { AGENT_LIVE_AT, FULL_UNLOCK_AFTER_H, USE_MOCK_DATA } from "@/config";
import { formatHms, formatUtcDateTime } from "@/lib/format";
import { buildTimeline, type Features, type Timeline } from "@/lib/schedule";

type GateFeature = Extract<keyof Features, "registrationOpen" | "votingOpen" | "rewardsLedgerOpen">;

/** Registration (pitching), voting and the rewards ledger all open at the full unlock. */
const UNLOCK_AT: Record<GateFeature, keyof Timeline> = {
  registrationOpen: "fullUnlockAt",
  votingOpen: "fullUnlockAt",
  rewardsLedgerOpen: "fullUnlockAt",
};

/** The published schedule, used only until the server clock has answered. */
const PUBLISHED = buildTimeline(Date.parse(AGENT_LIVE_AT), FULL_UNLOCK_AFTER_H);
/** Before the sync, only well past the unlock counts as open, so a slightly wrong clock can't open it early. */
const PRE_SYNC_MARGIN_MS = 60_000;

/**
 * Shows children once `feature` is unlocked by the server-clock schedule.
 * Until then, shows a lock card: "{title} HH:MM:SS" and the unlock time in UTC.
 * Preview mode also shows a dimmed, non-interactive sample behind the card;
 * with real data nothing is shown behind it, so no invented data ever appears.
 */
export function LockGate({
  feature,
  title,
  description,
  children,
  minHeight = "18rem",
}: {
  feature: GateFeature;
  /** Countdown prefix, for example "The Tournament opens in". */
  title: string;
  description?: string;
  children: React.ReactNode;
  minHeight?: string;
}) {
  const { synced, schedule, timeline, now, error } = useSchedule();
  // Once open, the content is in the page from the first render (and the server's HTML), instead
  // of waiting for the clock sync; before the unlock, the synced server clock decides.
  const unlocked = synced ? schedule?.features[feature] : Date.now() >= PUBLISHED[UNLOCK_AT[feature]] + PRE_SYNC_MARGIN_MS;
  if (unlocked) return <>{children}</>;

  const unlockAt = timeline ? timeline[UNLOCK_AT[feature]] : null;
  const card = (
    <div className="card w-full max-w-md bg-milk p-6 text-center shadow-2xl shadow-soil/20">
      <p className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-line-strong text-grass">
        <LockIcon />
      </p>
      {unlockAt !== null ? (
        <>
          <p className="text-lg font-bold text-soil" role="timer" aria-live="off">
            {title} <span className="font-mono tabular-nums text-grass">{formatHms(unlockAt - now)}</span>
          </p>
          <p className="mt-1 text-sm text-soil/70">{formatUtcDateTime(unlockAt)}</p>
        </>
      ) : error ? (
        <p className="text-sm text-soil/70">The server clock couldn&apos;t be reached. Please reload the page.</p>
      ) : (
        <p className="text-sm text-soil/70">Checking the server clock…</p>
      )}
      {description && <p className="mt-3 text-sm text-soil/80">{description}</p>}
    </div>
  );

  if (!USE_MOCK_DATA) return <div className="flex justify-center py-6">{card}</div>;

  return (
    <div className="relative" style={{ minHeight }}>
      <div inert aria-hidden className="pointer-events-none select-none opacity-30 saturate-50">
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center p-4 pt-10 sm:pt-16">{card}</div>
    </div>
  );
}
