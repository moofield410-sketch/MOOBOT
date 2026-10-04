"use client";

import Link from "next/link";
import { useState } from "react";
import { MooBotLook } from "@/components/motion/MooBotLook";
import { useSchedule } from "@/components/ScheduleProvider";
import { HeroLandscape } from "@/components/ui/Nature";
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
    <section className="relative isolate">
      <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        {/* Lift only (no fade), so the hero copy paints at once and counts as LCP immediately. */}
        <div className="animate-lift">
          <ScheduleChip />
          <h1 className="mt-6 pb-2 font-display text-6xl font-bold leading-[1.02] tracking-[-0.03em] text-moss sm:text-7xl lg:text-[88px]">
            {SITE.name}
          </h1>
          <p className="mt-5 font-display text-2xl font-semibold text-soil sm:text-3xl">{SITE.tagline}</p>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-fern">{intro}</p>
          {/* Stacked on phones, side by side from sm: the row never re-wraps when the web font swaps in. */}
          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              href="/masters"
              className="btn-primary px-7 py-3.5 text-base"
              onPointerEnter={() => setCtaHover(true)}
              onPointerLeave={() => setCtaHover(false)}
              onFocus={() => setCtaHover(true)}
              onBlur={() => setCtaHover(false)}
            >
              Explore the Masters
            </Link>
            <Link href="#how-it-works" className="btn-secondary px-7 py-3.5 text-base">
              How it works
            </Link>
          </div>
          <Link href="#bloom-pop" className="tap link mt-6 inline-block text-sm">
            Or play Bloom Pop while you wait
          </Link>
        </div>

        {/* MooBot on a line-art hillside under the sun. Box reserved: no layout shift. */}
        <div className="relative mx-auto flex h-[300px] w-full max-w-[460px] items-end justify-center sm:h-[400px] lg:h-[480px]">
          <HeroLandscape className="absolute inset-0 h-full w-full [mask-image:radial-gradient(closest-side,black_72%,transparent)]" />
          <div className="relative -mb-2">
            <MooBotLook
              state={ctaHover ? "happy" : "idle"}
              size={420}
              className="h-auto w-[230px] sm:w-[320px] lg:w-[380px]"
              title="MooBot, the Field's AI agent robot cow"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
