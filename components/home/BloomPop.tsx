"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MooBotMascot, type MascotState } from "@/components/MooBotMascot";
import * as G from "@/lib/bloom-pop";

/**
 * Bloom Pop: a seed shooter on the home page. MooBot balances a seed on his head; aim and launch it
 * into the meadow. Three or more seeds of one kind bloom and pop, and anything left hanging falls.
 * Crowley the crow perches on the branch at the top: every few shots that pop nothing, he drops a
 * new row. Just for fun: the best score stays in this browser and has no value.
 * Grid logic lives in lib/bloom-pop.ts; this file is input, physics and drawing only.
 */

const R = 16;
const TOP = 34;
const { width: W, center } = G.layout(R, TOP);
const H = 580;
const LAUNCH = { x: W / 2, y: H - 78 };
const NEXT = { x: W / 2 - 108, y: H - 44 };
const DEADLINE = LAUNCH.y - R * 2.4;
const SPEED = 640;
const MIN_ANGLE = (10 * Math.PI) / 180;
const MAX_ANGLE = Math.PI - MIN_ANGLE;
const BEST_KEY = "moofield:bloom-pop:best";


type Status = "ready" | "playing" | "over" | "cleared";
type Flying = { x: number; y: number; vx: number; vy: number; kind: number };
type Particle = { x: number; y: number; vx: number; vy: number; kind: number; t: number; mode: "bloom" | "fall" };
type Floater = { x: number; y: number; text: string; t: number };

type Game = {
  grid: G.Grid;
  level: number;
  score: number;
  misses: number;
  current: number;
  next: number;
  angle: number;
  flying: Flying | null;
  particles: Particle[];
  floaters: Floater[];
  crowFlap: number;
};

function rowsFor(level: number) {
  return Math.min(4 + level, 10);
}
function kindsFor(level: number) {
  return level === 1 ? 4 : G.SEED_KINDS;
}

function pickKind(game: Pick<Game, "grid" | "level">) {
  const kinds = G.kindsInGrid(game.grid);
  if (kinds.length === 0) return Math.floor(Math.random() * kindsFor(game.level));
  return kinds[Math.floor(Math.random() * kinds.length)];
}

function newGame(level: number, score: number): Game {
  const grid = G.createGrid(rowsFor(level), kindsFor(level));
  const base = { grid, level };
  return {
    ...base,
    score,
    misses: 0,
    current: pickKind(base),
    next: pickKind(base),
    angle: Math.PI / 2,
    flying: null,
    particles: [],
    floaters: [],
    crowFlap: 0,
  };
}

/** True when a seed at (x, y) touches the ceiling or another seed. */
function hits(grid: G.Grid, x: number, y: number) {
  if (y <= TOP + R) return true;
  for (let r = 0; r < grid.cells.length; r++) {
    const row = grid.cells[r];
    for (let c = 0; c < G.COLS; c++) {
      if (row[c] === G.EMPTY) continue;
      const p = center(grid, r, c);
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < (R * 1.76) ** 2) return true;
    }
  }
  return false;
}

/** Moves a point one step, bouncing off the side walls. */
function step(s: { x: number; y: number; vx: number; vy: number }, dt: number) {
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  if (s.x < R) {
    s.x = 2 * R - s.x;
    s.vx = -s.vx;
  } else if (s.x > W - R) {
    s.x = 2 * (W - R) - s.x;
    s.vx = -s.vx;
  }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function drawSeed(ctx: CanvasRenderingContext2D, x: number, y: number, kind: number, r = R, alpha = 1) {
  const seed = G.SEEDS[kind];
  ctx.globalAlpha = alpha;
  ctx.fillStyle = seed.fill;
  ctx.beginPath();
  ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Soft highlight, top left.
  ctx.fillStyle = "rgb(255 255 255 / 0.28)";
  ctx.beginPath();
  ctx.arc(x - r * 0.32, y - r * 0.36, r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // A glyph per kind, so seeds read without relying on color.
  ctx.fillStyle = seed.ink;
  ctx.strokeStyle = seed.ink;
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.lineCap = "round";
  ctx.beginPath();
  switch (kind) {
    case 0: // leaf
      ctx.ellipse(x, y, r * 0.5, r * 0.25, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = seed.fill;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.3, y + r * 0.3);
      ctx.lineTo(x + r * 0.3, y - r * 0.3);
      ctx.stroke();
      break;
    case 1: // sun
      ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.moveTo(x + Math.cos(a) * r * 0.34, y + Math.sin(a) * r * 0.34);
        ctx.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
      }
      ctx.stroke();
      break;
    case 2: // dew drop
      ctx.moveTo(x, y - r * 0.52);
      ctx.bezierCurveTo(x + r * 0.5, y, x + r * 0.35, y + r * 0.45, x, y + r * 0.45);
      ctx.bezierCurveTo(x - r * 0.35, y + r * 0.45, x - r * 0.5, y, x, y - r * 0.52);
      ctx.fill();
      break;
    case 3: // clover flower
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        ctx.moveTo(x + Math.cos(a) * r * 0.27 + r * 0.17, y + Math.sin(a) * r * 0.27);
        ctx.arc(x + Math.cos(a) * r * 0.27, y + Math.sin(a) * r * 0.27, r * 0.17, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.fillStyle = seed.fill;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 4: // berries
      for (const [dx, dy] of [
        [-0.2, 0.14],
        [0.2, 0.14],
        [0, -0.2],
      ]) {
        ctx.moveTo(x + dx * r + r * 0.18, y + dy * r);
        ctx.arc(x + dx * r, y + dy * r, r * 0.18, 0, Math.PI * 2);
      }
      ctx.fill();
      break;
  }
  ctx.globalAlpha = 1;
}

/** Crowley on his branch, facing the field. `flap` (0 → 1) raises his wing; `misses` fills his dots. */
function drawBranch(ctx: CanvasRenderingContext2D, flap: number, misses: number, font: string) {
  const by = TOP - 6;
  ctx.strokeStyle = "#8a6a45";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(6, by);
  ctx.quadraticCurveTo(W / 2, by - 5, W - 6, by);
  ctx.stroke();
  // Two small leaves on the branch.
  ctx.fillStyle = "#5daa4a";
  for (const [x, rot] of [
    [W * 0.22, -0.6],
    [W * 0.6, 0.5],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, by - 5, 6, 2.6, rot, 0, Math.PI * 2);
    ctx.fill();
  }

  const cx = W - 34;
  const cy = by - 10 - flap * 6;
  ctx.fillStyle = "#2b2f2a";
  // Tail
  ctx.beginPath();
  ctx.moveTo(cx + 8, cy + 2);
  ctx.lineTo(cx + 20, cy + 6);
  ctx.lineTo(cx + 18, cy + 0);
  ctx.closePath();
  ctx.fill();
  // Body and head
  ctx.beginPath();
  ctx.ellipse(cx, cy, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - 9, cy - 7, 6, 0, Math.PI * 2);
  ctx.fill();
  // Beak
  ctx.fillStyle = "#f2b705";
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy - 9);
  ctx.lineTo(cx - 21, cy - 6);
  ctx.lineTo(cx - 14, cy - 4);
  ctx.closePath();
  ctx.fill();
  // Eye
  ctx.fillStyle = "#fffdf7";
  ctx.beginPath();
  ctx.arc(cx - 10, cy - 8, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // Wing
  ctx.fillStyle = "#454b43";
  ctx.beginPath();
  ctx.ellipse(cx + 1, cy - 1 - flap * 4, 7, 4, -0.3 - flap * 0.9, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.strokeStyle = "#8a6a45";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy + 7);
  ctx.lineTo(cx - 3, by);
  ctx.moveTo(cx + 3, cy + 7);
  ctx.lineTo(cx + 3, by);
  ctx.stroke();

  // Miss dots: when they fill up, Crowley drops a row.
  for (let i = 0; i < G.MISSES_PER_ROW; i++) {
    const x = cx - 40 - i * 10;
    ctx.beginPath();
    ctx.arc(x, by - 12, 3, 0, Math.PI * 2);
    if (G.MISSES_PER_ROW - 1 - i < misses) {
      ctx.fillStyle = "#2b2f2a";
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgb(30 42 28 / 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.fillStyle = "rgb(30 42 28 / 0.55)";
  ctx.font = `600 11px ${font}`;
  ctx.textAlign = "left";
  ctx.fillText("Crowley", 10, by - 9);
}

function draw(ctx: CanvasRenderingContext2D, game: Game, status: Status, font: string) {
  ctx.clearRect(0, 0, W, H);

  drawBranch(ctx, Math.max(0, Math.sin(game.crowFlap * 18)) * Math.min(1, game.crowFlap * 3), game.misses, font);

  game.grid.cells.forEach((row, r) =>
    row.forEach((kind, c) => {
      if (kind === G.EMPTY) return;
      const p = center(game.grid, r, c);
      drawSeed(ctx, p.x, p.y, kind);
    }),
  );

  // The line seeds must stay above.
  ctx.strokeStyle = "rgb(30 42 28 / 0.14)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(8, DEADLINE);
  ctx.lineTo(W - 8, DEADLINE);
  ctx.stroke();
  ctx.setLineDash([]);

  // Aim guide: a dotted path that follows the bounce, until it meets a seed.
  if (status === "playing" && !game.flying) {
    const s = { x: LAUNCH.x, y: LAUNCH.y, vx: Math.cos(game.angle), vy: -Math.sin(game.angle) };
    ctx.fillStyle = "#1e2a1c";
    for (let i = 1; i <= 90; i++) {
      step(s, 6);
      if (hits(game.grid, s.x, s.y)) break;
      if (i % 3 === 0) {
        ctx.globalAlpha = 0.35 * (1 - i / 100);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  if (!game.flying && status !== "over") drawSeed(ctx, LAUNCH.x, LAUNCH.y, game.current);
  if (game.flying) drawSeed(ctx, game.flying.x, game.flying.y, game.flying.kind);

  if (status !== "over") {
    drawSeed(ctx, NEXT.x, NEXT.y, game.next, R * 0.72);
    ctx.fillStyle = "rgb(30 42 28 / 0.55)";
    ctx.font = `600 10px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText("NEXT", NEXT.x, NEXT.y + R + 6);
  }

  for (const p of game.particles) {
    if (p.mode === "fall") {
      drawSeed(ctx, p.x, p.y, p.kind, R, Math.max(0, 1 - p.t / 1.1));
      continue;
    }
    // Bloom: five petals open outward and fade.
    const k = Math.min(1, p.t / 0.55);
    ctx.fillStyle = G.SEEDS[p.kind].fill;
    ctx.globalAlpha = 1 - k;
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5 + k * 1.2;
      ctx.beginPath();
      ctx.ellipse(p.x + Math.cos(a) * R * (0.3 + k), p.y + Math.sin(a) * R * (0.3 + k), R * 0.42 * (1 - k * 0.5), R * 0.22, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.font = `700 15px ${font}`;
  ctx.textAlign = "center";
  for (const f of game.floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.t / 0.9);
    ctx.fillStyle = "#1f5a22";
    ctx.fillText(f.text, f.x, f.y - f.t * 36);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BloomPop() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(newGame(1, 0));
  const statusRef = useRef<Status>("ready");
  const pressedRef = useRef(false);
  const moodTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [status, setStatusState] = useState<Status>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [level, setLevel] = useState(1);
  const [mood, setMood] = useState<MascotState>("idle");

  const setStatus = useCallback((s: Status) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  useEffect(() => {
    const saved = Number(localStorage.getItem(BEST_KEY));
    if (saved > 0) setBest(saved);
  }, []);

  useEffect(() => {
    if (score > best) {
      setBest(score);
      try {
        localStorage.setItem(BEST_KEY, String(score));
      } catch {}
    }
  }, [score, best]);

  const cheer = useCallback(() => {
    setMood("happy");
    clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood("idle"), 900);
  }, []);

  /** A flying seed has landed: place it, pop matches, drop orphans, then let Crowley act. */
  const settle = useCallback(
    (f: Flying) => {
      const game = gameRef.current;
      const { grid } = game;
      const [r, c] = G.snapCell(grid, f.x, f.y, R, TOP);
      G.set(grid, r, c, f.kind);
      game.flying = null;

      const group = G.matchGroup(grid, r, c);
      if (group.length >= 3) {
        for (const [gr, gc] of group) {
          const p = center(grid, gr, gc);
          game.particles.push({ ...p, vx: 0, vy: 0, kind: grid.cells[gr][gc], t: 0, mode: "bloom" });
          G.set(grid, gr, gc, G.EMPTY);
        }
        const dropped = G.floating(grid);
        for (const [gr, gc] of dropped) {
          const p = center(grid, gr, gc);
          game.particles.push({ ...p, vx: (Math.random() - 0.5) * 120, vy: -120 - Math.random() * 80, kind: grid.cells[gr][gc], t: 0, mode: "fall" });
          G.set(grid, gr, gc, G.EMPTY);
        }
        const gained = group.length * 10 + dropped.length * 20;
        game.score += gained;
        const at = center(grid, r, c);
        game.floaters.push({ x: at.x, y: at.y, text: `+${gained}`, t: 0 });
        cheer();
      } else if (++game.misses >= G.MISSES_PER_ROW) {
        game.misses = 0;
        game.crowFlap = 0.9;
        G.pushRow(grid, kindsFor(game.level));
      }

      if (G.isEmpty(grid)) {
        game.score += 250 * game.level;
        setScore(game.score);
        setMood("happy");
        setStatus("cleared");
        return;
      }
      setScore(game.score);

      const low = G.lowestRow(grid);
      if (center(grid, low, 0).y + R > DEADLINE) {
        clearTimeout(moodTimer.current);
        setMood("sleeping");
        setStatus("over");
        return;
      }

      // Load the next seed, only with kinds still on the board.
      const kinds = G.kindsInGrid(grid);
      game.current = kinds.includes(game.next) ? game.next : pickKind(game);
      game.next = pickKind(game);
    },
    [cheer, setStatus],
  );

  const shoot = useCallback(() => {
    const game = gameRef.current;
    if (statusRef.current !== "playing" || game.flying) return;
    game.flying = { x: LAUNCH.x, y: LAUNCH.y, vx: Math.cos(game.angle) * SPEED, vy: -Math.sin(game.angle) * SPEED, kind: game.current };
  }, []);

  const swap = useCallback(() => {
    const game = gameRef.current;
    if (statusRef.current !== "playing" || game.flying) return;
    [game.current, game.next] = [game.next, game.current];
  }, []);

  const start = useCallback(
    (nextLevel: number) => {
      const keep = nextLevel > 1 ? gameRef.current.score : 0;
      gameRef.current = newGame(nextLevel, keep);
      setLevel(nextLevel);
      setScore(keep);
      setMood("idle");
      setStatus("playing");
      canvasRef.current?.focus({ preventScroll: true });
    },
    [setStatus],
  );

  // Size the canvas to its box (sharp on high-DPI screens) and run the loop while it's on screen.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const font = getComputedStyle(canvas).fontFamily || "sans-serif";
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const scale = (wrap.clientWidth / W) * (window.devicePixelRatio || 1);
      canvas.width = Math.round(W * scale);
      canvas.height = Math.round(H * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      draw(ctx, gameRef.current, statusRef.current, font);
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
      if (game.flying) {
        const f = game.flying;
        const steps = Math.ceil((SPEED * dt) / 4);
        for (let i = 0; i < steps; i++) {
          step(f, dt / steps);
          if (hits(game.grid, f.x, f.y)) {
            settle(f);
            break;
          }
        }
      }
      for (const p of game.particles) {
        p.t += dt;
        if (p.mode === "fall") {
          p.vy += 1400 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
      }
      game.particles = reduced ? [] : game.particles.filter((p) => p.t < (p.mode === "fall" ? 1.1 : 0.55));
      for (const f of game.floaters) f.t += dt;
      game.floaters = game.floaters.filter((f) => f.t < 0.9);
      game.crowFlap = Math.max(0, game.crowFlap - dt);
      draw(ctx, game, statusRef.current, font);
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
  }, [settle]);

  const toLogical = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * W) / rect.width, y: ((e.clientY - rect.top) * H) / rect.height };
  };

  const aimAt = (p: { x: number; y: number }) => {
    const a = Math.atan2(LAUNCH.y - p.y, p.x - LAUNCH.x);
    gameRef.current.angle = Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, a < 0 ? (p.x < LAUNCH.x ? MAX_ANGLE : MIN_ANGLE) : a));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (statusRef.current !== "playing") return;
    const game = gameRef.current;
    const turn = Math.PI / 60;
    if (e.key === "ArrowLeft") game.angle = Math.min(MAX_ANGLE, game.angle + turn);
    else if (e.key === "ArrowRight") game.angle = Math.max(MIN_ANGLE, game.angle - turn);
    else if (e.key === " " || e.key === "Enter" || e.key === "ArrowUp") shoot();
    else if (e.key === "s" || e.key === "S") swap();
    else return;
    e.preventDefault();
  };

  const playing = status === "playing";

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-3 flex items-center justify-between gap-4 px-1 font-display text-sm text-fern">
        <span>
          Score <span className="ml-1 font-mono text-base font-semibold tabular-nums text-soil">{score}</span>
        </span>
        <span>
          Field <span className="ml-1 font-mono text-base font-semibold tabular-nums text-soil">{level}</span>
        </span>
        <span>
          Best <span className="ml-1 font-mono text-base font-semibold tabular-nums text-soil">{best}</span>
        </span>
      </div>

      <div ref={wrapRef} className="relative w-full overflow-hidden rounded-2xl border border-line bg-milk" style={{ aspectRatio: `${W} / ${H}` }}>
        {/* Soft ground at the bottom, where MooBot stands. */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[13%] bg-[linear-gradient(180deg,transparent,rgb(93_170_74/0.14))]" />
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="img"
          aria-label="Bloom Pop game board. Use the left and right arrow keys to aim, Space to launch, S to swap seeds."
          className={`absolute inset-0 h-full w-full font-display outline-none focus-visible:ring-2 focus-visible:ring-sky ${playing ? "cursor-crosshair touch-none" : ""}`}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            if (!playing) return;
            pressedRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            aimAt(toLogical(e));
          }}
          onPointerMove={(e) => {
            if (playing && (e.pointerType === "mouse" || pressedRef.current)) aimAt(toLogical(e));
          }}
          onPointerUp={(e) => {
            if (!playing || !pressedRef.current) return;
            pressedRef.current = false;
            const p = toLogical(e);
            if ((p.x - NEXT.x) ** 2 + (p.y - NEXT.y) ** 2 < (R * 1.6) ** 2) swap();
            else shoot();
          }}
          onPointerCancel={() => (pressedRef.current = false)}
        />

        {/* MooBot balances the seed on his head. 80 of the board's 368 px wide, centered under the launcher. */}
        <div aria-hidden className="pointer-events-none absolute bottom-[0.6%] left-1/2 w-[22%] -translate-x-1/2">
          <MooBotMascot variant="head" state={mood} size={80} decorative className="h-auto w-full" />
        </div>

        {!playing && (
          <div className="absolute inset-0 grid place-items-center bg-milk/70 p-6 backdrop-blur-[2px]">
            <div className="text-center">
              {status === "ready" && (
                <>
                  <p className="font-display text-2xl font-semibold text-soil">Bloom Pop</p>
                  <p className="mx-auto mt-2 max-w-[16rem] text-sm text-fern">Match three seeds of a kind to make them bloom.</p>
                  <button type="button" className="btn-primary mt-5 px-6 py-3" onClick={() => start(1)}>
                    Play
                  </button>
                </>
              )}
              {status === "over" && (
                <>
                  <p className="font-display text-2xl font-semibold text-soil">The meadow is full</p>
                  <p className="mt-2 text-sm text-fern">
                    You scored <span className="font-mono font-semibold text-soil">{score}</span>
                    {score > 0 && score >= best ? ", a new best." : "."}
                  </p>
                  <button type="button" className="btn-primary mt-5 px-6 py-3" onClick={() => start(1)}>
                    Plant again
                  </button>
                </>
              )}
              {status === "cleared" && (
                <>
                  <p className="font-display text-2xl font-semibold text-soil">Field {level} in bloom!</p>
                  <p className="mt-2 text-sm text-fern">
                    +{250 * level} bonus. Crowley looks annoyed.
                  </p>
                  <button type="button" className="btn-primary mt-5 px-6 py-3" onClick={() => start(level + 1)}>
                    Next field
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 px-1 text-xs text-fern">Aim with your mouse or finger, release to launch. Tap the small seed to swap. Keyboard: ← → to aim, Space to launch, S to swap.</p>
    </div>
  );
}

/** Crowley the crow, for the character card next to the game (matches the canvas drawing). */
export function Crowley({ size = 56, className = "shrink-0" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 56" width={size} height={(size * 56) / 64} aria-hidden className={className}>
      <path d="M4 46 Q32 42 60 46" stroke="#8a6a45" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M40 30 L56 36 L54 28 Z" fill="#2b2f2a" />
      <ellipse cx="34" cy="30" rx="14" ry="10" fill="#2b2f2a" />
      <circle cx="22" cy="20" r="8" fill="#2b2f2a" />
      <path d="M16 17 L6 21 L16 24 Z" fill="#f2b705" />
      <circle cx="20" cy="18.5" r="2.2" fill="#fffdf7" />
      <ellipse cx="36" cy="27" rx="9" ry="5" fill="#454b43" transform="rotate(-18 36 27)" />
      <path d="M30 39 V45 M37 39 V45" stroke="#8a6a45" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
