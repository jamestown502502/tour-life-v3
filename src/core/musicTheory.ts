// Tiny chord-symbol parser so song JSON can specify "Am7-Fmaj7-Cmaj7-G6" as plain text and
// the audio engine derives real frequencies from it, rather than hand-typing Hz values.

const NOTE_SEMITONES: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
};

const QUALITY_INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  7: [0, 4, 7, 10],
  6: [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
};

function freqFromSemitonesFromA4(semitones: number): number {
  return 440 * Math.pow(2, semitones / 12);
}

/** Parses one chord symbol (e.g. "Am7", "Fmaj7", "G6", "C") into frequencies at the given
 *  base octave. Falls back to a C major triad for anything unparseable — content-authoring
 *  typo, not a runtime condition worth throwing over. */
export function parseChord(symbol: string, octave = 3): number[] {
  const match = symbol.trim().match(/^([A-G]#?)(maj7|m7|m6|m|7|6)?$/);
  const rootName = match?.[1] ?? 'C';
  const quality = match?.[2] ?? '';
  const intervals = QUALITY_INTERVALS[quality] ?? QUALITY_INTERVALS[''];
  const rootSemitoneFromA4 = (octave - 4) * 12 + ((NOTE_SEMITONES[rootName] ?? 0) - 9);
  return intervals.map((iv) => freqFromSemitonesFromA4(rootSemitoneFromA4 + iv));
}

/** "Am7-Fmaj7-Cmaj7-G6" -> four chords' worth of frequencies. */
export function parseChordProgression(progression: string, octave = 3): number[][] {
  return progression.split('-').map((symbol) => parseChord(symbol, octave));
}

/** Default cozy pad for screens with no specific song attached (Title, Hub). */
export const DEFAULT_AMBIENCE_CHORDS = parseChordProgression('Am7-Fmaj7-Cmaj7-G6');
export const DEFAULT_AMBIENCE_BPM = 68;
