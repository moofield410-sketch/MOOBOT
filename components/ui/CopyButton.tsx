"use client";

import { useEffect, useRef, useState } from "react";

/** Copies `text` to the clipboard; a soft cyan glint plays on hover, and "Copied" shows for 2s. */
export function CopyButton({ text, label = "Copy address" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" onClick={copy} className="btn-secondary glint px-3 py-1.5 text-xs">
      <span aria-live="polite" className={copied ? "text-sky" : undefined}>
        {copied ? "Copied" : label}
      </span>
    </button>
  );
}
