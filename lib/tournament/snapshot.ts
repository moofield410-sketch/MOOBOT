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
  if (headTime < at) return null;
  if (headTime === at) return head;

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

/** Sums Transfer values over [from, to], halving the range when the node refuses a big one. */
async function transferSumChunked(chain: SnapshotChain, token: Address, owner: Address, dir: "in" | "out", from: bigint, to: bigint): Promise<bigint> {
  let total = 0n;
  let span = to - from + 1n;
  let start = from;
  while (start <= to) {
    const end = start + span - 1n > to ? to : start + span - 1n;
    try {
      total += await chain.transferSum(token, owner, dir, start, end);
      start = end + 1n;
    } catch (err) {
      if (span <= 2_000n) throw err;
      span /= 2n;
    }
  }
  return total;
}

export interface SnapshotBalance {
  raw: bigint;
  decimals: number;
  method: "direct" | "transfers";
}

/** A wallet's $ORBIO at the snapshot block: read directly, or rebuilt from today's balance minus transfers since. */
export async function balanceAtSnapshot(chain: SnapshotChain, token: Address, owner: Address, snapshot: bigint): Promise<SnapshotBalance> {
  const decimals = await chain.decimals(token);
  try {
    return { raw: await chain.balanceAt(token, owner, snapshot), decimals, method: "direct" };
  } catch {
    // The node no longer keeps state that old: rebuild it.
  }
  const now = await chain.headBlock();
  const today = await chain.balanceAt(token, owner, now);
  if (now <= snapshot) return { raw: today, decimals, method: "transfers" };
  const [received, sent] = await Promise.all([
    transferSumChunked(chain, token, owner, "in", snapshot + 1n, now),
    transferSumChunked(chain, token, owner, "out", snapshot + 1n, now),
  ]);
  const raw = today - received + sent;
  return { raw: raw < 0n ? 0n : raw, decimals, method: "transfers" };
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
