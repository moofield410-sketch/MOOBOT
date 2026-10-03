"use client";

import { useQuery } from "@tanstack/react-query";
import type { MooBotState } from "@/lib/moobot";

/** How often the browser re-reads /api/moobot, so price, market cap and fees update without a reload. */
const REFRESH_MS = 60_000;

/**
 * The $MOOBOT launch switch as seen by the browser: our own /api/moobot, never Orbio directly.
 * `initial` is the server-rendered answer, so the first paint needs no extra request.
 */
export function useMooBot(initial?: MooBotState) {
  return useQuery({
    queryKey: ["moobot"],
    queryFn: async (): Promise<MooBotState> => {
      const res = await fetch("/api/moobot", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json() as Promise<MooBotState>;
    },
    initialData: initial,
    initialDataUpdatedAt: initial ? Date.now() : undefined,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
  });
}
