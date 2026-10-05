"use client";

import { useEffect, useState } from "react";
import { useTournamentMe, useSignedAction } from "@/components/tournament/useTournament";
import { MasterAvatar } from "@/components/MasterCard";
import { ConnectOptions } from "@/components/wallet/WalletMenu";
import { ORBIO_LINKS, TOURNAMENT } from "@/config";
import { NO_DEMO, oneLine, pitchTarget } from "@/lib/tournament/messages";
import { checkDemoUrl, checkPitchText } from "@/lib/tournament/rules";
import type { Address } from "@/lib/types";

const control = "w-full rounded-xl border border-line-strong bg-milk px-3 text-base text-soil placeholder:text-fern/70 focus:border-grass focus:outline-none sm:text-sm";

type Target = "open" | "master" | "tender";

/** First problem with the draft, using the same rules the server applies. null when it's ready. */
function draftProblem(title: string, summary: string, demo: string): string | null {
  try {
    checkPitchText(oneLine(title), oneLine(summary));
    checkDemoUrl(demo);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Submit a pitch for an Orbio agent the connected wallet owns or operates. One pitch per agent
 * per round. The wallet signs the exact pitch text: free, no gas, nothing leaves the wallet.
 */
export function PitchForm({
  masters,
  tenders,
}: {
  masters: { token: Address; name: string }[];
  tenders: { id: string; title: string; masterName: string | null }[];
}) {
  const me = useTournamentMe();
  const pitch = useSignedAction("pitch");
  const [mounted, setMounted] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [demo, setDemo] = useState("");
  const [target, setTarget] = useState<Target>("open");
  const [masterToken, setMasterToken] = useState<string>("");
  const [tenderId, setTenderId] = useState<string>("");
  const [touched, setTouched] = useState(false);
  useEffect(() => setMounted(true), []);

  const free = me.data?.agents?.filter((a) => !a.pitchId) ?? [];
  useEffect(() => {
    if (!agentId && free[0]) setAgentId(free[0].agentId);
  }, [agentId, free]);

  const shell = (children: React.ReactNode) => (
    <section aria-labelledby="pitch-form" className="card p-6 sm:p-7">
      <p className="eyebrow mb-1.5">Fighters</p>
      <h2 id="pitch-form" className="font-display text-xl font-semibold text-soil">
        Submit a pitch
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );

  if (!mounted) return shell(<p className="text-sm text-soil/70">Loading…</p>);
  if (!me.address) {
    return shell(
      <div className="max-w-sm">
        <p className="mb-4 text-sm text-soil/80">Connect the wallet that owns or operates your agent on Orbio.</p>
        <ConnectOptions />
      </div>,
    );
  }
  if (me.isLoading) return shell(<p className="text-sm text-soil/70">Checking your agents on Orbio…</p>);
  if (!me.data || me.data.agentsError) return shell(<p className="text-sm text-moss">{me.data?.agentsError ?? "Couldn't check your agents right now. Please reload."}</p>);
  if (me.data.round.status !== "live") return shell(<p className="text-sm text-soil/80">Pitching opens with Round 1.</p>);

  const agents = me.data.agents ?? [];
  if (agents.length === 0) {
    return shell(
      <p className="text-sm text-soil/80">
        This wallet doesn&apos;t own or operate an agent on Orbio, so it can&apos;t pitch. Launch an agent on{" "}
        <a href={ORBIO_LINKS.dashboard} target="_blank" rel="noopener noreferrer" className="link">
          Orbio
        </a>{" "}
        first, or connect the wallet that owns one. You can still vote with $ORBIO.
      </p>,
    );
  }
  if (pitch.done) {
    return shell(
      <div>
        <p className="font-semibold text-grass">✓ Your pitch is on the board.</p>
        <p className="mt-1 text-sm text-soil/80">Share it so the Crowd can vote. Masters can score it too.</p>
        {free.length > 1 && (
          <button type="button" onClick={pitch.reset} className="btn-secondary mt-4">
            Pitch for another agent
          </button>
        )}
      </div>,
    );
  }
  if (free.length === 0) {
    return shell(<p className="text-sm text-soil/80">Your agents already pitched in Round {me.data.round.number}. One pitch per agent per round.</p>);
  }

  const chosenAgent = agents.find((a) => a.agentId === agentId) ?? null;
  const problem = draftProblem(title, summary, demo);
  const targetOk = target === "open" || (target === "master" && masterToken) || (target === "tender" && tenderId);
  const submit = () => {
    setTouched(true);
    if (problem || !targetOk || !agentId) return;
    const to = pitchTarget({ masterToken: target === "master" ? (masterToken as Address) : null, tenderId: target === "tender" ? tenderId : null });
    void pitch.send(me.data!.round.number, {
      "Agent ID": agentId,
      "Pitch to": to,
      Title: oneLine(title),
      Summary: oneLine(summary),
      Demo: demo.trim() || NO_DEMO,
    });
  };
  const L = TOURNAMENT.pitch;

  return shell(
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold text-soil">Your agent</span>
        <span className="flex items-center gap-3">
          {chosenAgent && <MasterAvatar m={{ name: chosenAgent.name, ticker: chosenAgent.ticker ?? "", logoUrl: chosenAgent.logoUrl }} />}
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={`${control} h-11`}>
          {agents.map((a) => (
            <option key={a.agentId} value={a.agentId} disabled={Boolean(a.pitchId)}>
              {a.name}
              {a.ticker ? ` ($${a.ticker})` : ""} · #{a.agentId}
              {a.pitchId ? (a.pitchHidden ? " · pitch hidden by a moderator this round" : " · already pitched") : ""}
            </option>
          ))}
        </select>
        </span>
      </label>

      <fieldset className="grid gap-2 text-sm">
        <legend className="mb-1.5 font-semibold text-soil">Pitch to</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["open", "Any Master (open pitch)"],
              ["master", "A specific Master"],
              ["tender", "Answer a tender"],
            ] as [Target, string][]
          ).map(([v, label]) => (
            <label key={v} className={`chip cursor-pointer gap-1.5 ${target === v ? "border-grass text-grass" : ""} ${v === "tender" && tenders.length === 0 ? "opacity-50" : ""}`}>
              <input type="radio" name="target" value={v} checked={target === v} disabled={v === "tender" && tenders.length === 0} onChange={() => setTarget(v)} className="accent-[var(--color-grass)]" />
              {label}
            </label>
          ))}
        </div>
        {target === "master" && (
          <select aria-label="Master" value={masterToken} onChange={(e) => setMasterToken(e.target.value)} className={`${control} h-11`}>
            <option value="">Choose a Master…</option>
            {masters.map((m) => (
              <option key={m.token} value={m.token}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        {target === "tender" && (
          <select aria-label="Tender" value={tenderId} onChange={(e) => setTenderId(e.target.value)} className={`${control} h-11`}>
            <option value="">Choose a tender…</option>
            {tenders.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
                {t.masterName ? ` · ${t.masterName}` : ""}
              </option>
            ))}
          </select>
        )}
      </fieldset>

      <label className="grid gap-1.5 text-sm">
        <span className="flex justify-between font-semibold text-soil">
          Title{" "}
          <span className="font-normal text-soil/60">
            {oneLine(title).length}/{L.titleMax}
          </span>
        </span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={L.titleMax} placeholder="One clear feature, e.g. Daily holder digest" className={`${control} h-11`} />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="flex justify-between font-semibold text-soil">
          What you&apos;ll build{" "}
          <span className="font-normal text-soil/60">
            {oneLine(summary).length}/{L.summaryMax}
          </span>
        </span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={L.summaryMax + 50}
          rows={4}
          placeholder="What it does, who it helps, and how a Master would use it."
          className={`${control} resize-y py-2`}
        />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold text-soil">
          Demo link <span className="font-normal text-soil/60">(optional, https)</span>
        </span>
        <input value={demo} onChange={(e) => setDemo(e.target.value)} inputMode="url" placeholder="https://" className={`${control} h-11`} />
      </label>

      {touched && (problem || !targetOk) && (
        <p role="alert" className="text-sm text-moss">
          {problem ?? (target === "master" ? "Choose the Master you're pitching to." : "Choose the tender you're answering.")}
        </p>
      )}
      {pitch.error && (
        <p role="alert" className="text-sm text-moss">
          {pitch.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pitch.busy} className="btn-primary">
          {pitch.busy ? "Check your wallet…" : "Sign and submit pitch"}
        </button>
        <p className="text-xs text-soil/70">Free signed message: no gas, nothing leaves your wallet. You can&apos;t edit a pitch after sending it.</p>
      </div>
    </form>,
  );
}
