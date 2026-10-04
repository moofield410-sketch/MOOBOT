"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MooBotMascot } from "@/components/MooBotMascot";
import { useMooBot } from "@/components/moobot/useMooBot";
import { CopyButton } from "@/components/ui/CopyButton";
import { CloseIcon } from "@/components/ui/Icons";
import { shortAddress } from "@/lib/format";

const KEY = "moofield:announcement-seen";

/** Confetti angles for the one-time burst (globals.css .burst). */
const BURST = Array.from({ length: 14 }, (_, i) => `${(i * 360) / 14}deg`);

/**
 * Site-wide announcement that appears by itself: once when $MOOBOT is confirmed on Orbio, and again
 * when it graduates. Driven by /api/moobot (polled each minute), so it needs no site update. Each
 * announcement shows until the visitor closes it; closing is remembered in this browser.
 */
export function LaunchAnnouncement() {
  const { data } = useMooBot();
  const pathname = usePathname();
  const [seen, setSeen] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    try {
      setSeen(localStorage.getItem(KEY));
    } catch {
      setSeen(null);
    }
  }, []);

  if (seen === undefined || data?.status !== "verified") return null;
  const graduated = data.agent.graduated === true;
  const id = `${graduated ? "graduated" : "launched"}:${data.address}`;
  if (seen === id) return null;

  const close = () => {
    try {
      localStorage.setItem(KEY, id);
    } catch {}
    setSeen(id);
  };

  return (
    <div role="status" className="safe-x mx-auto mt-4 w-full max-w-7xl sm:[--safe-pad:1.5rem]">
      <div className="card relative flex flex-wrap items-center gap-x-5 gap-y-3 overflow-hidden border-sun/40 bg-[linear-gradient(90deg,rgb(242_183_5/0.1),transparent_60%)] px-4 py-3 sm:px-5">
        <span aria-hidden className="relative shrink-0">
          <MooBotMascot variant="head" state="happy" size={44} decorative />
          <span className="burst">
            {BURST.map((a) => (
              <span key={a} style={{ "--a": a } as React.CSSProperties} />
            ))}
          </span>
        </span>
        <p className="min-w-0 flex-1 text-sm text-soil">
          <span className="font-display font-semibold">{graduated ? "MooBot graduated on Orbio!" : "$MOOBOT is live on Orbio."}</span>{" "}
          <span className="text-fern">
            {graduated ? "It completed its bonding curve and now trades as a Master." : `Official contract ${shortAddress(data.address)}. Ignore any other address.`}
          </span>
        </p>
        <div className="flex items-center gap-3">
          {!graduated && <CopyButton text={data.address} />}
          {pathname !== "/" && (
            <Link href="/#moobot-live" className="tap link text-sm" onClick={close}>
              See it live
            </Link>
          )}
          <button type="button" onClick={close} aria-label="Close announcement" className="hit-44 grid h-8 w-8 place-items-center rounded-full text-soil/60 hover:text-soil">
            <CloseIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
