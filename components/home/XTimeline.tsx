"use client";

import { useEffect, useRef, useState } from "react";
import { XIcon } from "@/components/ui/Icons";

const WIDGET_SRC = "https://platform.x.com/widgets.js";
/** How long to wait for X to draw the timeline before showing the fallback. */
const RENDER_TIMEOUT_MS = 10_000;

declare global {
  interface Window {
    twttr?: { widgets?: { load: (el?: Element) => void } };
  }
}

type State = "waiting" | "loading" | "shown" | "unavailable";

/**
 * The account's X timeline via X's own widget script. Nothing loads from X until the section is
 * near the screen, tracking is off (data-dnt), and X's markup lives in a node React never touches
 * (the widget replaces it with an iframe). If no iframe appears in time, a fallback card shows.
 */
export function XTimeline({ url, handle }: { url: string; handle: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("waiting");

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    if (!("IntersectionObserver" in window)) return setState("loading");
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setState("loading");
        io.disconnect();
      },
      { rootMargin: "300px" },
    );
    io.observe(box);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (state !== "loading" || !mount) return;

    const a = document.createElement("a");
    a.className = "twitter-timeline";
    a.href = url;
    a.textContent = `Posts by @${handle}`;
    a.dataset.height = "560";
    a.dataset.dnt = "true";
    a.dataset.theme = "light";
    a.dataset.chrome = "noheader nofooter noborders transparent";
    mount.replaceChildren(a);

    if (window.twttr?.widgets) window.twttr.widgets.load(mount);
    else if (!document.querySelector(`script[src="${WIDGET_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = WIDGET_SRC;
      s.async = true;
      s.charset = "utf-8";
      document.body.appendChild(s);
    }

    // X inserts an iframe even when it won't show posts (it stays 0×0), so only a drawn one counts.
    const drawn = () => [...mount.querySelectorAll("iframe")].some((f) => f.offsetHeight > 80);
    const poll = setInterval(() => {
      if (!drawn()) return;
      clearInterval(poll);
      clearTimeout(timer);
      setState("shown");
    }, 400);
    const timer = setTimeout(() => {
      clearInterval(poll);
      setState(drawn() ? "shown" : "unavailable");
    }, RENDER_TIMEOUT_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(timer);
    };
  }, [state, url, handle]);

  return (
    <div ref={boxRef} className="card relative min-h-[22rem] overflow-hidden p-2 sm:p-3">
      <div ref={mountRef} className={state === "unavailable" ? "hidden" : ""} />
      {(state === "waiting" || state === "loading") && (
        <div className="absolute inset-0 grid place-items-center p-8" aria-busy="true">
          <div className="w-full max-w-sm space-y-3">
            <div className="skeleton h-3 w-2/3" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-5/6" />
            <p className="pt-2 text-center text-sm text-fern">Loading posts from @{handle}…</p>
          </div>
        </div>
      )}
      {state === "unavailable" && (
        <div className="flex min-h-[21rem] flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-soil text-milk">
            <XIcon className="h-5 w-5" />
          </span>
          <p className="font-display text-lg font-semibold text-soil">See the latest posts on X</p>
          <p className="max-w-xs text-sm text-fern">X didn&apos;t show the timeline here (it sometimes asks visitors to log in first).</p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-1">
            Open @{handle}
          </a>
        </div>
      )}
    </div>
  );
}
