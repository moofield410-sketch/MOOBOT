// The site's sound, made with the Web Audio API (no audio files). Game effects play only when
// someone plays; the meadow tune plays only once the visitor turns music on. Everything goes
// through one soft reverb and a limiter, at low volume, and stops while the tab is hidden.
// Browsers only allow sound after a tap or key press, so nothing here starts on page load.

import { DEFAULT_SOUND, PAD_CHORDS, SOUND_KEY, musicPhrase, parseSoundSettings, scaleHz, type SoundSettings } from "@/lib/sound";

// ---------------------------------------------------------------------------
// Settings (shared by every toggle, remembered in this browser)
// ---------------------------------------------------------------------------

let settings: SoundSettings = DEFAULT_SOUND;
let loaded = false;
const listeners = new Set<() => void>();

export function getSoundSettings(): SoundSettings {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      settings = parseSoundSettings(localStorage.getItem(SOUND_KEY));
    } catch {}
  }
  return settings;
}

export const getServerSoundSettings = () => DEFAULT_SOUND;

export function subscribeSound(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Changes settings. Call from a tap or key press: turning music on starts it right away. */
export function setSoundSettings(patch: Partial<SoundSettings>) {
  settings = { ...getSoundSettings(), ...patch };
  try {
    localStorage.setItem(SOUND_KEY, JSON.stringify(settings));
  } catch {}
  listeners.forEach((l) => l());
  if (settings.music) startMusic();
  else stopMusic();
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

type Engine = { ctx: AudioContext; sfx: GainNode; music: GainNode };
let engine: Engine | null = null;

/** A soft room: stereo noise that fades out over `seconds`. */
function impulse(ctx: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

function ensure(): Engine | null {
  if (typeof window === "undefined") return null;
  if (!engine) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();

    // Limiter last, so no combination of sounds ever gets loud.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(limiter);

    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 2.6, 3);
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.45;
    verb.connect(verbOut).connect(master);

    const sfx = ctx.createGain();
    sfx.gain.value = 0.32;
    sfx.connect(master);
    const sfxSend = ctx.createGain();
    sfxSend.gain.value = 0.22;
    sfx.connect(sfxSend).connect(verb);

    const music = ctx.createGain();
    music.gain.value = 0;
    music.connect(master);
    const musicSend = ctx.createGain();
    musicSend.gain.value = 0.7;
    music.connect(musicSend).connect(verb);

    engine = { ctx, sfx, music };

    // Quiet while the tab is hidden; back when it returns.
    document.addEventListener("visibilitychange", () => {
      if (!engine) return;
      if (document.hidden) void engine.ctx.suspend();
      else void engine.ctx.resume();
    });
  }
  if (engine.ctx.state === "suspended" && !document.hidden) void engine.ctx.resume();
  return engine;
}

type Tone = {
  t: number;
  freq: number;
  /** Glide to this frequency by the end. */
  to?: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  attack?: number;
  /** Lowpass cutoff, for softer, warmer tones. */
  lowpass?: number;
  pan?: number;
};

function tone(e: Engine, out: AudioNode, { t, freq, to, dur, gain, type = "sine", attack = 0.005, lowpass, pan }: Tone) {
  const { ctx } = e;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = osc;
  if (lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lowpass;
    f.Q.value = 2;
    node = node.connect(f);
  }
  node = node.connect(env);
  if (pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    node = node.connect(p);
  }
  node.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** A kalimba-like pluck: a pure note, a quiet octave and a tiny click of a third partial. */
function pluck(e: Engine, out: AudioNode, freq: number, t: number, gain: number, dur = 1.4, pan = 0) {
  tone(e, out, { t, freq, dur, gain, pan });
  tone(e, out, { t, freq: freq * 2, dur: dur * 0.4, gain: gain * 0.22, pan });
  tone(e, out, { t, freq: freq * 3, dur: 0.12, gain: gain * 0.06, type: "triangle", pan });
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export type Sfx =
  | "launch"
  | "land"
  | "pop"
  | "fall"
  | "crow"
  | "clear"
  | "over"
  | "dash"
  | "bloom"
  | "miss"
  | "catch"
  | "moo";

/** Plays a short effect if game sounds are on. `n` raises the pitch (bigger pops, higher flowers). */
export function playSfx(name: Sfx, n = 0) {
  if (!getSoundSettings().effects) return;
  const e = ensure();
  if (!e) return;
  const t = e.ctx.currentTime + 0.01;
  const out = e.sfx;
  switch (name) {
    case "launch": // a soft "fwip"
      tone(e, out, { t, freq: 420, to: 760, dur: 0.12, gain: 0.16 });
      break;
    case "land": // a seed settles: a small wooden tap
      tone(e, out, { t, freq: 300, to: 210, dur: 0.09, gain: 0.12, type: "triangle", lowpass: 1200 });
      break;
    case "pop": // a bubble and a note that climbs with the group size
      tone(e, out, { t, freq: 520, to: 1250, dur: 0.06, gain: 0.07 });
      pluck(e, out, scaleHz(3 + Math.min(n, 5)), t + 0.02, 0.2, 1.1);
      break;
    case "fall": // loose seeds drop away
      tone(e, out, { t: t + 0.08, freq: 520, to: 260, dur: 0.35, gain: 0.05 });
      break;
    case "crow": // Crowley: two short, muffled caws
      for (const at of [0, 0.2]) tone(e, out, { t: t + at, freq: 560, to: 410, dur: 0.14, gain: 0.05, type: "sawtooth", lowpass: 900, pan: 0.5 });
      break;
    case "clear": // a field in bloom: four notes up
      [4, 5, 7, 8].forEach((s, i) => pluck(e, out, scaleHz(s), t + i * 0.11, 0.18));
      break;
    case "over": // three notes down, softly
      [7, 5, 2].forEach((s, i) => pluck(e, out, scaleHz(s), t + i * 0.18, 0.14, 1.6));
      break;
    case "dash": // Bumble's buzz: two close, muffled tones
      tone(e, out, { t, freq: 190, to: 240, dur: 0.18, gain: 0.05, type: "sawtooth", lowpass: 1000 });
      tone(e, out, { t, freq: 197, to: 248, dur: 0.18, gain: 0.04, type: "sawtooth", lowpass: 1000 });
      break;
    case "bloom": // a bud opens: the note rises as the path climbs, then starts over
      pluck(e, out, scaleHz(1 + ((n - 1) % 8)), t, 0.2, 1.3);
      break;
    case "miss": // Bumble drifts off
      tone(e, out, { t, freq: 520, to: 190, dur: 0.42, gain: 0.08 });
      break;
    case "catch": // MooBot to the rescue
      [2, 6].forEach((s, i) => pluck(e, out, scaleHz(s), t + i * 0.12, 0.18));
      break;
    case "moo": // a small, soft moo
      tone(e, out, { t, freq: 150, to: 118, dur: 0.55, gain: 0.07, type: "sawtooth", attack: 0.06, lowpass: 650 });
      tone(e, out, { t, freq: 151.5, to: 119, dur: 0.55, gain: 0.05, type: "sawtooth", attack: 0.06, lowpass: 650 });
      break;
  }
}

// ---------------------------------------------------------------------------
// Music: a slow, generative meadow tune
// ---------------------------------------------------------------------------

/** Seconds per beat (eighth notes at about 71 BPM). A bar is 8 beats. */
const BEAT = 0.42;
const BAR = BEAT * 8;
const MUSIC_LEVEL = 0.45;

let musicTimer: ReturnType<typeof setInterval> | undefined;
let nextBarAt = 0;
let bar = 0;
let lastStep = 4;
let birdAt = 0;

function scheduleBar(e: Engine, t: number) {
  const out = e.music;
  // A warm pad that changes every two bars and overlaps the next chord.
  if (bar % 2 === 0) {
    const chord = PAD_CHORDS[(bar / 2) % PAD_CHORDS.length];
    for (const s of chord) {
      for (const detune of [0.997, 1.003]) {
        tone(e, out, { t, freq: scaleHz(s) * detune, dur: BAR * 2 + 1.2, gain: 0.022, type: "triangle", attack: 1.8, lowpass: 700 });
      }
    }
  }
  // A few plucked notes on top, with plenty of rests.
  const phrase = musicPhrase(Math.random, lastStep);
  for (const n of phrase) pluck(e, out, scaleHz(n.step), t + n.beat * BEAT, 0.06, 1.8, (Math.random() - 0.5) * 0.5);
  if (phrase.length) lastStep = phrase[phrase.length - 1].step;
  bar++;

  // Now and then, a distant bird.
  if (t > birdAt) {
    const pan = Math.random() < 0.5 ? -0.7 : 0.7;
    const chirps = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < chirps; i++) {
      tone(e, out, { t: t + 0.6 + i * 0.12, freq: 2500 + Math.random() * 300, to: 3300, dur: 0.07, gain: 0.012, pan });
    }
    birdAt = t + 18 + Math.random() * 30;
  }
}

function startMusic() {
  const e = ensure();
  if (!e || musicTimer) return;
  const now = e.ctx.currentTime;
  e.music.gain.cancelScheduledValues(now);
  e.music.gain.setTargetAtTime(MUSIC_LEVEL, now, 1.2);
  nextBarAt = now + 0.2;
  birdAt = now + 10 + Math.random() * 15;
  const tick = () => {
    while (nextBarAt < e.ctx.currentTime + 1.2) {
      scheduleBar(e, nextBarAt);
      nextBarAt += BAR;
    }
  };
  tick();
  musicTimer = setInterval(tick, 300);
}

function stopMusic() {
  if (!musicTimer || !engine) return;
  clearInterval(musicTimer);
  musicTimer = undefined;
  const now = engine.ctx.currentTime;
  engine.music.gain.cancelScheduledValues(now);
  engine.music.gain.setTargetAtTime(0, now, 0.4);
}

/** Creates the audio engine during a tap (browsers require one), e.g. when a game starts. */
export function primeSound() {
  if (getSoundSettings().effects || getSoundSettings().music) ensure();
}

let unlockInstalled = false;
/** If music was on last visit, it starts on the visitor's first tap or key press. */
export function installSoundUnlock() {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const unlock = () => {
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
    if (getSoundSettings().music) startMusic();
  };
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
}
