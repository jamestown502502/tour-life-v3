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

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface ParsedChord { root: string; quality: string }
export function splitChord(symbol: string): ParsedChord {
  const match = symbol.trim().match(/^([A-G]#?)(maj7|m7|m6|m|7|6)?$/);
  return { root: match?.[1] ?? 'C', quality: match?.[2] ?? '' };
}
/** "Am7" moved by `semitones` → "Cm7". Quality is preserved; the root wraps around the octave. */
export function transposeChord(symbol: string, semitones: number): string {
  const { root, quality } = splitChord(symbol);
  const idx = ((NOTE_SEMITONES[root] ?? 0) + semitones + 120) % 12;
  return `${NOTE_NAMES[idx]}${quality}`;
}
export const QUALITY_LABELS: Record<string, string> = {
  '': 'Major', m: 'Minor', 7: 'Dominant seventh', maj7: 'Major seventh', 6: 'Sixth', m7: 'Minor seventh', m6: 'Minor sixth',
};
export const QUALITY_HINTS: Record<string, string> = {
  '': 'bright and settled',
  m: 'the third is lowered, and the whole chord aches',
  7: 'a major chord with a restless top note that wants to move somewhere',
  maj7: 'a major chord with a dreamy top note that is happy to stay',
};
export function chordFrequencies(symbol: string, octave = 3): number[] { return parseChord(symbol, octave); }

/** Default cozy pad for screens with no specific song attached (Title, Hub). */
export const DEFAULT_AMBIENCE_CHORDS = parseChordProgression('Am7-Fmaj7-Cmaj7-G6');
export const DEFAULT_AMBIENCE_BPM = 68;
