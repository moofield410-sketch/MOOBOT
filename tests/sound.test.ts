import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { seededRng } from "@/lib/bloom-pop";
import { DEFAULT_SOUND, MELODY_HIGH, MELODY_LOW, PAD_CHORDS, musicPhrase, parseSoundSettings, scaleHz } from "@/lib/sound";

describe("sound settings", () => {
  it("defaults to game sounds on and music off", () => {
    assert.deepEqual(DEFAULT_SOUND, { effects: true, music: false });
    assert.deepEqual(parseSoundSettings(null), DEFAULT_SOUND);
  });

  it("keeps stored choices and ignores junk", () => {
    assert.deepEqual(parseSoundSettings('{"effects":false,"music":true}'), { effects: false, music: true });
    assert.deepEqual(parseSoundSettings('{"music":true}'), { effects: true, music: true });
    assert.deepEqual(parseSoundSettings('{"effects":"no","music":1}'), DEFAULT_SOUND);
    assert.deepEqual(parseSoundSettings("not json"), DEFAULT_SOUND);
  });
});

describe("meadow tune", () => {
  it("tunes the scale to D major pentatonic", () => {
    const close = (a: number, b: number) => Math.abs(a - b) < 0.05;
    assert.ok(close(scaleHz(0), 293.66)); // D4
    assert.ok(close(scaleHz(3), 440)); // A4
    assert.ok(close(scaleHz(5), 587.33)); // D5
    assert.ok(close(scaleHz(-5), 146.83)); // D3
    assert.ok(close(scaleHz(-1), 246.94)); // B3
  });

  it("writes phrases inside the calm range, in order, within the bar", () => {
    const rng = seededRng("tune");
    let from = 4;
    for (let bar = 0; bar < 200; bar++) {
      const phrase = musicPhrase(rng, from);
      let lastBeat = -1;
      for (const n of phrase) {
        assert.ok(n.step >= MELODY_LOW && n.step <= MELODY_HIGH, `step ${n.step}`);
        assert.ok(n.beat > lastBeat && n.beat + n.beats <= 8, `beat ${n.beat}`);
        lastBeat = n.beat;
      }
      if (phrase.length) from = phrase[phrase.length - 1].step;
    }
    // Never shriller than A5.
    assert.ok(scaleHz(MELODY_HIGH) < 900);
  });

  it("builds pad chords from three different notes below the melody", () => {
    for (const chord of PAD_CHORDS) {
      assert.equal(new Set(chord).size, 3);
      assert.ok(chord.every((s) => s < MELODY_LOW));
    }
  });
});
