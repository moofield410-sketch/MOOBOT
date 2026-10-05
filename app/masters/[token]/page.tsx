import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MasterAvatar } from "@/components/MasterCard";
import { NoPitchesYet } from "@/components/tournament/EmptyStates";
import { PitchCard } from "@/components/tournament/PitchCard";
import { TenderCard } from "@/components/tournament/TenderCard";
import { Card, StaleNotice } from "@/components/ui/Card";
import { DetailRow, Details } from "@/components/ui/Details";
import { LockGate } from "@/components/ui/LockGate";
import { NotAvailable } from "@/components/ui/NotAvailable";
import { NA_REASONS } from "@/lib/na-reasons";
import { StatTile } from "@/components/ui/Stats";
import { explorerLink, formatCompact, formatDate, formatUpdated, formatUsd } from "@/lib/format";
import { getMaster } from "@/lib/registry";
import { getPitches, getTenders } from "@/lib/tournament";
import { tournamentOpenNow } from "@/lib/timeline.server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const { master } = await getMaster(token);
  return { title: master ? `${master.name} ($${master.ticker})` : "Master not found" };
}

export default async function MasterProfilePage({ params }: Props) {
  const { token } = await params;
  const { master: m, meta } = await getMaster(token);
  if (!m) notFound();

  const pitches = (await getPitches()).data?.filter((p) => p.masterToken === m.tokenAddress) ?? [];
  const tenders = (await getTenders()).data?.filter((t) => t.masterToken === m.tokenAddress) ?? [];
  const na = <NotAvailable reason={NA_REASONS.orbioMissing} />;

  return (
    <div className="space-y-12">
      <div>
        <Link href="/masters" className="tap link text-sm">
          ← All Masters
        </Link>
      </div>

      {meta.stale && <StaleNotice error={meta.error} />}

      <header className="card relative flex flex-col items-start gap-5 overflow-hidden p-6 sm:flex-row sm:gap-6 sm:p-8">
        {/* Coin glow behind the avatar. */}
        <div aria-hidden className="halo -left-16 -top-20 h-64 w-64" />
        <div className="relative">
          <MasterAvatar m={m} size="lg" />
        </div>
        <div className="relative min-w-0 flex-1">
          <h1 className="font-display text-4xl font-semibold tracking-[-0.02em] text-soil sm:text-5xl">{m.name}</h1>
          <p className="mt-1 font-mono text-base text-fern">${m.ticker}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {m.category && <span className="chip">{m.category}</span>}
            {/* Real Masters haven't set a profile yet, so "not taking pitches" would be a guess. */}
            {(m.openToPitches || m.isMock) && (
              <span className={`chip ${m.openToPitches ? "border-line-strong text-grass" : ""}`}>
                {m.openToPitches ? "Open to pitches" : "Not taking pitches right now"}
              </span>
            )}
          </div>
          {m.description && <p className="mt-4 max-w-2xl text-lg text-soil/85">{m.description}</p>}
        </div>
      </header>

      <section aria-label="Key stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Holders" value={m.holderCount === null ? na : formatCompact(m.holderCount)} />
        {m.isMock ? (
          <StatTile label="Liquidity" value={m.liquidityUsd === null ? na : formatUsd(m.liquidityUsd)} />
        ) : (
          <StatTile label="Market cap" value={m.marketCapUsd === null ? na : formatUsd(m.marketCapUsd)} />
        )}
        <StatTile label="Volume" value={na} />
        <StatTile label={m.graduatedAt ? "Graduated" : "Launched"} value={m.graduatedAt || m.launchedAt ? formatDate((m.graduatedAt ?? m.launchedAt)!) : na} />
      </section>

      {(m.explorerUrl || m.orbioUrl) && (
        <div className="flex flex-wrap gap-3">
          {m.explorerUrl && (
            <a href={m.explorerUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              View token on explorer
            </a>
          )}
          {m.orbioUrl && (
            <a href={m.orbioUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              Open Orbio dashboard
            </a>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="pitches-heading">
          <h2 id="pitches-heading" className="mb-5 text-xl font-bold text-soil">
            Pitches to {m.name}
          </h2>
          <LockGate feature="registrationOpen" title="The Tournament opens in" minHeight="16rem" initiallyUnlocked={tournamentOpenNow()}>
            {pitches.length > 0 ? (
              <ul className={`grid gap-5 ${pitches.length > 1 ? "md:grid-cols-2" : "max-w-md"}`}>
                {pitches.map((p) => (
                  <li key={p.id}>
                    <PitchCard p={p} masterName={m.name} />
                  </li>
                ))}
              </ul>
            ) : (
              <NoPitchesYet />
            )}
          </LockGate>

          {tenders.length > 0 && (
            <>
              <h2 className="mb-5 mt-10 text-xl font-bold text-soil">Tenders from {m.name}</h2>
              <ul className={`grid gap-5 ${tenders.length > 1 ? "md:grid-cols-2" : "max-w-md"}`}>
                {tenders.map((t) => (
                  <li key={t.id}>
                    <TenderCard t={t} masterName={m.name} masterLogo={m.logoUrl} masterTicker={m.ticker} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <aside className="space-y-6">
          <Card title="Contact">
            <p className="text-sm text-soil/80">
              Masters will be able to choose how Fighters reach them: an X handle, a Telegram group or an agent endpoint.
            </p>
            {m.contactRoute ? (
              <a href={m.contactRoute} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-4 w-full">
                Contact {m.name}
              </a>
            ) : (
              <button type="button" aria-disabled="true" className="btn-secondary mt-4 w-full">
                Contact options coming soon
              </button>
            )}
          </Card>

          <Card title="On-chain record">
            <p className="text-sm text-soil/80">
              {m.isMock ? "Preview: sample record." : "Graduation status comes from Orbio and is confirmed per agent."}
            </p>
            <Details>
              <DetailRow label="Token address" value={m.tokenAddress} href={explorerLink("token", m.tokenAddress, m.isMock)} />
              <DetailRow label="Owner wallet" value={m.ownerWallet} href={explorerLink("address", m.ownerWallet, m.isMock)} />
              {m.agentWallet && <DetailRow label="Agent wallet" value={m.agentWallet} href={explorerLink("address", m.agentWallet, m.isMock)} />}
              {m.orbioAgentId && <DetailRow label="Orbio agent ID" value={m.orbioAgentId} />}
              {m.launchTx && <DetailRow label="Launch transaction" value={m.launchTx} href={explorerLink("tx", m.launchTx, m.isMock)} />}
              {m.gradTx && <DetailRow label="Graduation transaction" value={m.gradTx} href={explorerLink("tx", m.gradTx, m.isMock)} />}
              {m.gradBlock && <DetailRow label="Graduation block" value={Number(m.gradBlock).toLocaleString("en-US")} />}
            </Details>
            <p className="mt-4 text-xs text-soil/60">{formatUpdated(meta.updatedAt)}</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
