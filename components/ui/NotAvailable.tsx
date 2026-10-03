"use client";

import { useId, useState } from "react";
import { MooBotMascot } from "@/components/MooBotMascot";
import { InfoIcon } from "@/components/ui/Icons";

/**
 * "n/a" with a small info button. The reason shows on hover, keyboard focus or tap,
 * and screen readers get it through aria-describedby.
 */
export function NotAvailable({ reason, className = "" }: { reason: string; className?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  // The tooltip's MooBot is only mounted while the tooltip can be seen (keeps pages light).
  const [hover, setHover] = useState(false);
  return (
    <span
      className={`group/na relative inline-flex items-center gap-1.5 ${className}`}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <span>n/a</span>
      <button
        type="button"
        aria-label="Why n/a?"
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="hit-44 inline-flex h-5 w-5 items-center justify-center rounded-full text-soil/60 hover:text-grass focus-visible:text-grass"
      >
        <InfoIcon />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-max max-w-[17rem] items-center gap-2 rounded-xl border border-line-strong bg-milk/95 py-1.5 pl-1.5 pr-3 font-sans text-xs font-normal normal-case leading-snug tracking-normal text-soil shadow-lg shadow-soil/15 backdrop-blur ${
          open ? "flex" : "hidden group-hover/na:flex group-focus-within/na:flex"
        }`}
      >
        {(open || hover) && <MooBotMascot variant="head" state="sleeping" size={22} decorative className="shrink-0" />}
        <span>{reason}</span>
      </span>
    </span>
  );
}
