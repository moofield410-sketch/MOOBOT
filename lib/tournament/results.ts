import { TOURNAMENT } from "@/config";
import { computeRoundPayouts, rankRoundPitches, type RoundInput, type RoundMaster } from "@/lib/rewards";
import { visiblePitches } from "@/lib/tournament/rules";
import type { FrozenPayouts, RoundDoc, StoredPitch, StoredTender } from "@/lib/tournament/types";
import type { Address, PastRound, Pitch, PitchStatus, Tender, VoterRank } from "@/lib/types";

/**
 * Turns stored rounds into what the pages show: the ranked board, round results and each wallet's
 * ledger. Pure (unit-tested). Ranking reuses the rewards calculator's rules: one pitch per agent,
 * ranked by voting power, ties to the earliest submission.
 */

export interface RoundTimes {
  number: number;
  startsAt: number;
  endsAt: number;
}

export interface RankedPitch extends Pitch {
  rank: number;
}

/** Pitches ranked by voting power. While the round runs every pitch is "open"; after it, the top places are set. */
export function rankBoard(doc: RoundDoc, ended: boolean): RankedPitch[] {
  const pitches = visiblePitches(doc);
  const ranked = rankRoundPitches(
    pitches.map((p) => ({ id: p.id, fighter: p.agentId, fighterOwner: p.fighterOwner, submittedAt: p.submittedAt })),
    doc.votes.map((v) => ({ wallet: v.wallet, pitchId: v.pitchId, power: v.power })),
  );
  const byId = new Map(pitches.map((p) => [p.id, p]));
  return ranked.map((r) => {
    const p = byId.get(r.id)!;
    const votes = doc.votes.filter((v) => v.pitchId === p.id).length;
    const status: PitchStatus = !ended ? "open" : r.power > 0 && r.rank === 1 ? "winner" : r.power > 0 && r.rank <= TOURNAMENT.shortlist ? "shortlisted" : "closed";
    return { ...toPitch(p, doc), votes, votingPower: r.power, status, rank: r.rank };
  });
}

function toPitch(p: StoredPitch, doc: RoundDoc): Pitch {
  const scores = doc.scores.filter((s) => s.pitchId === p.id).map((s) => s.score);
  return {
    id: p.id,
    title: p.title,
    summary: p.summary,
    fighter: p.fighter,
    fighterWallet: p.fighterOwner,
    masterToken: p.masterToken,
    tenderId: p.tenderId,
    status: "open",
    votes: 0,
    votingPower: 0,
    submittedAt: p.submittedAt,
    roundId: `r${p.round}`,
    agentId: p.agentId,
    ticker: p.ticker,
    fighterToken: p.fighterToken,
    demoUrl: p.demoUrl,
    logoUrl: p.logoUrl ?? null,
    scoreAvg: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    scoreCount: scores.length,
  };
}

/** This round's voters by voting power; "winners backed" counts finished rounds where their pick won. */
export function rankVotersOf(doc: RoundDoc, past: PastRound[], pastDocs: RoundDoc[]): (VoterRank & { rank: number })[] {
  const backed = new Map<string, number>();
  const cast = new Map<string, number>();
  for (const d of pastDocs) {
    const winner = past.find((r) => r.number === d.round)?.winnerPitchId;
    for (const v of d.votes) {
      const w = v.wallet.toLowerCase();
      cast.set(w, (cast.get(w) ?? 0) + 1);
      if (winner && v.pitchId === winner) backed.set(w, (backed.get(w) ?? 0) + 1);
    }
  }
  return [...doc.votes]
    .map((v) => ({
      wallet: v.wallet,
      votingPower: v.power,
      votesCast: (cast.get(v.wallet.toLowerCase()) ?? 0) + 1,
      backedWinners: backed.get(v.wallet.toLowerCase()) ?? 0,
      castAt: v.castAt,
    }))
    .sort((a, b) => b.votingPower - a.votingPower || a.castAt.localeCompare(b.castAt))
    .map(({ castAt: _castAt, ...v }, i) => ({ ...v, rank: i + 1 }));
}

/** A finished round's result. `poolCredits` is null while the round pool can't be worked out. */
export function pastRoundOf(doc: RoundDoc, t: RoundTimes, poolCredits: number | null): PastRound {
  const board = rankBoard(doc, true);
  const winner = board.find((p) => p.status === "winner") ?? null;
  return {
    id: `r${t.number}`,
    number: t.number,
    startedAt: new Date(t.startsAt).toISOString(),
    endedAt: new Date(t.endsAt).toISOString(),
    snapshotBlock: doc.snapshot?.block ?? null,
    eligibleWallets: null,
    votesCast: doc.votes.length,
    winnerPitchId: winner?.id ?? null,
    winnerTitle: winner?.title ?? null,
    winnerFighter: winner?.fighter ?? null,
    poolCredits,
    pitchCount: board.length,
    top: board
      .filter((p) => p.votingPower > 0)
      .slice(0, TOURNAMENT.shortlist)
      .map((p) => ({ id: p.id, title: p.title, fighter: p.fighter, ticker: p.ticker ?? "", logoUrl: p.logoUrl ?? null, votes: p.votes, votingPower: p.votingPower })),
  };
}

export function toTender(t: StoredTender, doc: RoundDoc[] | null, now: number): Tender & { masterName: string } {
  const bids = (doc ?? []).reduce((n, d) => n + visiblePitches(d).filter((p) => p.tenderId === t.id).length, 0);
  return {
    id: t.id,
    masterToken: t.masterToken,
    masterName: t.masterName,
    title: t.title,
    description: t.description,
    criteria: t.criteria,
    deadline: t.deadline,
    status: Date.parse(t.deadline) > now ? "open" : "closed",
    bids,
  };
}

/** Inputs for the rewards calculator for one finished round (displayed, not paid). */
export function roundInput(doc: RoundDoc, pool: bigint, tenders: StoredTender[], masters: RoundMaster[], recentTop3: string[]): RoundInput {
  const pitches = visiblePitches(doc);
  const scorers = new Set(doc.scores.map((s) => s.masterToken.toLowerCase()));
  const posted = new Set(tenders.filter((t) => t.round === doc.round).map((t) => t.masterToken.toLowerCase()));
  return {
    pool,
    pitches: pitches.map((p) => ({ id: p.id, fighter: p.agentId, fighterOwner: p.fighterOwner, submittedAt: p.submittedAt })),
    votes: doc.votes.map((v) => ({ wallet: v.wallet, pitchId: v.pitchId, power: v.power })),
    masters: masters.filter((m) => scorers.has(m.id.toLowerCase()) || posted.has(m.id.toLowerCase())),
    scores: doc.scores.map((s) => ({ masterId: s.masterToken, pitchId: s.pitchId })),
    tenders: tenders
      .filter((t) => t.round === doc.round)
      .map((t) => ({ masterId: t.masterToken, pitchCount: pitches.filter((p) => p.tenderId === t.id).length })),
    recentTop3,
  };
}

export interface LedgerEntry {
  round: number;
  role: "pitch" | "voter" | "master";
  /** What happened, in a few words. */
  label: string;
  /** Accrued $CREDIT (6 decimals) as a string, or null while the round pool can't be worked out. Displayed, not paid. */
  amountAtoms: string | null;
}

/** One wallet's entries for a finished round. With no pool, entries still list what the wallet did. */
export function ledgerFor(wallet: Address, doc: RoundDoc, input: RoundInput | null, masterOwners: Map<string, string>, frozen: FrozenPayouts | null = null): LedgerEntry[] {
  const w = wallet.toLowerCase();
  const entries: LedgerEntry[] = [];
  // A frozen round's shares are read as stored; only an unfrozen one is computed.
  const payouts = frozen
    ? {
        pitches: frozen.pitches.map((x) => ({ pitchId: x.pitchId, amount: BigInt(x.amount) })),
        voters: frozen.voters.map((x) => ({ wallet: x.wallet, amount: BigInt(x.amount) })),
        masters: frozen.masters.map((x) => ({ masterId: x.masterId, amount: BigInt(x.amount) })),
      }
    : input
      ? computeRoundPayouts(input)
      : null;
  const titles = new Map(doc.pitches.map((p) => [p.id, p.title]));

  for (const p of visiblePitches(doc).filter((p) => p.fighterOwner.toLowerCase() === w)) {
    const paid = payouts?.pitches.find((x) => x.pitchId === p.id);
    const place = rankBoard(doc, true).find((x) => x.id === p.id);
    entries.push({
      round: doc.round,
      role: "pitch",
      label: `Your pitch "${p.title}"${place && place.votingPower > 0 ? ` placed #${place.rank}` : " got no votes"}`,
      amountAtoms: payouts ? String(paid?.amount ?? 0n) : null,
    });
  }
  const vote = doc.votes.find((v) => v.wallet.toLowerCase() === w);
  if (vote) {
    const paid = payouts?.voters.find((x) => x.wallet.toLowerCase() === w);
    entries.push({ round: doc.round, role: "voter", label: `You voted for "${titles.get(vote.pitchId) ?? vote.pitchId}"`, amountAtoms: payouts ? String(paid?.amount ?? 0n) : null });
  }
  for (const [masterId, owner] of masterOwners) {
    if (owner.toLowerCase() !== w || !input?.masters.some((m) => m.id === masterId)) continue;
    const paid = payouts?.masters.find((x) => x.masterId === masterId);
    entries.push({ round: doc.round, role: "master", label: "Your Master took part", amountAtoms: payouts ? String(paid?.amount ?? 0n) : null });
  }
  return entries;
}
