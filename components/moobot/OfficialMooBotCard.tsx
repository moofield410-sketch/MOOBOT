"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { MooBotMascot } from "@/components/MooBotMascot";
import { MooBotMarket } from "@/components/moobot/MooBotMarket";
import { useMooBot } from "@/components/moobot/useMooBot";
import { Thinking } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";

const VERIFY_HREF = "/docs/safety#how-to-verify-the-official-moobot-contract";
const noop = () => () => {};

/**
 * "Official $MOOBOT contract". Shows the address only once it is verified on the Orbio API
 * (lib/moobot.ts); before that it says "Not launched yet". The full card adds live market figures;
 * `compact` (footer and Docs) shows the address only.
 */
export function OfficialMooBotCard({ compact = false }: { compact?: boolean }) {
  const query = useMooBot();
  // Another component on the page may fill the shared query cache before this one hydrates, so the
  // first client render shows "Checking…" like the server did, then switches to the answer.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const isLoading = !hydrated || query.isLoading;
  const isError = hydrated && query.isError;
  const data = hydrated ? query.data : undefined;
  const verified = data?.status === "verified" ? data : null;

  return (
    <section aria-label="Official $MOOBOT contract" className={compact ? "" : "card relative flex flex-col items-start gap-5 overflow-hidden p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-7"}>
      {!compact && (
        <MooBotMascot variant="head" size={64} state={verified ? "happy" : isLoading ? "thinking" : "sleeping"} decorative className="shrink-0" />
      )}
      <div className="min-w-0 flex-1">
      <p className={compact ? "mb-1.5 text-sm font-semibold text-soil" : "eyebrow mb-1.5"}>Official $MOOBOT contract</p>
      {isLoading ? (
        <Thinking label="Checking…" bars={1} />
      ) : verified ? (
        <>
          <p className={`break-all font-mono text-soil ${compact ? "text-xs" : "text-sm sm:text-base"}`}>{verified.address}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <CopyButton text={verified.address} />
            {verified.explorerUrl && (
              <a href={verified.explorerUrl} target="_blank" rel="noopener noreferrer" className="tap link text-sm">
                View on explorer
              </a>
            )}
          </div>
          <p className="mt-2 text-xs text-fern">
            Confirmed on Orbio (agent #{verified.agent.agentId}). Ignore any other address.{" "}
            <Link href={VERIFY_HREF} className="link">
              How to verify
            </Link>
          </p>
          {!compact && (
            <div className="mt-5 border-t border-line pt-4">
              <MooBotMarket agent={verified.agent} />
              <p className="mt-3 text-xs text-fern">Live from Orbio, refreshed every minute.</p>
            </div>
          )}
        </>
      ) : (
        <>
          <p className={compact ? "text-sm text-soil/80" : "font-display text-lg font-semibold text-soil"}>{isError ? "Couldn't check right now" : "Not launched yet"}</p>
          <p className="mt-1 text-xs text-fern">
            The address will appear here once it is confirmed on Orbio. Until then, ignore any address claiming to be $MOOBOT.{" "}
            <Link href={VERIFY_HREF} className="link">
              How to verify
            </Link>
          </p>
        </>
      )}
      </div>
    </section>
  );
}
