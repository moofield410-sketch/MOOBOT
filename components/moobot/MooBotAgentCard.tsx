"use client";

import { formatUnits } from "viem";
import { MooBotMarket } from "@/components/moobot/MooBotMarket";
import { useMooBot } from "@/components/moobot/useMooBot";
import { Card } from "@/components/ui/Card";
import { NotAvailable } from "@/components/ui/NotAvailable";
import { StatRow } from "@/components/ui/Stats";
import { ORBIO_LINKS } from "@/config";
import type { MooBotState } from "@/lib/moobot";
import { MOOBOT_NOT_LAUNCHED, NA_REASONS } from "@/lib/na-reasons";
import { formatCredits } from "@/lib/rewards";

/** Whole-token display of a wei amount; null (Orbio has no value) becomes n/a, never 0. */
function orbioAmount(wei: string | null): React.ReactNode {
  if (wei === null) return <NotAvailable reason={NA_REASONS.orbioNull} />;
  return `${Number(formatUnits(BigInt(wei), 18)).toLocaleString("en-US", { maximumFractionDigits: 2 })} $ORBIO`;
}

const creditAmount = (atoms: string | null): React.ReactNode =>
  atoms === null ? <NotAvailable reason={NA_REASONS.orbioNull} /> : `${formatCredits(atoms)} $CREDIT`;

/**
 * The MooBot agent's figures from the Orbio API: market, stake, fees and $CREDIT. Shown only once the
 * $MOOBOT contract is verified. `moobot` is the server-rendered answer; useMooBot keeps it live.
 * Orbio's own fee shares are linked, never restated here.
 */
export function MooBotAgentCard({ moobot: initial }: { moobot: MooBotState }) {
  const { data } = useMooBot(initial);
  const moobot = data ?? initial;
  if (moobot.status !== "verified") {
    return (
      <Card eyebrow="MooBot agent on Orbio" title="Market, fees, stake and $CREDIT" className="h-full">
        <p className="text-lg font-bold text-soil">{MOOBOT_NOT_LAUNCHED}</p>
        <p className="mt-1 text-sm text-soil/75">These figures come from Orbio once the official $MOOBOT contract is confirmed there.</p>
      </Card>
    );
  }

  const a = moobot.agent;
  return (
    <Card
      eyebrow="MooBot agent on Orbio"
      title={`Agent #${a.agentId}${a.name ? ` · ${a.name}` : ""}`}
      meta={{ updatedAt: moobot.checkedAt, stale: moobot.stale }}
      className="h-full"
    >
      <MooBotMarket agent={a} />
      <dl className="mt-5 border-t border-line pt-2">
        <StatRow label="Staked" value={orbioAmount(a.stakedWei)} />
        <StatRow label="Creator fees claimed" value={orbioAmount(a.claimedFeesWei)} />
        <StatRow label="Protocol fee" value={orbioAmount(a.protocolFeeWei)} />
        <StatRow label="Gateway balance credited (from fees)" value={creditAmount(a.gatewayCreditAtoms)} />
        <StatRow label="$CREDIT owed (accrued, not yet claimed)" value={creditAmount(a.creditOwedAtoms)} />
        <StatRow label="$CREDIT claimed" value={creditAmount(a.creditClaimedAtoms)} />
        <StatRow label="$CREDIT minted (all time)" value={creditAmount(a.creditMintedAtoms)} />
      </dl>
      <p className="mt-4 text-xs text-soil/65">
        Read from the Orbio API. How fees are split is set by Orbio and can change; see{" "}
        <a href={ORBIO_LINKS.docs} target="_blank" rel="noopener noreferrer" className="link">
          Orbio&apos;s docs
        </a>{" "}
        and its{" "}
        <a href={ORBIO_LINKS.liveTerms} target="_blank" rel="noopener noreferrer" className="link">
          live launch terms
        </a>
        .
      </p>
    </Card>
  );
}
