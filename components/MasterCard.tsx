import Link from "next/link";
import { MasterLogo } from "@/components/MasterLogo";
import { NotAvailable } from "@/components/ui/NotAvailable";
import { NA_REASONS } from "@/lib/na-reasons";
import { formatCompact, formatDate, formatUsd } from "@/lib/format";
import type { Master } from "@/lib/types";

const shortDate = (iso: string | null) => (iso ? formatDate(iso).replace(/ \d{4}$/, "") : "n/a");

/** Token icon inside the gold-ring frame, over the initials (shown while loading, or if there's no logo or it fails). */
export function MasterAvatar({ m, size = "md" }: { m: Pick<Master, "name" | "ticker" | "logoUrl">; size?: "md" | "lg" }) {
  const initials = m.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-grass/30 bg-[radial-gradient(circle_at_35%_30%,rgb(255_229_138/0.6),rgb(239_233_210)_70%)] font-display font-semibold text-moss shadow-[0_0_24px_-6px_rgb(255_179_0/0.45)] ${
        size === "lg" ? "h-16 w-16 text-xl" : "h-11 w-11 text-sm"
      }`}
    >
      {initials}
      {m.logoUrl && <MasterLogo src={m.logoUrl} size={size === "lg" ? 64 : 44} />}
    </span>
  );
}

export function MasterCard({ m }: { m: Master }) {
  const usd = m.isMock ? m.liquidityUsd : m.marketCapUsd;
  // The info button sits above the card's stretched profile link (relative z-10).
  const na = <NotAvailable reason={NA_REASONS.orbioMissing} className="relative z-10" />;
  return (
    <article className="card card-hover group relative flex h-full flex-col p-5">
      <div className="flex items-start gap-3">
        <MasterAvatar m={m} />
        <div className="min-w-0 flex-1">
          {/* Stretched link: the whole card opens the profile; the external links below sit above it. */}
          <Link
            href={`/masters/${m.tokenAddress}`}
            className="block truncate font-display font-semibold text-soil no-underline after:absolute after:inset-0 group-hover:text-moss"
            aria-label={`${m.name} (${m.ticker}) profile`}
          >
            {m.name}
          </Link>
          <p className="font-mono text-xs text-fern">${m.ticker}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {m.category && <span className="chip">{m.category}</span>}
        {m.openToPitches && <span className="chip border-line-strong text-grass">Open to pitches</span>}
      </div>

      <p className="mt-3 line-clamp-2 min-h-[2.75rem] flex-1 text-sm text-fern">{m.description ?? "No description yet."}</p>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-fern">Holders</dt>
          <dd className="whitespace-nowrap font-mono font-medium tabular-nums text-soil">{m.holderCount === null ? na : formatCompact(m.holderCount)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-fern">{m.isMock ? "Liquidity" : "Market cap"}</dt>
          <dd className="whitespace-nowrap font-mono font-medium tabular-nums text-soil" title={usd === null ? undefined : formatUsd(usd)}>
            {usd === null ? na : `$${formatCompact(usd)}`}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-fern">{m.graduatedAt ? "Graduated" : "Launched"}</dt>
          <dd className="whitespace-nowrap font-mono font-medium tabular-nums text-soil">{m.graduatedAt || m.launchedAt ? shortDate(m.graduatedAt ?? m.launchedAt) : na}</dd>
        </div>
      </dl>

      {(m.explorerUrl || m.orbioUrl) && (
        <div className="relative z-10 mt-4 flex flex-wrap gap-4 border-t border-line pt-3 text-xs pointer-coarse:pt-0">
          {m.explorerUrl && (
            <a href={m.explorerUrl} target="_blank" rel="noopener noreferrer" className="tap link">
              Explorer
            </a>
          )}
          {m.orbioUrl && (
            <a href={m.orbioUrl} target="_blank" rel="noopener noreferrer" className="tap link">
              Orbio dashboard
            </a>
          )}
        </div>
      )}
    </article>
  );
}
