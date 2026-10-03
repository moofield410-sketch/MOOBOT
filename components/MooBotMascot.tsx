import { useId } from "react";

/**
 * MooBot: animated AI-agent robot cow mascot (white metal with cow patches, pink muzzle, LED visor,
 * cowbell collar and a $MOOBOT coin core). Pure SVG + CSS, so it works in Server and Client
 * Components; the animations are defined once in app/globals.css ("MooBot mascot"). Drive `state`
 * from the UI. Every SVG id is prefixed with a per-instance useId(), so many MooBots can share a
 * page. The box size is reserved from the viewBox (width and height attributes) to avoid layout shift.
 */

export type MascotState = "idle" | "talking" | "thinking" | "happy" | "sleeping";
const INK = "#1E2A1C";
const SPOT = "#2B2F2A";
const SHADE = "#CDD5C8";
const PINK = "#F4A6B5";
const PINK_SHADE = "#DE8A9C";
const HORN = "#F1E3B8";
const COLLAR = "#2F7A32";
const LED = "#7CF29A";
const VISOR = "#10201A";
const GOLD_DARK = "#B98600";
const HOOF = "#3B3328";

/** Full body, or the head only (logo, favicon-sized uses). */
const VIEWBOX = { full: [0, 0, 400, 420], head: [34, 14, 332, 234] } as const;

/** Sleeping "z" glyphs as [x, baseline y, size, animation delay in s]. */
const Z_GLYPHS = [
  [300, 78, 30, 0],
  [320, 50, 22, 1.1],
  [284, 42, 16, 2.2],
] as const;

/** Floating leaf bits as [x, y, size, rotation, animation delay in s]. */
const LEAVES = [
  [58, 210, 12, -30, 0],
  [338, 176, 10, 25, 1.2],
  [322, 258, 8, -15, 2.3],
  [78, 146, 8, 40, 0.6],
] as const;

export function MooBotMascot({
  state = "idle",
  size = 240,
  variant = "full",
  eyeOffset,
  className = "",
  title = "MooBot, the AI agent robot cow",
  decorative = false,
}: {
  state?: MascotState;
  /** Rendered width in px (height follows the viewBox, so the box is reserved before paint). */
  size?: number;
  variant?: keyof typeof VIEWBOX;
  /** Moves the eyes toward a point, up to ±6px (used by the look-at wrapper). */
  eyeOffset?: { x: number; y: number };
  className?: string;
  title?: string;
  /** Hide from screen readers when the mascot is purely decorative. */
  decorative?: boolean;
}) {
  const raw = useId();
  const uid = `m${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  const id = (name: string) => `${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;
  const [vx, vy, vw, vh] = VIEWBOX[variant];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      width={size}
      height={Math.round((size * vh) / vw)}
      className={`moobot moobot--${state} shrink-0 ${className}`}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": title })}
    >
      <defs>
        <filter id={id("glow")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={id("metal")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#DDE3D8" />
        </linearGradient>
        <radialGradient id={id("coin")} cx=".35" cy=".35" r=".8">
          <stop offset="0" stopColor="#FFE58A" />
          <stop offset=".55" stopColor="#F2B705" />
          <stop offset="1" stopColor={GOLD_DARK} />
        </radialGradient>
        <clipPath id={id("head-clip")}>
          <rect x="96" y="78" width="208" height="160" rx="70" />
        </clipPath>
        <clipPath id={id("body-clip")}>
          <rect x="108" y="222" width="184" height="112" rx="44" />
        </clipPath>
        <clipPath id={id("visor-clip")}>
          <rect x="127" y="115" width="146" height="50" rx="25" />
        </clipPath>
      </defs>

      {variant === "full" && (
        <>
          <ellipse className="moobot-shadow" cx="200" cy="398" rx="96" ry="11" fill="#1E2A1C" opacity=".18" />
          <g fill="#5DAA4A">
            {LEAVES.map(([x, y, s, r, delay]) => (
              <ellipse
                key={`${x}-${y}`}
                className="moobot-bit"
                cx={x}
                cy={y}
                rx={s / 2}
                ry={s / 4}
                transform={`rotate(${r} ${x} ${y})`}
                style={delay ? { animationDelay: `${delay}s` } : undefined}
              />
            ))}
          </g>
        </>
      )}

      <g className="moobot-bob" stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        {variant === "full" && (
          <>
            {/* tail with a tuft, swishing behind the body */}
            <g className="moobot-tail">
              <path d="M284 262 Q326 258 332 304" fill="none" strokeWidth="8" />
              <path d="M332 296 q12 10 4 26 q-12 -2 -14 -18 Z" fill={SPOT} strokeWidth="4" />
            </g>

            {/* back legs */}
            <rect x="118" y="292" width="34" height="74" rx="14" fill={SHADE} strokeWidth="6" />
            <rect x="248" y="292" width="34" height="74" rx="14" fill={SHADE} strokeWidth="6" />

            {/* body with cel shading and cow patches */}
            <rect x="108" y="222" width="184" height="112" rx="44" fill={url("metal")} stroke="none" />
            <g clipPath={url("body-clip")} stroke="none">
              <ellipse cx="200" cy="344" rx="112" ry="40" fill={SHADE} />
              <path d="M108 250 q20 -16 40 -2 q10 18 -6 32 q-22 10 -34 -6 Z" fill={SPOT} />
              <path d="M262 226 q28 -6 36 18 q2 24 -22 26 q-22 -4 -20 -24 Z" fill={SPOT} />
            </g>
            <rect x="108" y="222" width="184" height="112" rx="44" fill="none" strokeWidth="6" />

            {/* chest plate + $MOOBOT coin core */}
            <rect x="150" y="248" width="100" height="68" rx="22" fill="#F7F3E3" strokeWidth="5" />
            <g className="moobot-coin">
              <circle cx="200" cy="282" r="22" fill={url("coin")} strokeWidth="4" />
              <circle cx="200" cy="282" r="15" fill="none" stroke={GOLD_DARK} strokeWidth="2" />
              {/* "M" drawn as a path: no font dependency, and no stray text in accessible names */}
              <path d="M190 291 V273 L200 284 L210 273 V291" fill="none" stroke="#6B4700" strokeWidth="4.5" />
            </g>

            {/* front legs with hooves */}
            <rect x="140" y="300" width="40" height="72" rx="16" fill={url("metal")} strokeWidth="6" />
            <rect x="220" y="300" width="40" height="72" rx="16" fill={url("metal")} strokeWidth="6" />
            <rect x="135" y="352" width="50" height="24" rx="10" fill={HOOF} strokeWidth="6" />
            <rect x="215" y="352" width="50" height="24" rx="10" fill={HOOF} strokeWidth="6" />
            <path d="M160 356 v18 M240 356 v18" stroke="#6B5E4C" strokeWidth="3" />

            {/* collar with status LEDs and a swinging cowbell */}
            <rect x="136" y="222" width="128" height="18" rx="9" fill={COLLAR} strokeWidth="5" />
            <g fill={LED} stroke="none">
              {[160, 176, 224, 240].map((cx, i) => (
                <circle key={cx} className="moobot-led" cx={cx} cy="231" r="3.2" style={{ animationDelay: `${i * 0.3}s` }} />
              ))}
            </g>
            <g className="moobot-bell">
              <path d="M186 238 Q186 226 200 226 Q214 226 214 238 L218 256 H182 Z" fill={url("coin")} strokeWidth="4" />
              <circle cx="200" cy="258" r="4" fill={GOLD_DARK} strokeWidth="2.5" />
            </g>
          </>
        )}

        <g className="moobot-head">
          {/* floppy ears with pink insides */}
          <g className="moobot-ear-l">
            <path d="M104 128 Q64 112 40 128 Q56 150 104 150 Z" fill={url("metal")} strokeWidth="6" />
            <path d="M96 132 Q68 124 54 131 Q66 143 96 144 Z" fill={PINK} stroke="none" />
          </g>
          <g className="moobot-ear-r">
            <path d="M296 128 Q336 112 360 128 Q344 150 296 150 Z" fill={url("metal")} strokeWidth="6" />
            <path d="M304 132 Q332 124 346 131 Q334 143 304 144 Z" fill={PINK} stroke="none" />
          </g>

          {/* horns */}
          <path d="M132 96 Q108 76 112 44 Q126 58 152 84 Z" fill={HORN} strokeWidth="5" />
          <path d="M268 96 Q292 76 288 44 Q274 58 248 84 Z" fill={HORN} strokeWidth="5" />

          {/* antenna */}
          <rect x="195" y="44" width="10" height="34" rx="3" fill="#A9B1A6" strokeWidth="3" />
          <circle className="moobot-antenna" cx="200" cy="36" r="10" fill={LED} strokeWidth="4" filter={url("glow")} />

          {/* head with cel shading and a cow patch over one eye */}
          <rect x="96" y="78" width="208" height="160" rx="70" fill={url("metal")} stroke="none" />
          <g clipPath={url("head-clip")} stroke="none">
            <ellipse cx="200" cy="258" rx="140" ry="48" fill={SHADE} />
            <path d="M96 96 q38 -26 72 -6 q14 26 -10 46 q-34 18 -62 4 Z" fill={SPOT} />
            <path d="M262 80 q36 4 44 30 q-18 14 -36 2 q-12 -16 -8 -32 Z" fill={SPOT} />
          </g>
          <rect x="96" y="78" width="208" height="160" rx="70" fill="none" strokeWidth="6" />

          {/* cheek bolts */}
          <circle cx="110" cy="182" r="8" fill="#E8EDE4" strokeWidth="4" />
          <circle cx="290" cy="182" r="8" fill="#E8EDE4" strokeWidth="4" />
          <path d="M110 178 v8 M106 182 h8 M290 178 v8 M286 182 h8" strokeWidth="2" />

          {/* LED visor */}
          <rect x="124" y="112" width="152" height="56" rx="28" fill={VISOR} strokeWidth="6" />
          <g clipPath={url("visor-clip")} stroke="none">
            <rect className="moobot-scan" x="124" y="108" width="152" height="6" fill={LED} opacity=".25" />
          </g>
          <g
            className="moobot-eyes"
            stroke="none"
            style={eyeOffset ? { transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)` } : undefined}
          >
            {[168, 232].map((cx) => (
              <g key={cx} className="moobot-eye moobot-eye-open">
                <circle cx={cx} cy="140" r="14" fill={LED} filter={url("glow")} />
                <circle cx={cx + 5} cy="134" r="4.5" fill="#FFFFFF" />
              </g>
            ))}
            <path
              className="moobot-eye-happy"
              d="M155 146 Q168 128 181 146 M219 146 Q232 128 245 146"
              fill="none"
              stroke={LED}
              strokeWidth="7"
              filter={url("glow")}
            />
            {/* sleeping: two thin green lines */}
            <path className="moobot-eye-sleep" d="M155 142 H181 M219 142 H245" fill="none" stroke={LED} strokeWidth="4" opacity=".85" />
          </g>

          {/* pink muzzle, nostrils and smile */}
          <ellipse cx="200" cy="204" rx="72" ry="34" fill={PINK} strokeWidth="5" />
          <ellipse cx="200" cy="218" rx="60" ry="16" fill={PINK_SHADE} stroke="none" opacity=".55" />
          <ellipse cx="176" cy="196" rx="9" ry="6" fill={SPOT} stroke="none" />
          <ellipse cx="224" cy="196" rx="9" ry="6" fill={SPOT} stroke="none" />
          <g className="moobot-mouth">
            <path d="M174 214 Q200 234 226 214 Q200 224 174 214 Z" fill="#6B2D3A" strokeWidth="3.5" />
          </g>
        </g>
      </g>

      {/* sleeping: floating "z" glyphs */}
      <g className="moobot-zzz" fill="none" stroke="#2F7A32" strokeLinecap="round" strokeLinejoin="round">
        {Z_GLYPHS.map(([x, y, s, delay]) => (
          <path
            key={s}
            className="moobot-z"
            d={`M${x} ${y - 0.55 * s} H${x + 0.5 * s} L${x} ${y} H${x + 0.5 * s}`}
            strokeWidth={s * 0.13}
            style={delay ? { animationDelay: `${delay}s` } : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
