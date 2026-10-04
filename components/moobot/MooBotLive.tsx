"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import { MooBotMascot } from "@/components/MooBotMascot";
import { useMooBot } from "@/components/moobot/useMooBot";
import { CopyButton } from "@/components/ui/CopyButton";
import { NotAvailable } from "@/components/ui/NotAvailable";
import { REWARDS } from "@/config";
import type { MooBotAgent, MooBotState } from "@/lib/moobot";
import { formatMicroUsd, formatUpdated } from "@/lib/format";
import { NA_REASONS } from "@/lib/na-reasons";
import { formatCredits } from "@/lib/rewards";

const VERIFY_HREF = "/docs/safety#how-to-verify-the-official-moobot-contract";

/** What switches on by itself the moment the contract is confirmed on Orbio. */
const SYSTEMS = ["Official contract", "Price and market cap", "Graduation tracker", "Field Fund $CREDIT", "Wallet balance and holder aura"];

const na = <NotAvailable reason={NA_REASONS.orbioNull} />;
const usd = (micro: string | null) => (micro === null ? na : formatMicroUsd(micro));
const credit = (atoms: string | null) => (atoms === null ? na : formatCredits(atoms));
const orbio = (wei: string | null) =>
  wei === null ? na : Number(formatUnits(BigInt(wei), 18)).toLocaleString("en-US", { maximumFractionDigits: 0 });

type Phase = "pre" | "curve" | "graduated";

function phaseOf(m: MooBotState): Phase {
  if (m.status !== "verified") return "pre";
  return m.agent.graduated ? "graduated" : "curve";
}

const PHASE_BADGE: Record<Phase, { label: string; className: string }> = {
  pre: { label: "Not launched yet", className: "border-line-strong bg-oat text-soil/80" },
  curve: { label: "Live on the bonding curve", className: "border-sky/30 bg-sky/10 text-sky" },
  graduated: { label: "Graduated on Orbio", className: "border-sun/50 bg-sun/15 text-wheat" },
};

function Tile({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-hay/40 p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-fern">{label}</p>
      <div className="mt-2 break-words font-mono text-lg font-semibold tabular-nums text-soil sm:text-2xl">{children}</div>
      {hint && <div className="mt-1.5 text-xs text-fern">{hint}</div>}
    </div>
  );
}

function Graduation({ agent }: { agent: MooBotAgent | null }) {
  const graduated = agent?.graduated === true;
  const pct = agent?.curveProgressBps == null ? null : Math.min(100, agent.curveProgressBps / 100);
  const fill = graduated ? 100 : (pct ?? 0);
  return (
    <>
      {agent === null ? "–" : graduated ? "100%" : pct === null ? na : `${pct.toFixed(1)}%`}
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fill}
        aria-label="$MOOBOT bonding-curve progress to graduation"
      >
        <div className={`h-full rounded-full ${graduated ? "bg-sun" : "bg-chart"} transition-[width] duration-700`} style={{ width: `${fill}%` }} />
      </div>
    </>
  );
}

/**
 * $MOOBOT Live: the home page's launch dashboard. Before launch it lists what will switch on; once
 * MOOBOT_TOKEN_ADDRESS is set and confirmed on Orbio (lib/moobot.ts), every figure fills in by
 * itself and refreshes each minute. Every number is Orbio's; n/a when Orbio has none.
 */
export function MooBotLive({ initial }: { initial: MooBotState }) {
  const { data } = useMooBot(initial);
  const m = data ?? initial;
  const phase = phaseOf(m);
  const agent = m.status === "verified" ? m.agent : null;
  const badge = PHASE_BADGE[phase];

  return (
    <section aria-labelledby="moobot-live" className="card relative overflow-hidden p-6 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-center gap-4">
          <MooBotMascot variant="head" size={56} state={phase === "pre" ? "sleeping" : "happy"} decorative className="shrink-0" />
          <div>
            <p className="eyebrow mb-1.5">$MOOBOT Live</p>
            <h2 id="moobot-live" className="font-display text-2xl font-semibold text-soil sm:text-3xl">
              {agent?.name ? `${agent.name} on Orbio` : "MooBot on Orbio"}
            </h2>
          </div>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${badge.className}`}>
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${phase === "pre" ? "bg-soil/40" : phase === "curve" ? "bg-sky" : "bg-sun"}`} />
            {badge.label}
          </span>
          {m.status === "verified" && (
            <span className="font-mono text-[11px] text-fern">
              {formatUpdated(m.checkedAt)} · refreshes every minute{m.stale && " · Orbio is slow, showing the last good figures"}
            </span>
          )}
        </div>
      </header>

      {phase === "graduated" && (
        <p className="mt-5 rounded-2xl border border-sun/40 bg-sun/10 px-4 py-3 text-sm text-soil">
          MooBot completed its bonding curve and graduated on Orbio. It now trades as a Master.
        </p>
      )}

      <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile label="Price">{agent ? usd(agent.priceMicroUsd) : "–"}</Tile>
        <Tile label="Market cap">{agent ? usd(agent.marketCapMicroUsd) : "–"}</Tile>
        <Tile label={phase === "graduated" ? "Graduated" : "Graduation progress"}>
          <Graduation agent={agent} />
        </Tile>
        <Tile
          label="Field Fund received"
          hint={
            agent ? (
              <>
                {agent.creditOwedAtoms !== null && BigInt(agent.creditOwedAtoms) > 0n
                  ? `+${formatCredits(agent.creditOwedAtoms)} accrued, not yet claimed`
                  : `${REWARDS.treasuryPct}% goes to the treasury`}
              </>
            ) : (
              "$CREDIT received by the MooBot agent"
            )
          }
        >
          {agent ? credit(agent.creditClaimedAtoms) : "–"}
        </Tile>
      </div>

      <div className="mt-6 grid gap-6 border-t border-line pt-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-fern">Official $MOOBOT contract</p>
          {m.status === "verified" ? (
            <>
              <p className="mt-2 break-all font-mono text-sm text-soil sm:text-base">{m.address}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <CopyButton text={m.address} />
                {m.explorerUrl && (
                  <a href={m.explorerUrl} target="_blank" rel="noopener noreferrer" className="tap link text-sm">
                    View on explorer
                  </a>
                )}
                <Link href={VERIFY_HREF} className="tap link text-sm">
                  How to verify
                </Link>
              </div>
              <p className="mt-2 text-xs text-fern">Confirmed on Orbio (agent #{m.agent.agentId}). Ignore any other address.</p>
            </>
          ) : (
            <>
              <p className="mt-2 font-display text-lg font-semibold text-soil">Not launched yet</p>
              <p className="mt-1 max-w-lg text-sm text-fern">
                The address appears here the moment it is confirmed on Orbio. Until then, ignore any address claiming to be $MOOBOT.{" "}
                <Link href={VERIFY_HREF} className="link">
                  How to verify
                </Link>
              </p>
            </>
          )}
        </div>

        {agent ? (
          <dl className="grid grid-cols-2 gap-4 self-start text-sm">
            <div>
              <dt className="text-fern">$ORBIO staked</dt>
              <dd className="mt-0.5 font-mono font-semibold tabular-nums text-soil">{orbio(agent.stakedWei)}</dd>
            </div>
            <div>
              <dt className="text-fern">Creator fees claimed</dt>
              <dd className="mt-0.5 font-mono font-semibold tabular-nums text-soil">{orbio(agent.claimedFeesWei)}</dd>
            </div>
            <div className="col-span-2">
              <Link href="/credits" className="link">
                Full Field Fund and agent figures
              </Link>
            </div>
          </dl>
        ) : (
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-fern">Switches on at launch</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {SYSTEMS.map((s) => (
                <li key={s} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-milk px-3 py-1 text-xs text-soil/80">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full border border-soil/40" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
