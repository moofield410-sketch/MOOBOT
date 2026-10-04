import type { Metadata } from "next";
import Link from "next/link";
import { NoPitchesYet, NoRoundsYet, NoTendersYet } from "@/components/tournament/EmptyStates";
import { PitchCard } from "@/components/tournament/PitchCard";
import { RoundCountdown } from "@/components/tournament/RoundCountdown";
import { TenderCard } from "@/components/tournament/TenderCard";
import { PageHeader } from "@/components/ui/Card";
import { DetailRow, Details } from "@/components/ui/Details";
import { LockGate } from "@/components/ui/LockGate";
import { Tabs } from "@/components/ui/Tabs";
import { FULL_UNLOCK_AFTER_H, TOURNAMENT, USE_MOCK_DATA } from "@/config";
import { formatCompact, formatDate, formatUtcDateTime } from "@/lib/format";
import { getMasters } from "@/lib/registry";
import { currentRound } from "@/lib/rounds";
import { serverTimeline } from "@/lib/timeline.server";
import { getPastRounds, getPitches, getTenders } from "@/lib/tournament";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tournament" };

export default async function TournamentPage() {
  const masters = await getMasters();
  const name = new Map((masters.data ?? []).map((m) => [m.tokenAddress, m.name]));
  const pitches = getPitches();
  const tenders = getTenders();
  const rounds = getPastRounds();

  const open = pitches.data?.filter((p) => p.status === "open" || p.status === "shortlisted") ?? [];
  const firstRoundEnds = formatUtcDateTime(currentRound(0, serverTimeline()).endsAt);

  const tabs = [
    {
      id: "pitches",
      label: "Open pitches",
      count: open.length,
      content:
        open.length > 0 ? (
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {open.map((p) => (
              <li key={p.id}>
                <PitchCard p={p} masterName={p.masterToken ? (name.get(p.masterToken) ?? null) : null} />
              </li>
            ))}
          </ul>
        ) : (
          <NoPitchesYet />
        ),
    },
    {
      id: "tenders",
      label: "Tenders",
      count: tenders.data?.filter((t) => t.status === "open").length ?? 0,
      content: tenders.data && tenders.data.length > 0 ? (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tenders.data.map((t) => (
            <li key={t.id}>
              <TenderCard t={t} masterName={name.get(t.masterToken) ?? null} />
            </li>
          ))}
        </ul>
      ) : (
        <NoTendersYet />
      ),
    },
    {
      id: "past",
      label: "Past rounds",
      count: rounds.data?.length ?? 0,
      content: rounds.data && rounds.data.length > 0 ? (
        <ul className="space-y-4">
          {rounds.data.map((r) => (
            <li key={r.id} className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow mb-1">Round {r.number}</p>
                  <p className="text-lg font-bold text-soil">
                    Champion: <span className="text-grass">{r.winnerTitle}</span>
                  </p>
                  <p className="text-sm text-soil/70">
                    by {r.winnerFighter} · {formatDate(r.startedAt)} to {formatDate(r.endedAt)}
                  </p>
                  <Link href={`/tournament/recaps/${r.number}`} className="tap link mt-2 inline-block text-sm">
                    Read the recap
                  </Link>
                </div>
                <dl className="grid grid-cols-3 gap-6 text-sm">
                  <div>
                    <dt className="text-xs text-soil/60">Votes</dt>
                    <dd className="font-semibold text-soil">{formatCompact(r.votesCast)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-soil/60">Eligible wallets</dt>
                    <dd className="font-semibold text-soil">{formatCompact(r.eligibleWallets)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-soil/60">Pool</dt>
                    <dd className="font-semibold text-soil">{formatCompact(r.poolCredits)} credits</dd>
                  </div>
                </dl>
              </div>
              <Details>
                <DetailRow label="Snapshot block" value={Number(r.snapshotBlock).toLocaleString("en-US")} />
                <DetailRow label="Winning pitch ID" value={r.winnerPitchId} />
              </Details>
            </li>
          ))}
        </ul>
      ) : (
        <NoRoundsYet firstRoundEnds={firstRoundEnds} />
      ),
    },
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="The Tournament"
        title="Pitch, vote, win"
        intro={
          <>
            Fighters will pitch features to Masters, and the Crowd will vote. Each {TOURNAMENT.roundLengthH}-hour round will crown one
            champion. Pitch and vote submission are still being built.{" "}
            <Link href="/docs/pitching" className="link">
              How pitching works
            </Link>
          </>
        }
      />

      <RoundCountdown hideWhileUpcoming />

      <LockGate
        feature="registrationOpen"
        title="The Tournament opens in"
        description={`The Tournament board unlocks ${FULL_UNLOCK_AFTER_H} hours after go-live. Pitch and vote submission ship after that.${USE_MOCK_DATA ? " Here's a preview of the board." : ""}`}
        minHeight="28rem"
      >
        <Tabs label="Tournament board" tabs={tabs} />
      </LockGate>
    </div>
  );
}
