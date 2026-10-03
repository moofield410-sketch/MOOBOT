"use client";

import { useMemo, useState } from "react";
import { MasterCard } from "@/components/MasterCard";
import { SearchIcon } from "@/components/ui/Icons";
import { filterMasters, type MasterSort } from "@/lib/masters-filter";
import { MASTER_CATEGORIES, type Master, type MasterCategory } from "@/lib/types";

/** `has`: the sort is offered only when at least one Master has that figure (no sorting on all-n/a). */
const SORTS: { value: MasterSort; label: string; has?: (m: Master) => boolean }[] = [
  { value: "newest", label: "Newest" },
  { value: "marketCap", label: "Highest market cap", has: (m) => m.marketCapUsd !== null },
  { value: "holders", label: "Most holders", has: (m) => m.holderCount !== null },
  { value: "liquidity", label: "Most liquidity", has: (m) => m.liquidityUsd !== null },
  { value: "name", label: "Name (A–Z)" },
];

const control = "rounded-xl h-11 sm:h-10 border border-line bg-milk px-3 text-sm text-soil focus:border-line-strong";

export function MastersBrowser({ masters }: { masters: Master[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<MasterCategory | "all">("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [sort, setSort] = useState<MasterSort>("newest");

  const results = useMemo(() => filterMasters(masters, { q, category, openOnly, sort }), [masters, q, category, openOnly, sort]);
  const filtered = q !== "" || category !== "all" || openOnly;
  // Category and "open to pitches" come from Master profiles; hide the filters until any Master has set them.
  const hasCategories = masters.some((m) => m.category !== null);
  const hasOpenFlag = masters.some((m) => m.openToPitches);
  const sorts = SORTS.filter((s) => !s.has || masters.some(s.has));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3" role="search">
        <label className="relative min-w-[14rem] flex-1">
          <span className="sr-only">Search Masters</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-soil/60" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, ticker or description"
            className={`${control} w-full pl-9 placeholder:text-soil/50`}
          />
        </label>

        {hasCategories && (
          <label className="flex items-center gap-2 text-sm text-soil/80">
            <span className="sr-only sm:not-sr-only">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as MasterCategory | "all")} className={control}>
              <option value="all">All categories</option>
              {MASTER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 text-sm text-soil/80">
          <span className="sr-only sm:not-sr-only">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as MasterSort)} className={control}>
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {hasOpenFlag && (
          <label className="flex h-11 cursor-pointer sm:h-10 items-center gap-2 text-sm text-soil">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="h-4 w-4 accent-[var(--color-grass)]" />
            Open to pitches
          </label>
        )}
      </div>

      <p className="mb-4 text-sm text-soil/70" aria-live="polite">
        {results.length === masters.length ? `${masters.length} Masters` : `${results.length} of ${masters.length} Masters`}
      </p>

      {results.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((m) => (
            <li key={m.tokenAddress}>
              <MasterCard m={m} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="card p-10 text-center">
          <p className="font-semibold text-soil">No Masters match your search.</p>
          {filtered && (
            <button
              type="button"
              className="btn-secondary mt-4"
              onClick={() => {
                setQ("");
                setCategory("all");
                setOpenOnly(false);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
