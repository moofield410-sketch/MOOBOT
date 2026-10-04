"use client";

import { useEffect, useRef, useState } from "react";

const WIDGET_SRC = "https://platform.x.com/widgets.js";

declare global {
  interface Window {
    twttr?: { widgets?: { load: (el?: Element) => void } };
  }
}

/**
 * Featured posts (X_FEED.featuredPosts), used when no X_BEARER_TOKEN is set. Each starts as a plain
 * link card, and X's own widget script is loaded only once the section scrolls near the screen,
 * with tracking off (data-dnt), so visitors who never get here never load anything from X.
 */
export function XEmbeds({ urls }: { urls: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) return setNear(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near || !ref.current) return;
    if (window.twttr?.widgets) return window.twttr.widgets.load(ref.current);
    if (document.querySelector(`script[src="${WIDGET_SRC}"]`)) return;
    const s = document.createElement("script");
    s.src = WIDGET_SRC;
    s.async = true;
    s.charset = "utf-8";
    document.body.appendChild(s);
  }, [near]);

  return (
    <div ref={ref} className="grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
      {urls.map((url) => (
        <blockquote key={url} className="twitter-tweet card m-0 p-5" data-dnt="true" data-theme="light" data-conversation="none">
          <a href={url} target="_blank" rel="noopener noreferrer" className="link text-sm">
            View this post on X
          </a>
        </blockquote>
      ))}
    </div>
  );
}
