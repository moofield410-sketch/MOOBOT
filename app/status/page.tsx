import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/Card";
import { StatRow } from "@/components/ui/Stats";
import { formatInt, formatUpdated } from "@/lib/format";
import { getStatus } from "@/lib/status";
import type { SystemStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Status" };

type Health = "ok" | "partial" | "delayed" | "down" | "preview";

const SUMMARY: Record<Health, { title: string; body: string; dot: string }> = {
  ok: { title: "All systems normal", body: "Data is flowing and up to date.", dot: "pulse" },
  partial: { title: "Live data", body: "Masters come live from Orbio. Wallet balances aren't connected yet.", dot: "pulse" },
  preview: { title: "Preview mode", body: "The site is showing sample data while preview mode is on.", dot: "bg-grass" },
  delayed: { title: "Data delayed", body: "Some data may be out of date. We're showing the latest we have.", dot: "bg-moss" },
  down: { title: "Data source unavailable", body: "We can't reach the blockchain right now. Cached data is shown where possible.", dot: "bg-fern" },
};

const MOOBOT_STATE_LABEL: Record<SystemStatus["moobot"]["status"], string> = {
  "not-launched": "Not launched yet",
  invalid: "Address rejected (invalid)",
  "not-found": "Address rejected (not on Orbio)",
  unverified: "Not verified yet",
  verified: "Verified on Orbio",
};

/** A small status pill: cyan when healthy, gold when it needs attention, muted when off. */
function StatusPill({ tone, children }: { tone: "good" | "warn" | "off"; children: React.ReactNode }) {
  const cls = tone === "good" ? "border-sky/30 text-sky" : tone === "warn" ? "border-grass/40 text-grass" : "border-line-strong text-fern";
  return <span className={`chip ${cls}`}>{children}</span>;
}

export default async function StatusPage() {
  const s = await getStatus();
  // A missing RPC_URL only affects wallet balances, so it isn't reported as "delayed".
  const health: Health =
    s.mode === "mock"
      ? "preview"
      : s.rpc.status === "down"
        ? "down"
        : s.orbio?.lastError
          ? "delayed"
          : s.rpc.status === "not-configured"
            ? "partial"
            : "ok";
  const summary = SUMMARY[health];
  const isDev = process.env.NODE_ENV !== "production";
  // Same check as lib/wagmi.ts; WalletConnect stays hidden in the connect menu while it's unset.
  const walletConnect = Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID);

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader eyebrow="Status" title="System status" intro="The health of the data sources behind Moofield." />

      <div className="card flex items-center gap-4 p-6" role="status">
        {summary.dot === "pulse" ? <span aria-hidden className="pulse-dot shrink-0" /> : <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${summary.dot}`} />}
        <div>
          <p className="text-lg font-bold text-soil">{summary.title}</p>
          <p className="text-sm text-soil/80">{summary.body}</p>
        </div>
      </div>

      {(s.moobot.status === "invalid" || s.moobot.status === "not-found") && (
        <div role="alert" className="rounded-xl border-2 border-moss bg-oat p-5">
          <p className="text-lg font-bold text-moss">Warning: the configured $MOOBOT contract was rejected</p>
          <p className="mt-1 text-sm text-soil">
            {s.moobot.status === "invalid"
              ? `The configured $MOOBOT address is not valid. ${s.moobot.reason}`
              : `The configured $MOOBOT address ${s.moobot.address} was not found on the Orbio API.`}{" "}
            $MOOBOT features stay off and the site shows &quot;Not launched yet&quot; until this is fixed.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="$MOOBOT contract">
          <dl>
            <StatRow label="State" value={<StatusPill tone={s.moobot.status === "verified" ? "good" : s.moobot.status === "not-launched" ? "off" : "warn"}>{MOOBOT_STATE_LABEL[s.moobot.status]}</StatusPill>} />
            {"address" in s.moobot && <StatRow label="Address" value={<span className="break-all font-mono text-xs">{s.moobot.address}</span>} />}
            {s.moobot.status === "verified" && (
              <>
                <StatRow label="Orbio agent" value={`#${s.moobot.agent.agentId}${s.moobot.agent.name ? ` · ${s.moobot.agent.name}` : ""}`} />
                <StatRow label="Last check" value={s.moobot.checkedAt ? formatUpdated(s.moobot.checkedAt).replace("Updated ", "") : "Not yet"} />
              </>
            )}
          </dl>
          {s.moobot.status === "unverified" && (
            <p className="mt-3 text-sm text-soil/80">Orbio couldn&apos;t be reached to confirm the address. $MOOBOT features stay off until it can.</p>
          )}
          {s.moobot.status === "verified" && s.moobot.stale && (
            <p className="mt-3 text-sm text-soil/80">Orbio couldn&apos;t be reached for the latest check; showing the last confirmed result.</p>
          )}
        </Card>

        <Card title="Blockchain connection">
          <dl>
            <StatRow label="Connection" value={<StatusPill tone={s.rpc.status === "ok" ? "good" : s.rpc.status === "down" ? "warn" : "off"}>{s.rpc.status === "ok" ? "Healthy" : s.rpc.status === "down" ? "Unavailable" : s.mode === "mock" ? "Preview" : "Not connected yet"}</StatusPill>} />
            <StatRow label="Response time" value={s.rpc.latencyMs !== null ? `${s.rpc.latencyMs} ms` : "n/a"} />
            <StatRow label="Latest block" value={formatInt(s.rpc.headBlock)} />
          </dl>
        </Card>
        {s.orbio ? (
          <Card title="Orbio agent data">
            <dl>
              <StatRow label="Last fetch" value={s.orbio.lastFetchAt ? formatUpdated(s.orbio.lastFetchAt).replace("Updated ", "") : "Not yet"} />
              <StatRow label="Agents on Orbio" value={formatInt(s.orbio.agentsTotal)} />
              <StatRow label="Graduated (confirmed)" value={formatInt(s.orbio.graduated)} />
              <StatRow label="Hidden (checks disagree)" value={formatInt(s.orbio.hiddenMismatches)} />
              <StatRow label="Last result" value={<StatusPill tone={s.orbio.lastError ? "warn" : "good"}>{s.orbio.lastError ? "Retrying" : "OK"}</StatusPill>} />
            </dl>
          </Card>
        ) : (
          <Card title="Graduation scanner">
            <dl>
              <StatRow label="Last scan" value={s.indexer.lastScanAt ? formatUpdated(s.indexer.lastScanAt).replace("Updated ", "") : "Not yet"} />
              <StatRow label="Blocks behind" value={s.indexer.lagBlocks !== null ? formatInt(s.indexer.lagBlocks) : "n/a"} />
              <StatRow label="Last result" value={<StatusPill tone={s.indexer.lastScanError ? "warn" : "good"}>{s.indexer.lastScanError ? "Retrying" : "OK"}</StatusPill>} />
            </dl>
          </Card>
        )}

        <Card title="Wallet connection">
          <dl>
            <StatRow label="Browser wallets" value={<StatusPill tone="good">Available</StatusPill>} />
            <StatRow label="WalletConnect" value={<StatusPill tone={walletConnect ? "good" : "warn"}>{walletConnect ? "Configured" : "Not configured"}</StatusPill>} />
          </dl>
          {!walletConnect && (
            <p className="mt-3 text-sm text-soil/80">
              WalletConnect: not configured. Phone wallets can&apos;t connect until NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set.
            </p>
          )}
        </Card>
      </div>

      {isDev && (s.configErrors.length > 0 || s.missingConfirm.length > 0) && (
        <Card eyebrow="Development only" title="Configuration">
          {s.configErrors.length > 0 && (
            <ul className="mb-4 list-inside list-disc text-sm text-moss">
              {s.configErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <p className="text-sm text-soil/80">Waiting on Orbio details (CONFIRM):</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {s.missingConfirm.map((m) => (
              <li key={m} className="chip max-w-full break-all font-mono">
                {m}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-xs text-soil/60">{formatUpdated(s.checkedAt).replace("Updated", "Checked")}</p>
    </div>
  );
}
