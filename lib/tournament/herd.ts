import { isAddress } from "viem";
import { VOTING } from "@/config";
import { cached } from "@/lib/cache";
import { checkTokenAddress, moobotTokenSetting } from "@/lib/moobot";
import { fetchAgentByToken } from "@/lib/sources/orbio-api";
import { balanceAtSnapshot, findSnapshotBlock, type SnapshotChain } from "@/lib/tournament/snapshot";
import type { RoundDoc } from "@/lib/tournament/types";
import type { Address } from "@/lib/types";

/**
 * $MOOBOT votes (the "herd"). Every VOTING.moobotPerPoint whole $MOOBOT a voter holds is one vote
 * point, added to their $ORBIO power. There is no snapshot: while a round runs the board counts
 * what each voter holds now, and when it ends the result counts what they held at the round's last
 * block. So selling lowers a vote (to zero), buying raises it, and tokens moved to a second wallet
 * stop counting for the first: they can't be voted with twice. SERVER-SIDE ONLY.
 */

const lc = (a: string) => a.toLowerCase();

/** The verified $MOOBOT contract from MOOBOT_TOKEN_ADDRESS, or null while it isn't set. */
export function moobotToken(): Address | null {
  const s = moobotTokenSetting();
  if (!s) return null;
  const c = checkTokenAddress(s);
  return c.ok ? (lc(c.address) as Address) : null;
}

/** Whole vote points from a raw balance. */
export function pointsOf(raw: bigint, decimals: number): number {
  const whole = raw / 10n ** BigInt(decimals);
  const points = whole / BigInt(VOTING.moobotPerPoint);
  return points > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(points);
}

/** Each vote's power is its $ORBIO power plus its wallet's $MOOBOT points (missing = 0). */
export function withHerd(doc: RoundDoc, points: Map<string, number>): RoundDoc {
  return { ...doc, votes: doc.votes.map((v) => ({ ...v, power: v.power + (points.get(lc(v.wallet)) ?? 0) })) };
}

/** Reads each wallet's points at one block, a few at a time. Throws if any read fails (never a guessed 0). */
async function pointsAt(chain: SnapshotChain, token: Address, wallets: string[], block: bigint): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(wallets.map(lc))];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const reads = await Promise.all(chunk.map((w) => balanceAtSnapshot(chain, token, w as Address, block)));
    reads.forEach((b, j) => out.set(chunk[j], pointsOf(b.raw, b.decimals)));
  }
  return out;
}

/** One wallet's points right now (the vote button and My Wallet). */
export async function pointsNow(chain: SnapshotChain, token: Address, wallet: Address): Promise<{ balance: number; points: number }> {
  const b = await balanceAtSnapshot(chain, token, wallet, await chain.headBlock());
  const whole = b.raw / 10n ** BigInt(b.decimals);
  return { balance: whole > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(whole), points: pointsOf(b.raw, b.decimals) };
}

/**
 * Every voter's points right now, for the live board: refreshed at most every 30 seconds (in the
 * background, so the board never waits) and shared between server instances. An empty map when the
 * chain or the token isn't set up; on a failed read the last good one is kept.
 */
export async function liveHerd(doc: RoundDoc, chain: SnapshotChain | null, token: Address | null = moobotToken()): Promise<Map<string, number>> {
  if (!chain || !token || doc.votes.length === 0) return new Map();
  const wallets = doc.votes.map((v) => lc(v.wallet)).sort();
  const env = await cached<Record<string, number>>(
    `herd:${doc.round}:${wallets.length}`,
    { ttlMs: 30_000, staleMs: 30 * 60_000, background: true, shared: true },
    async () => ({ value: Object.fromEntries(await pointsAt(chain, token, wallets, await chain.headBlock())), source: "live" }),
  );
  return new Map(Object.entries(env.data ?? {}));
}

/**
 * Every voter's points at the round's last block (the last block at or before its end), for the
 * frozen result. null while that can't be read yet (no chain, or an RPC error): the round then
 * waits to be frozen. With no $MOOBOT contract set, nobody has points (an empty map).
 */
export async function finalHerd(
  doc: RoundDoc,
  endsAt: number,
  chain: SnapshotChain | null,
  token: Address | null = moobotToken(),
): Promise<{ block: string | null; points: Map<string, number> } | null> {
  if (!token || doc.votes.length === 0) return { block: null, points: new Map() };
  if (!chain) return null;
  try {
    const block = await findSnapshotBlock(chain, endsAt);
    if (block === null) return null;
    return { block: block.toString(), points: await pointsAt(chain, token, doc.votes.map((v) => v.wallet), block) };
  } catch {
    return null;
  }
}

/**
 * Wallets that can't vote at all: the MooBot agent's owner and agent wallet (from its Orbio
 * record) and TEAM_WALLETS. The team funds the rewards, so it never picks the winners.
 */
export async function teamWallets(): Promise<Set<string>> {
  const out = new Set<string>(
    (process.env[VOTING.teamWalletsEnv] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => isAddress(s))
      .map(lc),
  );
  const token = moobotToken();
  if (token) {
    const a = await fetchAgentByToken(token).catch(() => null);
    if (a?.owner) out.add(lc(a.owner));
    if (a?.agentWallet) out.add(lc(a.agentWallet));
  }
  return out;
}
