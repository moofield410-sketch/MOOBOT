import { MasterAvatar } from "@/components/MasterCard";
import { HideButton } from "@/components/tournament/HideButton";
import { ScoreControl } from "@/components/tournament/ScoreControl";
import { VoteButton } from "@/components/tournament/VoteButton";
import { Details, DetailRow } from "@/components/ui/Details";
import { TOURNAMENT } from "@/config";
import { formatCompact, formatDate } from "@/lib/format";
import type { Pitch, PitchStatus } from "@/lib/types";

const STATUS: Record<PitchStatus, string> = {
  open: "Open",
  shortlisted: "Shortlisted",
  winner: "Winner",
  closed: "Closed",
};

/** The demo link's site, shown so people see where it goes before they click. */
function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function PitchCard({
  p,
  masterName,
  tenderTitle = null,
  rank,
  showVote = true,
  live = true,
}: {
  p: Pitch;
  masterName: string | null;
  tenderTitle?: string | null;
  rank?: number;
  showVote?: boolean;
  /** False once the round has ended (no voting or scoring). */
  live?: boolean;
}) {
  const target = tenderTitle ? `Answers the tender "${tenderTitle}"${masterName ? ` from ${masterName}` : ""}` : masterName ? `Pitched to ${masterName}` : "Open pitch: any Master";
  return (
    <article className="card card-hover flex h-full flex-col p-5" id={`pitch-${p.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <MasterAvatar m={{ name: p.fighter, ticker: p.ticker ?? "", logoUrl: p.logoUrl ?? null }} size="sm" />
          <p className="min-w-0 text-xs text-soil/70">
            {rank !== undefined && p.votingPower > 0 && <span className="mr-1.5 font-mono font-semibold text-grass">#{rank}</span>}
            by <span className="font-semibold text-soil">{p.fighter}</span>
            {p.ticker && <span className="text-soil/60"> ${p.ticker}</span>}
          </p>
        </div>
        <span className={`chip ${p.status === "shortlisted" || p.status === "winner" ? "border-line-strong text-grass" : ""}`}>{STATUS[p.status]}</span>
      </div>
      <h3 className="mt-2 font-display text-base font-semibold text-soil">{p.title}</h3>
      <p className="mt-1 text-sm text-soil/70">{target}</p>
      <p className="mt-3 flex-1 whitespace-pre-line break-words text-sm text-soil/85">{p.summary}</p>
      {p.demoUrl && (
        <a href={p.demoUrl} target="_blank" rel="noopener noreferrer nofollow ugc" className="tap link mt-3 inline-flex w-max items-center gap-1 text-sm">
          Try the demo <span className="text-xs text-soil/60">({host(p.demoUrl)})</span>
        </a>
      )}

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
          <dt className="text-xs text-soil/60">{p.scoreCount ? "Masters' score" : "Submitted"}</dt>
          <dd className="font-mono font-medium tabular-nums text-soil">
            {p.scoreCount ? `${p.scoreAvg}/${TOURNAMENT.scoreMax} (${p.scoreCount})` : formatDate(p.submittedAt).replace(/ \d{4}$/, "")}
          </dd>
        </div>
      </dl>

      {showVote && (
        <div className="mt-4">
          <VoteButton pitchId={p.id} title={p.title} ownAgentId={p.agentId} live={live} />
        </div>
      )}
      {showVote && live && p.agentId && <ScoreControl pitchId={p.id} fighterToken={p.fighterToken} fighterOwner={p.fighterWallet} />}
      {p.agentId && <HideButton pitchId={p.id} />}

      <Details>
        <DetailRow label="Fighter owner wallet" value={p.fighterWallet} />
        {p.fighterToken && <DetailRow label="Fighter token" value={p.fighterToken} />}
        {p.masterToken && <DetailRow label="Master token" value={p.masterToken} />}
        <DetailRow label="Submitted" value={formatDate(p.submittedAt)} />
        <DetailRow label="Pitch ID" value={p.id} />
      </Details>
    </article>
  );
}
