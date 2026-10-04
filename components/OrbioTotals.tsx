import { formatUnits } from "viem";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { dayLabel } from "@/components/FieldFund";
import { Card } from "@/components/ui/Card";
import { NotAvailable } from "@/components/ui/NotAvailable";
import { StatRow, StatTile } from "@/components/ui/Stats";
import { formatCompact, formatInt, formatMicroUsd } from "@/lib/format";
import { NA_REASONS } from "@/lib/na-reasons";
import { formatCredits } from "@/lib/rewards";
import type { OrbioTotals } from "@/lib/sources/orbio-api";
import type { DataEnvelope } from "@/lib/types";

const na = <NotAvailable reason={NA_REASONS.orbioNull} />;
const orbioAmount = (wei: string) => Number(formatUnits(BigInt(wei), 18));
/** "$16.5M" */
const usdCompact = (usd: number) => `$${formatCompact(usd)}`;

/**
 * Orbio at a glance: totals across every agent on the Orbio launchpad (not only MooBot), from
 * Orbio's public analytics. Live before $MOOBOT launches. `compact` is the home page version.
 */
export function OrbioTotalsCard({ totals, compact = false }: { totals: DataEnvelope<OrbioTotals>; compact?: boolean }) {
  const t = totals.data;
  if (!t) {
    return (
      <Card eyebrow="Orbio at a glance" title="The whole launchpad, live">
        <p className="text-sm text-soil/80">Orbio&apos;s totals couldn&apos;t be loaded right now. They&apos;ll be back on the next refresh.</p>
      </Card>
    );
  }

  const orbioUsd = t.orbioMicroUsd === null ? null : Number(t.orbioMicroUsd) / 1e6;
  const staked = t.stakedWei === null ? null : orbioAmount(t.stakedWei);
  const today = new Date().toISOString().slice(0, 10);
  const latest = t.launchesByDay[t.launchesByDay.length - 1];
  // Skip the empty days before Orbio's first launch, so the bars aren't squeezed to one side.
  const firstLaunch = t.launchesByDay.findIndex((d) => d.launches > 0);
  const chart = (firstLaunch < 0 ? [] : t.launchesByDay.slice(firstLaunch)).map((d) => ({ key: d.day, label: dayLabel(d.day), value: d.launches }));

  return (
    <Card eyebrow="Orbio at a glance" title="The whole launchpad, live" meta={totals}>
      <p className="-mt-2 mb-5 max-w-2xl text-sm text-fern">
        Every agent on the Orbio launchpad added up, not only MooBot. Read from Orbio&apos;s public data.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Agents on Orbio"
          value={t.agents === null ? na : formatInt(t.agents)}
          hint={latest?.day === today ? `${formatInt(latest.launches)} new today (UTC)` : undefined}
        />
        <StatTile label="Combined market cap" value={t.marketCapMicroUsd === null ? na : usdCompact(Number(t.marketCapMicroUsd) / 1e6)} hint="All agents together" />
        <StatTile
          label="$ORBIO staked"
          value={staked === null ? na : formatCompact(staked)}
          hint={staked !== null && orbioUsd !== null ? `≈ ${usdCompact(staked * orbioUsd)} at today's price` : undefined}
        />
        <StatTile
          label="$CREDIT accrued"
          value={t.creditAccruedAtoms === null ? na : formatCredits(t.creditAccruedAtoms)}
          hint={t.creditClaimedAtoms === null ? undefined : `${formatCredits(t.creditClaimedAtoms)} claimed by agents`}
        />
      </div>

      <div className={`mt-6 grid gap-6 ${compact ? "" : "lg:grid-cols-[1fr_1.4fr]"}`}>
        {!compact && (
          <dl className="self-start">
            <StatRow label="Creator fees collected" value={t.creatorFeesWei === null ? na : `${formatCompact(orbioAmount(t.creatorFeesWei))} $ORBIO`} />
            <StatRow
              label="Paid to agents as gateway balance"
              value={t.convertedUsdgAtoms === null ? na : formatMicroUsd(t.convertedUsdgAtoms)}
            />
            <StatRow label="$ORBIO price" value={t.orbioMicroUsd === null ? na : formatMicroUsd(t.orbioMicroUsd)} />
          </dl>
        )}
        {chart.length > 0 && (
          <div className="min-w-0">
            <p className="mb-2 text-sm font-semibold text-soil">
              New agents launched per day, last {chart.length === 1 ? "day" : `${chart.length} days`}
            </p>
            <ColumnChart
              data={chart}
              title={`New agents launched on Orbio per day, last ${chart.length} days`}
              valueLabel="New agents"
              height={compact ? 170 : 200}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
