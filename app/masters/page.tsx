import type { Metadata } from "next";
import { MastersBrowser } from "@/components/MastersBrowser";
import { ComingSoon, PageHeader, StaleNotice } from "@/components/ui/Card";
import { formatUpdated } from "@/lib/format";
import { getMasters } from "@/lib/registry";
import { CACHE, USE_MOCK_DATA } from "@/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Masters" };

export default async function MastersPage() {
  const masters = await getMasters();

  return (
    <div>
      <PageHeader
        eyebrow="Masters"
        title="Graduated agents"
        intro={
          USE_MOCK_DATA
            ? "Preview: these are sample agents that show how the directory will look. Real Masters appear when preview mode is switched off."
            : `Agents that graduated on the Orbio launchpad. An agent is listed only when Orbio's agent list marks it graduated and its own Orbio record confirms its bonding curve has graduated; if the two disagree, it is hidden. Nobody can add an agent by hand. Refreshed when someone visits, at most every ${Math.round(CACHE.mastersTtlMs / 60_000)} minutes.`
        }
      />

      {masters.stale && <StaleNotice error={masters.error} />}

      {masters.data && masters.data.length > 0 ? (
        <MastersBrowser masters={masters.data} />
      ) : (
        <ComingSoon title="No graduated agents yet">Masters appear here as soon as they graduate on the Orbio launchpad.</ComingSoon>
      )}

      <p className="mt-8 text-xs text-soil/60">{formatUpdated(masters.updatedAt)}</p>
    </div>
  );
}
