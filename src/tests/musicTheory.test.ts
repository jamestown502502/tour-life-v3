import { describe, expect, it } from 'vitest';
import { parseChord, parseChordProgression } from '../core/musicTheory';

describe('parseChord', () => {
  it('parses a major triad', () => {
    const freqs = parseChord('C', 4);
    expect(freqs).toHaveLength(3);
    expect(freqs[0]).toBeCloseTo(261.63, 0); // C4
  });

  it('parses a minor 7th chord (Am7) with 4 tones', () => {
    const freqs = parseChord('Am7', 4);
    expect(freqs).toHaveLength(4);
    expect(freqs[0]).toBeCloseTo(440, 0); // A4
  });

  it('parses a major 7th chord (Fmaj7)', () => {
    const freqs = parseChord('Fmaj7', 3);
    expect(freqs).toHaveLength(4);
  });

  it('falls back to a C major triad for an unparseable symbol', () => {
    const freqs = parseChord('???', 4);
    expect(freqs).toHaveLength(3);
    expect(freqs[0]).toBeCloseTo(261.63, 0);
  });
});

describe('parseChordProgression', () => {
  it('splits "Am7-Fmaj7-Cmaj7-G6" into 4 chords', () => {
    const chords = parseChordProgression('Am7-Fmaj7-Cmaj7-G6');
    expect(chords).toHaveLength(4);
    for (const c of chords) expect(c.length).toBeGreaterThanOrEqual(3);
  });
});
