import { cookies } from "next/headers";
import { isAddress } from "viem";
import { SESSION_COOKIE, sessionSecret, verifySessionToken } from "@/lib/auth/session";
import { errorMessage } from "@/lib/monitoring";
import { logoPath } from "@/lib/safe-url";
import { currentRound } from "@/lib/rounds";
import { TournamentError } from "@/lib/tournament/rules";
import { allow, clientIp } from "@/lib/rate-limit";
import { defaultDeps, ledger, powerFor, powerKnown } from "@/lib/tournament/service";
import { readRound } from "@/lib/tournament/store";
import type { Address } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const same = (a: string | null | undefined, b: string) => Boolean(a && a.toLowerCase() === b);

/** Fresh voting-power reads (chain reads) one connection may trigger per window. */
const FRESH_POWER_READS = 12;
const FRESH_POWER_WINDOW_MS = 10 * 60_000;

/**
 * What one wallet can do in the running round: its voting power at the snapshot block, its vote,
 * the Orbio agents it can pitch for, the Masters it can score and post tenders for, whether it
 * moderates, and its rewards ledger. Read-only: takes an address, never a signature.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("address");
  if (!raw || !isAddress(raw)) return Response.json({ error: "Invalid address" }, { status: 400 });
  const address = raw.toLowerCase() as Address;
  const deps = defaultDeps;
  const round = currentRound(deps.now(), deps.timeline());

  const secret = sessionSecret();
  const session = secret ? verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value, secret) : null;
  const isModerator = same(session, address) && deps.moderators().includes(address);

  const settle = async <T,>(p: Promise<T>): Promise<{ value: T | null; error: string | null }> => {
    try {
      return { value: await p, error: null };
    } catch (err) {
      return { value: null, error: err instanceof TournamentError ? err.message : `Couldn't check right now: ${errorMessage(err)}` };
    }
  };

  const live = round.status === "live";
  // A first power read costs chain reads; a known one costs nothing. Fresh reads are limited per
  // connection (a voter needs one or two), unless the wallet is signed in as itself.
  const fresh = live && !(await powerKnown(round.number, address));
  const tooMany = fresh && !same(session, address) && !allow(`power:${clientIp(req)}`, FRESH_POWER_READS, FRESH_POWER_WINDOW_MS);
  const [doc, power, agents, masters, entries] = await Promise.all([
    live ? readRound(round.number) : Promise.resolve(null),
    !live
      ? Promise.resolve({ value: null, error: null })
      : tooMany
        ? Promise.resolve({ value: null, error: "Too many wallets checked from your connection. Please wait a few minutes and reload." })
        : settle(powerFor(deps, address)),
    settle(deps.agentsOf(address)),
    settle(deps.masters()),
    settle(ledger(address, deps)),
  ]);

  const hidden = new Set(doc?.hidden.map((h) => h.pitchId) ?? []);
  const vote = doc?.votes.find((v) => v.wallet === address) ?? null;
  const owned = (masters.value ?? []).filter((m) => same(m.ownerWallet, address) || same(m.agentWallet, address));

  return Response.json(
    {
      address,
      round,
      isModerator,
      power: power.value ? { balance: power.value.balance, power: power.value.power, block: power.value.block, method: power.value.method } : null,
      powerError: power.error,
      vote: vote ? { pitchId: vote.pitchId, power: vote.power, castAt: vote.castAt } : null,
      agents: agents.value?.filter((a) => same(a.owner, address) || same(a.agentWallet, address)).map((a) => {
        const pitch = doc?.pitches.find((p) => p.agentId === a.agentId);
        return {
          agentId: a.agentId,
          name: a.name ?? a.symbol ?? `Agent #${a.agentId}`,
          ticker: a.symbol,
          token: a.token,
          logoUrl: logoPath(a.token, a.logo),
          pitchId: pitch ? pitch.id : null,
          pitchHidden: pitch ? hidden.has(pitch.id) : false,
        };
      }) ?? null,
      agentsError: agents.error,
      masters: owned.map((m) => ({
        token: m.tokenAddress,
        name: m.name,
        agentId: m.orbioAgentId,
        scored: doc?.scores.filter((s) => same(s.masterToken, m.tokenAddress)).map((s) => s.pitchId) ?? [],
      })),
      mastersError: masters.error,
      ledger: entries.value ?? [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
