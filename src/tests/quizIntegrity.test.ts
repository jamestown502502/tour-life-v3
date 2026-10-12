// Player feedback 2026-10-12: "move B-flat down a whole step" offered A, A#, B and not the answer
// (A-flat). The note parser only knew sharps, so every flat chord in the songs (Ab, Eb, Bb) fell
// back to C. These tests hold every theory question to having its correct answer on screen.
import { describe, it, expect } from 'vitest';
import { splitChord, transposeChord, parseChord, transposeQuestion } from '../core/musicTheory';
import { SONGS, CITIES } from '../game/content';

const SEMI: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const pc = (chord: string): number => SEMI[splitChord(chord).root];

describe('flat chords', () => {
  it('parse as themselves, not as C', () => {
    expect(splitChord('Bb')).toEqual({ root: 'Bb', quality: '' });
    expect(splitChord('Ebm7')).toEqual({ root: 'Eb', quality: 'm7' });
    expect(parseChord('Bb')).toEqual(parseChord('A#'));
    expect(parseChord('Ab')).not.toEqual(parseChord('C'));
  });
  it('every chord in every song parses to its real root', () => {
    for (const song of SONGS) for (const chord of song.chordProgression.split('-')) {
      expect(splitChord(chord).root, `${song.id}: ${chord}`).toBe(chord.match(/^[A-G][#b]?/)![0]);
    }
  });
  it('transpose keeps flat spelling when asked', () => {
    expect(transposeChord('Bb', -2, true)).toBe('Ab');
    expect(transposeChord('Eb', 7, true)).toBe('Bb');
    expect(transposeChord('Bb', -2)).toBe('G#');
  });
});

describe('the transpose quiz', () => {
  const MOVES = [-2, 2, -1, 5, 7];
  it('always offers the right answer among three different options, for every chord a city can draw', () => {
    for (const city of CITIES) {
      const song = SONGS.find((s) => s.id === city.songId)!;
      const chords = song.chordProgression.split('-');
      const flats = chords.some((c) => /^[A-G]b/.test(c));
      for (const from of chords) for (const semis of MOVES) {
        const { answer, options } = transposeQuestion(from, semis, flats);
        expect(options, `${city.id} ${from} ${semis}`).toContain(answer);
        expect(new Set(options).size).toBe(3);
        expect(((pc(answer) - pc(from)) % 12 + 12) % 12).toBe(((semis % 12) + 12) % 12);
        if (flats) for (const o of options) expect(o, 'a flat-key song spells its answers in flats').not.toMatch(/#/);
      }
    }
  });
  it('the reported question: B-flat down a whole step offers A-flat', () => {
    const { answer, options } = transposeQuestion('Bb', -2, true);
    expect(answer).toBe('Ab');
    expect(options).toContain('Ab');
  });
});

describe('the live-radio clock', () => {
  it('gives enough time to read the question and both answers', async () => {
    const { PRESSURE_MIN_SECONDS } = await import('../const');
    for (const city of CITIES) for (const mg of city.minigames ?? []) {
      if (mg.type !== 'pressure') continue;
      expect(mg.pressureSeconds ?? PRESSURE_MIN_SECONDS, mg.id).toBeGreaterThanOrEqual(PRESSURE_MIN_SECONDS);
    }
    expect(PRESSURE_MIN_SECONDS).toBeGreaterThanOrEqual(6);
  });
});
