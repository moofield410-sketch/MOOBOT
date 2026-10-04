/**
 * Minimal line-art nature pieces: thin strokes in the brand greens, no fills beyond a light wash.
 * Purely decorative (aria-hidden). Server-safe: plain SVG.
 */

/** A small leafy sprig, used as a section ornament. */
export function Sprig({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 64 28" fill="none" aria-hidden className={className} style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M2 24 C 18 22, 34 16, 62 4" stroke="#2f7a32" strokeOpacity=".55" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16 21 C 14 15, 18 11, 23 10 C 23 15, 20 19, 16 21 Z" fill="#5daa4a" fillOpacity=".35" stroke="#2f7a32" strokeOpacity=".55" strokeWidth="1.1" />
      <path d="M30 17 C 31 11, 36 9, 40 9 C 38 14, 35 16, 30 17 Z" fill="#5daa4a" fillOpacity=".35" stroke="#2f7a32" strokeOpacity=".55" strokeWidth="1.1" />
      <path d="M28 18 C 26 22, 28 26, 33 27 C 33 23, 31 20, 28 18 Z" fill="#5daa4a" fillOpacity=".25" stroke="#2f7a32" strokeOpacity=".5" strokeWidth="1.1" />
      <path d="M44 12 C 46 7, 51 5, 55 6 C 52 10, 49 12, 44 12 Z" fill="#5daa4a" fillOpacity=".35" stroke="#2f7a32" strokeOpacity=".55" strokeWidth="1.1" />
    </svg>
  );
}

/** A centered divider: hairline, sprig, hairline. */
export function SprigDivider({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`flex items-center justify-center gap-4 ${className}`}>
      <span className="h-px w-16 bg-line-strong sm:w-28" />
      <Sprig className="h-5 w-12" />
      <span className="h-px w-16 bg-line-strong sm:w-28" />
    </div>
  );
}

/**
 * Line-art landscape for the hero: a sun, two rolling hill lines, grass tufts and a few
 * dandelion seeds drifting. Scales to its box (preserveAspectRatio none on the hills keeps them wide).
 */
export function HeroLandscape({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 460 480" fill="none" aria-hidden className={className}>
      {/* Sun */}
      <circle cx="230" cy="210" r="150" fill="#f2b705" fillOpacity=".09" />
      <circle cx="230" cy="210" r="150" stroke="#f2b705" strokeOpacity=".45" strokeWidth="1.2" />
      <circle cx="230" cy="210" r="178" stroke="#f2b705" strokeOpacity=".2" strokeWidth="1" strokeDasharray="2 8" />
      {/* Hills */}
      <path d="M0 372 C 80 330, 150 330, 230 356 S 380 384, 460 344 V480 H0 Z" fill="#5daa4a" fillOpacity=".1" />
      <path d="M0 372 C 80 330, 150 330, 230 356 S 380 384, 460 344" stroke="#2f7a32" strokeOpacity=".4" strokeWidth="1.4" />
      <path d="M0 418 C 100 388, 190 398, 270 410 S 400 420, 460 398 V480 H0 Z" fill="#5daa4a" fillOpacity=".12" />
      <path d="M0 418 C 100 388, 190 398, 270 410 S 400 420, 460 398" stroke="#2f7a32" strokeOpacity=".45" strokeWidth="1.4" />
      {/* Grass tufts */}
      {[
        [48, 404],
        [118, 396],
        [356, 410],
        [418, 402],
      ].map(([x, y]) => (
        <path
          key={x}
          d={`M${x} ${y} q -3 -12 -8 -16 M${x} ${y} q 0 -14 2 -20 M${x} ${y} q 4 -10 9 -13`}
          stroke="#2f7a32"
          strokeOpacity=".5"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      ))}
      {/* Dandelion seeds */}
      {[
        [70, 120, 1],
        [392, 86, 0.8],
        [408, 250, 0.7],
      ].map(([x, y, s]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${s})`} stroke="#56634f" strokeOpacity=".45" strokeWidth="1" strokeLinecap="round">
          <path d="M0 0 V14" />
          {[-60, -30, 0, 30, 60].map((a) => (
            <path key={a} d="M0 0 l0 -8" transform={`rotate(${a})`} />
          ))}
        </g>
      ))}
    </svg>
  );
}
