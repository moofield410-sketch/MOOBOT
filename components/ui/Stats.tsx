/** Stat tile: small mist label, big mono number, optional hint. `bare` drops the card (for glass strips). */
export function StatTile({ label, value, hint, bare = false }: { label: string; value: React.ReactNode; hint?: React.ReactNode; bare?: boolean }) {
  return (
    <div className={bare ? "p-5" : "card p-5"}>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-fern">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-soil sm:text-3xl">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-fern">{hint}</p>}
    </div>
  );
}

/** A labelled row with a value and a share meter (fill and track from the chart ramp). */
export function MeterRow({ label, value, pct, note }: { label: string; value: React.ReactNode; pct: number; note?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-soil/85">
          {label} <span className="text-soil/60">· {pct}%</span>
        </p>
        <p className="text-base font-semibold text-soil">{value}</p>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${label}: ${pct}%`}
      >
        <div className="h-full rounded-full bg-chart" style={{ width: `${pct}%` }} />
      </div>
      {note && <p className="mt-1.5 text-xs text-soil/60">{note}</p>}
    </div>
  );
}

/** Stat row: label on the left, value on the right, hairline divider. */
export function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="text-sm text-soil/75">{label}</dt>
      <dd className="text-right text-base font-semibold text-soil">{value}</dd>
    </div>
  );
}
