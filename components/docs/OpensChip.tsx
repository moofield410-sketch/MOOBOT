"use client";

import { useSchedule } from "@/components/ScheduleProvider";

const LIVE = "border-wheat text-wheat";
const OPENS = "border-grass text-grass";

/**
 * An [[Opens]] tag in the Docs. The Docs are built ahead of time, so the tag switches itself to
 * "Live" on the visitor's page once the Tournament has unlocked (server clock), instead of reading
 * "Opens …" until the next deploy.
 */
export function OpensChip({ label }: { label: string }) {
  const { synced, schedule } = useSchedule();
  const open = synced && schedule?.features.registrationOpen;
  return <span className={`chip mr-1.5 align-middle text-[11px] font-semibold not-italic ${open ? LIVE : OPENS}`}>{open ? "Live" : label}</span>;
}
