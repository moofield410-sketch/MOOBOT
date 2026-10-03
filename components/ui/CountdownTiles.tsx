/** Countdown in glass tiles: JetBrains Mono digits with small mist unit labels. */
export function CountdownTiles({ ms, size = "lg" }: { ms: number; size?: "lg" | "sm" }) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const parts = [
    { v: Math.floor(total / 86_400), u: "Days" },
    { v: Math.floor((total % 86_400) / 3_600), u: "Hours" },
    { v: Math.floor((total % 3_600) / 60), u: "Min" },
    { v: total % 60, u: "Sec" },
  ];
  const big = size === "lg";
  return (
    <div className={`flex ${big ? "gap-2 sm:gap-3" : "gap-1.5"}`} role="timer" aria-live="off">
      {parts.map((p) => (
        <div
          key={p.u}
          className={`flex flex-col items-center rounded-xl border border-line bg-wash shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_2px_0_rgb(30_42_28/0.06)] ${big ? "min-w-[4.25rem] px-3 py-3 sm:min-w-[5.5rem] sm:py-4" : "min-w-[3rem] px-2 py-1.5"}`}
        >
          <span className={`font-mono font-semibold leading-none tabular-nums text-soil ${big ? "text-3xl sm:text-5xl" : "text-lg"}`}>
            {String(p.v).padStart(2, "0")}
          </span>
          <span className={`mt-1.5 font-medium uppercase tracking-wider text-fern ${big ? "text-[10px]" : "text-[9px]"}`}>{p.u}</span>
        </div>
      ))}
    </div>
  );
}
