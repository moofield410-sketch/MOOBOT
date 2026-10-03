import { USE_MOCK_DATA } from "@/config";
import { SAMPLE_PAST_ROUNDS, SAMPLE_PITCHES, SAMPLE_TENDERS, SAMPLE_VOTERS } from "@/lib/sample/tournament";
import type { DataEnvelope, Leaderboard, PastRound, Pitch, Tender, VoterRank } from "@/lib/types";

/**
 * Tournament data (pitches, tenders, rounds, leaderboard).
 * Preview mode: sample data. Real mode: the real (empty) state. Nothing accepts pitches,
 * tenders or votes yet (that needs a database), so none can exist. Numbers are never invented.
 */

function envelope<T>(sample: T, empty: T): DataEnvelope<T> {
  return USE_MOCK_DATA
    ? { data: sample, source: "mock", updatedAt: new Date().toISOString(), stale: false }
    : { data: empty, source: "live", updatedAt: new Date().toISOString(), stale: false };
}

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

export function getPitches(): DataEnvelope<Pitch[]> {
  return envelope([...SAMPLE_PITCHES].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)), []);
}

export function getTenders(): DataEnvelope<Tender[]> {
  const sorted = [...SAMPLE_TENDERS].sort((a, b) =>
    a.status === b.status ? a.deadline.localeCompare(b.deadline) : a.status === "open" ? -1 : 1,
  );
  return envelope(sorted, []);
}

export function getPastRounds(): DataEnvelope<PastRound[]> {
  return envelope([...SAMPLE_PAST_ROUNDS].sort((a, b) => b.number - a.number), []);
}

export function getLeaderboard(): DataEnvelope<Leaderboard> {
  return envelope({ pitches: rankPitches(SAMPLE_PITCHES), voters: rankVoters(SAMPLE_VOTERS) }, { pitches: [], voters: [] });
}
