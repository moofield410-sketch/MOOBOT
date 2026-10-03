"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useSchedule } from "@/components/ScheduleProvider";
import { MasterAvatar } from "@/components/MasterCard";
import { Card, EmptyState, StaleNotice } from "@/components/ui/Card";
import { LockGate } from "@/components/ui/LockGate";
import { NotAvailable } from "@/components/ui/NotAvailable";
import { MOOBOT_NOT_LAUNCHED, NA_REASONS } from "@/lib/na-reasons";
import { useWalletBalances } from "@/components/wallet/useWalletBalances";
import { StatRow, StatTile } from "@/components/ui/Stats";
import { CopyButton } from "@/components/ui/CopyButton";
import { ConnectOptions } from "@/components/wallet/WalletMenu";
import { useSession } from "@/components/wallet/useSession";
import { AUTH, CHAIN, HOLDER_AURA_TIERS, VOTING } from "@/config";
import { formatUpdated, formatUtcDateTime } from "@/lib/format";
import type { DataEnvelope, OwnedAgent, TokenBalance, WalletBalances } from "@/lib/types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

function naReason(b: TokenBalance | undefined): string {
  if (b?.status === "error") return "Couldn't read this balance right now.";
  if (b?.status === "unverified") return NA_REASONS.moobotUnverified;
  return NA_REASONS.rpcMissing;
}

function balanceText(b: TokenBalance | undefined): React.ReactNode {
  if (b?.status === "not-launched") return <span className="text-lg text-soil/80">{MOOBOT_NOT_LAUNCHED}</span>;
  if (!b || b.status !== "ok" || b.formatted === null) return <NotAvailable reason={naReason(b)} />;
  return Number(b.formatted).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Holder aura: cosmetic only. Needs a verified $MOOBOT contract and a readable balance. */
function auraText(b: WalletBalances | null): React.ReactNode {
  if (!b) return "…";
  if (b.moobot.status === "not-launched") return <span className="text-lg text-soil/80">{MOOBOT_NOT_LAUNCHED}</span>;
  if (b.moobot.status !== "ok") return <NotAvailable reason={naReason(b.moobot)} />;
  return b.aura ?? <span className="text-lg text-soil/80">No aura yet</span>;
}

export function WalletDashboard({ preview }: { preview: boolean }) {
  const { address, isConnected, chainId } = useAccount();
  const { signedIn, busy, error, signIn } = useSession();
  const { synced, timeline, now } = useSchedule();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const balances = useWalletBalances(address);
  const agents = useQuery({
    queryKey: ["wallet-agents", address],
    queryFn: () => getJson<DataEnvelope<OwnedAgent[]>>(`/api/wallet/${address}/agents`),
    enabled: Boolean(address),
  });

  if (!mounted || !isConnected || !address) {
    return (
      <Card title="Connect your wallet" className="max-w-md">
        <p className="mb-4 text-sm text-soil/80">See your $ORBIO balance, your $MOOBOT balance once it launches, your launchpad tokens and whether you meet the voting minimum.</p>
        <ConnectOptions />
      </Card>
    );
  }

  const b = balances.data?.data ?? null;
  const explorer = CHAIN.explorerUrl ? `${CHAIN.explorerUrl}/address/${address}` : null;
  const snapshotAt = timeline?.fullUnlockAt ?? null;
  const snapshotTaken = synced && snapshotAt !== null && now >= snapshotAt;
  const meets = b?.meetsVotingMinimum ?? null;

  return (
    <div className="space-y-6">
      {preview && (
        <p className="rounded-xl border border-line-strong bg-oat px-4 py-3 text-sm text-soil">
          <span className="font-semibold text-grass">Preview mode:</span> balances and tokens below are sample data, not your real balances.
        </p>
      )}

      <Card title="Your wallet">
        <p className="break-all font-mono text-sm text-soil">{address}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <CopyButton text={address} />
          {explorer && (
            <a href={explorer} target="_blank" rel="noopener noreferrer" className="link">
              View on explorer
            </a>
          )}
          {chainId !== undefined && chainId !== CHAIN.id && (
            <span className="text-soil/75">Your wallet is on another network. That&apos;s fine: balances are read from {CHAIN.name}.</span>
          )}
        </div>
        <div className="mt-5 border-t border-line pt-4">
          {signedIn ? (
            <p className="text-sm text-soil">
              <span className="font-semibold text-grass">Signed in.</span> You signed a free message to prove you own this wallet.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={signIn} disabled={busy} className="btn-primary">
                {busy ? "Check your wallet…" : "Sign in"}
              </button>
              <p className="text-xs text-soil/70">{AUTH.safetyLine}</p>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-moss">
              {error}
            </p>
          )}
        </div>
      </Card>

      {balances.data?.stale && <StaleNotice error={balances.data.error} />}
      <section aria-label="Balances" className="grid gap-4 sm:grid-cols-3">
        <StatTile label="$ORBIO balance" value={balances.isLoading ? "…" : balanceText(b?.orbio)} />
        <StatTile label="$MOOBOT balance" value={balances.isLoading ? "…" : balanceText(b?.moobot)} />
        <StatTile
          label="Holder aura"
          value={balances.isLoading ? "…" : auraText(b)}
          hint={`Cosmetic only. Tiers from ${HOLDER_AURA_TIERS[0].minMooBot.toLocaleString("en-US")} $MOOBOT; no effect on voting or rewards.`}
        />
      </section>
      {balances.isError && <p className="text-sm text-moss">We couldn&apos;t load your balances. Please try again shortly.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Voting eligibility" meta={balances.data ? { updatedAt: balances.data.updatedAt, stale: balances.data.stale } : undefined}>
          <dl>
            <StatRow label="Minimum" value={`${VOTING.minOrbio.toLocaleString("en-US")} $ORBIO at the snapshot`} />
            <StatRow
              label="Round 1 snapshot"
              value={snapshotAt === null ? "…" : snapshotTaken ? "Snapshot block: n/a" : `Taken at ${formatUtcDateTime(snapshotAt)}`}
            />
            <StatRow
              label="Your current balance"
              value={meets === null ? <NotAvailable reason={naReason(b?.orbio)} /> : meets ? "Meets the minimum" : "Below the minimum"}
            />
          </dl>
          <p className="mt-4 text-sm text-soil/80">
            {snapshotTaken
              ? "Snapshot records aren't available yet, so eligibility is shown from your current balance. Voting itself is coming soon."
              : "The snapshot hasn't been taken yet. Your voting power will be based on your balance at that moment, not today."}
          </p>
        </Card>

        <Card title="Your launchpad tokens" meta={agents.data ?? undefined}>
          {agents.isLoading ? (
            <p className="text-sm text-soil/70">Loading…</p>
          ) : agents.isError || !agents.data?.data ? (
            <p className="text-sm text-soil/80">n/a: we couldn&apos;t check Orbio right now.</p>
          ) : agents.data.data.length === 0 ? (
            <p className="text-sm text-soil/80">This wallet doesn&apos;t own or operate any Orbio launchpad token.</p>
          ) : (
            <ul className="divide-y divide-line">
              {agents.data.data.map((a) => (
                <li key={a.tokenAddress} className="flex flex-wrap items-center gap-3 py-3">
                  <MasterAvatar m={a} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-soil">
                      {a.name} <span className="font-normal text-soil/70">${a.ticker}</span>
                    </p>
                    {a.explorerUrl && (
                      <a href={a.explorerUrl} target="_blank" rel="noopener noreferrer" className="link text-xs">
                        View token
                      </a>
                    )}
                  </div>
                  <span className={`chip ${a.graduated ? "border-line-strong text-grass" : ""}`}>{a.graduated ? "Graduated" : "Not graduated"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card eyebrow="Rewards ledger" title="Your rewards">
        <LockGate feature="rewardsLedgerOpen" title="The rewards ledger opens in" minHeight="14rem">
          {/* No round has finished, so no rewards exist yet. The ledger fills in once rounds are scored. */}
          <EmptyState title="No rewards yet" plain>
            <p>Rewards from pitches, votes and Masters&apos; shares will appear here once rounds are scored. Displayed, not paid.</p>
          </EmptyState>
        </LockGate>
      </Card>

      {balances.data?.updatedAt && <p className="text-xs text-soil/60">{formatUpdated(balances.data.updatedAt)}</p>}
    </div>
  );
}
