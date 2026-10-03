import { NotAvailable } from "@/components/ui/NotAvailable";
import type { MooBotAgent } from "@/lib/moobot";
import { formatMicroUsd } from "@/lib/format";
import { NA_REASONS } from "@/lib/na-reasons";

const usd = (micro: string | null): React.ReactNode => (micro === null ? <NotAvailable reason={NA_REASONS.orbioNull} /> : formatMicroUsd(micro));

/**
 * $MOOBOT's live market figures from the Orbio API: price, market cap and bonding-curve progress
 * to graduation. Refreshed by useMooBot; the figures are Orbio's, never estimated here.
 */
export function MooBotMarket({ agent }: { agent: MooBotAgent }) {
  const pct = agent.curveProgressBps === null ? null : Math.min(100, agent.curveProgressBps / 100);
  return (
    <div>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-[0.14em] text-fern">Price</dt>
          <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-soil">{usd(agent.priceMicroUsd)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-[0.14em] text-fern">Market cap</dt>
          <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-soil">{usd(agent.marketCapMicroUsd)}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-base text-soil/85">{agent.graduated ? "Graduated on Orbio" : "Progress to graduation"}</p>
          <p className="font-mono text-base font-semibold tabular-nums text-soil">
            {agent.graduated ? "100%" : pct === null ? <NotAvailable reason={NA_REASONS.orbioNull} /> : `${pct.toFixed(1)}%`}
          </p>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-track"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={agent.graduated ? 100 : (pct ?? 0)}
          aria-label="$MOOBOT bonding-curve progress to graduation"
        >
          <div className="h-full rounded-full bg-chart" style={{ width: `${agent.graduated ? 100 : (pct ?? 0)}%` }} />
        </div>
      </div>
    </div>
  );
}
