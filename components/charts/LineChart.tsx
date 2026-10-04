"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Single-series line chart over time (plain SVG, no library), the sibling of ColumnChart.
 * Dataviz mark specs: a 2px line with round joins, an 8px end marker, hairline solid grid,
 * a crosshair that snaps to the nearest point with a tooltip, keyboard navigation, and a table view.
 * The y-axis fits the data's range rather than starting at 0 (it shows change, not size), so
 * there is no area fill to suggest size.
 */

export interface LineDatum {
  key: string;
  /** Epoch milliseconds. */
  at: number;
  value: number;
}

const TEXT_MUTED = "rgb(86 99 79)";

/** Clean tick values spanning [min, max]. Never zero-height. */
function niceRange(min: number, max: number, ticks = 4): { lo: number; hi: number; step: number } {
  if (!(max > min)) {
    const pad = Math.abs(min) * 0.02 || 1;
    return niceRange(min - pad, max + pad, ticks);
  }
  const rough = (max - min) / ticks;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  return { lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step, step };
}

export function LineChart({
  data,
  title,
  height = 220,
  valueLabel,
  format,
  formatTick = format,
  formatTime,
  formatTimeLong,
}: {
  data: LineDatum[];
  /** Accessible name; the visible title lives in the surrounding card. */
  title: string;
  height?: number;
  valueLabel: string;
  /** Tooltip and table value. */
  format: (n: number) => string;
  /** Y-axis tick label; gets the tick step so it can pick its decimals (see stepDecimals in lib/format). */
  formatTick?: (n: number, step: number) => string;
  /** Short axis label, e.g. "08:20". */
  formatTime: (at: number) => string;
  /** Tooltip and table label, e.g. "4 Oct, 08:20 UTC". */
  formatTimeLong: (at: number) => string;
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

  const values = data.map((d) => d.value);
  const { lo, hi, step } = niceRange(Math.min(...values), Math.max(...values));
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const tickLabels = ticks.map((t) => formatTick(t, step));
  const pad = { top: 14, right: 10, bottom: 26, left: Math.min(96, 14 + 6.6 * Math.max(...tickLabels.map((t) => t.length))) };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const t0 = data[0]?.at ?? 0;
  const t1 = data[data.length - 1]?.at ?? 1;
  const x = (at: number) => pad.left + (t1 > t0 ? ((at - t0) / (t1 - t0)) * plotW : plotW / 2);
  const y = (v: number) => pad.top + plotH - ((v - lo) / (hi - lo)) * plotH;
  // A gap in the record (over 3x the usual spacing) breaks the line instead of bridging it with a guess.
  const gaps = data.slice(1).map((d, i) => d.at - data[i].at);
  const usual = [...gaps].sort((p, q) => p - q)[Math.floor(gaps.length / 2)] ?? 0;
  const path = data
    .map((d, i) => `${i === 0 || (usual > 0 && gaps[i - 1] > 3 * usual) ? "M" : "L"}${x(d.at).toFixed(1)},${y(d.value).toFixed(1)}`)
    .join(" ");
  const xLabels = data.length > 2 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : data.map((_, i) => i);

  /** Nearest point to a pointer x, so the reader aims at a time, never at the 2px line. */
  const nearest = (px: number) => {
    let best = 0;
    for (let i = 1; i < data.length; i++) if (Math.abs(x(data[i].at) - px) < Math.abs(x(data[best].at) - px)) best = i;
    return best;
  };

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
  const last = data[data.length - 1];

  return (
    <figure className="m-0">
      <div ref={wrapRef} className="relative w-full" style={{ height }}>
        {width > 0 && data.length > 0 && (
          <svg
            width={width}
            height={height}
            role="group"
            aria-label={`${title}. Use the left and right arrow keys to read each value.`}
            tabIndex={0}
            onKeyDown={onKey}
            onFocus={() => setActive((v) => v ?? data.length - 1)}
            onBlur={() => setActive(null)}
            onPointerMove={(e) => setActive(nearest(e.clientX - e.currentTarget.getBoundingClientRect().left))}
            onPointerLeave={() => setActive(null)}
            className="block touch-pan-y focus-visible:outline-offset-4"
          >
            {ticks.map((t, i) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-grid)" strokeWidth={1} shapeRendering="crispEdges" />
                <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={TEXT_MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {tickLabels[i]}
                </text>
              </g>
            ))}

            <path d={path} fill="none" stroke="var(--color-chart)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {a && (
              <>
                <line x1={x(a.at)} x2={x(a.at)} y1={pad.top} y2={pad.top + plotH} stroke={TEXT_MUTED} strokeOpacity={0.45} strokeWidth={1} shapeRendering="crispEdges" />
                <circle cx={x(a.at)} cy={y(a.value)} r={5} fill="var(--color-chart-hover)" stroke="var(--color-milk)" strokeWidth={2} />
              </>
            )}
            {!a && last && <circle cx={x(last.at)} cy={y(last.value)} r={4} fill="var(--color-chart)" stroke="var(--color-milk)" strokeWidth={2} />}

            {xLabels.map((i) => (
              <text
                key={i}
                x={x(data[i].at)}
                y={height - 8}
                textAnchor={data.length === 1 ? "middle" : i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                fontSize={11}
                fill={TEXT_MUTED}
              >
                {formatTime(data[i].at)}
              </text>
            ))}
          </svg>
        )}

        {a && (
          <div
            className="card pointer-events-none absolute z-10 -translate-x-1/2 bg-milk px-3 py-2 text-left shadow-lg shadow-soil/15"
            style={{ left: Math.min(Math.max(x(a.at), 80), Math.max(80, width - 80)), top: 0 }}
          >
            <p className="whitespace-nowrap text-sm font-bold tabular-nums text-soil">{format(a.value)}</p>
            <p className="whitespace-nowrap text-xs text-soil/70">{formatTimeLong(a.at)}</p>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {a ? `${formatTimeLong(a.at)}: ${format(a.value)}` : ""}
        </p>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-soil/70 hover:text-grass pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center">View as table</summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-line-strong text-left text-soil/80">
                <th className="py-1.5 font-semibold">Time (UTC)</th>
                <th className="py-1.5 text-right font-semibold">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.key} className="border-b border-line">
                  <td className="py-1.5 text-soil/85">{formatTimeLong(d.at)}</td>
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
