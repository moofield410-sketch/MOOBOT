"use client";

import { useEffect, useRef, useState } from "react";
import { MooBotMascot, type MascotState } from "@/components/MooBotMascot";

const MAX = 6;

/**
 * MooBot whose eyes follow the pointer (up to ±6px). Off on touch screens and with reduced
 * motion, where MooBot simply looks ahead.
 */
export function MooBotLook({ state = "idle", size, className, title }: { state?: MascotState; size: number; className?: string; title?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | undefined>(undefined);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height * 0.35);
        const d = Math.max(1, Math.hypot(dx, dy));
        const k = Math.min(1, d / 400);
        setOffset({ x: Math.round((dx / d) * MAX * k * 10) / 10, y: Math.round((dy / d) * MAX * k * 10) / 10 });
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <span ref={ref} className="inline-block">
      <MooBotMascot state={state} size={size} eyeOffset={state === "thinking" || state === "sleeping" ? undefined : offset} className={className} title={title} />
    </span>
  );
}
