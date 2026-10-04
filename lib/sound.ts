// Sound settings and the meadow tune's notes. Pure (tested); components/sound/engine.ts makes the
// actual sound with the browser's Web Audio API. Every sound is synthesized: no audio files.

import type { Rng } from "@/lib/bloom-pop";

export type SoundSettings = { effects: boolean; music: boolean };

/** Game sounds on (they only play when someone plays); music off until the visitor turns it on. */
export const DEFAULT_SOUND: SoundSettings = { effects: true, music: false };

export const SOUND_KEY = "moofield:sound";

/** Reads stored settings; anything missing or malformed falls back to the default. */
export function parseSoundSettings(raw: string | null): SoundSettings {
  try {
    const v = JSON.parse(raw ?? "null") as Partial<SoundSettings> | null;
    return {
      effects: typeof v?.effects === "boolean" ? v.effects : DEFAULT_SOUND.effects,
      music: typeof v?.music === "boolean" ? v.music : DEFAULT_SOUND.music,
    };
  } catch {
    return { ...DEFAULT_SOUND };
  }
}

/** D major pentatonic: no note in it clashes with another, so random melodies always sound calm. */
const PENTATONIC = [0, 2, 4, 7, 9];
/** D4, in semitones from A4. */
const ROOT = -7;

/** Frequency of scale step `step` (0 = D4; 5 = D5; negative steps go down). */
export function scaleHz(step: number) {
  const octave = Math.floor(step / PENTATONIC.length);
  const degree = ((step % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length;
  return 440 * 2 ** ((ROOT + octave * 12 + PENTATONIC[degree]) / 12);
}

/** Melody range, in scale steps: D4 up to A5. Kept low and narrow so nothing gets shrill. */
export const MELODY_LOW = 0;
export const MELODY_HIGH = 8;

export type Note = { step: number; beat: number; beats: number };

/**
 * One bar-long phrase of the meadow tune: mostly small steps, often a rest, never outside the
 * range. `from` is where the last phrase ended, so phrases join smoothly.
 */
export function musicPhrase(rng: Rng, from: number, beats = 8): Note[] {
  const notes: Note[] = [];
  let step = Math.min(MELODY_HIGH, Math.max(MELODY_LOW, from));
  for (let beat = 0; beat < beats; ) {
    const len = rng() < 0.7 ? 1 : 2;
    if (rng() < 0.45) {
      beat += len;
      continue;
    }
    const move = [-2, -1, -1, 0, 1, 1, 2][Math.floor(rng() * 7)];
    step = Math.min(MELODY_HIGH, Math.max(MELODY_LOW, step + move));
    notes.push({ step, beat, beats: Math.min(len, beats - beat) });
    beat += len;
  }
  return notes;
}

/** Slow pad chords under the melody, from scale notes only (steps below D4): D, Bm, Esus, Asus. */
export const PAD_CHORDS = [
  [-5, -3, -2], // D3 F#3 A3
  [-6, -5, -3], // B2 D3 F#3
  [-4, -2, -1], // E3 A3 B3
  [-7, -5, -4], // A2 D3 E3
];
