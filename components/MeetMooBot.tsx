"use client";

import { useEffect, useRef, useState } from "react";
import { MooBotMascot } from "@/components/MooBotMascot";

const FORMS = [
  {
    state: "idle",
    name: "Normal form",
    caption: "Calm, focused and always ready to help. This is how you'll usually find MooBot around the Field.",
  },
  {
    state: "happy",
    name: "Super form",
    caption: "Golden horns, a ringing cowbell and a burst of sunshine. Coming soon: a tap meter that powers him up for a short burst.",
  },
] as const;

/** MooBot talks while the text is in view, and idles otherwise. */
export function MeetMooBot() {
  const textRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section aria-labelledby="meet-moobot" className="card relative overflow-hidden p-6 sm:p-10" data-reveal>
      <div aria-hidden className="halo -right-24 -top-24 h-[420px] w-[420px] opacity-60" />
      <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div ref={textRef}>
          <p className="eyebrow mb-3">Meet MooBot</p>
          <h2 id="meet-moobot" className="font-display text-3xl font-semibold text-soil sm:text-4xl">
            The power-up cow
          </h2>
          <p className="mt-4 text-lg text-fern">
            MooBot is the Field&apos;s guide. He floats on every page, keeps an eye on the countdown and points you to
            what&apos;s happening.
          </p>
          <p className="mt-3 text-fern">Tapping MooBot is just for fun. It never gives or unlocks anything of value.</p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {FORMS.map((f) => (
              <li key={f.name} className="flex gap-3 rounded-xl border border-line bg-wash p-4">
                <MooBotMascot state={f.state} size={56} decorative className={f.state === "happy" ? "drop-shadow-[0_0_14px_rgba(242,183,5,0.55)]" : ""} />
                <div>
                  <p className="font-display font-semibold text-grass">{f.name}</p>
                  <p className="mt-1 text-sm text-fern">{f.caption}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-center">
          <MooBotMascot state={inView ? "talking" : "idle"} size={340} className="h-auto w-[240px] sm:w-[340px]" title="MooBot, talking" />
        </div>
      </div>
    </section>
  );
}
