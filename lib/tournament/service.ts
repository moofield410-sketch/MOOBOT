import { verifyMessage, type Hex } from "viem";
import { CONTRACTS, CREDIT_DECIMALS, REWARDS, TOURNAMENT } from "@/config";
import { sessionSecret } from "@/lib/auth/session";
import { getCredits } from "@/lib/credits";
import { kvMode } from "@/lib/kv";
import { reportError } from "@/lib/monitoring";
import { getMasters } from "@/lib/registry";
import { roundPool, type RoundMaster } from "@/lib/rewards";
import { currentRound, type RoundState } from "@/lib/rounds";
import type { Timeline } from "@/lib/schedule";
import { publicClientOrNull } from "@/lib/sources/chain";
import { fetchOrbioAgentsByWallet, type OrbioAgent } from "@/lib/sources/orbio-api";
import { serverTimeline, testClockActive } from "@/lib/timeline.server";
import { CRITERIA_SEPARATOR, oneLine, parseAction, parsePitchTarget, type ActionKind } from "@/lib/tournament/messages";
import { ledgerFor, pastRoundOf, roundInput, type LedgerEntry } from "@/lib/tournament/results";
import {
  applyHide,
  applyPitch,
  applyScore,
  applyTender,
  applyVote,
  checkDemoUrl,
  checkFresh,
  checkPitchText,
  checkTenderText,
  nextTenderId,
  refuse,
  TournamentError,
} from "@/lib/tournament/rules";
import { balanceAtSnapshot, findSnapshotBlock, powerOf, viemSnapshotChain, type SnapshotChain } from "@/lib/tournament/snapshot";
import { readPower, readRound, readTenders, updateRound, updateTenders, writePower } from "@/lib/tournament/store";
import type { PowerRecord, RoundDoc, StoredPitch, StoredScore, StoredTender, StoredVote } from "@/lib/tournament/types";
import type { Address, Master, PastRound } from "@/lib/types";

/**
 * The Tournament's server side: checks each signed action (the signature, its freshness, the
 * round, who the signer is on Orbio, their voting power at the snapshot) and stores it.
 * Everything outside this file is pure, so the rules are unit-tested; tests pass their own deps.
 */

export interface TournamentDeps {
  now(): number;
  timeline(): Timeline;
  /** null while RPC_URL isn't set. */
  chain(): SnapshotChain | null;
  orbioToken: Address | null;
  agentsOf(wallet: Address): Promise<OrbioAgent[]>;
  masters(): Promise<Master[]>;
  verify(address: Address, message: string, signature: Hex): Promise<boolean>;
  moderators(): Address[];
}

/** Checks a signature offline first (normal wallets); smart-contract wallets are checked on chain. */
export async function verifySignature(address: Address, message: string, signature: Hex): Promise<boolean> {
  try {
    if (await verifyMessage({ address, message, signature })) return true;
  } catch {
    // Not a plain wallet signature: try the chain below.
  }
  const client = publicClientOrNull();
  if (!client) return false;
  try {
    return await client.verifyMessage({ address, message, signature });
  } catch (err) {
    reportError(err, { where: "tournament verifySignature" });
    return false;
  }
}

export function moderatorWallets(): Address[] {
  return (process.env[TOURNAMENT.moderatorsEnv] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is Address => /^0x[0-9a-f]{40}$/.test(s));
}

let chainCache: { client: unknown; chain: SnapshotChain } | null = null;

export const defaultDeps: TournamentDeps = {
  now: () => Date.now(),
  timeline: serverTimeline,
  chain() {
    const client = publicClientOrNull();
    if (!client) return null;
    if (chainCache?.client !== client) chainCache = { client, chain: viemSnapshotChain(client) };
    return chainCache.chain;
  },
  orbioToken: CONTRACTS.orbioToken,
  agentsOf: (wallet) => fetchOrbioAgentsByWallet(wallet),
  async masters() {
    const m = await getMasters();
    if (!m.data) throw new TournamentError("Orbio's Masters list can't be read right now. Please try again in a minute.", 503);
    return m.data;
  },
  verify: verifySignature,
  moderators: moderatorWallets,
};

const same = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

/** The round that is running now, or a refusal if none is (before the unlock). */
export function liveRound(deps: TournamentDeps): RoundState {
  const r = currentRound(deps.now(), deps.timeline());
  if (r.status !== "live") refuse("The Tournament hasn't opened yet.", 403);
  return r;
}

/** Parses and checks a signed action: format, freshness, the live round, and the signature. */
async function signed<K extends ActionKind>(deps: TournamentDeps, kind: K, message: unknown, signature: unknown) {
  if (typeof message !== "string" || typeof signature !== "string" || message.length > 3_000 || !/^0x[0-9a-fA-F]{130,}$/.test(signature)) {
    refuse("Invalid request.");
  }
  const action = parseAction(kind, message as string);
  if (!action) return refuse("This isn't a valid Moofield message. Please sign again from the site.");
  checkFresh(action.issuedAt, deps.now());
  const round = liveRound(deps);
  if (action.round !== round.number) refuse(`Round ${action.round} isn't running: it's Round ${round.number} now. Please reload and sign again.`, 409);
  if (!(await deps.verify(action.address, message as string, signature as Hex))) refuse("The signature doesn't match this wallet.", 401);
  return { action, round, message: message as string, signature: signature as Hex };
}

// --- Snapshot and voting power ---------------------------------------------------------------

/** The round's snapshot block, found and stored by the first request after the round starts. */
export async function ensureSnapshot(deps: TournamentDeps, round: RoundState): Promise<RoundDoc["snapshot"]> {
  const doc = await readRound(round.number);
  if (doc.snapshot) return doc.snapshot;
  const chain = deps.chain();
  if (!chain) return null;
  const block = await findSnapshotBlock(chain, round.startsAt);
  if (block === null) return null;
  const blockTime = (await chain.blockTime(block)) * 1000;
  const snapshot = { block: block.toString(), blockTime, takenAt: new Date(deps.now()).toISOString() };
  return updateRound(round.number, (d) => (d.snapshot ? { doc: d, result: d.snapshot } : { doc: { ...d, snapshot }, result: snapshot }));
}

/** A wallet's voting power for the live round: read once at the snapshot block, then kept. */
export async function powerFor(deps: TournamentDeps, wallet: Address): Promise<PowerRecord> {
  const round = liveRound(deps);
  const kept = await readPower(round.number, wallet);
  if (kept) return kept;
  const chain = deps.chain();
  if (!chain || !deps.orbioToken) return refuse("Voting power can't be read right now: the blockchain connection isn't set up.", 503);
  const snapshot = await ensureSnapshot(deps, round);
  if (!snapshot) return refuse("The snapshot block isn't available yet. Please try again in a minute.", 503);
  const b = await balanceAtSnapshot(chain, deps.orbioToken, wallet, BigInt(snapshot.block));
  const { balance, power } = powerOf(b);
  const record: PowerRecord = {
    round: round.number,
    wallet: wallet.toLowerCase() as Address,
    block: snapshot.block,
    raw: b.raw.toString(),
    decimals: b.decimals,
    balance,
    power,
    method: b.method,
    readAt: new Date(deps.now()).toISOString(),
  };
  await writePower(record);
  return record;
}

// --- Signed actions --------------------------------------------------------------------------

export async function submitPitch(deps: TournamentDeps, message: unknown, signature: unknown): Promise<StoredPitch> {
  const { action, round, message: msg, signature: sig } = await signed(deps, "pitch", message, signature);
  const f = action.fields;
  const title = oneLine(f.Title);
  const summary = oneLine(f.Summary);
  checkPitchText(title, summary);
  const demoUrl = checkDemoUrl(f.Demo);
  const target = parsePitchTarget(f["Pitch to"]);
  if (!target) return refuse("The pitch target isn't valid. Please sign again from the site.");

  const agents = await deps.agentsOf(action.address);
  const agent = agents.find((a) => a.agentId === f["Agent ID"]);
  if (!agent) return refuse("This wallet doesn't own or operate that Orbio agent.", 403);
  if (!same(agent.owner, action.address) && !same(agent.agentWallet, action.address)) refuse("This wallet doesn't own or operate that Orbio agent.", 403);

  if (target.masterToken) {
    const masters = await deps.masters();
    if (!masters.some((m) => same(m.tokenAddress, target.masterToken))) refuse("That agent isn't a graduated Master.", 404);
  }
  const tenders = (await readTenders()).tenders;
  const pitch: StoredPitch = {
    id: `r${round.number}-${agent.agentId}`,
    round: round.number,
    agentId: agent.agentId,
    fighter: agent.name ?? agent.symbol ?? `Agent #${agent.agentId}`,
    ticker: agent.symbol ?? "",
    fighterToken: agent.token,
    fighterOwner: agent.owner,
    fighterAgentWallet: agent.agentWallet,
    submittedBy: action.address,
    title,
    summary,
    demoUrl,
    masterToken: target.tenderId ? (tenders.find((t) => t.id === target.tenderId)?.masterToken ?? null) : target.masterToken,
    tenderId: target.tenderId,
    submittedAt: new Date(deps.now()).toISOString(),
    message: msg,
    signature: sig,
  };
  return updateRound(round.number, (doc) => ({ doc: applyPitch(doc, pitch, tenders, deps.now()), result: pitch }));
}

export async function castVote(deps: TournamentDeps, message: unknown, signature: unknown): Promise<StoredVote> {
  const { action, round, message: msg, signature: sig } = await signed(deps, "vote", message, signature);
  // Cheap checks first, so nobody waits for a chain read only to be refused.
  const before = await readRound(round.number);
  applyVote(before, { round: round.number, wallet: action.address, pitchId: action.fields.Pitch, power: 1, balance: 0, castAt: "", message: msg, signature: sig });
  const power = await powerFor(deps, action.address);
  if (power.power <= 0) refuse(`This wallet held ${power.balance.toLocaleString("en-US")} $ORBIO at the snapshot block, under the voting minimum.`, 403);
  const vote: StoredVote = {
    round: round.number,
    wallet: action.address,
    pitchId: action.fields.Pitch,
    power: power.power,
    balance: power.balance,
    castAt: new Date(deps.now()).toISOString(),
    message: msg,
    signature: sig,
  };
  return updateRound(round.number, (doc) => ({ doc: applyVote(doc, vote), result: vote }));
}

/** The Master a wallet acts for: the signer must be its owner or agent wallet. */
async function masterOf(deps: TournamentDeps, wallet: Address, token: string): Promise<Master> {
  const m = (await deps.masters()).find((x) => same(x.tokenAddress, token));
  if (!m) return refuse("That agent isn't a graduated Master.", 404);
  if (!same(m.ownerWallet, wallet) && !same(m.agentWallet, wallet)) refuse("This wallet doesn't own or operate that Master.", 403);
  return m;
}

export async function submitScore(deps: TournamentDeps, message: unknown, signature: unknown): Promise<StoredScore> {
  const { action, round, message: msg, signature: sig } = await signed(deps, "score", message, signature);
  const m = await masterOf(deps, action.address, action.fields.Master);
  const value = /^\d{1,2}$/.test(action.fields.Score) ? Number(action.fields.Score) : NaN;
  const score: StoredScore = {
    round: round.number,
    pitchId: action.fields.Pitch,
    masterToken: m.tokenAddress,
    masterAgentId: m.orbioAgentId,
    masterName: m.name,
    masterOwner: m.ownerWallet,
    wallet: action.address,
    score: value,
    scoredAt: new Date(deps.now()).toISOString(),
    message: msg,
    signature: sig,
  };
  return updateRound(round.number, (doc) => ({ doc: applyScore(doc, score), result: score }));
}

export async function postTender(deps: TournamentDeps, message: unknown, signature: unknown): Promise<StoredTender> {
  const { action, round, message: msg, signature: sig } = await signed(deps, "tender", message, signature);
  const f = action.fields;
  const m = await masterOf(deps, action.address, f.Master);
  const criteria = f["Looking for"].split(CRITERIA_SEPARATOR).map(oneLine).filter(Boolean);
  const t = { title: oneLine(f.Title), description: oneLine(f.Description), criteria };
  checkTenderText(t);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(f.Deadline)) refuse("The deadline isn't a valid date.");
  return updateTenders((doc) => {
    const tender: StoredTender = {
      id: nextTenderId(doc, round.number, { agentId: m.orbioAgentId, token: m.tokenAddress }),
      round: round.number,
      masterToken: m.tokenAddress,
      masterAgentId: m.orbioAgentId,
      masterName: m.name,
      wallet: action.address,
      ...t,
      deadline: new Date(f.Deadline).toISOString(),
      postedAt: new Date(deps.now()).toISOString(),
      message: msg,
      signature: sig,
    };
    return { doc: applyTender(doc, tender, deps.now()), result: tender };
  });
}

/** Moderators only (MODERATOR_WALLETS), signed in. Works on any round. */
export async function hidePitch(deps: TournamentDeps, by: Address | null, pitchId: unknown, reason: unknown): Promise<{ pitchId: string }> {
  if (!by) return refuse("Sign in with your wallet first.", 401);
  if (!deps.moderators().some((w) => same(w, by))) refuse("Only Moofield moderators can hide pitches.", 403);
  const id = typeof pitchId === "string" ? pitchId : "";
  const n = Number(id.match(/^r(\d{1,5})-/)?.[1]);
  if (!Number.isInteger(n) || n < 1) refuse("Unknown pitch.", 404);
  const why = typeof reason === "string" ? oneLine(reason).slice(0, 200) : "";
  if (why.length < 3) refuse("Please give a short reason.");
  return updateRound(n, (doc) => ({ doc: applyHide(doc, id, by.toLowerCase() as Address, why, new Date(deps.now()).toISOString()), result: { pitchId: id } }));
}

// --- Reading -----------------------------------------------------------------------------------

export interface RoundView {
  times: { number: number; startsAt: number; endsAt: number };
  doc: RoundDoc;
}

/** Every round that has started, newest first. Round docs that don't exist yet read as empty. */
export async function startedRounds(deps: TournamentDeps = defaultDeps): Promise<{ current: RoundState; rounds: RoundView[] }> {
  const t = deps.timeline();
  const current = currentRound(deps.now(), t);
  if (current.status !== "live") return { current, rounds: [] };
  const len = current.endsAt - current.startsAt;
  const numbers = Array.from({ length: current.number }, (_, i) => current.number - i);
  const docs = await Promise.all(numbers.map((n) => readRound(n)));
  return {
    current,
    rounds: numbers.map((n, i) => ({ times: { number: n, startsAt: t.fullUnlockAt + (n - 1) * len, endsAt: t.fullUnlockAt + n * len }, doc: docs[i] })),
  };
}

/** The round pool in $CREDIT atoms: min(share of the treasury, cap). null while the cap isn't set or credits are unknown. */
async function poolAtoms(): Promise<bigint | null> {
  if (REWARDS.roundPoolCapCredits === null) return null;
  const c = await getCredits();
  return c.data ? roundPool(BigInt(c.data.treasuryAtoms)) : null;
}

const toWhole = (atoms: bigint) => Number(atoms / 10n ** BigInt(CREDIT_DECIMALS));

export async function pastRounds(deps: TournamentDeps = defaultDeps): Promise<{ past: PastRound[]; views: RoundView[] }> {
  const { current, rounds } = await startedRounds(deps);
  const finished = rounds.filter((r) => r.times.number < current.number);
  const pool = finished.length ? await poolAtoms() : null;
  return { past: finished.map((r) => pastRoundOf(r.doc, r.times, pool === null ? null : toWhole(pool))), views: finished };
}

/** A wallet's ledger across finished rounds (displayed, not paid). */
export async function ledger(wallet: Address, deps: TournamentDeps = defaultDeps): Promise<LedgerEntry[]> {
  const { past, views } = await pastRounds(deps);
  if (views.length === 0) return [];
  const [pool, tenders, masters] = await Promise.all([poolAtoms(), readTenders(), deps.masters().catch(() => [] as Master[])]);
  const roundMasters: RoundMaster[] = masters.map((m) => ({ id: m.tokenAddress, agentId: m.orbioAgentId ?? "", ownerWallet: m.ownerWallet }));
  const owners = new Map(masters.map((m) => [m.tokenAddress as string, m.ownerWallet as string]));
  const entries: LedgerEntry[] = [];
  for (const v of [...views].sort((a, b) => a.times.number - b.times.number)) {
    const recentTop3 = past
      .filter((p) => p.number < v.times.number && p.number >= v.times.number - REWARDS.repeatWinner.rounds)
      // A pitch id is r<round>-<agentId>.
      .flatMap((p) => (p.top ?? []).map((x) => x.id.replace(/^r\d+-/, "")));
    const input = pool === null ? null : roundInput(v.doc, pool, tenders.tenders, roundMasters, recentTop3);
    entries.push(...ledgerFor(wallet, v.doc, input, owners));
  }
  return entries.sort((a, b) => b.round - a.round);
}

/** For the Status page: is everything the Tournament needs in place, and how is the round going. */
export async function tournamentStatus(deps: TournamentDeps = defaultDeps) {
  const round = currentRound(deps.now(), deps.timeline());
  const doc = round.status === "live" ? await readRound(round.number) : null;
  const tenders = (await readTenders()).tenders;
  return {
    round,
    snapshot: doc?.snapshot ?? null,
    pitches: doc ? doc.pitches.length - doc.hidden.length : 0,
    votes: doc?.votes.length ?? 0,
    scores: doc?.scores.length ?? 0,
    hidden: doc?.hidden.length ?? 0,
    openTenders: tenders.filter((t) => Date.parse(t.deadline) > deps.now()).length,
    chainConnected: deps.chain() !== null,
    moderators: deps.moderators().length,
    signInConfigured: sessionSecret() !== null,
    storage: kvMode(),
    testClock: testClockActive(),
  };
}
