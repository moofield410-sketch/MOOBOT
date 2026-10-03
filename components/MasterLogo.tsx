"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A Master's token icon, laid over the initials avatar. A plain <img>, not next/image: logos come
 * from arbitrary hosts and the optimiser needs sharp (a native binary). The image stays invisible
 * until it has loaded, then fades in; if it fails it is removed, so the initials underneath show
 * and no broken-image icon ever appears. `src` must already be checked by safeLogoUrl.
 * If a Content-Security-Policy is ever added, its img-src must allow https:.
 */
export function MasterLogo({ src, size }: { src: string; size: number }) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");

  // The image may finish (or fail) before hydration attaches onLoad/onError.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete) setState(img.naturalWidth > 0 ? "loaded" : "failed");
  }, [src]);

  if (state === "failed") return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary https hosts; see the note above
    <img
      ref={ref}
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setState("loaded")}
      onError={() => setState("failed")}
      className={`absolute inset-0 h-full w-full rounded-full object-cover transition-opacity duration-300 ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
    />
  );
}
