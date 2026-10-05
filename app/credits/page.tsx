import type { Metadata } from "next";
import Link from "next/link";
import { FieldFundCard } from "@/components/FieldFund";
import { MooBotAgentCard } from "@/components/moobot/MooBotAgentCard";
import { OrbioTotalsCard } from "@/components/OrbioTotals";
import { getMooBot } from "@/lib/moobot";
import { getOrbioTotals } from "@/lib/orbio-totals";
import { Card, ComingSoon, PageHeader } from "@/components/ui/Card";
import { NotAvailable } from "@/components/ui/NotAvailable";
import { NA_REASONS } from "@/lib/na-reasons";
import { MeterRow, StatRow, StatTile } from "@/components/ui/Stats";
import { CHAIN, CONTRACTS, FULL_UNLOCK_AFTER_H, REWARDS, TOURNAMENT } from "@/config";
import { averagePerDay, getCreditMarket } from "@/lib/credit-market";
import { getCredits, getTreasury } from "@/lib/credits";
import { formatCompact, formatInt, formatUtcDateTime } from "@/lib/format";
import { formatCredits } from "@/lib/rewards";
import { splitByPercent } from "@/lib/splits";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Credits" };

const S = REWARDS.roundSplit;

export default async function CreditsPage() {
  const [credits, treasury, moobot, orbioTotals] = await Promise.all([getCredits(), getTreasury(), getMooBot(), getOrbioTotals()]);
  const market = await getCreditMarket();
  const t = treasury.data;
  const pool = t?.poolAtoms ? BigInt(t.poolAtoms) : null;
  const buckets = pool !== null ? splitByPercent(pool, S, "treasuryPct") : null;
  const creditUrl = CHAIN.explorerUrl ? `${CHAIN.explorerUrl}/token/${CONTRACTS.creditToken}` : null;
  // Why the pool is n/a: no treasury figure yet (the MooBot agent's credits can't be read).
  const poolNa = <NotAvailable reason={NA_REASONS.moobotAgent} />;
  const treasuryNa = <NotAvailable reason={NA_REASONS.moobotAgent} />;
  const v = (atoms: bigint | undefined) => (atoms === undefined ? poolNa : formatCredits(atoms));

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Credits"
        title="Where the $CREDIT goes"
        intro={
          <>
            Tournament rewards would be counted in{" "}
            {creditUrl ? (
              <a href={creditUrl} target="_blank" rel="noopener noreferrer" className="link">
                Orbio&apos;s $CREDIT token
              </a>
            ) : (
              "Orbio's $CREDIT token"
            )}{" "}
            (Orbio describes one $CREDIT as one dollar of AI usage balance). Moofield&apos;s policy, not an on-chain rule: of the
            $CREDIT the MooBot agent receives, {REWARDS.agentOpsPct}% runs the agent first and {REWARDS.treasuryPct}% goes to the
            treasury, an accounting figure shown here. Each round, {REWARDS.roundPoolPctOfTreasury}% of the treasury becomes the pool (the
            rest rolls over), the dev tops it up to at least {formatInt(REWARDS.roundPoolFloorCredits)} $CREDIT, and the team pays the
            winners after the round.{" "}
            <Link href="/docs/rewards" className="link">
              How rewards work
            </Link>
          </>
        }
      />

      <MooBotAgentCard moobot={moobot} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <FieldFundCard credits={credits} history={market.data?.history ?? null} />

        <Card eyebrow="Treasury" title="This round's pool" meta={t ? treasury : undefined} className="h-full">
          <dl>
            <StatRow label="Treasury balance" value={t ? formatCredits(t.treasuryAtoms) : treasuryNa} />
            <StatRow label={`${REWARDS.roundPoolPctOfTreasury}% of the treasury`} value={t ? formatCredits(t.poolShareAtoms) : treasuryNa} />
            <StatRow label="Added by the dev" value={t ? formatCredits(t.devTopUpAtoms) : treasuryNa} />
            <StatRow label="This round's pool" value={pool !== null ? formatCredits(pool) : poolNa} />
          </dl>
          <p className="rounded-xl mt-5 border border-line bg-hay px-4 py-3 font-mono text-sm text-soil">
            Round pool = max({REWARDS.roundPoolPctOfTreasury}% × treasury, {formatInt(REWARDS.roundPoolFloorCredits)})
          </p>
          <p className="mt-3 text-sm text-soil/75">
            The other {100 - REWARDS.roundPoolPctOfTreasury}% of the treasury rolls over to the next round. When {REWARDS.roundPoolPctOfTreasury}% is
            under {formatInt(REWARDS.roundPoolFloorCredits)} $CREDIT, the dev adds the difference. The pool is fixed when the round ends.
          </p>
          {!t && <p className="mt-3 text-sm text-soil/75">The treasury appears once the official $MOOBOT contract is confirmed on Orbio.</p>}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card eyebrow="Each round" title="How the round pool is shared">
          <div className="space-y-5">
            <MeterRow
              label="Pitches"
              pct={S.pitchesPct}
              value={v(buckets?.pitchesPct)}
              note={`The top ${REWARDS.pitchPlaces.length} pitches share it ${REWARDS.pitchPlaces.join("/")}.`}
            />
            <MeterRow
              label="Voters"
              pct={S.votersPct}
              value={v(buckets?.votersPct)}
              note={`Everyone who voted, whichever pitch they backed, by voting power. Max ${REWARDS.voterShareCapPct}% per wallet.`}
            />
            <MeterRow label="Masters" pct={S.mastersPct} value={v(buckets?.mastersPct)} note="Shared equally by Masters who took part in the round." />
            {S.treasuryPct > 0 && <MeterRow label="Stays in the treasury" pct={S.treasuryPct} value={v(buckets?.treasuryPct)} note="Carried into the next round." />}
          </div>
        </Card>

        <Card eyebrow="Fair-play guards" title="When rewards are held back">
          <p className="mb-3 text-sm text-soil/75">These rules are fixed in the rewards calculator.</p>
          <ul className="list-disc space-y-2.5 pl-5 text-sm text-soil/85 marker:text-wheat">
            <li>No rewards for a round unless at least {REWARDS.minVoters} wallets voted. Then the treasury keeps its share for the next round, and the dev adds nothing.</li>
            <li>A place or bucket nobody qualifies for (no third pitch with votes, no Master taking part) isn&apos;t paid; the treasury keeps it.</li>
            <li>
              An agent that placed in the top {REWARDS.pitchPlaces.length} gets{" "}
              {REWARDS.repeatWinner.factor === 0.5 ? "half" : `${Math.round(REWARDS.repeatWinner.factor * 100)}% of`} its share if it places
              again within the next {REWARDS.repeatWinner.rounds} rounds.
            </li>
            <li>A Master gets no Masters share in a round where it, or another agent of its owner, is behind a top-{REWARDS.pitchPlaces.length} pitch.</li>
            <li>
              Round 1 starts {FULL_UNLOCK_AFTER_H} hours after go-live. Rounds last {TOURNAMENT.roundLengthH} hours.
            </li>
          </ul>
          <p className="rounded-xl mt-5 border border-line-strong bg-oat px-4 py-3 text-sm text-soil">
            <span className="font-semibold text-grass">Paid by the team after each round.</span> When a round ends its result and every
            share are frozen and shown here and in each wallet; the dev then sends the $CREDIT by hand. The site itself never sends anything.
          </p>
        </Card>
      </div>

      <section aria-labelledby="market-heading">
        <h2 id="market-heading" className="mb-6 text-2xl font-bold text-soil">
          $CREDIT activity
        </h2>
        {market.data ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                <StatTile label={market.source === "mock" ? "Received, last 24h" : "Received, latest day"} value={formatCompact(market.data.received24h)} hint="$CREDIT" />
                <StatTile label="Received per day" value={formatCompact(averagePerDay(market.data.history))} hint="7-day average" />
                {market.data.movements.length > 0 ? (
                  <StatTile label="Movements shown" value={formatInt(market.data.movements.length)} />
                ) : (
                  <StatTile label="Days recorded" value={formatInt(market.data.history.length)} hint="Recorded automatically from Orbio" />
                )}
              </div>

              {market.data.movements.length > 0 && (
              <Card title="Recent movements">
                <div className="-mx-3 overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-sm">
                    <thead>
                      <tr className="border-b border-line-strong text-left text-xs text-soil/75">
                        <th scope="col" className="px-3 py-3 font-semibold">Time (UTC)</th>
                        <th scope="col" className="px-3 py-3 font-semibold">Type</th>
                        <th scope="col" className="px-3 py-3 text-right font-semibold">$CREDIT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {market.data.movements.map((mv) => (
                        <tr key={mv.at} className="border-b border-line last:border-b-0">
                          <td className="px-3 py-3 text-soil/85">{formatUtcDateTime(mv.at)}</td>
                          <td className="px-3 py-3 text-soil">{mv.kind}</td>
                          <td className={`px-3 py-3 text-right font-semibold tabular-nums ${mv.amount >= 0 ? "text-grass" : "text-soil"}`}>
                            {mv.amount >= 0 ? "+" : "−"}
                            {formatInt(Math.abs(mv.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              )}
            </div>
        ) : (
          <ComingSoon title="Recording">
            The site keeps its own day-by-day record of the $CREDIT the MooBot agent receives, starting when the official contract is
            confirmed. The first full day shows here after the second day of records.
          </ComingSoon>
        )}
      </section>

      <OrbioTotalsCard totals={orbioTotals} />
    </div>
  );
}
