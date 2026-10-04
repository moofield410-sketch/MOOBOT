import { isAddress } from "viem";
import { CHAIN, ORBIO_API, ORBIO_LINKS } from "@/config";
import { errorMessage, reportError } from "@/lib/monitoring";
import { logoPath } from "@/lib/safe-url";
import type { Address, Hash, Master, OwnedAgent } from "@/lib/types";

/**
 * Orbio public API (https://www.orbio.so/launchpad/docs.md). SERVER-SIDE ONLY: never import
 * this from a client component. Field names below are the real ones returned by the API.
 *
 * Graduation rule (confirmed by the project owner): an agent is a Master when the list shows
 * `price.graduated === true` AND its per-agent record confirms `curve.graduated === true`.
 * If the two disagree, the agent is hidden and the mismatch is logged.
 */

export type Fetcher = (url: string) => Promise<unknown>;

/** A non-2xx answer from Orbio. `status` lets callers tell "not found" (404) from an outage. */
export class OrbioHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Orbio API returned ${status}`);
    this.name = "OrbioHttpError";
    this.status = status;
  }
}

export const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(ORBIO_API.timeoutMs),
  });
  if (!res.ok) throw new OrbioHttpError(res.status);
  return res.json();
};

export interface OrbioAgent {
  agentId: string;
  token: Address;
  name: string | null;
  symbol: string | null;
  /** Token icon URL as Orbio returns it (unchecked; toMaster passes it through safeLogoUrl). */
  logo: string | null;
  owner: Address;
  agentWallet: Address | null;
  launchedAt: string | null;
  launchTx: Hash | null;
  description: string | null;
  /** The agent's X link as it set it on Orbio (socials.twitter), unchecked. */
  twitter: string | null;
  price: { source: string | null; graduated: boolean | null; priceMicroUsd: string | null; marketCapMicroUsd: string | null } | null;
  curve: { graduated: boolean | null; progressBps: number | null } | null;
  /** $CREDIT (6 decimals). Orbio: it accrues for the agent ("owed"); claimAgentCredit sends it to the agent wallet ("claimed"). */
  credit: { mintedAtoms: string | null; owedAtoms: string | null; claimedAtoms: string | null } | null;
  /** In wei of the pair token ($ORBIO, 18 decimals). Only on the per-agent record. */
  stake: { stakedWei: string | null; claimedFeesWei: string | null; protocolFeeWei: string | null } | null;
  /**
   * The converted share of the agent's fees. Orbio: the harvest "sells the converted share for USDG
   * and credits it as the agent's gateway balance", and "one $CREDIT is one dollar of balance".
   * usdgAtoms has 6 decimals, like $CREDIT. Only on the per-agent record.
   */
  converted: { usdgAtoms: string | null } | null;
}

const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);
const addr = (v: unknown) => (typeof v === "string" && isAddress(v) ? (v.toLowerCase() as Address) : null);

/** Validates one agent record. Returns null for records missing required fields. */
export function parseAgent(raw: unknown): OrbioAgent | null {
  const r = obj(raw);
  if (!r) return null;
  const agentId = str(r.agentId);
  const token = addr(r.token);
  const owner = addr(r.owner);
  if (!agentId || !token || !owner) return null;
  const price = obj(r.price);
  const curve = obj(r.curve);
  const credit = obj(r.credit);
  const stake = obj(r.stake);
  const converted = obj(r.converted);
  return {
    agentId,
    token,
    name: str(r.name),
    symbol: str(r.symbol),
    logo: str(r.logo),
    owner,
    agentWallet: addr(r.agentWallet),
    launchedAt: str(r.launchedAt),
    launchTx: (str(r.launchTx) as Hash | null) ?? null,
    description: str(r.description),
    twitter: str(obj(r.socials)?.twitter),
    price: price
      ? { source: str(price.source), graduated: typeof price.graduated === "boolean" ? price.graduated : null, priceMicroUsd: str(price.priceMicroUsd), marketCapMicroUsd: str(price.marketCapMicroUsd) }
      : null,
    curve: curve
      ? { graduated: typeof curve.graduated === "boolean" ? curve.graduated : null, progressBps: typeof curve.progressBps === "number" ? curve.progressBps : null }
      : null,
    credit: credit ? { mintedAtoms: str(credit.mintedAtoms), owedAtoms: str(credit.owedAtoms), claimedAtoms: str(credit.claimedAtoms) } : null,
    stake: stake ? { stakedWei: str(stake.stakedWei), claimedFeesWei: str(stake.claimedFeesWei), protocolFeeWei: str(stake.protocolFeeWei) } : null,
    converted: converted ? { usdgAtoms: str(converted.usdgAtoms) } : null,
  };
}

/** Pages through GET /agents (200 per page). */
export async function fetchAllAgents(fetcher: Fetcher = defaultFetcher, query = ""): Promise<{ agents: OrbioAgent[]; total: number }> {
  const agents: OrbioAgent[] = [];
  let total = 0;
  for (let offset = 0, page = 0; page < 50; page++, offset += ORBIO_API.pageSize) {
    const body = obj(await fetcher(`${ORBIO_API.baseUrl}/agents?limit=${ORBIO_API.pageSize}&offset=${offset}&sort=newest${query}`));
    const data = Array.isArray(body?.data) ? body.data : null;
    if (!data) throw new Error("Orbio API: unexpected agent list shape");
    total = Number(obj(body?.page)?.total ?? data.length);
    for (const raw of data) {
      const a = parseAgent(raw);
      if (a) agents.push(a);
    }
    if (data.length < ORBIO_API.pageSize || offset + data.length >= total) break;
  }
  return { agents, total };
}

export async function fetchAgent(id: string, fetcher: Fetcher = defaultFetcher): Promise<OrbioAgent> {
  const a = parseAgent(await fetcher(`${ORBIO_API.baseUrl}/agents/${encodeURIComponent(id)}`));
  if (!a) throw new Error(`Orbio API: unexpected record for agent ${id}`);
  return a;
}

/**
 * One agent by its token address (Orbio's /agents/{id} accepts a vault ID or a token address).
 * Returns null when Orbio has no such agent (404) or answers for a different token; throws on outages.
 */
export async function fetchAgentByToken(token: Address, fetcher: Fetcher = defaultFetcher): Promise<OrbioAgent | null> {
  let raw: unknown;
  try {
    raw = await fetcher(`${ORBIO_API.baseUrl}/agents/${token}`);
  } catch (err) {
    if (err instanceof OrbioHttpError && err.status === 404) return null;
    throw err;
  }
  const a = parseAgent(raw);
  if (!a) throw new Error(`Orbio API: unexpected record for token ${token}`);
  return a.token === token.toLowerCase() ? a : null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export interface Confirmation {
  confirmed: OrbioAgent[];
  mismatches: { agentId: string; token: Address; curveGraduated: boolean | null }[];
}

/** Applies the confirmed graduation rule to a list of agents. Any failed confirmation request throws. */
export async function confirmGraduated(agents: OrbioAgent[], fetcher: Fetcher = defaultFetcher): Promise<Confirmation> {
  const flagged = agents.filter((a) => a.price?.graduated === true);
  const details = await mapLimit(flagged, ORBIO_API.confirmConcurrency, (a) => fetchAgent(a.agentId, fetcher));
  const confirmed: OrbioAgent[] = [];
  const mismatches: Confirmation["mismatches"] = [];
  flagged.forEach((a, i) => {
    const curveGraduated = details[i].curve?.graduated ?? null;
    if (curveGraduated === true) confirmed.push({ ...a, curve: details[i].curve });
    else {
      mismatches.push({ agentId: a.agentId, token: a.token, curveGraduated });
      reportError(new Error("Orbio graduation mismatch: hidden from Masters"), { agentId: a.agentId, token: a.token, listGraduated: true, curveGraduated });
    }
  });
  return { confirmed, mismatches };
}

const tokenLink = (token: string) => (CHAIN.explorerUrl ? `${CHAIN.explorerUrl}/token/${token}` : null);

export function toMaster(a: OrbioAgent): Master {
  const launchedSec = Number(a.launchedAt);
  const capMicro = a.price?.marketCapMicroUsd ? Number(a.price.marketCapMicroUsd) : NaN;
  return {
    tokenAddress: a.token,
    name: a.name ?? a.symbol ?? "Unnamed agent",
    ticker: a.symbol ?? "n/a",
    ownerWallet: a.owner,
    agentWallet: a.agentWallet,
    orbioAgentId: a.agentId,
    launchedAt: Number.isFinite(launchedSec) && launchedSec > 0 ? new Date(launchedSec * 1000).toISOString() : null,
    launchTx: a.launchTx,
    graduatedAt: null,
    gradTx: null,
    gradBlock: null,
    marketCapUsd: Number.isFinite(capMicro) ? capMicro / 1e6 : null,
    liquidityUsd: null,
    holderCount: null,
    explorerUrl: tokenLink(a.token),
    orbioUrl: ORBIO_LINKS.dashboard,
    logoUrl: logoPath(a.token, a.logo),
    contactRoute: null,
    openToPitches: false,
    description: a.description,
    category: null,
    isMock: false,
  };
}

/** Orbio-wide totals from GET /agents/analytics. null means Orbio returned no value (n/a, never 0). */
export interface OrbioTotals {
  agents: number | null;
  /** Every agent's market cap added up (micro-USD). */
  marketCapMicroUsd: string | null;
  /** $ORBIO price (micro-USD). */
  orbioMicroUsd: string | null;
  /** $ORBIO wei (18 decimals). */
  stakedWei: string | null;
  creatorFeesWei: string | null;
  /** USDG atoms (6 decimals): the converted share credited to agents as gateway balance. */
  convertedUsdgAtoms: string | null;
  /** $CREDIT atoms (6 decimals). Orbio's field is creditEarnedAtoms; the site says "accrued". */
  creditAccruedAtoms: string | null;
  creditClaimedAtoms: string | null;
  /** New agents per UTC day, oldest first (Orbio sends the last 30 days). */
  launchesByDay: { day: string; launches: number }[];
}

export function parseAnalytics(raw: unknown): OrbioTotals {
  const r = obj(raw);
  const t = obj(r?.totals);
  if (!r || !t) throw new Error("Orbio API: unexpected analytics shape");
  // Orbio sends the count as a string here ("1152"); null or junk stays null, never 0.
  const agents = /^\d+$/.test(String(t.agents ?? "")) ? Number(t.agents) : null;
  const days = Array.isArray(r.days) ? r.days : [];
  return {
    agents,
    marketCapMicroUsd: str(r.marketCapMicroUsd),
    orbioMicroUsd: str(r.orbioMicroUsd),
    stakedWei: str(t.stakedWei),
    creatorFeesWei: str(t.creatorFeesWei),
    convertedUsdgAtoms: str(t.convertedUsdgAtoms),
    creditAccruedAtoms: str(t.creditEarnedAtoms),
    creditClaimedAtoms: str(t.creditClaimedAtoms),
    launchesByDay: days.flatMap((d) => {
      const o = obj(d);
      const day = str(o?.day);
      return day && /^\d{4}-\d{2}-\d{2}$/.test(day) && typeof o?.launches === "number" ? [{ day, launches: o.launches }] : [];
    }),
  };
}

export async function fetchAnalytics(fetcher: Fetcher = defaultFetcher): Promise<OrbioTotals> {
  return parseAnalytics(await fetcher(`${ORBIO_API.baseUrl}/agents/analytics`));
}

export const CHART_RANGES = ["1h", "4h", "1d"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

/** One agent's price history from GET /agents/{id}/chart. Orbio samples it every minute, with no backfill. */
export interface PriceChart {
  range: ChartRange;
  /** When Orbio started recording this agent's price (ISO), or null if it hasn't yet. */
  trackedSince: string | null;
  /** Oldest first. Points without a price are dropped. */
  points: { at: string; priceMicroUsd: string; marketCapMicroUsd: string | null }[];
}

export function parseChart(raw: unknown, range: ChartRange): PriceChart {
  const r = obj(raw);
  if (!r || !Array.isArray(r.points)) throw new Error("Orbio API: unexpected chart shape");
  const points = r.points
    .flatMap((p) => {
      const o = obj(p);
      const at = str(o?.at);
      const price = str(o?.priceMicroUsd);
      return at && price && Number.isFinite(Date.parse(at)) && /^\d+$/.test(price) ? [{ at, priceMicroUsd: price, marketCapMicroUsd: str(o?.marketCapMicroUsd) }] : [];
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return { range, trackedSince: str(r.trackedSince), points };
}

export async function fetchAgentChart(token: Address, range: ChartRange, fetcher: Fetcher = defaultFetcher): Promise<PriceChart> {
  return parseChart(await fetcher(`${ORBIO_API.baseUrl}/agents/${token}/chart?range=${range}`), range);
}

/** Last fetch details, shown on the Status page. */
export interface OrbioFetchState {
  lastFetchAt: string | null;
  agentsTotal: number | null;
  graduated: number | null;
  hiddenMismatches: number;
  lastError: string | null;
}

const g = globalThis as unknown as { __moobotOrbio?: OrbioFetchState };
export function orbioFetchState(): OrbioFetchState {
  return (g.__moobotOrbio ??= { lastFetchAt: null, agentsTotal: null, graduated: null, hiddenMismatches: 0, lastError: null });
}

/** All graduated agents as Masters, applying the confirmed rule. */
export async function fetchGraduatedMasters(fetcher: Fetcher = defaultFetcher): Promise<{ masters: Master[]; total: number; mismatches: number }> {
  const state = orbioFetchState();
  try {
    const { agents, total } = await fetchAllAgents(fetcher);
    const { confirmed, mismatches } = await confirmGraduated(agents, fetcher);
    Object.assign(state, {
      lastFetchAt: new Date().toISOString(),
      agentsTotal: total,
      graduated: confirmed.length,
      hiddenMismatches: mismatches.length,
      lastError: null,
    });
    return { masters: confirmed.map(toMaster), total, mismatches: mismatches.length };
  } catch (err) {
    state.lastError = errorMessage(err);
    throw err;
  }
}

/** Launchpad agents owned or operated by a wallet (Orbio's `wallet` filter), with graduation confirmed. */
/** Orbio agents a wallet owns or operates (Orbio's `wallet` filter matches the owner or the agent wallet). */
export async function fetchOrbioAgentsByWallet(wallet: Address, fetcher: Fetcher = defaultFetcher): Promise<OrbioAgent[]> {
  const body = obj(await fetcher(`${ORBIO_API.baseUrl}/agents?wallet=${wallet}&limit=${ORBIO_API.pageSize}`));
  if (!Array.isArray(body?.data)) throw new Error("Orbio API: unexpected agent list shape");
  // The Tournament also checks owner/agentWallet itself before accepting a pitch (lib/tournament/service.ts).
  return body.data.map(parseAgent).filter((a): a is OrbioAgent => a !== null);
}

export async function fetchAgentsByWallet(wallet: Address, fetcher: Fetcher = defaultFetcher): Promise<OwnedAgent[]> {
  const agents = await fetchOrbioAgentsByWallet(wallet, fetcher);
  const { confirmed } = await confirmGraduated(agents, fetcher);
  const graduated = new Set(confirmed.map((a) => a.agentId));
  return agents.map((a) => ({
    agentId: a.agentId,
    name: a.name ?? a.symbol ?? "Unnamed agent",
    ticker: a.symbol ?? "n/a",
    tokenAddress: a.token,
    graduated: graduated.has(a.agentId),
    explorerUrl: tokenLink(a.token),
    logoUrl: logoPath(a.token, a.logo),
  }));
}
