import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui/Card";
import { formatCompact, formatDate, formatUtcDateTime } from "@/lib/format";
import { currentRound } from "@/lib/rounds";
import { serverTimeline } from "@/lib/timeline.server";
import { getPastRounds } from "@/lib/tournament";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Round recaps" };

/** Every finished round gets a recap here by itself, newest first. */
export default function RecapsPage() {
  const rounds = getPastRounds().data ?? [];
  const next = currentRound(Date.now(), serverTimeline());

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="The Tournament"
        title="Round recaps"
        intro="When a round ends, its recap appears here by itself: the champion, the votes and the pool."
      />
      {rounds.length > 0 ? (
        <ul className="grid gap-5 md:grid-cols-2" data-reveal-stagger>
          {rounds.map((r) => (
            <li key={r.id}>
              <Link href={`/tournament/recaps/${r.number}`} className="card card-hover block p-6 no-underline">
                <p className="eyebrow mb-2">
                  Round {r.number} · {formatDate(r.endedAt)}
                </p>
                <p className="font-display text-xl font-semibold text-soil">{r.winnerTitle}</p>
                <p className="mt-1 text-sm text-fern">
                  Champion by {r.winnerFighter} · {formatCompact(r.votesCast)} votes
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No recaps yet" mascot="sleeping">
          <p>
            The first recap appears by itself when Round {next.number} ends
            {next.status === "upcoming" ? `. It starts ${formatUtcDateTime(next.startsAt)}` : ` on ${formatUtcDateTime(next.endsAt)}`}.
          </p>
        </EmptyState>
      )}
    </div>
  );
}
