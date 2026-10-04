"use client";

import { useState } from "react";
import { useSignedAction, useTournamentMe } from "@/components/tournament/useTournament";
import { TOURNAMENT } from "@/config";

/** For wallets that own or operate a graduated Master: score a pitch from 1 to 10 (once per Master). */
export function ScoreControl({ pitchId, fighterToken, fighterOwner }: { pitchId: string; fighterToken?: string; fighterOwner?: string }) {
  const me = useTournamentMe();
  const score = useSignedAction("score");
  const [value, setValue] = useState(7);
  const [masterToken, setMasterToken] = useState<string | null>(null);

  const masters = (me.data?.masters ?? []).filter((m) => m.token.toLowerCase() !== fighterToken?.toLowerCase());
  if (!me.data || me.data.round.status !== "live" || masters.length === 0) return null;
  // A Master can't score a pitch from an agent its own owner runs.
  if (fighterOwner && fighterOwner.toLowerCase() === me.data.address) return null;
  const pending = masters.filter((m) => !m.scored.includes(pitchId));
  if (pending.length === 0 || score.done) {
    return <p className="mt-3 text-center text-xs text-grass">✓ Scored by your Master</p>;
  }
  const chosen = pending.find((m) => m.token === masterToken) ?? pending[0];

  return (
    <div className="mt-3 rounded-xl border border-line bg-hay/40 p-3 text-xs text-soil">
      <p className="font-semibold">Score as a Master</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {pending.length > 1 && (
          <select aria-label="Master" value={chosen.token} onChange={(e) => setMasterToken(e.target.value)} className="h-9 rounded-lg border border-line bg-milk px-2">
            {pending.map((m) => (
              <option key={m.token} value={m.token}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2">
          <span className="sr-only">Score</span>
          <input
            type="range"
            min={1}
            max={TOURNAMENT.scoreMax}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-28 accent-[var(--color-grass)]"
          />
          <span className="w-10 font-mono font-semibold tabular-nums">
            {value}/{TOURNAMENT.scoreMax}
          </span>
        </label>
        <button
          type="button"
          disabled={score.busy}
          onClick={() => score.send(me.data!.round.number, { Pitch: pitchId, Master: chosen.token, Score: String(value) })}
          className="btn-secondary ml-auto px-3 py-1.5 text-xs"
        >
          {score.busy ? "Check your wallet…" : "Sign score"}
        </button>
      </div>
      {score.error && (
        <p role="alert" className="mt-2 text-moss">
          {score.error}
        </p>
      )}
    </div>
  );
}
