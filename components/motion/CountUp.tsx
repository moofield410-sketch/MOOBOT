"use client";

import { useEffect, useRef, useState } from "react";
import { formatCompact } from "@/lib/format";

const FORMATS = {
  int: (n: number) => Math.round(n).toLocaleString("en-US"),
  compact: (n: number) => formatCompact(Math.round(n)),
};

/**
 * A number that counts up once when it first scrolls into view. The final value is rendered on the
 * server and kept for reduced motion and no-JS, so nothing ever shows a wrong number for long.
 * `format` is a name (not a function) so Server Components can pass it.
 */
export function CountUp({ value, format: formatName = "compact", durationMs = 1200 }: { value: number; format?: keyof typeof FORMATS; durationMs?: number }) {
  const format = FORMATS[formatName];
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<number>(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    let frame = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / durationMs);
        setShown(value * (1 - (1 - p) ** 3));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      setShown(0);
      frame = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, durationMs]);

  return (
    <span ref={ref} className="font-mono tabular-nums">
      {format(shown)}
    </span>
  );
}
