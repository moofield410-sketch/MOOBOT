"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getServerSoundSettings, getSoundSettings, installSoundUnlock, setSoundSettings, subscribeSound } from "@/components/sound/engine";

export function useSoundSettings() {
  return useSyncExternalStore(subscribeSound, getSoundSettings, getServerSoundSettings);
}

const SpeakerIcon = ({ muted, className = "h-[18px] w-[18px]" }: { muted: boolean; className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" fillOpacity="0.12" />
    {muted ? (
      <path d="m16 9.5 5 5m0-5-5 5" />
    ) : (
      <>
        <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
        <path d="M18.2 6.8a7.5 7.5 0 0 1 0 10.4" />
      </>
    )}
  </svg>
);

const NoteIcon = ({ className = "h-3 w-3" }: { className?: string }) => (
  <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
    <path d="M6 2.5 14 1v9.2a2.3 2.3 0 1 1-1.5-2.1V4.1L7.5 5v6.7A2.3 2.3 0 1 1 6 9.6Z" />
  </svg>
);

function Switch({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left hover:bg-hay/60"
    >
      <span>
        <span className="block text-sm font-semibold text-soil">{label}</span>
        <span className="block text-xs text-fern">{hint}</span>
      </span>
      <span aria-hidden className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-grass" : "bg-track"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-milk shadow transition-[left] ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/** Header control: game sounds and background music, remembered in this browser. */
export function SoundToggle() {
  const s = useSoundSettings();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => installSoundUnlock(), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const silent = !s.effects && !s.music;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Sound settings"
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-11 w-11 place-items-center rounded-full text-soil/80 hover:text-soil"
      >
        <SpeakerIcon muted={silent} />
        {s.music && (
          <span aria-hidden className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-grass text-milk">
            <NoteIcon className="h-2.5 w-2.5" />
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 top-full z-50 mt-2 w-72 p-2">
          <Switch label="Game sounds" hint="Soft pops, plucks and buzzes in the games" checked={s.effects} onChange={(v) => setSoundSettings({ effects: v })} />
          <Switch label="Background music" hint="A slow meadow tune, very quiet" checked={s.music} onChange={(v) => setSoundSettings({ music: v })} />
        </div>
      )}
    </div>
  );
}

/** Small mute button for a game's score bar: turns game sounds on or off. */
export function GameSoundButton() {
  const s = useSoundSettings();
  return (
    <button
      type="button"
      onClick={() => setSoundSettings({ effects: !s.effects })}
      aria-pressed={s.effects}
      aria-label={s.effects ? "Mute game sounds" : "Turn game sounds on"}
      title={s.effects ? "Mute game sounds" : "Turn game sounds on"}
      className="hit-44 -my-2 grid h-8 w-8 shrink-0 place-items-center rounded-full text-fern hover:text-soil"
    >
      <SpeakerIcon muted={!s.effects} className="h-4 w-4" />
    </button>
  );
}
