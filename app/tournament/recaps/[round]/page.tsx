import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MasterAvatar } from "@/components/MasterCard";
import { MooBotMascot } from "@/components/MooBotMascot";
import { StatTile } from "@/components/ui/Stats";
import { SprigDivider } from "@/components/ui/Nature";
import { XIcon } from "@/components/ui/Icons";
import { NotAvailable } from "@/components/ui/NotAvailable";
import { SOCIAL } from "@/config";
import { formatCompact, formatDate } from "@/lib/format";
import { NA_REASONS } from "@/lib/na-reasons";
import { getPastRounds } from "@/lib/tournament";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ round: string }> };

async function findRound(round: string) {
  if (!/^\d{1,5}$/.test(round)) return null;
  return (await getPastRounds()).data?.find((r) => r.number === Number(round)) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await findRound((await params).round);
  if (!r) return { title: "Recap not found" };
  return {
    title: `Round ${r.number} recap`,
    description: r.winnerTitle ? `Champion: ${r.winnerTitle} by ${r.winnerFighter}.` : `Round ${r.number} of the Moofield Tournament: no champion.`,
  };
}

/** A finished round's recap, built from the round's results with a ready-made post for X. */
export default async function RecapPage({ params }: Props) {
  const r = await findRound((await params).round);
  if (!r) notFound();

  const site = URL.canParse(process.env.URL ?? "") ? process.env.URL : null;
  // The champion's own votes (not the whole round's), then the round's total.
  const champVotes = r.top?.find((p) => p.id === r.winnerPitchId)?.votes ?? null;
  const text = r.winnerTitle
    ? `Round ${r.number} of the Moofield Tournament is in 🏆 Champion: "${r.winnerTitle}" by ${r.winnerFighter}${champVotes !== null ? `, with ${formatCompact(champVotes)} of ${formatCompact(r.votesCast)} votes` : ""}.`
    : `Round ${r.number} of the Moofield Tournament is over: ${formatCompact(r.votesCast)} votes were cast.`;
  const share = new URLSearchParams({ text, via: SOCIAL.xHandle.replace(/^@/, "") });
  if (site) share.set("url", `${site}/tournament/recaps/${r.number}`);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href="/tournament/recaps" className="tap link text-sm">
        All recaps
      </Link>
      <article className="card relative overflow-hidden px-6 py-10 text-center sm:px-12">
        <SprigDivider className="mb-6" />
        <p className="eyebrow mx-auto mb-3 w-max">
          Round {r.number} · {formatDate(r.startedAt)} to {formatDate(r.endedAt)}
        </p>
        <h1 className="font-display text-3xl font-semibold text-soil sm:text-4xl">{r.winnerTitle ?? "No champion this round"}</h1>
        <p className="mt-2 text-fern">{r.winnerFighter ? `Champion pitch by ${r.winnerFighter}` : "No pitch received a vote."}</p>
        <MooBotMascot state={r.winnerTitle ? "happy" : "idle"} size={140} decorative className="mx-auto mt-6" />
        <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
          <StatTile label="Votes cast" value={formatCompact(r.votesCast)} />
          <StatTile label="Pitches" value={formatCompact(r.pitchCount ?? 0)} />
          <StatTile
            label="Round pool"
            value={r.poolCredits === null ? <NotAvailable reason={NA_REASONS.capNotSet} /> : formatCompact(r.poolCredits)}
            hint="$CREDIT, paid by the team after the round"
          />
        </div>
        {r.funding && (
          <p className="mx-auto mt-4 max-w-lg text-sm text-fern">
            {r.funding.allocatedCredits > 0
              ? `Awarded: ${formatCompact(r.funding.allocatedCredits)} $CREDIT, ${formatCompact(r.funding.fromTreasuryCredits)} from the treasury and ${formatCompact(r.funding.fromDevCredits)} added by the dev. Frozen when the round ended.`
              : "Nothing was awarded this round (too few voters or no pitch with votes): the treasury keeps its share for the next round."}
          </p>
        )}
        {r.top && r.top.length > 1 && (
          <ol className="mx-auto mt-8 max-w-md space-y-2 text-left">
            {r.top.map((x, i) => (
              <li key={x.id} className="flex items-center gap-3 rounded-xl border border-line bg-wash px-4 py-2.5 text-sm">
                <span className="font-mono font-semibold text-grass">#{i + 1}</span>
                <MasterAvatar m={{ name: x.fighter, ticker: x.ticker ?? "", logoUrl: x.logoUrl ?? null }} size="sm" />
                <span className="min-w-0 flex-1 truncate text-soil">
                  {x.title} <span className="text-fern">· {x.fighter}</span>
                </span>
                <span className="font-mono tabular-nums text-soil" title="Voting power">
                  {formatCompact(x.votingPower)}
                </span>
              </li>
            ))}
          </ol>
        )}
        <a href={`https://x.com/intent/post?${share}`} target="_blank" rel="noopener noreferrer" className="btn-primary mt-8">
          <XIcon /> Share this recap
        </a>
        {r.snapshotBlock && <p className="mt-4 font-mono text-xs text-fern">Snapshot block {Number(r.snapshotBlock).toLocaleString("en-US")}</p>}
        <a href={`/api/tournament/audit?round=${r.number}`} target="_blank" rel="noopener noreferrer" className="tap link mt-2 inline-block text-xs">
          Audit log (every signed vote)
        </a>
      </article>
    </div>
  );
}
