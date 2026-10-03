"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { CLOCK_RESYNC_MS } from "@/config";
import { clockOffset, getSchedule, type ScheduleState, type Timeline } from "@/lib/schedule";

interface ScheduleContextValue {
  /** False until the first server time sync completes. Render placeholders until then. */
  synced: boolean;
  error: string | null;
  /** Server-corrected current time (ms). */
  now: number;
  timeline: Timeline | null;
  schedule: ScheduleState | null;
}

const ScheduleContext = createContext<ScheduleContextValue>({
  synced: false,
  error: null,
  now: 0,
  timeline: null,
  schedule: null,
});

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const offset = useRef(0);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const sentAt = Date.now();
        const res = await fetch("/api/schedule", { cache: "no-store" });
        const receivedAt = Date.now();
        if (!res.ok) throw new Error(`Schedule sync failed (${res.status})`);
        const body = (await res.json()) as { serverNow: number; timeline: Timeline };
        if (cancelled) return;
        offset.current = clockOffset(sentAt, receivedAt, body.serverNow);
        setTimeline(body.timeline);
        setNow(Date.now() + offset.current);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    sync();
    const tick = setInterval(() => setNow(Date.now() + offset.current), 1000);
    const resync = setInterval(sync, CLOCK_RESYNC_MS);
    return () => {
      cancelled = true;
      clearInterval(tick);
      clearInterval(resync);
    };
  }, []);

  const schedule = timeline ? getSchedule(now, timeline) : null;

  return (
    <ScheduleContext.Provider value={{ synced: timeline !== null, error, now, timeline, schedule }}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  return useContext(ScheduleContext);
}
