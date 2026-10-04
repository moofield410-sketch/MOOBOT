import Link from "next/link";
import { MasterAvatar } from "@/components/MasterCard";
import { NotAvailable } from "@/components/ui/NotAvailable";
import { formatCompact, formatUsd } from "@/lib/format";
import { NA_REASONS } from "@/lib/na-reasons";
import type { Master } from "@/lib/types";

/** Master of the day (lib/spotlight.ts): changes by itself at 00:00 UTC. */
export function MasterSpotlight({ m }: { m: Master }) {
  const na = <NotAvailable reason={NA_REASONS.orbioMissing} />;
  const usd = m.isMock ? m.liquidityUsd : m.marketCapUsd;
  return (
    <article className="card relative mb-8 grid items-center gap-6 overflow-hidden p-6 sm:p-8 md:grid-cols-[auto_1fr_auto]">
      <MasterAvatar m={m} size="lg" />
      <div className="min-w-0">
        <p className="eyebrow mb-1.5">Master of the day</p>
        <h3 className="truncate font-display text-2xl font-semibold text-soil">
          {m.name} <span className="font-mono text-base font-medium text-fern">${m.ticker}</span>
        </h3>
        <p className="mt-2 line-clamp-2 max-w-2xl text-fern">{m.description ?? "No description yet."}</p>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-fern">{m.isMock ? "Liquidity" : "Market cap"}</dt>
            <dd className="font-mono font-semibold tabular-nums text-soil">{usd === null ? na : formatUsd(usd)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-fern">Holders</dt>
            <dd className="font-mono font-semibold tabular-nums text-soil">{m.holderCount === null ? na : formatCompact(m.holderCount)}</dd>
          </div>
          {m.openToPitches && (
            <div className="self-end">
              <span className="chip border-line-strong text-grass">Open to pitches</span>
            </div>
          )}
        </dl>
      </div>
      <div className="flex flex-col items-start gap-2 md:items-end">
        <Link href={`/masters/${m.tokenAddress}`} className="btn-secondary">
          View profile
        </Link>
        <p className="text-xs text-fern">A new Master every day at 00:00 UTC</p>
      </div>
    </article>
  );
}
