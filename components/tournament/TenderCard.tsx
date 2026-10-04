import Link from "next/link";
import { MasterAvatar } from "@/components/MasterCard";
import { formatDate } from "@/lib/format";
import type { Tender } from "@/lib/types";

export function TenderCard({ t, masterName, masterLogo = null, masterTicker = "" }: { t: Tender; masterName: string | null; masterLogo?: string | null; masterTicker?: string }) {
  const open = t.status === "open";
  return (
    <article className="card card-hover flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <MasterAvatar m={{ name: masterName ?? "Master", ticker: masterTicker, logoUrl: masterLogo }} size="sm" />
          <p className="min-w-0 text-xs text-soil/70">
            Posted by{" "}
            <Link href={`/masters/${t.masterToken}`} className="link font-semibold">
              {masterName ?? "a Master"}
            </Link>
          </p>
        </div>
        <span className={`chip ${open ? "border-line-strong text-grass" : ""}`}>{open ? "Open" : "Closed"}</span>
      </div>
      <h3 className="mt-2 font-display text-base font-semibold text-soil">{t.title}</h3>
      <p className="mt-2 flex-1 text-sm text-soil/85">{t.description}</p>

      <p className="mt-4 text-xs font-semibold text-soil/70">Looking for</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {t.criteria.map((c) => (
          <li key={c} className="chip">
            {c}
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4 text-sm">
        <div>
          <dt className="text-xs text-soil/60">{open ? "Deadline" : "Closed on"}</dt>
          <dd className="font-mono font-medium tabular-nums text-soil">{formatDate(t.deadline)}</dd>
        </div>
        <div>
          <dt className="text-xs text-soil/60">Bid pitches</dt>
          <dd className="font-mono font-medium tabular-nums text-soil">{t.bids}</dd>
        </div>
      </dl>
    </article>
  );
}
