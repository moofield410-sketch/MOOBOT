"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Single-series column chart (plain SVG, no library).
 * Follows the dataviz mark specs: bars <= 24px with 4px rounded tops and a 2px gap,
 * hairline solid grid, per-bar hover/focus tooltip, keyboard navigation, and a table view.
 * Colours come from the validated chart tokens in globals.css.
 */

export interface ColumnDatum {
  key: string;
  label: string;
  value: number;
}

const TEXT_MUTED = "rgb(86 99 79)";

function niceScale(max: number, ticks = 4): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 1 };
  const rough = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  return { top: step * Math.ceil(max / step), step };
}

function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export function ColumnChart({
  data,
  title,
  height = 220,
  compact = false,
  valueLabel = "Credits",
  format = (n: number) => n.toLocaleString("en-US"),
}: {
  data: ColumnDatum[];
  /** Accessible name; the visible title lives in the surrounding card. */
  title: string;
  height?: number;
  compact?: boolean;
  valueLabel?: string;
  format?: (n: number) => string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 12, right: 4, bottom: 26, left: compact ? 4 : 44 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const { top, step } = niceScale(Math.max(0, ...data.map((d) => d.value)));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(1, Math.min(24, band - 2));
  const y = (v: number) => pad.top + plotH - (v / top) * plotH;
  const xLabels = data.length > 2 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : data.map((_, i) => i);

  const onKey = (e: React.KeyboardEvent) => {
    if (!data.length) return;
    const cur = active ?? data.length - 1;
    let next = cur;
    if (e.key === "ArrowRight") next = Math.min(data.length - 1, cur + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, cur - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = data.length - 1;
    else return;
    e.preventDefault();
    setActive(next);
  };

  const a = active !== null ? data[active] : null;
  const tipLeft = active !== null ? pad.left + active * band + band / 2 : 0;

  return (
    <figure className="m-0">
      <div ref={wrapRef} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="group"
            aria-label={`${title}. Use the left and right arrow keys to read each value.`}
            tabIndex={0}
            onKeyDown={onKey}
            onFocus={() => setActive((v) => v ?? data.length - 1)}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
            className="block focus-visible:outline-offset-4"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-grid)" strokeWidth={1} shapeRendering="crispEdges" />
                {!compact && (
                  <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={TEXT_MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {t.toLocaleString("en-US")}
                  </text>
                )}
              </g>
            ))}

            {data.map((d, i) => {
              const x = pad.left + i * band + (band - barW) / 2;
              const h = Math.max(0, y(0) - y(d.value));
              return (
                <g key={d.key}>
                  <path d={barPath(x, y(d.value), barW, h)} fill={i === active ? "var(--color-chart-hover)" : "var(--color-chart)"} />
                  {/* Hit target: the whole band, taller and wider than the bar. */}
                  <rect
                    x={pad.left + i * band}
                    y={pad.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onPointerEnter={() => setActive(i)}
                    onPointerMove={() => setActive(i)}
                  />
                </g>
              );
            })}

            {xLabels.map((i) => (
              <text
                key={i}
                x={pad.left + i * band + band / 2}
                y={height - 8}
                textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                fontSize={11}
                fill={TEXT_MUTED}
              >
                {data[i].label}
              </text>
            ))}
          </svg>
        )}

        {a && (
          <div
            className="card pointer-events-none absolute z-10 -translate-x-1/2 bg-milk px-3 py-2 text-left shadow-lg shadow-soil/15"
            style={{ left: Math.min(Math.max(tipLeft, 60), Math.max(60, width - 60)), top: 0 }}
          >
            <p className="text-sm font-bold text-soil">{format(a.value)}</p>
            <p className="text-xs text-soil/70">
              {a.label} · {valueLabel}
            </p>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {a ? `${a.label}: ${format(a.value)} ${valueLabel.toLowerCase()}` : ""}
        </p>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-soil/70 hover:text-grass pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center">View as table</summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-line-strong text-left text-soil/80">
                <th className="py-1.5 font-semibold">Date</th>
                <th className="py-1.5 text-right font-semibold">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-b border-line">
                  <td className="py-1.5 text-soil/85">{d.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-soil">{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
