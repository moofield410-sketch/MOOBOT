"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSchedule } from "@/components/ScheduleProvider";
import { useSignedAction, useTournamentMe } from "@/components/tournament/useTournament";
import { LockIcon } from "@/components/ui/Icons";
import { VOTING } from "@/config";
import { formatCompact } from "@/lib/format";
import { formatCountdown } from "@/lib/schedule";

const shell = "btn-secondary w-full bg-milk px-3 py-2 text-xs";

/**
 * Vote for a pitch with a free signed message. One vote per wallet per round: the first is final.
 * Voting power is the wallet's $ORBIO at the round's snapshot block (read by the server).
 */
export function VoteButton({ pitchId, title, ownAgentId, live = true }: { pitchId?: string; title?: string; ownAgentId?: string; live?: boolean }) {
  const { synced, schedule, timeline, now } = useSchedule();
  const me = useTournamentMe();
  const vote = useSignedAction("vote");
  const [confirm, setConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const locked = (label: string) => (
    <span className="cta-glow w-full opacity-80 [animation-duration:10s]">
      <button type="button" aria-disabled="true" onClick={(e) => e.preventDefault()} className={shell}>
        <LockIcon className="h-3.5 w-3.5" />
        <span className="font-mono tabular-nums">{label}</span>
      </button>
    </span>
  );

  if (!synced || !schedule || !timeline || !mounted) return locked("Checking…");
  if (!schedule.features.votingOpen) return locked(`Tournament opens in ${formatCountdown(timeline.fullUnlockAt - now)}`);
  if (!live || !pitchId) return locked("Voting closed for this round");
  if (!me.address) {
    return (
      <Link href="/wallet" className={shell}>
        Connect a wallet to vote
      </Link>
    );
  }
  if (me.isLoading) return locked("Checking your voting power…");
  const m = me.data;
  if (!m) return <p className="text-xs text-moss">Couldn&apos;t check your wallet. Please reload.</p>;

  if (ownAgentId && m.agents?.some((a) => a.agentId === ownAgentId)) {
    return <p className="rounded-xl border border-line px-3 py-2 text-center text-xs text-soil/70">Your agent&apos;s pitch: you can&apos;t vote for it</p>;
  }
  if (m.vote) {
    return m.vote.pitchId === pitchId ? (
      <p className="flex items-center justify-center gap-1.5 rounded-xl border border-grass/30 bg-grass/5 px-3 py-2 text-xs font-semibold text-grass">
        ✓ You voted for this · power {formatCompact(m.vote.power)}
      </p>
    ) : (
      <p className="rounded-xl border border-line px-3 py-2 text-center text-xs text-soil/70">You already voted this round</p>
    );
  }
  if (m.isTeam) return <p className="rounded-xl border border-line px-3 py-2 text-center text-xs text-soil/70">Team wallets don&apos;t vote: the team funds the rewards</p>;
  if (!m.power) return <p className="text-xs text-moss">{m.powerError ?? "Couldn't read your voting power."}</p>;
  if (m.power.power <= 0) {
    return (
      <p className="rounded-xl border border-line px-3 py-2 text-center text-xs text-soil/75">
        No vote yet: hold {VOTING.minOrbio.toLocaleString("en-US")}+ $ORBIO at the snapshot, or {VOTING.moobotPerPoint.toLocaleString("en-US")}+ $MOOBOT (1 point each {VOTING.moobotPerPoint.toLocaleString("en-US")}).
      </p>
    );
  }

  if (vote.done) return <p className="text-center text-xs font-semibold text-grass">✓ Vote recorded</p>;

  return (
    <div className="space-y-2">
      {confirm ? (
        <div className="rounded-xl border border-line-strong bg-milk p-3 text-xs text-soil">
          <p>
            Vote for <span className="font-semibold">&ldquo;{title}&rdquo;</span> with power <span className="font-mono font-semibold">{formatCompact(m.power.power)}</span>?
            Your first vote in a round is final.
            {m.moobot && m.moobot.points > 0 && (
              <> Your {formatCompact(m.moobot.points)} $MOOBOT points count what you still hold when the round ends: sell, and they go down.</>
            )}
          </p>
          <div className="mt-2.5 flex gap-2">
            <button type="button" disabled={vote.busy} onClick={() => vote.send(m.round.number, { Pitch: pitchId })} className="btn-primary flex-1 px-3 py-2 text-xs">
              {vote.busy ? "Check your wallet…" : "Sign and vote"}
            </button>
            <button type="button" disabled={vote.busy} onClick={() => setConfirm(false)} className="btn-secondary px-3 py-2 text-xs">
              Cancel
            </button>
          </div>
          <p className="mt-2 text-[11px] text-soil/65">Free signed message: no gas, nothing leaves your wallet.</p>
        </div>
      ) : (
        <span className="cta-glow w-full">
          <button type="button" onClick={() => setConfirm(true)} className="btn-primary w-full px-3 py-2 text-xs">
            Vote · power <span className="font-mono tabular-nums">{formatCompact(m.power.power)}</span>
          </button>
        </span>
      )}
      {vote.error && (
        <p role="alert" className="text-xs text-moss">
          {vote.error}
        </p>
      )}
    </div>
  );
}
