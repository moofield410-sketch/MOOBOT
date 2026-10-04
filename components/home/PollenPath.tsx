"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MooBotMascot, type MascotState } from "@/components/MooBotMascot";
import { playSfx, primeSound } from "@/components/sound/engine";
import { GameSoundButton } from "@/components/sound/SoundToggle";
import { dailyFieldId, seededRng, type Rng } from "@/lib/bloom-pop";
import * as P from "@/lib/pollen-path";

/**
 * Pollen Path: a one-tap game on the home page. Bumble the bee circles a flower; tap to dash straight
 * out. Land on the next bud and it blooms, leaving a trail of pollen up the meadow. Miss and Bumble
 * drifts off; once per run MooBot catches him. Today's path is the same for everyone. Just for fun:
 * the best count stays in this browser and has no value.
 * Rules and numbers live in lib/pollen-path.ts; this file is input, motion and drawing only.
 */

const W = 368;
const H = 580;
/** Where the current flower sits on screen (the camera follows it up). */
const ANCHOR_Y = H * 0.7;
const START: P.Point = { x: W / 2, y: 0 };
const BEST_KEY = "moofield:pollen-path:best";

type Status = "ready" | "playing" | "over";
type Dash = { x: number; y: number; vx: number; vy: number; travelled: number; limit: number; missed: boolean };
type Puff = { x: number; y: number; vx: number; vy: number; t: number; color: string };

type Game = {
  path: P.Point[];
  /** Seconds since each flower bloomed (undefined: still a bud). */
  bloomedAt: (number | undefined)[];
  index: number;
  angle: number;
  dash: Dash | null;
  camY: number;
  puffs: Puff[];
  clock: number;
  rng: Rng;
};

function newGame(rng: Rng): Game {
  const path = P.buildPath(4, rng, W, START);
  return { path, bloomedAt: [0], index: 0, angle: Math.PI, dash: null, camY: START.y - ANCHOR_Y, puffs: [], clock: 0, rng };
}

/** Keeps a few buds ready above the current flower. */
function grow(game: Game) {
  while (game.path.length < game.index + 4) {
    game.path.push(P.nextFlower(game.path[game.path.length - 1], game.rng, W, game.path.length));
  }
}

const petal = (i: number) => P.PETALS[i % P.PETALS.length];

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, i: number, open: number) {
  const p = petal(i);
  // Stem and a leaf, so every flower grows from somewhere.
  ctx.strokeStyle = "#5daa4a";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y + 6);
  ctx.quadraticCurveTo(x + 3, y + 18, x, y + 30);
  ctx.stroke();
  ctx.fillStyle = "#5daa4a";
  ctx.beginPath();
  ctx.ellipse(x + 6, y + 22, 6, 2.6, -0.5, 0, Math.PI * 2);
  ctx.fill();

  if (open <= 0) {
    // A closed bud: green cup, a hint of petal on top.
    ctx.fillStyle = p.fill;
    ctx.strokeStyle = p.ring;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y - 4, 7, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#4b9a3c";
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 2);
    ctx.quadraticCurveTo(x, y + 14, x + 10, y - 2);
    ctx.quadraticCurveTo(x, y + 4, x - 10, y - 2);
    ctx.fill();
    return;
  }

  // Petals open outward with a little overshoot.
  const k = Math.min(1, open);
  const s = 1 + Math.sin(k * Math.PI) * 0.12;
  const r = 20 * k * s;
  ctx.fillStyle = p.fill;
  ctx.strokeStyle = p.ring;
  ctx.lineWidth = 1;
  for (let j = 0; j < 7; j++) {
    const a = (j * 2 * Math.PI) / 7 + i;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.26, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = p.heart;
  ctx.beginPath();
  ctx.arc(x, y, 6 * k, 0, Math.PI * 2);
  ctx.fill();
}

/** Bumble, facing `heading` (radians). `flap` drives the wings. */
function drawBee(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, flap: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(1.35, 1.35);
  // Wings
  const w = 0.6 + Math.abs(Math.sin(flap)) * 0.5;
  ctx.fillStyle = "rgb(255 255 255 / 0.85)";
  ctx.strokeStyle = "rgb(79 147 207 / 0.5)";
  ctx.lineWidth = 0.8;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-1, side * 6, 5, 3.4 * w, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Body, stripes, head
  ctx.fillStyle = "#f6c945";
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3b2f22";
  for (const sx of [-3, 1.5]) ctx.fillRect(sx, -5, 2, 10);
  ctx.beginPath();
  ctx.arc(8, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();
  // Sting
  ctx.beginPath();
  ctx.moveTo(-8, -1.2);
  ctx.lineTo(-11, 0);
  ctx.lineTo(-8, 1.2);
  ctx.fill();
  // Eye
  ctx.fillStyle = "#fffdf7";
  ctx.beginPath();
  ctx.arc(9.2, -1.2, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, game: Game, status: Status) {
  ctx.clearRect(0, 0, W, H);
  const sy = (y: number) => y - game.camY;
  const { path, index } = game;

  // Drifting pollen motes, a slow parallax behind the meadow.
  ctx.fillStyle = "rgb(242 183 5 / 0.35)";
  for (let i = 0; i < 18; i++) {
    const x = (i * 97 + 31) % W;
    const y = ((((i * 149 + 57 - game.camY * 0.35) % H) + H) % H) + Math.sin(game.clock * 0.8 + i) * 4;
    ctx.beginPath();
    ctx.arc(x, y, i % 3 === 0 ? 1.8 : 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // The ground the path starts from.
  const gy = sy(START.y + 34);
  if (gy < H + 40) {
    ctx.fillStyle = "rgb(93 170 74 / 0.16)";
    ctx.beginPath();
    ctx.moveTo(0, gy + 8);
    ctx.quadraticCurveTo(W / 2, gy - 10, W, gy + 8);
    ctx.lineTo(W, H + 40);
    ctx.lineTo(0, H + 40);
    ctx.closePath();
    ctx.fill();
  }

  // Pollen trail through every flower reached so far.
  ctx.strokeStyle = "rgb(242 183 5 / 0.75)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i <= index; i++) (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, path[i].x, sy(path[i].y));
  ctx.stroke();

  // A faint dotted hint toward the next bud.
  const next = path[index + 1];
  if (status === "playing" && next) {
    ctx.strokeStyle = "rgb(30 42 28 / 0.18)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.moveTo(path[index].x, sy(path[index].y));
    ctx.lineTo(next.x, sy(next.y));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (let i = 0; i < path.length; i++) {
    const y = sy(path[i].y);
    if (y < -50 || y > H + 50) continue;
    const at = game.bloomedAt[i];
    drawFlower(ctx, path[i].x, y, i, at === undefined ? 0 : Math.min(1, (game.clock - at) / 0.45 + (i === 0 ? 1 : 0)));
  }

  for (const p of game.puffs) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / 0.7);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, sy(p.y), 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Bumble: circling, dashing, or drifting off after a miss.
  if (status === "ready") return;
  const flap = game.clock * 38;
  if (game.dash) {
    const d = game.dash;
    if (!d.missed || d.travelled < d.limit + 220) drawBee(ctx, d.x, sy(d.y), Math.atan2(d.vy, d.vx), flap);
  } else {
    const p = P.orbitPoint(path[index], game.angle);
    const heading = game.angle + (P.spinDirection(index) * Math.PI) / 2;
    drawBee(ctx, p.x, sy(p.y), heading, flap);
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PollenPath() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(newGame(Math.random));
  const statusRef = useRef<Status>("ready");
  const moodTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [status, setStatusState] = useState<Status>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [mood, setMood] = useState<MascotState>("idle");
  /** Once per run, MooBot catches Bumble after a miss. */
  const [caught, setCaught] = useState(false);
  /** Today's path (fixed when the run starts, so midnight doesn't change it). */
  const [day, setDay] = useState<string | null>(null);

  const setStatus = useCallback((s: Status) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const bestKey = `${BEST_KEY}:${day ?? dailyFieldId(Date.now())}`;

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem(bestKey)) || 0);
    } catch {
      setBest(0);
    }
  }, [bestKey]);

  useEffect(() => {
    if (score > best) {
      setBest(score);
      try {
        localStorage.setItem(bestKey, String(score));
      } catch {}
    }
  }, [score, best, bestKey]);

  const cheer = useCallback(() => {
    setMood("happy");
    clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood("idle"), 700);
  }, []);

  const dash = useCallback(() => {
    const game = gameRef.current;
    if (statusRef.current !== "playing" || game.dash) return;
    const from = P.orbitPoint(game.path[game.index], game.angle);
    const target = game.path[game.index + 1];
    game.dash = {
      ...from,
      vx: Math.cos(game.angle) * P.DASH_SPEED,
      vy: Math.sin(game.angle) * P.DASH_SPEED,
      travelled: 0,
      limit: Math.hypot(target.x - from.x, target.y - from.y) + P.OVERSHOOT,
      missed: false,
    };
    playSfx("dash");
  }, []);

  /** A fresh run on today's path. */
  const start = useCallback(() => {
    const today = dailyFieldId(Date.now());
    setDay(today);
    primeSound();
    gameRef.current = newGame(seededRng(`pollen-path:${today}`));
    setScore(0);
    setCaught(false);
    setMood("idle");
    setStatus("playing");
    canvasRef.current?.focus({ preventScroll: true });
  }, [setStatus]);

  /** MooBot catches Bumble: back on the same flower, same count. */
  const catchBee = useCallback(() => {
    const game = gameRef.current;
    game.dash = null;
    setCaught(true);
    playSfx("catch");
    setMood("happy");
    setStatus("playing");
    canvasRef.current?.focus({ preventScroll: true });
  }, [setStatus]);

  // Size the canvas to its box (sharp on high-DPI screens) and run the loop while it's on screen.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const scale = (wrap.clientWidth / W) * (window.devicePixelRatio || 1);
      canvas.width = Math.round(W * scale);
      canvas.height = Math.round(H * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      draw(ctx, gameRef.current, statusRef.current);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.033, last ? (now - last) / 1000 : 0);
      last = now;
      const game = gameRef.current;
      game.clock += dt;
      const playing = statusRef.current === "playing";

      if (game.dash) {
        const d = game.dash;
        const target = game.path[game.index + 1];
        const reach = P.hitRadius(game.index);
        const steps = Math.ceil((P.DASH_SPEED * dt) / 3);
        for (let i = 0; i < steps; i++) {
          d.x += (d.vx * dt) / steps;
          d.y += (d.vy * dt) / steps;
          d.travelled += (P.DASH_SPEED * dt) / steps;
          if (d.missed) continue;
          if ((d.x - target.x) ** 2 + (d.y - target.y) ** 2 <= reach ** 2) {
            // Landed: the bud blooms and Bumble circles it from where he arrived.
            game.index += 1;
            game.angle = Math.atan2(d.y - target.y, d.x - target.x);
            game.bloomedAt[game.index] = game.clock;
            game.dash = null;
            grow(game);
            if (!reduced) {
              const color = petal(game.index).ring;
              for (let j = 0; j < 10; j++) {
                const a = (j * 2 * Math.PI) / 10;
                game.puffs.push({ x: target.x, y: target.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, t: 0, color: j % 2 ? color : "#f2b705" });
              }
            }
            playSfx("bloom", game.index);
            setScore(game.index);
            cheer();
            break;
          }
          if (d.travelled > d.limit || d.x < -P.BEE_R || d.x > W + P.BEE_R) {
            d.missed = true;
            clearTimeout(moodTimer.current);
            setMood("sleeping");
            playSfx("miss");
            setStatus("over");
          }
        }
      } else if (playing) {
        game.angle += P.spinDirection(game.index) * P.orbitSpeed(game.index) * dt;
      }

      for (const p of game.puffs) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
      game.puffs = game.puffs.filter((p) => p.t < 0.7);

      // The camera eases up after the current flower.
      const goal = game.path[game.index].y - ANCHOR_Y;
      game.camY = reduced ? goal : game.camY + (goal - game.camY) * Math.min(1, dt * 5);

      draw(ctx, game, statusRef.current);
      raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      last = 0;
      if (e.isIntersecting) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);

    return () => {
      ro.disconnect();
      io.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(moodTimer.current);
    };
  }, [cheer, setStatus]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (statusRef.current !== "playing") return;
    if (e.key !== " " && e.key !== "Enter" && e.key !== "ArrowUp") return;
    e.preventDefault();
    dash();
  };

  const playing = status === "playing";

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-3 flex items-center justify-between gap-4 px-1 font-display text-sm text-fern">
        <span>
          Flowers <span className="ml-1 font-mono text-base font-semibold tabular-nums text-soil">{score}</span>
        </span>
        <span>
          Today&apos;s best <span className="ml-1 font-mono text-base font-semibold tabular-nums text-soil">{best}</span>
        </span>
        <GameSoundButton />
      </div>

      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-2xl border border-line bg-[linear-gradient(180deg,rgb(127_184_230/0.16),rgb(255_253_247/0.9)_55%,rgb(93_170_74/0.08))]"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="img"
          aria-label="Pollen Path game. Press Space, Enter or tap to make Bumble dash toward the next bud."
          className={`absolute inset-0 h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-sky ${playing ? "cursor-pointer touch-none" : ""}`}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            if (!playing) return;
            e.preventDefault();
            dash();
          }}
        />

        {!playing && (
          <div className="absolute inset-0 grid place-items-center bg-milk/70 p-6 backdrop-blur-[2px]">
            <div className="text-center">
              <MooBotMascot variant="head" state={mood} size={64} decorative className="mx-auto" />
              {status === "ready" && (
                <>
                  <p className="mt-3 font-display text-2xl font-semibold text-soil">Pollen Path</p>
                  <p className="mx-auto mt-2 max-w-[16rem] text-sm text-fern">
                    Tap when Bumble faces the next bud. Every bud you reach blooms. Today&apos;s path is the same for everyone.
                  </p>
                  <button type="button" className="btn-primary mt-5 px-6 py-3" onClick={start}>
                    Fly today&apos;s path
                  </button>
                </>
              )}
              {status === "over" && (
                <>
                  <p className="mt-3 font-display text-2xl font-semibold text-soil">Bumble drifted off</p>
                  <p className="mt-2 text-sm text-fern">
                    You reached <span className="font-mono font-semibold text-soil">{score}</span> {score === 1 ? "flower" : "flowers"} on today&apos;s path
                    {score > 0 && score >= best ? ", a new best." : "."}
                  </p>
                  <div className="mt-5 flex flex-col items-center gap-3">
                    {!caught && (
                      <button type="button" className="btn-primary px-6 py-3" onClick={catchBee}>
                        Let MooBot catch him
                      </button>
                    )}
                    <button type="button" className={`${caught ? "btn-primary" : "btn-secondary"} px-6 py-3`} onClick={start}>
                      Start over
                    </button>
                    {!caught && <p className="text-xs text-fern">MooBot can catch Bumble once per run.</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 px-1 text-xs text-fern">Tap or click the meadow to dash. Keyboard: Space or Enter.</p>
    </div>
  );
}

/** Bumble the bee, for the character card next to the game (matches the canvas drawing). */
export function Bumble({ size = 56, className = "shrink-0" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 56" width={size} height={(size * 56) / 64} aria-hidden className={className}>
      <ellipse cx="28" cy="18" rx="10" ry="7" fill="#fff" stroke="#4f93cf" strokeOpacity="0.5" transform="rotate(-25 28 18)" />
      <ellipse cx="38" cy="16" rx="9" ry="6" fill="#fff" stroke="#4f93cf" strokeOpacity="0.5" transform="rotate(20 38 16)" />
      <path d="M12 32 L5 34 L12 36 Z" fill="#3b2f22" />
      <ellipse cx="30" cy="34" rx="18" ry="12" fill="#f6c945" />
      <rect x="22" y="23" width="4.5" height="22" rx="2" fill="#3b2f22" />
      <rect x="32" y="22.5" width="4.5" height="23" rx="2" fill="#3b2f22" />
      <circle cx="49" cy="33" r="8" fill="#3b2f22" />
      <circle cx="51.5" cy="30.5" r="2.2" fill="#fffdf7" />
      <path d="M48 25 Q50 17 55 16 M52 26 Q56 20 60 21" stroke="#3b2f22" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
