"use client";

import Link from "next/link";
import { useState } from "react";
import { MooBotLook } from "@/components/motion/MooBotLook";
import { useSchedule } from "@/components/ScheduleProvider";
import { SITE } from "@/config";
import { formatCountdown } from "@/lib/schedule";

/**
 * Schedule chip above the headline. "Live" means the site's schedule has passed go-live; it does
 * not claim an agent is running (see AUDIT.md). Before that it counts down to go-live.
 */
function ScheduleChip() {
  const { synced, schedule } = useSchedule();
  if (!synced || !schedule) return <span className="chip">{`${SITE.event} · ${SITE.ticker}`}</span>;
  if (schedule.stage === "warmup") {
    return (
      <span className="chip">
        Go-live in <span className="font-mono tabular-nums text-soil">{formatCountdown(schedule.msRemaining)}</span>
      </span>
    );
  }
  return (
    <span className="chip-live uppercase tracking-wider">
      Live
      {schedule.nextAt !== null && (
        <span className="normal-case tracking-normal text-soil/80">
          · {schedule.nextLabel} in <span className="font-mono tabular-nums">{formatCountdown(schedule.msRemaining)}</span>
        </span>
      )}
    </span>
  );
}

export function HomeHero({ intro }: { intro: string }) {
  const [ctaHover, setCtaHover] = useState(false);

  return (
    <section className="grain relative isolate -mx-4 overflow-hidden px-4 pb-6 pt-4 sm:-mx-6 sm:px-6 lg:pt-10">
      {/* Aurora: three blurred blobs drifting slowly behind the hero. Offsets are in rem from the top,
          not %, so the blobs don't move (layout shift) while the hero's height settles as fonts load. */}
      <div aria-hidden className="aurora -z-10">
        <span className="aurora-blob left-[-10%] top-[-6rem] h-[28rem] w-[28rem] text-grass/18" />
        <span className="aurora-blob right-[-5%] top-8 h-[26rem] w-[26rem] text-sky/14" />
        <span className="aurora-blob left-[35%] top-[24rem] h-[22rem] w-[22rem] text-clover/12" />
      </div>

      <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        {/* Lift only (no fade), so the hero copy paints at once and counts as LCP immediately. */}
        <div className="animate-lift">
          <ScheduleChip />
          <h1 className="sheen brand-text mt-6 pb-2 font-display text-6xl font-bold leading-[1.02] tracking-[-0.03em] sm:text-7xl lg:text-[88px]">
            {SITE.name}
          </h1>
          <p className="mt-5 font-display text-2xl font-semibold text-soil sm:text-3xl">{SITE.tagline}</p>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-fern">{intro}</p>
          {/* Stacked on phones, side by side from sm: the row never re-wraps when the web font swaps in. */}
          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span className="cta-glow" onPointerEnter={() => setCtaHover(true)} onPointerLeave={() => setCtaHover(false)}>
              <Link
                href="/masters"
                className="btn-primary px-7 py-3.5 text-base"
                onFocus={() => setCtaHover(true)}
                onBlur={() => setCtaHover(false)}
              >
                Explore the Masters
              </Link>
            </span>
            <Link href="#how-it-works" className="btn-secondary px-7 py-3.5 text-base">
              How it works
            </Link>
          </div>
        </div>

        {/* MooBot in front of the sun, standing on the crop rows. Box reserved: no layout shift. */}
        <div className="relative mx-auto flex h-[300px] w-full max-w-[460px] items-end justify-center sm:h-[400px] lg:h-[480px]">
          <div aria-hidden className="grid-floor" />
          <div aria-hidden className="halo left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 sm:h-[420px] sm:w-[420px]" />
          <div className="relative">
            <MooBotLook
              state={ctaHover ? "happy" : "idle"}
              size={420}
              className="h-auto w-[260px] sm:w-[360px] lg:w-[420px]"
              title="MooBot, the Field's AI agent robot cow"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
