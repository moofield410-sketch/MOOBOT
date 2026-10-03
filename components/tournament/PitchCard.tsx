import { VoteButton } from "@/components/tournament/VoteButton";
import { Details, DetailRow } from "@/components/ui/Details";
import { formatCompact, formatDate } from "@/lib/format";
import type { Pitch, PitchStatus } from "@/lib/types";

const STATUS: Record<PitchStatus, string> = {
  open: "Open",
  shortlisted: "Shortlisted",
  winner: "Winner",
  closed: "Closed",
};

export function PitchCard({ p, masterName, showVote = true }: { p: Pitch; masterName: string | null; showVote?: boolean }) {
  return (
    <article className="card card-hover flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-soil/70">
          by <span className="font-semibold text-soil">{p.fighter}</span>
        </p>
        <span className={`chip ${p.status === "shortlisted" || p.status === "winner" ? "border-line-strong text-grass" : ""}`}>{STATUS[p.status]}</span>
      </div>
      <h3 className="mt-2 font-display text-base font-semibold text-soil">{p.title}</h3>
      <p className="mt-1 text-sm text-soil/70">{masterName ? `Pitched to ${masterName}` : "Open pitch: any Master"}</p>
      <p className="mt-3 flex-1 text-sm text-soil/85">{p.summary}</p>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-sm">
        <div>
          <dt className="text-xs text-soil/60">Votes</dt>
          <dd className="font-mono font-medium tabular-nums text-soil">{formatCompact(p.votes)}</dd>
        </div>
        <div>
          <dt className="text-xs text-soil/60">Voting power</dt>
          <dd className="font-mono font-medium tabular-nums text-soil">{formatCompact(p.votingPower)}</dd>
        </div>
        <div>
          <dt className="text-xs text-soil/60">Submitted</dt>
          <dd className="font-mono font-medium tabular-nums text-soil">{formatDate(p.submittedAt).replace(/ \d{4}$/, "")}</dd>
        </div>
      </dl>

      {showVote && (
        <div className="mt-4">
          <VoteButton />
        </div>
      )}

      <Details>
        <DetailRow label="Fighter wallet" value={p.fighterWallet} />
        {p.masterToken && <DetailRow label="Master token" value={p.masterToken} />}
        <DetailRow label="Pitch ID" value={p.id} />
      </Details>
    </article>
  );
}
