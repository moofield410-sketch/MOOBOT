import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MooBotMascot } from "@/components/MooBotMascot";
import { StatTile } from "@/components/ui/Stats";
import { SprigDivider } from "@/components/ui/Nature";
import { XIcon } from "@/components/ui/Icons";
import { SOCIAL } from "@/config";
import { formatCompact, formatDate } from "@/lib/format";
import { getPastRounds } from "@/lib/tournament";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ round: string }> };

function findRound(round: string) {
  if (!/^\d{1,5}$/.test(round)) return null;
  return getPastRounds().data?.find((r) => r.number === Number(round)) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = findRound((await params).round);
  return r ? { title: `Round ${r.number} recap`, description: `Champion: ${r.winnerTitle} by ${r.winnerFighter}.` } : { title: "Recap not found" };
}

/** A finished round's recap, built from the round's results with a ready-made post for X. */
export default async function RecapPage({ params }: Props) {
  const r = findRound((await params).round);
  if (!r) notFound();

  const site = URL.canParse(process.env.URL ?? "") ? process.env.URL : null;
  const text = `Round ${r.number} of the Moofield Tournament is in 🏆 Champion: "${r.winnerTitle}" by ${r.winnerFighter}, with ${formatCompact(r.votesCast)} votes.`;
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
        <h1 className="font-display text-3xl font-semibold text-soil sm:text-4xl">{r.winnerTitle}</h1>
        <p className="mt-2 text-fern">Champion pitch by {r.winnerFighter}</p>
        <MooBotMascot state="happy" size={140} decorative className="mx-auto mt-6" />
        <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
          <StatTile label="Votes cast" value={formatCompact(r.votesCast)} />
          <StatTile label="Eligible wallets" value={formatCompact(r.eligibleWallets)} />
          <StatTile label="Round pool" value={formatCompact(r.poolCredits)} hint="$CREDIT, displayed, not paid" />
        </div>
        <a href={`https://x.com/intent/post?${share}`} target="_blank" rel="noopener noreferrer" className="btn-primary mt-8">
          <XIcon /> Share this recap
        </a>
        <p className="mt-4 font-mono text-xs text-fern">Snapshot block {Number(r.snapshotBlock).toLocaleString("en-US")}</p>
      </article>
    </div>
  );
}
