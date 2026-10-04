"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LineChart } from "@/components/charts/LineChart";
import { formatMicroUsd, stepDecimals } from "@/lib/format";
import type { MooBotChartState } from "@/lib/moobot";
import type { ChartRange } from "@/lib/sources/orbio-api";

/** Same pace as the rest of $MOOBOT Live; Orbio samples the price once a minute. */
const REFRESH_MS = 60_000;

const RANGES: { id: ChartRange; label: string; long: string }[] = [
  { id: "1h", label: "1H", long: "the last hour" },
  { id: "4h", label: "4H", long: "the last 4 hours" },
  { id: "1d", label: "1D", long: "the last day" },
];

const usd = (n: number) => formatMicroUsd(String(Math.round(n * 1e6)));
const usdTick = (n: number, step: number) => {
  const d = stepDecimals(step);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
};
const hhmm = (at: number) => new Date(at).toISOString().slice(11, 16);
const dayTime = (at: number) =>
  `${new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}, ${hhmm(at)} UTC`;

/**
 * $MOOBOT price over 1 hour, 4 hours or 1 day, from Orbio's minute-by-minute record (read through
 * our own /api/moobot/chart). Only rendered once the contract is verified.
 */
export function MooBotPriceChart() {
  const [range, setRange] = useState<ChartRange>("1h");
  const { data, isPending } = useQuery({
    queryKey: ["moobot-chart", range],
    queryFn: async (): Promise<MooBotChartState> => {
      const res = await fetch(`/api/moobot/chart?range=${range}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json() as Promise<MooBotChartState>;
    },
    placeholderData: keepPreviousData,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
  });

  const points = data?.status === "ok" ? data.chart.points : [];
  const series = points.map((p) => ({ key: p.at, at: Date.parse(p.at), value: Number(p.priceMicroUsd) / 1e6 }));
  const first = series[0]?.value;
  const last = series[series.length - 1]?.value;
  const change = series.length > 1 && first > 0 ? ((last - first) / first) * 100 : null;
  const longRange = RANGES.find((r) => r.id === range)!.long;

  return (
    <div className="mt-6 rounded-2xl border border-line bg-milk/70 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-fern">Price chart</p>
          <p className="mt-1 text-sm text-soil">
            {change === null ? (
              `Price over ${longRange}`
            ) : (
              <>
                <span className="font-mono font-semibold tabular-nums">
                  {change !== 0 && (
                    <span aria-hidden className="mr-1 text-[10px]">
                      {change > 0 ? "▲" : "▼"}
                    </span>
                  )}
                  {change > 0 && "+"}
                  {change.toFixed(1)}%
                </span>{" "}
                over {longRange}
              </>
            )}
          </p>
        </div>
        <div role="group" aria-label="Chart range" className="inline-flex rounded-full border border-line bg-hay/50 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={range === r.id}
              onClick={() => setRange(r.id)}
              className={`tap min-w-11 rounded-full px-3 py-1 font-mono text-xs font-semibold transition-colors ${
                range === r.id ? "bg-grass text-milk" : "text-soil/75 hover:text-soil"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <div aria-hidden className="h-[200px] animate-pulse rounded-xl bg-hay/60" />
      ) : data?.status !== "ok" ? (
        <p className="flex h-[200px] items-center justify-center rounded-xl bg-hay/40 px-6 text-center text-sm text-fern">
          Orbio&apos;s price history couldn&apos;t be loaded right now. It will try again in a minute.
        </p>
      ) : series.length < 2 ? (
        <p className="flex h-[200px] items-center justify-center rounded-xl bg-hay/40 px-6 text-center text-sm text-fern">
          Orbio records the price once a minute. The line appears after the first few readings.
        </p>
      ) : (
        <LineChart
          data={series}
          title={`$MOOBOT price in US dollars over ${longRange}`}
          height={200}
          valueLabel="Price (USD)"
          format={usd}
          formatTick={usdTick}
          formatTime={hhmm}
          formatTimeLong={dayTime}
        />
      )}

      <p className="mt-3 text-xs text-fern">
        From Orbio, sampled every minute. Orbio keeps no history from before it started recording.
        {data?.status === "ok" && data.stale && " Orbio is slow, so this may be a few minutes behind."}
      </p>
    </div>
  );
}
