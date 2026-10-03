import type { Master, MasterCategory } from "@/lib/types";

export type MasterSort = "newest" | "holders" | "liquidity" | "marketCap" | "name";

export interface MasterFilter {
  q?: string;
  openOnly?: boolean;
  category?: MasterCategory | "all";
  sort?: MasterSort;
}

/** Search, filter and sort for the Masters directory. Pure, so it runs on server or client. */
export function filterMasters(list: Master[], f: MasterFilter = {}): Master[] {
  const q = f.q?.trim().toLowerCase() ?? "";
  const out = list.filter((m) => {
    if (f.openOnly && !m.openToPitches) return false;
    if (f.category && f.category !== "all" && m.category !== f.category) return false;
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.ticker.toLowerCase().includes(q) ||
      (m.description?.toLowerCase().includes(q) ?? false)
    );
  });

  const sort = f.sort ?? "newest";
  const num = (n: number | null) => n ?? -1;
  return out.sort((a, b) => {
    switch (sort) {
      case "holders":
        return num(b.holderCount) - num(a.holderCount);
      case "liquidity":
        return num(b.liquidityUsd) - num(a.liquidityUsd);
      case "marketCap":
        return num(b.marketCapUsd) - num(a.marketCapUsd);
      case "name":
        return a.name.localeCompare(b.name);
      default:
        return (b.graduatedAt ?? b.launchedAt ?? "").localeCompare(a.graduatedAt ?? a.launchedAt ?? "");
    }
  });
}
