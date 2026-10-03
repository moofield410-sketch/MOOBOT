"use client";

import { useEffect } from "react";

/**
 * Site-wide motion helpers, mounted once in the layout:
 * - Card spotlight: sets --mx/--my on the hovered .card-hover so its radial glow follows the cursor.
 * - Scroll reveal: adds .is-revealed to [data-reveal] / [data-reveal-stagger] elements as they enter
 *   the viewport (including elements rendered later). The hidden start state only applies once the
 *   inline script in the layout has set html.reveal-ready, so nothing hides without JS.
 */
export function PointerEffects() {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(".card-hover") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains("reveal-ready")) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-revealed");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const pending = () => document.querySelectorAll("[data-reveal]:not(.is-revealed), [data-reveal-stagger]:not(.is-revealed)");
    const scan = () => pending().forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    // Safety net: content must never stay hidden (an observer that never fires, printing, odd
    // embeds). Anything still hidden 2.5s after mount, or when printing, is shown as is.
    const revealAll = () => pending().forEach((el) => el.classList.add("is-revealed"));
    const fallback = window.setTimeout(revealAll, 2500);
    window.addEventListener("beforeprint", revealAll);
    return () => {
      io.disconnect();
      mo.disconnect();
      window.clearTimeout(fallback);
      window.removeEventListener("beforeprint", revealAll);
    };
  }, []);

  return null;
}
