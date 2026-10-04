import type { Metadata } from "next";
import Link from "next/link";
import { NoPitchesYet, NoRoundsYet, NoTendersYet } from "@/components/tournament/EmptyStates";
import { PitchCard } from "@/components/tournament/PitchCard";
import { PitchForm } from "@/components/tournament/PitchForm";
import { RoundCountdown } from "@/components/tournament/RoundCountdown";
import { TenderCard } from "@/components/tournament/TenderCard";
import { TenderForm } from "@/components/tournament/TenderForm";
import { PageHeader, StaleNotice } from "@/components/ui/Card";
import { DetailRow, Details } from "@/components/ui/Details";
import { LockGate } from "@/components/ui/LockGate";
import { NotAvailable } from "@/components/ui/NotAvailable";
import { Tabs } from "@/components/ui/Tabs";
import { CHAIN, FULL_UNLOCK_AFTER_H, TOURNAMENT, USE_MOCK_DATA, VOTING } from "@/config";
import { formatCompact, formatDate, formatUtcDateTime } from "@/lib/format";
import { NA_REASONS } from "@/lib/na-reasons";
import { getMasters } from "@/lib/registry";
import { currentRound } from "@/lib/rounds";
import { serverTimeline } from "@/lib/timeline.server";
import { getTournamentState } from "@/lib/tournament";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tournament" };

export default async function TournamentPage() {
  const [masters, state] = await Promise.all([getMasters(), getTournamentState()]);
  const all = masters.data ?? [];
  const name = new Map(all.map((m) => [m.tokenAddress, m.name]));
  const byToken = new Map(all.map((m) => [m.tokenAddress, m]));
  const t = state.data;
  const live = t?.round.status === "live";
  const pitches = t?.pitches ?? [];
  const tenders = t?.tenders ?? [];
  const rounds = t?.past ?? [];
  const tenderTitle = new Map(tenders.map((x) => [x.id, x.title]));
  const openTenders = tenders.filter((x) => x.status === "open");
  const firstRoundEnds = formatUtcDateTime(currentRound(0, serverTimeline()).endsAt);
  const snapshotUrl = t?.snapshot && CHAIN.explorerUrl ? `${CHAIN.explorerUrl}/block/${t.snapshot.block}` : null;

  const tabs = [
    {
      id: "pitches",
      label: live ? `Round ${t!.round.number} pitches` : "Open pitches",
      count: pitches.length,
      content:
        pitches.length > 0 ? (
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {pitches.map((p) => (
              <li key={p.id}>
                <PitchCard p={p} rank={p.rank} masterName={p.masterToken ? (name.get(p.masterToken) ?? null) : null} tenderTitle={p.tenderId ? (tenderTitle.get(p.tenderId) ?? null) : null} live={live} />
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
      count: openTenders.length,
      content: (
        <div className="space-y-5">
          <TenderForm />
          {tenders.length > 0 ? (
            <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {tenders.map((x) => (
                <li key={x.id}>
                  <TenderCard
                    t={x}
                    masterName={x.masterName ?? name.get(x.masterToken) ?? null}
                    masterLogo={byToken.get(x.masterToken)?.logoUrl ?? null}
                    masterTicker={byToken.get(x.masterToken)?.ticker ?? ""}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <NoTendersYet />
          )}
        </div>
      ),
    },
    {
      id: "past",
      label: "Past rounds",
      count: rounds.length,
      content:
        rounds.length > 0 ? (
          <ul className="space-y-4">
            {rounds.map((r) => (
              <li key={r.id} className="card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow mb-1">Round {r.number}</p>
                    <p className="text-lg font-bold text-soil">
                      {r.winnerTitle ? (
                        <>
                          Champion: <span className="text-grass">{r.winnerTitle}</span>
                        </>
                      ) : (
                        "No champion: no pitch received a vote"
                      )}
                    </p>
                    <p className="text-sm text-soil/70">
                      {r.winnerFighter ? `by ${r.winnerFighter} · ` : ""}
                      {formatDate(r.startedAt)} to {formatDate(r.endedAt)}
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
                      <dt className="text-xs text-soil/60">Pitches</dt>
                      <dd className="font-semibold text-soil">{formatCompact(r.pitchCount ?? 0)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-soil/60">Pool</dt>
                      <dd className="font-semibold text-soil">{r.poolCredits === null ? <NotAvailable reason={NA_REASONS.capNotSet} /> : `${formatCompact(r.poolCredits)} $CREDIT`}</dd>
                    </div>
                  </dl>
                </div>
                <Details>
                  <DetailRow label="Snapshot block" value={r.snapshotBlock ? Number(r.snapshotBlock).toLocaleString("en-US") : "n/a"} />
                  {r.winnerPitchId && <DetailRow label="Winning pitch ID" value={r.winnerPitchId} />}
                  <DetailRow label="Audit log" value={`/api/tournament/audit?round=${r.number}`} href={`/api/tournament/audit?round=${r.number}`} />
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
            Fighters pitch features to Masters, and the Crowd votes with $ORBIO. Each {TOURNAMENT.roundLengthH}-hour round crowns one champion. Pitching,
            voting and scoring use a free signed message: no gas, nothing leaves your wallet.{" "}
            <Link href="/docs/pitching" className="link">
              How pitching works
            </Link>
            {" · "}
            <Link href="/docs/voting" className="link">
              How voting works
            </Link>
          </>
        }
      />

      <RoundCountdown hideWhileUpcoming />

      <LockGate
        feature="registrationOpen"
        title="The Tournament opens in"
        description={`The Tournament board unlocks ${FULL_UNLOCK_AFTER_H} hours after go-live. Pitching and voting open with it.${USE_MOCK_DATA ? " Here's a preview of the board." : ""}`}
        minHeight="28rem"
      >
        <div className="space-y-8">
          {state.stale && <StaleNotice error={state.error} />}
          {live && (
            <section aria-label="Round snapshot" className="card flex flex-wrap items-center justify-between gap-4 p-5 text-sm">
              <div>
                <p className="font-semibold text-soil">Voting power snapshot</p>
                <p className="text-soil/75">
                  {t!.snapshot ? (
                    <>
                      Block{" "}
                      {snapshotUrl ? (
                        <a href={snapshotUrl} target="_blank" rel="noopener noreferrer" className="link font-mono">
                          {Number(t!.snapshot.block).toLocaleString("en-US")}
                        </a>
                      ) : (
                        <span className="font-mono">{Number(t!.snapshot.block).toLocaleString("en-US")}</span>
                      )}
                      , the last block before Round {t!.round.number} started ({formatUtcDateTime(t!.round.startsAt)}). Hold at least{" "}
                      {VOTING.minOrbio.toLocaleString("en-US")} $ORBIO there to vote.
                    </>
                  ) : (
                    <>
                      Taken at the round start ({formatUtcDateTime(t!.round.startsAt)}); the block number appears with the first vote. Hold at least{" "}
                      {VOTING.minOrbio.toLocaleString("en-US")} $ORBIO at that moment to vote.
                    </>
                  )}
                </p>
              </div>
              <a href={`/api/tournament/audit?round=${t!.round.number}`} target="_blank" rel="noopener noreferrer" className="tap link text-sm">
                Audit log (every signed vote)
              </a>
            </section>
          )}
          {live && <PitchForm masters={all.map((m) => ({ token: m.tokenAddress, name: m.name }))} tenders={openTenders.map((x) => ({ id: x.id, title: x.title, masterName: x.masterName }))} />}
          <Tabs label="Tournament board" tabs={tabs} />
        </div>
      </LockGate>
    </div>
  );
}
