import { CACHE, REWARDS, USE_MOCK_DATA } from "@/config";
import { cached } from "@/lib/cache";
import { recordFieldFundTotal } from "@/lib/field-fund-history";
import { getMooBot } from "@/lib/moobot";
import { credits, roundPool, splitReceived } from "@/lib/rewards";
import { SAMPLE_TOTAL_CREDITS } from "@/lib/sample/credits";
import type { CreditStats, DataEnvelope, TreasuryState } from "@/lib/types";

/**
 * Orbio $CREDIT received by the MooBot agent and its 20/80 split.
 * Preview mode: sample data. Real mode: the verified MooBot agent's Orbio record. "Received" is
 * credit.claimedAtoms: Orbio documents that claimAgentCredit sends accrued $CREDIT to the agent
 * wallet. "Unavailable" until $MOOBOT is verified (lib/moobot.ts). Numbers are never invented.
 */
async function receivedAtoms(): Promise<{ value: bigint; waiting: string | null; source: "mock" | "orbio" } | null> {
  if (USE_MOCK_DATA) return { value: credits(SAMPLE_TOTAL_CREDITS), waiting: null, source: "mock" };
  const moobot = await getMooBot();
  if (moobot.status !== "verified") return null;
  const claimed = moobot.agent.creditClaimedAtoms;
  if (!claimed) return null;
  // Each fresh read also feeds the automatic daily history (lib/field-fund-history.ts).
  await recordFieldFundTotal(BigInt(claimed));
  return { value: BigInt(claimed), waiting: moobot.agent.creditOwedAtoms, source: "orbio" };
}

/** For the scheduled refresh: records today's total even when nobody visits. Never throws. */
export async function recordFieldFund(): Promise<"recorded" | "not-launched"> {
  if (USE_MOCK_DATA) return "not-launched";
  const moobot = await getMooBot();
  const claimed = moobot.status === "verified" ? moobot.agent.creditClaimedAtoms : null;
  if (!claimed) return "not-launched";
  await recordFieldFundTotal(BigInt(claimed));
  return "recorded";
}

export async function getCredits(): Promise<DataEnvelope<CreditStats>> {
  return cached<CreditStats | null>("credits", { ttlMs: CACHE.creditsTtlMs, staleMs: CACHE.creditsStaleMs }, async () => {
    const received = await receivedAtoms();
    if (!received) return { value: null, source: "unavailable" };
    const split = splitReceived(received.value);
    return {
      value: {
        receivedAtoms: received.value.toString(),
        waitingAtoms: received.waiting,
        agentOpsAtoms: split.agentOps.toString(),
        treasuryAtoms: split.treasury.toString(),
      },
      source: received.source,
    };
  }) as Promise<DataEnvelope<CreditStats>>;
}

/**
 * Treasury balance and this round's pool. While rewards are displayed (not paid), the treasury
 * is the 80% share of all $CREDIT received. Real mode needs a treasury ledger, so it is
 * "unavailable" until the MooBot agent exists.
 */
export async function getTreasury(): Promise<DataEnvelope<TreasuryState>> {
  const env = await getCredits();
  if (!env.data) return { data: null, source: "unavailable", updatedAt: env.updatedAt, stale: env.stale, error: env.error };
  const treasury = BigInt(env.data.treasuryAtoms);
  const pool = roundPool(treasury);
  const share = (treasury * BigInt(REWARDS.roundPoolPctOfTreasury * 100)) / 10_000n;
  return {
    ...env,
    data: {
      treasuryAtoms: treasury.toString(),
      poolShareAtoms: share.toString(),
      capAtoms: REWARDS.roundPoolCapCredits === null ? null : credits(REWARDS.roundPoolCapCredits).toString(),
      poolAtoms: pool === null ? null : pool.toString(),
    },
  };
}
