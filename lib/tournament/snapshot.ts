import { erc20Abi, parseAbiItem, type PublicClient } from "viem";
import { votingPower } from "@/lib/voting";
import type { Address } from "@/lib/types";

/**
 * The round snapshot: the block voting power is read at, and each wallet's $ORBIO balance there.
 *
 * The snapshot block is the last block whose timestamp is at or before the round start, so anyone
 * can re-check it. Many RPC nodes keep only a few hours of old state, so a balance is read at the
 * snapshot block directly when the node allows it, and otherwise rebuilt from the wallet's balance
 * today and its $ORBIO Transfer log since the snapshot (logs are kept for good).
 */

export interface SnapshotChain {
  headBlock(): Promise<bigint>;
  /** Block timestamp in seconds. */
  blockTime(block: bigint): Promise<number>;
  balanceAt(token: Address, owner: Address, block: bigint): Promise<bigint>;
  decimals(token: Address): Promise<number>;
  /** Sum of Transfer values into ("in") or out of ("out") `owner`, in blocks [from, to]. */
  transferSum(token: Address, owner: Address, dir: "in" | "out", from: bigint, to: bigint): Promise<bigint>;
}

/**
 * The last block with timestamp <= atMs, or null if the chain hasn't reached that time yet.
 * Estimates from the recent block rate, brackets the estimate, then binary-searches (about 20 reads).
 */
export async function findSnapshotBlock(chain: SnapshotChain, atMs: number): Promise<bigint | null> {
  const at = Math.floor(atMs / 1000);
  const head = await chain.headBlock();
  const headTime = await chain.blockTime(head);
  // Several blocks can share one timestamp (about 100 ms blocks): the snapshot is only fixed once a
  // later second exists, so it is exactly "the last block with timestamp <= the round start" and
  // anyone can re-check it.
  if (headTime <= at) return null;

  const sample = head > 100_000n ? head - 100_000n : 0n;
  const sampleTime = await chain.blockTime(sample);
  const rate = head > sample && headTime > sampleTime ? Number(head - sample) / (headTime - sampleTime) : 1;
  let guess = head - BigInt(Math.max(0, Math.floor((headTime - at) * rate)));
  if (guess < 0n) guess = 0n;

  // Bracket: lo has time <= at, hi has time > at.
  let lo = guess;
  let hi = head;
  let step = 1_000n;
  while (lo > 0n && (await chain.blockTime(lo)) > at) {
    hi = lo;
    lo = lo > step ? lo - step : 0n;
    step *= 4n;
  }
  if ((await chain.blockTime(lo)) > at) return null; // the chain starts after `at`
  step = 1_000n;
  for (let probe = lo + step; probe < hi; probe = lo + step) {
    if ((await chain.blockTime(probe)) > at) {
      hi = probe;
      break;
    }
    lo = probe;
    step *= 4n;
  }
  while (hi - lo > 1n) {
    const mid = (lo + hi) / 2n;
    if ((await chain.blockTime(mid)) <= at) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Sums Transfer values over [from, to]. It asks for the whole range first; when the node refuses,
 * it halves the range, and after each success it doubles it again, so one refusal (or a passing
 * error) doesn't make the rest of a long scan crawl. Gives up after too many refusals in a row.
 */
async function transferSumChunked(chain: SnapshotChain, token: Address, owner: Address, dir: "in" | "out", from: bigint, to: bigint): Promise<bigint> {
  const whole = to - from + 1n;
  let total = 0n;
  let span = whole;
  let start = from;
  let refusals = 0;
  /** The smallest range the node has refused: growing back stops below it, so refusals don't repeat. */
  let ceiling = whole + 1n;
  while (start <= to) {
    const end = start + span - 1n > to ? to : start + span - 1n;
    try {
      total += await chain.transferSum(token, owner, dir, start, end);
      start = end + 1n;
      refusals = 0;
      const grown = span * 2n > whole ? whole : span * 2n;
      span = grown < ceiling ? grown : span;
    } catch (err) {
      if (span <= 500n || ++refusals > 12) throw err;
      if (span < ceiling) ceiling = span;
      span /= 2n;
    }
  }
  return total;
}

/** Errors that mean "this node doesn't keep state that old", the only reason to rebuild from transfers. */
const PRUNED = /missing trie node|state (is )?not available|historical state|pruned|header not found|unknown block|archive|state.*(unavailable|too old)|block.*not found/i;
const messageOf = (err: unknown) => (err instanceof Error ? `${err.message} ${(err as { details?: string }).details ?? ""}` : String(err));

export interface SnapshotBalance {
  raw: bigint;
  decimals: number;
  method: "direct" | "transfers";
}

/** A wallet's $ORBIO at the snapshot block: read directly, or rebuilt from today's balance minus transfers since. */
export async function balanceAtSnapshot(chain: SnapshotChain, token: Address, owner: Address, snapshot: bigint): Promise<SnapshotBalance> {
  const decimals = await chain.decimals(token);
  // Read directly at the snapshot block. A node that says it doesn't keep state that old goes
  // straight to the rebuild; any other error (a timeout, a rate limit) gets a second try first.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return { raw: await chain.balanceAt(token, owner, snapshot), decimals, method: "direct" };
    } catch (err) {
      if (PRUNED.test(messageOf(err))) break;
    }
  }
  const now = await chain.headBlock();
  const today = await chain.balanceAt(token, owner, now);
  if (now <= snapshot) return { raw: today, decimals, method: "transfers" };
  const [received, sent] = await Promise.all([
    transferSumChunked(chain, token, owner, "in", snapshot + 1n, now),
    transferSumChunked(chain, token, owner, "out", snapshot + 1n, now),
  ]);
  const raw = today - received + sent;
  // Impossible unless logs were missing: never store a wrong 0 for the whole round.
  if (raw < 0n) throw new Error("The rebuilt balance came out negative (the node returned incomplete logs). Please try again.");
  return { raw, decimals, method: "transfers" };
}

/** Whole tokens (rounded down) and the voting power they give. */
export function powerOf(b: { raw: bigint; decimals: number }): { balance: number; power: number } {
  const whole = b.raw / 10n ** BigInt(b.decimals);
  const balance = whole > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(whole);
  return { balance, power: votingPower(balance) };
}

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

/** The SnapshotChain on a viem public client (reads only). */
export function viemSnapshotChain(client: PublicClient): SnapshotChain {
  const times = new Map<bigint, number>();
  const decimals = new Map<string, number>();
  return {
    headBlock: () => client.getBlockNumber(),
    async blockTime(block) {
      const hit = times.get(block);
      if (hit !== undefined) return hit;
      const t = Number((await client.getBlock({ blockNumber: block })).timestamp);
      times.set(block, t);
      return t;
    },
    balanceAt: (token, owner, block) => client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner], blockNumber: block }),
    async decimals(token) {
      const hit = decimals.get(token);
      if (hit !== undefined) return hit;
      const d = await client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" });
      decimals.set(token, d);
      return d;
    },
    async transferSum(token, owner, dir, from, to) {
      const logs = await client.getLogs({ address: token, event: TRANSFER, args: dir === "in" ? { to: owner } : { from: owner }, fromBlock: from, toBlock: to });
      return logs.reduce((s, l) => s + (l.args.value ?? 0n), 0n);
    },
  };
}
