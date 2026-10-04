import { getAddress } from "viem";
import { CHAIN, HOLDER_AURA_TIERS, MOOBOT_TOKEN, ORBIO_API } from "@/config";
import { cached } from "@/lib/cache";
import { reportError } from "@/lib/monitoring";
import {
  defaultFetcher,
  fetchAgentByToken,
  fetchAgentChart,
  type ChartRange,
  type Fetcher,
  type OrbioAgent,
  type PriceChart,
} from "@/lib/sources/orbio-api";
import type { Address } from "@/lib/types";

/**
 * The $MOOBOT launch switch. SERVER-SIDE ONLY (it reads the environment and calls Orbio).
 * Every $MOOBOT feature (contract card, wallet balance, holder aura, MooBot agent figures) is on
 * only when getMooBot() returns status "verified". Anything else means "not launched" to visitors,
 * and the Status page shows why.
 */

export type AddressCheck = { ok: true; address: Address } | { ok: false; reason: string };

/**
 * Format and checksum. An all-lowercase (or all-uppercase) address carries no checksum and is
 * accepted; a mixed-case one must match its EIP-55 checksum exactly, which catches typos.
 */
export function checkTokenAddress(input: string): AddressCheck {
  const s = input.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) return { ok: false, reason: "It is not a 0x address with 40 hex characters." };
  const checksummed = getAddress(s.toLowerCase()) as Address;
  const hex = s.slice(2);
  const hasChecksum = hex !== hex.toLowerCase() && hex !== hex.toUpperCase();
  if (hasChecksum && s !== checksummed) return { ok: false, reason: "Its checksum does not match, so it probably has a typo." };
  return { ok: true, address: checksummed };
}

/** The raw setting, read at call time so a redeploy with a new value takes effect. */
export function moobotTokenSetting(): string | null {
  const v = process.env[MOOBOT_TOKEN.env]?.trim();
  return v ? v : null;
}

/** The MooBot agent's figures from Orbio. null means Orbio returned no value (shown as n/a, never 0). */
export interface MooBotAgent {
  agentId: string;
  name: string | null;
  symbol: string | null;
  /** Micro-USD (6 decimals), as Orbio prices it. */
  priceMicroUsd: string | null;
  marketCapMicroUsd: string | null;
  /** Bonding-curve progress to graduation, in basis points (10000 = graduated). */
  curveProgressBps: number | null;
  graduated: boolean | null;
  /** $ORBIO wei (18 decimals). */
  stakedWei: string | null;
  claimedFeesWei: string | null;
  protocolFeeWei: string | null;
  /** $CREDIT atoms (6 decimals). */
  creditOwedAtoms: string | null;
  creditClaimedAtoms: string | null;
  creditMintedAtoms: string | null;
}

export type MooBotState =
  | { status: "not-launched" }
  | { status: "invalid"; reason: string }
  | { status: "not-found"; address: Address }
  | { status: "unverified"; address: Address; error: string }
  | { status: "verified"; address: Address; explorerUrl: string | null; agent: MooBotAgent; checkedAt: string | null; stale: boolean };

export const explorerTokenUrl = (address: Address) => (CHAIN.explorerUrl ? `${CHAIN.explorerUrl}/token/${address}` : null);

function toMooBotAgent(a: OrbioAgent): MooBotAgent {
  return {
    agentId: a.agentId,
    name: a.name,
    symbol: a.symbol,
    priceMicroUsd: a.price?.priceMicroUsd ?? null,
    marketCapMicroUsd: a.price?.marketCapMicroUsd ?? null,
    curveProgressBps: a.curve?.progressBps ?? null,
    graduated: a.curve?.graduated ?? a.price?.graduated ?? null,
    stakedWei: a.stake?.stakedWei ?? null,
    claimedFeesWei: a.stake?.claimedFeesWei ?? null,
    protocolFeeWei: a.stake?.protocolFeeWei ?? null,
    creditOwedAtoms: a.credit?.owedAtoms ?? null,
    creditClaimedAtoms: a.credit?.claimedAtoms ?? null,
    creditMintedAtoms: a.credit?.mintedAtoms ?? null,
  };
}

/**
 * Checks the setting, then confirms the token exists on the Orbio API (cached). If Orbio is
 * unreachable, the last good answer is kept (flagged stale); with no earlier answer it stays off.
 */
export async function getMooBot(fetcher: Fetcher = defaultFetcher, now?: () => number): Promise<MooBotState> {
  const setting = moobotTokenSetting();
  if (setting === null) return { status: "not-launched" };

  const check = checkTokenAddress(setting);
  if (!check.ok) return { status: "invalid", reason: check.reason };
  const address = check.address;

  const env = await cached<MooBotAgent | "not-found">(
    `moobot:${address}`,
    { ttlMs: MOOBOT_TOKEN.verifyTtlMs, staleMs: MOOBOT_TOKEN.verifyStaleMs, now },
    async () => {
      const agent = await fetchAgentByToken(address.toLowerCase() as Address, fetcher);
      if (!agent) reportError(new Error("$MOOBOT token not found on Orbio: $MOOBOT features stay off"), { address });
      return { value: agent ? toMooBotAgent(agent) : "not-found", source: "orbio" };
    },
  );

  if (env.data === null) return { status: "unverified", address, error: env.error ?? "Orbio could not be reached" };
  if (env.data === "not-found") return { status: "not-found", address };
  return { status: "verified", address, explorerUrl: explorerTokenUrl(address), agent: env.data, checkedAt: env.updatedAt, stale: env.stale };
}

export type MooBotChartState =
  | { status: "off" }
  | { status: "unavailable"; range: ChartRange }
  | { status: "ok"; chart: PriceChart; checkedAt: string | null; stale: boolean };

/**
 * The $MOOBOT price chart. Off until the contract is verified (same switch as everything else),
 * then Orbio's minute-by-minute price for the chosen range, cached for everyone.
 */
export async function getMooBotChart(range: ChartRange, fetcher: Fetcher = defaultFetcher, now?: () => number): Promise<MooBotChartState> {
  const m = await getMooBot(fetcher, now);
  if (m.status !== "verified") return { status: "off" };
  const env = await cached<PriceChart>(
    `moobot-chart:${m.address}:${range}`,
    { ttlMs: ORBIO_API.chartTtlMs, staleMs: ORBIO_API.chartStaleMs, now },
    async () => ({ value: await fetchAgentChart(m.address.toLowerCase() as Address, range, fetcher), source: "orbio" }),
  );
  if (env.data === null) return { status: "unavailable", range };
  return { status: "ok", chart: env.data, checkedAt: env.updatedAt, stale: env.stale };
}

/** The holder aura tier for a raw $MOOBOT balance, or null below the first tier. Cosmetic only. */
export function auraTier(raw: bigint, decimals: number): (typeof HOLDER_AURA_TIERS)[number] | null {
  const unit = 10n ** BigInt(decimals);
  let tier: (typeof HOLDER_AURA_TIERS)[number] | null = null;
  for (const t of HOLDER_AURA_TIERS) if (raw >= BigInt(t.minMooBot) * unit) tier = t;
  return tier;
}
