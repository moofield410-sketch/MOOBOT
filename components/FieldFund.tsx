import { ColumnChart } from "@/components/charts/ColumnChart";
import { Card } from "@/components/ui/Card";
import { MeterRow, StatRow } from "@/components/ui/Stats";
import { REWARDS } from "@/config";
import { averagePerDay } from "@/lib/credit-market";
import { formatInt } from "@/lib/format";
import { formatCredits } from "@/lib/rewards";
import type { CreditStats, DailyCredits, DataEnvelope } from "@/lib/types";

export function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function toChartData(history: DailyCredits[]) {
  return history.map((d) => ({ key: d.day, label: dayLabel(d.day), value: d.credits }));
}

/** Orbio $CREDIT received by the MooBot agent: 20% runs the agent (taken first), 80% to the treasury. */
export function FieldFundCard({
  credits,
  history,
  compact = false,
}: {
  credits: DataEnvelope<CreditStats>;
  history: DailyCredits[] | null;
  compact?: boolean;
}) {
  if (!credits.data) {
    return (
      <Card eyebrow="Field Fund" title="$CREDIT received by the MooBot agent" className="h-full">
        <p className="text-sm text-soil/80">These figures appear once the official $MOOBOT contract is confirmed on Orbio.</p>
      </Card>
    );
  }

  const c = credits.data;
  return (
    <Card eyebrow="Field Fund" title="$CREDIT received by the MooBot agent" meta={credits} className="h-full">
      <p className="text-4xl font-bold text-grass">{formatCredits(c.receivedAtoms)}</p>
      <p className="mt-1 text-sm text-soil/70">Orbio $CREDIT received in total</p>
      {c.waitingAtoms !== null && BigInt(c.waitingAtoms) > 0n && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-grass/25 bg-grass/5 px-3 py-1 text-sm text-moss">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-grass" />+{formatCredits(c.waitingAtoms)} accrued, not yet claimed
        </p>
      )}

      <div className="mt-6 space-y-4">
        <MeterRow label="Runs the agent (taken first)" pct={REWARDS.agentOpsPct} value={formatCredits(c.agentOpsAtoms)} />
        <MeterRow label="Treasury" pct={REWARDS.treasuryPct} value={formatCredits(c.treasuryAtoms)} />
      </div>

      {history && history.length > 0 && (
        <>
          <dl className="mt-6">
            <StatRow label="Received per day (7-day average)" value={formatInt(averagePerDay(history))} />
            <StatRow label="Best day (last 30)" value={formatInt(Math.max(...history.map((d) => d.credits)))} />
          </dl>
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold text-soil">$CREDIT received per day, last 30 days</p>
            <ColumnChart
              data={toChartData(history)}
              title="$CREDIT received per day, last 30 days"
              valueLabel="$CREDIT"
              height={compact ? 140 : 220}
              compact={compact}
            />
          </div>
        </>
      )}
    </Card>
  );
}
