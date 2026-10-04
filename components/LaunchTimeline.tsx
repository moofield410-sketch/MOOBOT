"use client";

import { FULL_UNLOCK_AFTER_H } from "@/config";
import { useSchedule } from "@/components/ScheduleProvider";
import { Thinking } from "@/components/ui/Card";
import { CountdownTiles } from "@/components/ui/CountdownTiles";
import { formatUtcDateTime } from "@/lib/format";
import { formatCountdown, type Stage } from "@/lib/schedule";

const STAGE_LABEL: Record<Stage, string> = {
  warmup: "Warming up",
  agentLive: "Live",
  fullUnlock: "Tournament unlocked",
};

const HEADLINE: Record<Stage, string> = {
  warmup: "Go-live in",
  agentLive: "The Tournament opens in",
  fullUnlock: "The Tournament board is open",
};

/** Go-live timeline. All times are shown in UTC. */
export function LaunchTimeline() {
  const { synced, error, now, timeline, schedule } = useSchedule();

  if (!synced || !timeline || !schedule) {
    return (
      <section className="card p-8" aria-label="Schedule" aria-busy="true">
        <Thinking label={error ? "We couldn't reach the server clock. Retrying shortly." : "Checking the server clock…"} />
      </section>
    );
  }

  const milestones = [
    { at: timeline.agentLiveAt, label: "Go-live", detail: "MooBot wakes up. Masters and credit data are already live." },
    {
      at: timeline.fullUnlockAt,
      label: `${FULL_UNLOCK_AFTER_H} hours later`,
      detail: "The Tournament board, leaderboard and rewards ledger unlock, and the Round 1 clock starts. Pitch and vote submission are still being built.",
    },
  ];

  // How far along the go-live → full unlock span we are (0 → 1). Drives the signal line.
  const span = timeline.fullUnlockAt - timeline.agentLiveAt;
  const progress = Math.min(1, Math.max(0, (now - timeline.agentLiveAt) / span));

  return (
    <section className="card h-full p-6 sm:p-8" aria-label="Schedule">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-2">{STAGE_LABEL[schedule.stage]}</p>
          <h2 className="font-display text-2xl font-semibold text-soil sm:text-3xl">{HEADLINE[schedule.stage]}</h2>
          <p className="mt-2 max-w-md text-sm text-fern">
            Go-live is the site&apos;s schedule. The Tournament unlocks {FULL_UNLOCK_AFTER_H} hours after it.
          </p>
        </div>
        {schedule.nextAt !== null && <CountdownTiles ms={schedule.msRemaining} />}
      </div>

      <div className="relative mt-10">
        {/* Signal line from go-live to the full unlock; fills with the signal gradient (transform only). */}
        <div aria-hidden className="absolute left-[5px] right-[calc(50%-5px)] top-[5px] hidden h-px bg-line-strong sm:block">
          <div
            className="h-full origin-left bg-[linear-gradient(90deg,#5daa4a,#f2b705)] transition-transform duration-1000"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
        <ol className="relative grid gap-6 sm:grid-cols-2">
          {milestones.map((m) => {
            const done = now >= m.at;
            const isNext = m.at === schedule.nextAt;
            return (
              <li key={m.label}>
                <span aria-hidden className="flex h-[11px] items-center">
                  {isNext ? (
                    <span className="pulse-dot" />
                  ) : (
                    <span className={`inline-block h-[11px] w-[11px] rounded-full ${done ? "bg-[linear-gradient(135deg,#5daa4a,#2f7a32)]" : "border border-line-strong bg-milk"}`} />
                  )}
                </span>
                <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-soil">
                  {m.label}
                  {done && <span className="sr-only">(done)</span>}
                  {isNext && <span className="chip-live px-2 py-0.5 text-[10px] uppercase tracking-wider">Next</span>}
                </p>
                <p className="mt-1 text-sm text-fern">{m.detail}</p>
                <p className="mt-1.5 font-mono text-xs text-fern">{formatUtcDateTime(m.at)}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** Compact "next unlock" value for stat strips. */
export function NextUnlockValue() {
  const { synced, schedule } = useSchedule();
  if (!synced || !schedule) return <span className="text-soil/60">…</span>;
  if (schedule.nextAt === null) return <>All open</>;
  return <span className="font-mono text-xl">{formatCountdown(schedule.msRemaining)}</span>;
}

export function NextUnlockLabel() {
  const { schedule } = useSchedule();
  return <>{schedule?.nextLabel ?? "Next unlock"}</>;
}
