import { TOURNAMENT, USE_MOCK_DATA } from "@/config";
import { cached, invalidate } from "@/lib/cache";
import { currentRound, type RoundState } from "@/lib/rounds";
import { SAMPLE_PAST_ROUNDS, SAMPLE_PITCHES, SAMPLE_TENDERS, SAMPLE_VOTERS } from "@/lib/sample/tournament";
import { serverTimeline } from "@/lib/timeline.server";
import { rankBoard, rankVotersOf, toTender, type RankedPitch } from "@/lib/tournament/results";
import { defaultDeps, pastRounds, startedRounds } from "@/lib/tournament/service";
import { liveHerd, withHerd } from "@/lib/tournament/herd";
import { readTenders } from "@/lib/tournament/store";
import type { Snapshot } from "@/lib/tournament/types";
import type { DataEnvelope, Leaderboard, PastRound, Pitch, Tender, VoterRank } from "@/lib/types";

/**
 * Tournament data for the pages: the running round's board, tenders, finished rounds and the
 * leaderboard. Real mode reads the Tournament store (lib/tournament/store.ts), re-read every few
 * seconds. Preview mode (local only): sample data. Numbers are never invented.
 */

/** Ranked by voting power; ties go to the earliest submission. */
export function rankPitches(pitches: Pitch[]): (Pitch & { rank: number })[] {
  return [...pitches]
    .sort((a, b) => b.votingPower - a.votingPower || a.submittedAt.localeCompare(b.submittedAt))
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

export function rankVoters(voters: VoterRank[]): (VoterRank & { rank: number })[] {
  return [...voters]
    .sort((a, b) => b.votingPower - a.votingPower || b.backedWinners - a.backedWinners || b.votesCast - a.votesCast)
    .map((v, i) => ({ ...v, rank: i + 1 }));
}

export type TenderView = Tender & { masterName: string | null };

export interface TournamentState {
  round: RoundState;
  snapshot: Snapshot | null;
  /** The running round's pitches, ranked (empty before the unlock). */
  pitches: RankedPitch[];
  voters: (VoterRank & { rank: number })[];
  tenders: TenderView[];
  past: PastRound[];
  hiddenCount: number;
}

const STATE_KEY = "tournament:state";

function sampleState(): TournamentState {
  const round = currentRound(Date.now(), serverTimeline());
  return {
    round,
    snapshot: null,
    pitches: rankPitches(SAMPLE_PITCHES),
    voters: rankVoters(SAMPLE_VOTERS),
    tenders: SAMPLE_TENDERS.map((t) => ({ ...t, masterName: null })),
    past: [...SAMPLE_PAST_ROUNDS].sort((a, b) => b.number - a.number),
    hiddenCount: 0,
  };
}

async function loadState(): Promise<TournamentState> {
  const now = Date.now();
  const [{ current, rounds }, tendersDoc, { past, views }] = await Promise.all([startedRounds(defaultDeps), readTenders(), pastRounds(defaultDeps)]);
  const live = rounds.find((r) => r.times.number === current.number && current.status === "live") ?? null;
  const docs = rounds.map((r) => r.doc);
  // The live board adds each voter's $MOOBOT points right now (sell, and the vote shrinks).
  const liveDoc = live ? withHerd(live.doc, await liveHerd(live.doc, defaultDeps.chain()).catch(() => new Map<string, number>())) : null;
  const tenders = tendersDoc.tenders
    .map((t) => toTender(t, docs, now))
    .sort((a, b) => (a.status === b.status ? a.deadline.localeCompare(b.deadline) : a.status === "open" ? -1 : 1));
  return {
    round: current,
    snapshot: live?.doc.snapshot ?? null,
    pitches: liveDoc ? rankBoard(liveDoc, false) : [],
    voters: liveDoc ? rankVotersOf(liveDoc, past, views.map((v) => v.doc)) : [],
    tenders,
    past: [...past].sort((a, b) => b.number - a.number),
    hiddenCount: live?.doc.hidden.length ?? 0,
  };
}

export function getTournamentState(): Promise<DataEnvelope<TournamentState>> {
  if (USE_MOCK_DATA) return Promise.resolve({ data: sampleState(), source: "mock", updatedAt: new Date().toISOString(), stale: false });
  return cached(STATE_KEY, { ttlMs: TOURNAMENT.boardTtlMs, staleMs: 10 * 60_000 }, async () => ({ value: await loadState(), source: "live" }));
}

/** After a pitch, vote, score, tender or hide: this server instance shows it straight away. */
export function refreshTournamentState(): void {
  invalidate(STATE_KEY);
}

function pick<T>(s: DataEnvelope<TournamentState>, f: (t: TournamentState) => T): DataEnvelope<T> {
  return { ...s, data: s.data ? f(s.data) : null };
}

/** The running round's pitches, ranked. */
export async function getPitches(): Promise<DataEnvelope<RankedPitch[]>> {
  return pick(await getTournamentState(), (t) => t.pitches as RankedPitch[]);
}

export async function getTenders(): Promise<DataEnvelope<TenderView[]>> {
  return pick(await getTournamentState(), (t) => t.tenders);
}

export async function getPastRounds(): Promise<DataEnvelope<PastRound[]>> {
  return pick(await getTournamentState(), (t) => t.past);
}

export async function getLeaderboard(): Promise<DataEnvelope<Leaderboard>> {
  return pick(await getTournamentState(), (t) => ({ pitches: t.pitches, voters: t.voters }));
}
