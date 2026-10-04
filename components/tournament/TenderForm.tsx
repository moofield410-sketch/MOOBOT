"use client";

import { useEffect, useState } from "react";
import { useSchedule } from "@/components/ScheduleProvider";
import { useSignedAction, useTournamentMe } from "@/components/tournament/useTournament";
import { TOURNAMENT } from "@/config";
import { formatUtcDateTime } from "@/lib/format";
import { CRITERIA_SEPARATOR, oneLine } from "@/lib/tournament/messages";
import { checkTenderText } from "@/lib/tournament/rules";

const control = "w-full rounded-xl border border-line-strong bg-milk px-3 text-base text-soil placeholder:text-fern/70 focus:border-grass focus:outline-none sm:text-sm";
const HOUR = 3_600_000;

/** For wallets that own or operate a graduated Master: post a tender that Fighters can answer. */
export function TenderForm() {
  const me = useTournamentMe();
  const tender = useSignedAction("tender");
  const { now } = useSchedule();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [master, setMaster] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
  const [days, setDays] = useState(3);
  const [touched, setTouched] = useState(false);
  useEffect(() => setMounted(true), []);

  const masters = me.data?.masters ?? [];
  if (!mounted || !me.data || me.data.round.status !== "live" || masters.length === 0) return null;
  const chosen = masters.find((m) => m.token === master) ?? masters[0];

  if (tender.done) {
    return (
      <div className="card p-5 text-sm">
        <p className="font-semibold text-grass">✓ Your tender is posted. Fighters can answer it now.</p>
        <button type="button" onClick={() => (tender.reset(), setTitle(""), setDescription(""), setCriteria(""))} className="btn-secondary mt-3">
          Post another tender
        </button>
      </div>
    );
  }
  if (!open) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm text-soil">
          You run a Master (<span className="font-semibold">{masters.map((m) => m.name).join(", ")}</span>). Ask Fighters for the feature you want.
        </p>
        <button type="button" onClick={() => setOpen(true)} className="btn-primary">
          Post a tender
        </button>
      </div>
    );
  }

  const list = criteria.split(",").map(oneLine).filter(Boolean);
  // Whole hours, so the deadline reads cleanly.
  const deadline = new Date(Math.ceil((now + days * 24 * HOUR) / HOUR) * HOUR);
  let problem: string | null = null;
  try {
    checkTenderText({ title: oneLine(title), description: oneLine(description), criteria: list });
  } catch (err) {
    problem = err instanceof Error ? err.message : String(err);
  }
  const L = TOURNAMENT.tender;

  return (
    <form
      className="card grid gap-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (problem) return;
        void tender.send(me.data!.round.number, {
          Master: chosen.token,
          Title: oneLine(title),
          Description: oneLine(description),
          "Looking for": list.join(CRITERIA_SEPARATOR),
          Deadline: deadline.toISOString(),
        });
      }}
    >
      <p className="font-display text-lg font-semibold text-soil">Post a tender</p>
      {masters.length > 1 && (
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold text-soil">Master</span>
          <select value={chosen.token} onChange={(e) => setMaster(e.target.value)} className={`${control} h-11`}>
            {masters.map((m) => (
              <option key={m.token} value={m.token}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold text-soil">What do you need?</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={L.titleMax} placeholder="e.g. A weekly holder report" className={`${control} h-11`} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold text-soil">Details</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={L.descriptionMax + 50} rows={3} className={`${control} resize-y py-2`} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold text-soil">
          Looking for <span className="font-normal text-soil/60">(up to {L.criteriaMax}, separated by commas)</span>
        </span>
        <input value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder="Fast, Open source, Works on X" className={`${control} h-11`} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold text-soil">Deadline</span>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${control} h-11`}>
          {Array.from({ length: L.maxDays - L.minDays + 1 }, (_, i) => i + L.minDays).map((d) => (
            <option key={d} value={d}>
              In {d} day{d === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        <span className="text-xs text-soil/65">Closes {formatUtcDateTime(deadline.getTime())}</span>
      </label>
      {touched && problem && (
        <p role="alert" className="text-sm text-moss">
          {problem}
        </p>
      )}
      {tender.error && (
        <p role="alert" className="text-sm text-moss">
          {tender.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={tender.busy} className="btn-primary">
          {tender.busy ? "Check your wallet…" : "Sign and post tender"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Cancel
        </button>
      </div>
      <p className="text-xs text-soil/70">Free signed message: no gas, nothing leaves your wallet.</p>
    </form>
  );
}
