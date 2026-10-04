/**
 * Shared drawing pieces for the Moofield posters. Each helper returns SVG markup in the poster's
 * own pixel space. Shapes match the website: Bumble and Crowley from the games, the five Bloom Pop
 * seeds, the five Pollen Path flowers, MooBot from public/moobot-assets.
 */
const MOOBOT_SRC = "../../public/moobot-assets/moobot-agent.svg";

const SEEDS = [
  { name: "Leaf", fill: "#5daa4a", ink: "#fffdf7" },
  { name: "Sun", fill: "#f2b705", ink: "#6b4700" },
  { name: "Dew", fill: "#4fa3d9", ink: "#fffdf7" },
  { name: "Clover", fill: "#8a5bb8", ink: "#fffdf7" },
  { name: "Berry", fill: "#e0654f", ink: "#fffdf7" },
];

const PETALS = [
  { name: "Daisy", fill: "#fffdf7", ring: "#e3dccb", heart: "#f2b705" },
  { name: "Clover", fill: "#b48ad9", ring: "#8f5fc0", heart: "#fff3c4" },
  { name: "Buttercup", fill: "#f6c945", ring: "#d9a514", heart: "#8a6a45" },
  { name: "Bluebell", fill: "#7fb8e6", ring: "#4f93cf", heart: "#fffdf7" },
  { name: "Poppy", fill: "#ec7a62", ring: "#d4553b", heart: "#2b2f2a" },
];

const deg = (rad) => (rad * 180) / Math.PI;

/** Filters and gradients the pieces below rely on. Put once inside the scene <svg>. */
function defs() {
  return `<defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#1e2a1c" flood-opacity=".14" />
    </filter>
    <radialGradient id="coin" cx=".35" cy=".35" r=".8">
      <stop offset="0" stop-color="#FFE58A" /><stop offset=".55" stop-color="#F2B705" /><stop offset="1" stop-color="#B98600" />
    </radialGradient>
  </defs>`;
}

/** The line-art sun from the hero: a wash, a thin gold ring and a dotted outer ring. */
function sunRing(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f2b705" fill-opacity=".1" />
    <circle cx="${cx}" cy="${cy}" r="${r}" stroke="#f2b705" stroke-opacity=".55" stroke-width="2" fill="none" />
    <circle cx="${cx}" cy="${cy}" r="${r + r * 0.15}" stroke="#f2b705" stroke-opacity=".28" stroke-width="1.6" fill="none"
      stroke-dasharray="3 12" stroke-linecap="round" />`;
}

/**
 * MooBot standing with his hooves on `groundY`, centered on `cx`, `h` px tall.
 * mood "happy" swaps the round eyes for the smiling arcs the site uses when he cheers.
 */
function moobot(cx, groundY, h, mood = "idle") {
  const s = h / 420;
  const x = cx - 200 * s;
  const y = groundY - 376 * s;
  let out = `<image href="${MOOBOT_SRC}" x="${x}" y="${y}" width="${400 * s}" height="${h}" />`;
  if (mood === "happy") {
    out += `<g transform="translate(${x} ${y}) scale(${s})" stroke-linecap="round" stroke-linejoin="round">
      <rect x="124" y="112" width="152" height="56" rx="28" fill="#10201A" stroke="#1E2A1C" stroke-width="6" />
      <path d="M155 146 Q168 128 181 146 M219 146 Q232 128 245 146" fill="none" stroke="#7CF29A" stroke-width="7" filter="url(#glow)" />
    </g>`;
  }
  return out;
}
/** Where a point in MooBot's own 400 x 420 drawing lands on the poster. */
function moobotPoint(cx, groundY, h, px, py) {
  const s = h / 420;
  return [cx - 200 * s + px * s, groundY - 376 * s + py * s];
}

/** A Bloom Pop seed: a colored ball with a soft highlight and its glyph. */
function seed(kind, x, y, r) {
  const { fill, ink } = SEEDS[kind];
  const w = Math.max(1, r * 0.1);
  let g = "";
  if (kind === 0) {
    g = `<ellipse rx="${r * 0.5}" ry="${r * 0.25}" transform="rotate(-45)" fill="${ink}" />
      <path d="M${-r * 0.3} ${r * 0.3} L${r * 0.3} ${-r * 0.3}" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" />`;
  } else if (kind === 1) {
    const rays = Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return `M${Math.cos(a) * r * 0.34} ${Math.sin(a) * r * 0.34} L${Math.cos(a) * r * 0.5} ${Math.sin(a) * r * 0.5}`;
    }).join(" ");
    g = `<circle r="${r * 0.22}" fill="${ink}" /><path d="${rays}" stroke="${ink}" stroke-width="${w}" stroke-linecap="round" />`;
  } else if (kind === 2) {
    g = `<path d="M0 ${-r * 0.52} C ${r * 0.5} 0, ${r * 0.35} ${r * 0.45}, 0 ${r * 0.45} C ${-r * 0.35} ${r * 0.45}, ${-r * 0.5} 0, 0 ${-r * 0.52} Z" fill="${ink}" />`;
  } else if (kind === 3) {
    g = Array.from({ length: 5 }, (_, i) => {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      return `<circle cx="${Math.cos(a) * r * 0.27}" cy="${Math.sin(a) * r * 0.27}" r="${r * 0.17}" fill="${ink}" />`;
    }).join("") + `<circle r="${r * 0.11}" fill="${fill}" />`;
  } else {
    g = [[-0.2, 0.14], [0.2, 0.14], [0, -0.2]].map(([dx, dy]) => `<circle cx="${dx * r}" cy="${dy * r}" r="${r * 0.18}" fill="${ink}" />`).join("");
  }
  return `<g transform="translate(${x} ${y})" filter="url(#soft)">
    <circle r="${r - 0.5}" fill="${fill}" />
    <circle cx="${-r * 0.32}" cy="${-r * 0.36}" r="${r * 0.28}" fill="rgb(255 255 255 / .28)" />${g}</g>`;
}

/** A Pollen Path flower in full bloom, with its stem and leaf. `s` scales it (1 = game size). */
function flower(kind, x, y, s = 1) {
  const p = PETALS[kind];
  const r = 20;
  const petals = Array.from({ length: 7 }, (_, j) => {
    const a = (j * 2 * Math.PI) / 7 + kind;
    return `<ellipse cx="${Math.cos(a) * r * 0.55}" cy="${Math.sin(a) * r * 0.55}" rx="${r * 0.5}" ry="${r * 0.26}"
      transform="rotate(${deg(a)} ${Math.cos(a) * r * 0.55} ${Math.sin(a) * r * 0.55})" />`;
  }).join("");
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 6 Q3 18 0 30 Q -2 40 0 48" stroke="#5daa4a" stroke-width="2.2" stroke-linecap="round" fill="none" />
    <ellipse cx="6" cy="26" rx="7" ry="3" transform="rotate(-29 6 26)" fill="#5daa4a" />
    <g fill="${p.fill}" stroke="${p.ring}" stroke-width="1">${petals}</g>
    <circle r="6" fill="${p.heart}" /></g>`;
}

/** Bumble the bee (64 x 56 drawing), top-left at x, y. `flip` makes him face left. */
function bumble(x, y, s = 1, rot = 0, flip = false) {
  const f = flip ? `translate(64 0) scale(-1 1)` : "";
  return `<g transform="translate(${x} ${y}) rotate(${rot} ${32 * s} ${28 * s}) scale(${s})"><g transform="${f}">
    <ellipse cx="28" cy="18" rx="10" ry="7" fill="#fff" stroke="#4f93cf" stroke-opacity="0.5" transform="rotate(-25 28 18)" />
    <ellipse cx="38" cy="16" rx="9" ry="6" fill="#fff" stroke="#4f93cf" stroke-opacity="0.5" transform="rotate(20 38 16)" />
    <path d="M12 32 L5 34 L12 36 Z" fill="#3b2f22" />
    <ellipse cx="30" cy="34" rx="18" ry="12" fill="#f6c945" />
    <rect x="22" y="23" width="4.5" height="22" rx="2" fill="#3b2f22" />
    <rect x="32" y="22.5" width="4.5" height="23" rx="2" fill="#3b2f22" />
    <circle cx="49" cy="33" r="8" fill="#3b2f22" />
    <circle cx="51.5" cy="30.5" r="2.2" fill="#fffdf7" />
    <path d="M48 25 Q50 17 55 16 M52 26 Q56 20 60 21" stroke="#3b2f22" stroke-width="1.6" fill="none" stroke-linecap="round" />
  </g></g>`;
}

/** Crowley the crow on a fence post. (x, y) is the top of the post; he faces left, toward MooBot. */
function crowley(x, y, s = 1, { hat = false, postH = 70 } = {}) {
  const hatSvg = hat
    ? `<g stroke="#1e2a1c" stroke-width="1" stroke-linejoin="round">
        <path d="M15 14 L28 11.5 L19.5 -4 Z" fill="#8a5bb8" />
        <circle cx="19" cy="7" r="1.3" fill="#f6c945" stroke="none" /><circle cx="22.5" cy="9.5" r="1.1" fill="#7fb8e6" stroke="none" /><circle cx="20.5" cy="2" r="1" fill="#fffdf7" stroke="none" />
        <circle cx="19.5" cy="-4.5" r="2.4" fill="#f2b705" />
      </g>`
    : "";
  return `<rect x="${x - 8 * s}" y="${y}" width="${16 * s}" height="${postH}" rx="${3 * s}" fill="#a07c52" stroke="#8a6a45" stroke-width="1.5" />
    <path d="M${x - 8 * s} ${y + 14 * s} h${16 * s}" stroke="#8a6a45" stroke-width="1.2" stroke-opacity=".6" />
    <g transform="translate(${x - 32 * s} ${y - 44 * s}) scale(${s})">
      <path d="M4 46 Q32 42 60 46" stroke="#8a6a45" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <path d="M40 30 L56 36 L54 28 Z" fill="#2b2f2a" />
      <ellipse cx="34" cy="30" rx="14" ry="10" fill="#2b2f2a" />
      <circle cx="22" cy="20" r="8" fill="#2b2f2a" />
      <path d="M16 17 L6 21 L16 24 Z" fill="#f2b705" />
      <circle cx="20" cy="18.5" r="2.2" fill="#fffdf7" />
      <ellipse cx="36" cy="27" rx="9" ry="5" fill="#454b43" transform="rotate(-18 36 27)" />
      <path d="M30 39 V45 M37 39 V45" stroke="#8a6a45" stroke-width="2" stroke-linecap="round" />
      ${hatSvg}
    </g>`;
}

function dandelion(x, y, s = 1, rot = 0) {
  const rays = [-60, -30, 0, 30, 60].map((a) => `<path d="M0 0 l0 -8" transform="rotate(${a})" />`).join("");
  return `<g transform="translate(${x} ${y}) scale(${s}) rotate(${rot})" stroke="#56634f" stroke-opacity=".45" stroke-width="${1.6 / s}"
    stroke-linecap="round" fill="none"><path d="M0 0 V14" />${rays}</g>`;
}

function tuft(x, y, s = 1) {
  return `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0 q -4 -16 -11 -21 M0 0 q 0 -19 3 -27 M0 0 q 6 -14 13 -18"
    stroke="#2f7a32" stroke-opacity=".55" stroke-width="${2 / s}" stroke-linecap="round" fill="none" />`;
}

/** A soft filled hill with a thin outline (the footer waves). */
function hill(d, fill) {
  return `<path d="${d} V2000 H-50 Z" fill="${fill}" /><path d="${d}" stroke="#2f7a32" stroke-opacity=".42" stroke-width="2" fill="none" />`;
}

/** A dotted pollen trail. */
function trail(d) {
  return `<path d="${d}" stroke="#f2b705" stroke-opacity=".8" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 11" fill="none" />`;
}

/** Party bunting along a sagging string from (x1, y) to (x2, y). */
function bunting(x1, x2, y, sag, n, colors) {
  const pt = (t) => [x1 + (x2 - x1) * t, y + 4 * sag * t * (1 - t)];
  let flags = "";
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pt((i + 0.15) / n);
    const [bx, by] = pt((i + 0.85) / n);
    const [mx, my] = pt((i + 0.5) / n);
    flags += `<path d="M${ax} ${ay} L${bx} ${by} L${mx} ${my + 46} Z" fill="${colors[i % colors.length]}" stroke="rgb(30 42 28 / .12)" stroke-width="1" />`;
  }
  return `<path d="M${x1} ${y} Q${(x1 + x2) / 2} ${y + 2 * sag} ${x2} ${y}" stroke="#8a6a45" stroke-width="2" fill="none" />${flags}`;
}

/** Repeatable "random" numbers, so a re-render gives the same picture. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
