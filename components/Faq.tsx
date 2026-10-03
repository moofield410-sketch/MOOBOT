"use client";

import { useId, useState } from "react";

export interface FaqItem {
  q: string;
  a: React.ReactNode;
}

/** Accordion with a smooth height animation (grid-rows 0fr → 1fr) and a rotating chevron. */
export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const base = useId();

  return (
    <div className="card divide-y divide-line px-2">
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `${base}-panel-${i}`;
        return (
          <div key={item.q} className="px-4">
            <h3 className="m-0 font-sans text-base tracking-normal">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left font-semibold text-soil transition-colors hover:text-moss"
              >
                {item.q}
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  className={`h-4 w-4 shrink-0 text-wheat transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${isOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </h3>
            <div id={panelId} role="region" className="accordion-panel" data-open={isOpen}>
              <div>
                <p className="pb-5 pr-8 text-fern">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
