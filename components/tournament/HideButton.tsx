"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTournamentMe } from "@/components/tournament/useTournament";

/** Moderators only (MODERATOR_WALLETS, signed in): hides a spam or scam pitch, with a reason. */
export function HideButton({ pitchId }: { pitchId: string }) {
  const me = useTournamentMe();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!me.data?.isModerator) return null;

  const hide = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tournament/hide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pitchId, reason }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 text-xs">
      {open ? (
        <div className="space-y-2 rounded-xl border border-moss/30 bg-milk p-3">
          <label className="block">
            <span className="text-soil/80">Why hide this pitch? (shown in the audit log)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className="mt-1 h-9 w-full rounded-lg border border-line bg-milk px-2 text-soil" />
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy || reason.trim().length < 3} onClick={hide} className="btn-primary px-3 py-1.5 text-xs">
              {busy ? "Hiding…" : "Hide pitch"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-3 py-1.5 text-xs">
              Cancel
            </button>
          </div>
          {error && <p className="text-moss">{error}</p>}
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="tap text-soil/60 hover:text-moss">
          Moderator: hide
        </button>
      )}
    </div>
  );
}
