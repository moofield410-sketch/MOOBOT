"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useSchedule } from "@/components/ScheduleProvider";
import { ME_KEY } from "@/components/tournament/useTournament";
import { currentRound } from "@/lib/rounds";

/**
 * Keeps every open page in step with the Tournament clock. When a round opens or ends (12:00 UTC on
 * the unlock day, then every round boundary), the server-rendered parts (the pitch form, the board,
 * the snapshot card) and the wallet's own data are fetched again, so nobody is left looking at
 * the last round's buttons. A second refresh a few seconds later catches the board's short cache.
 */
export function RoundWatcher() {
  const { now, timeline } = useSchedule();
  const router = useRouter();
  const queryClient = useQueryClient();
  const last = useRef<string | null>(null);

  const key = timeline ? (({ status, number }) => `${status}:${number}`)(currentRound(now, timeline)) : null;

  useEffect(() => {
    if (key === null) return;
    const before = last.current;
    last.current = key;
    if (before === null || before === key) return;
    const refresh = () => {
      router.refresh();
      void queryClient.invalidateQueries({ queryKey: [ME_KEY] });
    };
    refresh();
    const again = setTimeout(refresh, 7_000);
    return () => clearTimeout(again);
  }, [key, router, queryClient]);

  return null;
}
