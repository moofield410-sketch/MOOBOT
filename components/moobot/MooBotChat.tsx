"use client";

import { useEffect, useRef, useState } from "react";
import { GATEWAY } from "@/config";

type Turn = { role: "user" | "assistant"; content: string };
type Usage = { enabled: boolean; remainingToday: number; resting: boolean };
type Answer = { ok: true; reply: string; remainingToday: number } | { ok: false; reason: string; message: string; remainingToday?: number };

/** The conversation lives in this browser tab only, so collapsing MooBot doesn't lose it. Never sent anywhere to be saved. */
const STORAGE_KEY = "moobot-chat";
const MAX_INPUT = GATEWAY.chat.maxInputChars;
/** Turns sent with each question (the server accepts up to GATEWAY.chat.maxTurns). */
const HISTORY = GATEWAY.chat.maxTurns;

function load(): Turn[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((t) => (t?.role === "user" || t?.role === "assistant") && typeof t.content === "string") : [];
  } catch {
    return [];
  }
}

/**
 * "Ask MooBot": a small chat inside the floating guide, answered by AI through our own
 * /api/moobot/chat (the browser never talks to Orbio). Hidden entirely while the chat is off.
 */
export function MooBotChat({ onThinking }: { onThinking?: (thinking: boolean) => void }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = load();
    setTurns(saved);
    if (saved.length) setOpen(true);
    fetch("/api/moobot/chat", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Usage>) : null))
      .then(setUsage)
      .catch(() => setUsage(null));
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-20)));
    } catch {
      /* storage unavailable */
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [turns, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!usage?.enabled) return null;

  const outOfQuestions = usage.remainingToday <= 0;
  const blocked = usage.resting || outOfQuestions;

  const send = async () => {
    const q = draft.trim();
    if (!q || busy || blocked) return;
    const next: Turn[] = [...turns, { role: "user", content: q }];
    setTurns(next);
    setDraft("");
    setNotice(null);
    setBusy(true);
    onThinking?.(true);
    try {
      const res = await fetch("/api/moobot/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-HISTORY) }),
      });
      const a = (await res.json()) as Answer;
      if (a.ok) {
        setTurns([...next, { role: "assistant", content: a.reply }]);
        setUsage({ ...usage, remainingToday: a.remainingToday });
      } else {
        setNotice(a.message);
        setUsage({ ...usage, remainingToday: a.remainingToday ?? usage.remainingToday, resting: a.reason === "resting" });
      }
    } catch {
      setNotice("MooBot can't answer right now. Try again a bit later.");
    } finally {
      setBusy(false);
      onThinking?.(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary mt-3 w-full justify-center py-2 text-sm">
        💬 Ask MooBot a question
      </button>
    );
  }

  return (
    <section aria-label="Chat with MooBot" className="mt-3 border-t border-line pt-3">
      <div ref={listRef} className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1 text-sm" aria-live="polite">
        {turns.length === 0 && (
          <p className="rounded-2xl rounded-tl-sm bg-wash px-3 py-2 text-soil">
            Moo! Ask me anything about Moofield: the Tournament, the Masters, $MOOBOT or the games.
          </p>
        )}
        {turns.map((t, i) => (
          <p
            key={i}
            className={`whitespace-pre-line break-words px-3 py-2 ${
              t.role === "user" ? "ml-6 rounded-2xl rounded-tr-sm bg-grass text-milk" : "mr-4 rounded-2xl rounded-tl-sm bg-wash text-soil"
            }`}
          >
            <span className="sr-only">{t.role === "user" ? "You: " : "MooBot: "}</span>
            {t.content}
          </p>
        ))}
        {busy && (
          <p className="mr-4 inline-flex gap-1 rounded-2xl rounded-tl-sm bg-wash px-3 py-3" aria-label="MooBot is typing">
            {[0, 150, 300].map((d) => (
              <span key={d} aria-hidden className="h-1.5 w-1.5 animate-bounce rounded-full bg-fern" style={{ animationDelay: `${d}ms` }} />
            ))}
          </p>
        )}
      </div>

      {(notice || blocked) && (
        <p role="status" className="mt-2 rounded-xl border border-line bg-oat px-3 py-2 text-xs text-soil">
          {notice ??
            (usage.resting
              ? "MooBot is resting until 00:00 UTC. The Docs have every answer in the meantime."
              : "That's all my questions for today. Come back after 00:00 UTC! 🐄")}
        </p>
      )}

      <form
        className="mt-2 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="moobot-chat-input" className="sr-only">
          Your question for MooBot
        </label>
        <textarea
          id="moobot-chat-input"
          ref={inputRef}
          rows={2}
          maxLength={MAX_INPUT}
          value={draft}
          disabled={blocked}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={blocked ? "Back after 00:00 UTC" : "Ask about Moofield…"}
          className="min-h-11 flex-1 resize-none rounded-xl border border-line-strong bg-milk px-3 py-2 text-base text-soil placeholder:text-fern/70 focus:border-grass focus:outline-none sm:text-sm"
        />
        <button type="submit" disabled={busy || blocked || !draft.trim()} className="btn-primary min-h-11 px-4 py-2 text-sm disabled:opacity-50">
          Send
        </button>
      </form>

      <p className="mt-2 text-[11px] leading-snug text-fern">
        {blocked ? "" : `${usage.remainingToday} question${usage.remainingToday === 1 ? "" : "s"} left today. `}
        Answers are written by AI and can be wrong. Not financial advice. Never share your seed phrase.
      </p>
    </section>
  );
}
