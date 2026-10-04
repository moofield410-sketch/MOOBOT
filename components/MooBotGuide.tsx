"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { MooBotMascot, type MascotState } from "@/components/MooBotMascot";
import { AURA_RING } from "@/components/moobot/aura";
import { useSchedule } from "@/components/ScheduleProvider";
import { FULL_UNLOCK_AFTER_H } from "@/config";
import { useWalletBalances } from "@/components/wallet/useWalletBalances";
import { formatCountdown } from "@/lib/schedule";
import type { DataEnvelope, Master } from "@/lib/types";

/**
 * MooBot: draggable, collapsible floating guide.
 * Sleeps (showing the countdown) until go-live, then wakes and shows live site facts.
 * Tapping him only plays the flex gesture. The cosmetic tap meter comes in a later phase.
 */

type Gesture = "idle" | "wave" | "flex";

const STORAGE_KEY = "moobot-bot";
const MARGIN = 8;
const KEY_STEP = 16;
/** Pointer travel (px) before a press on the bubble counts as a drag instead of a tap. */
const DRAG_THRESHOLD = 6;
/** Below this width (Tailwind lg) he starts collapsed so the panel doesn't cover the page. */
const EXPANDED_MIN_WIDTH = 1024;

interface Pos {
  x: number;
  y: number;
}

/** Not synced → thinking, asleep → sleeping, wave → happy, flex/tap → talking, otherwise idle. */
function Mascot({ gesture, awake, synced, size }: { gesture: Gesture; awake: boolean; synced: boolean; size: number }) {
  const state: MascotState = !synced ? "thinking" : !awake ? "sleeping" : gesture === "wave" ? "happy" : gesture === "flex" ? "talking" : "idle";
  return <MooBotMascot state={state} size={size} decorative />;
}

/** The connected wallet's holder aura, or null (no wallet, $MOOBOT not launched, or below the first tier). */
function useHolderAura(): string | null {
  const { address } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const balances = useWalletBalances(mounted ? address : undefined);
  return mounted ? (balances.data?.data?.aura ?? null) : null;
}

export function MooBotGuide() {
  const { synced, schedule } = useSchedule();
  const awake = schedule?.features.moobotAwake ?? false;
  const aura = useHolderAura();
  const auraRing = aura ? (AURA_RING[aura] ?? AURA_RING.Spark) : "";

  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number; id: number; x0: number; y0: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [gesture, setGesture] = useState<Gesture>("idle");
  const [mastersCount, setMastersCount] = useState<{ n: number; mock: boolean } | null>(null);
  const gestureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const play = useCallback((g: Gesture, ms: number) => {
    if (gestureTimer.current) clearTimeout(gestureTimer.current);
    setGesture(g);
    gestureTimer.current = setTimeout(() => setGesture("idle"), ms);
  }, []);

  // Restore position and collapsed state.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { pos?: Pos | null; collapsed?: boolean } | null;
      if (saved?.pos) setPos(saved.pos);
      // Phones and tablets start collapsed so the panel doesn't cover the page; an explicit choice wins.
      if (saved?.collapsed ?? window.innerWidth < EXPANDED_MIN_WIDTH) setCollapsed(true);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const persist = useCallback((next: { pos?: Pos | null; collapsed?: boolean }) => {
    try {
      const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...next }));
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Wave when he wakes up (and as a greeting on load if already awake).
  useEffect(() => {
    if (awake) play("wave", 2500);
  }, [awake, play]);

  // Live facts once awake.
  useEffect(() => {
    if (!awake) return;
    fetch("/api/agents", { cache: "no-store" })
      .then((r) => r.json() as Promise<DataEnvelope<Master[]>>)
      .then((env) => setMastersCount(env.data ? { n: env.data.length, mock: env.source === "mock" } : null))
      .catch(() => setMastersCount(null));
  }, [awake]);

  const clamp = useCallback((p: Pos): Pos => {
    const el = rootRef.current;
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    return {
      x: Math.min(Math.max(MARGIN, p.x), window.innerWidth - w - MARGIN),
      y: Math.min(Math.max(MARGIN, p.y), window.innerHeight - h - MARGIN),
    };
  }, []);

  // Keep him on screen when the window or his size changes.
  useEffect(() => {
    if (!pos) return;
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos, clamp]);

  useEffect(() => {
    setPos((p) => (p ? clamp(p) : p));
  }, [collapsed, clamp]);

  const currentPos = (): Pos => {
    const r = rootRef.current!.getBoundingClientRect();
    return { x: r.left, y: r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = currentPos();
    drag.current = { dx: e.clientX - p.x, dy: e.clientY - p.y, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < DRAG_THRESHOLD) return;
    d.moved = true;
    setPos(clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    // A drag on the bubble must not also open the panel.
    suppressClick.current = d.moved;
    if (d.moved) persist({ pos: currentPos() });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const step = d[e.key];
    if (!step) return;
    e.preventDefault();
    const p = clamp({ x: currentPos().x + step[0], y: currentPos().y + step[1] });
    setPos(p);
    persist({ pos: p });
  };

  const toggle = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const next = !collapsed;
    setCollapsed(next);
    persist({ collapsed: next });
  };

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : { right: "max(16px, env(safe-area-inset-right))", bottom: "calc(16px + env(safe-area-inset-bottom))" };

  const dragHandlers = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };

  const grip = (
    <button
      type="button"
      aria-label="Move MooBot. Drag, or use the arrow keys."
      className="hidden cursor-grab touch-none px-1 text-sm text-soil/60 hover:text-soil active:cursor-grabbing sm:block"
      {...dragHandlers}
      onKeyDown={onKeyDown}
    >
      ⠿
    </button>
  );

  if (collapsed) {
    return (
      <div ref={rootRef} className="fixed z-50 flex items-end gap-1" style={style}>
        {grip}
        {/* 44px bubble; on phones (no grip) dragging the bubble itself moves him. */}
        <button
          type="button"
          onClick={toggle}
          aria-label="Open MooBot"
          className={`card touch-none rounded-full p-1.5 shadow-lg shadow-soil/20 ${auraRing}`}
          {...dragHandlers}
        >
          <Mascot gesture={gesture} awake={awake} synced={synced} size={32} />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      role="complementary"
      aria-label="MooBot guide"
      className="card fixed z-50 w-[min(20rem,calc(100vw-2rem))] p-4 shadow-2xl shadow-soil/20"
      style={style}
    >
      <div className="mb-3 flex items-center justify-between rounded-full border border-line bg-wash py-1 pl-1.5 pr-1">
        <div className="flex items-center gap-1.5">
          {grip}
          <p className="font-display text-sm font-semibold text-soil">MooBot</p>
          {awake ? <span className="chip-live px-2 py-0.5 text-[10.5px] uppercase tracking-wider">Live</span> : <span className="chip px-2 py-0.5 text-[10.5px]">Sleeping</span>}
        </div>
        <button type="button" onClick={toggle} aria-label="Collapse MooBot" className="hit-44 rounded-full px-2 py-0.5 text-base leading-none text-fern hover:text-soil">
          —
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => awake && play("flex", 700)}
            aria-label={awake ? "Tap MooBot" : "MooBot is sleeping"}
            className={`block rounded-2xl ${auraRing}`}
          >
            <Mascot gesture={gesture} awake={awake} synced={synced} size={64} />
          </button>
        </div>

        <div className="min-w-0 text-sm" aria-live="polite">
          {!synced || !schedule ? (
            <p className="text-soil/70">Checking the server clock…</p>
          ) : !awake ? (
            <>
              <p className="text-soil">Shh, I&apos;m resting until go-live.</p>
              <p className="mt-2 text-xs text-soil/70">{schedule.nextLabel} in</p>
              <p className="font-mono text-lg tabular-nums text-grass">{formatCountdown(schedule.msRemaining)}</p>
            </>
          ) : (
            <ul className="space-y-1.5">
              <li>
                {schedule.nextAt !== null ? (
                  <>
                    <span className="text-soil/70">Next unlock:</span> {schedule.nextLabel} in{" "}
                    <span className="font-mono font-semibold tabular-nums text-grass">{formatCountdown(schedule.msRemaining)}</span>
                  </>
                ) : (
                  <>The Tournament board is open.</>
                )}
              </li>
              <li>
                <span className="text-soil/70">Masters:</span>{" "}
                <Link href="/masters" className="link">{mastersCount ? `${mastersCount.n} graduated` : "see the list"}</Link>
              </li>
              <li>
                <span className="text-soil/70">Tournament:</span>{" "}
                {schedule.features.votingOpen ? (
                  <Link href="/tournament" className="link">
                    open now
                  </Link>
                ) : (
                  `opens ${FULL_UNLOCK_AFTER_H} hours after go-live.`
                )}
              </li>
              {aura && (
                <li>
                  <span className="text-soil/70">Your aura:</span> {aura} <span className="text-xs text-soil/60">(just for looks)</span>
                </li>
              )}
              <li className="text-xs text-soil/60">I never give financial advice.</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
