"use client";

import { useId, useRef, useState } from "react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  content: React.ReactNode;
}

/** Accessible tabs: arrow keys, Home and End move between tabs. */
export function Tabs({ tabs, label }: { tabs: TabItem[]; label: string }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();

  const focus = (i: number) => {
    const next = (i + tabs.length) % tabs.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t, i) => {
          const selected = i === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") focus(i + 1);
                else if (e.key === "ArrowLeft") focus(i - 1);
                else if (e.key === "Home") focus(0);
                else if (e.key === "End") focus(tabs.length - 1);
                else return;
                e.preventDefault();
              }}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                selected ? "border-grass text-grass" : "border-transparent text-soil/75 hover:text-soil"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={`rounded-full px-2 py-0.5 text-xs ${selected ? "bg-grass/15 text-grass" : "bg-oat text-soil/70"}`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={i !== active}
          tabIndex={0}
          className="focus-visible:outline-offset-8"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
