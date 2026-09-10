import { describe, expect, it } from 'vitest';
import {
  adjustedHitMs, buildPerformanceResult, combineHoldJudgement, comboMultiplier, effectiveWindows,
  judgeHit, letterGrade, pickArrangement, scoreForHit,
} from '../game/rhythm';
import type { SongDef } from '../../content/schema';

describe('rhythm windows and scoring', () => {
  it('judges hits by absolute delta against the given windows', () => {
    const windows = { perfect: 50, good: 100, ok: 160 };
    expect(judgeHit(0, windows)).toBe('perfect');
    expect(judgeHit(-40, windows)).toBe('perfect');
    expect(judgeHit(80, windows)).toBe('good');
    expect(judgeHit(150, windows)).toBe('ok');
    expect(judgeHit(200, windows)).toBe('miss');
  });

  it('wiggle room widens windows without touching scoring; easy scoring changes points without touching windows', () => {
    const standard = effectiveWindows('standard', false);
    const wiggled = effectiveWindows('standard', true);
    expect(wiggled.perfect).toBeGreaterThan(standard.perfect);
    expect(wiggled.ok).toBeGreaterThan(standard.ok);

    const normalGood = scoreForHit('good', 0, false);
    const easyGood = scoreForHit('good', 0, true);
    expect(easyGood).toBeGreaterThan(normalGood);
    // perfect score is identical either way — easy scoring only softens early/late penalties.
    expect(scoreForHit('perfect', 0, false)).toBe(scoreForHit('perfect', 0, true));
  });

  it('relaxed mode has wider windows than expert', () => {
    const relaxed = effectiveWindows('relaxed', false);
    const expert = effectiveWindows('expert', false);
    expect(relaxed.perfect).toBeGreaterThan(expert.perfect);
  });

  it('combo multiplier grows then caps', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(10)).toBeCloseTo(1.2);
    const capped = comboMultiplier(100);
    expect(comboMultiplier(50)).toBe(capped); // caps at combo 50
  });
});

describe('hold-note grading (real, not cosmetic)', () => {
  it('holding through the full duration keeps the start judgement', () => {
    expect(combineHoldJudgement('perfect', 1.0)).toBe('perfect');
    expect(combineHoldJudgement('good', 0.9)).toBe('good');
  });
  it('letting go early softens the judgement one tier', () => {
    expect(combineHoldJudgement('perfect', 0.6)).toBe('good');
    expect(combineHoldJudgement('good', 0.55)).toBe('ok');
  });
  it('releasing before halfway is a miss regardless of how good the press was', () => {
    expect(combineHoldJudgement('perfect', 0.2)).toBe('miss');
    expect(combineHoldJudgement('perfect', 0)).toBe('miss');
  });
});

describe('arrangement selection (story flags mutate the chart)', () => {
  const song: SongDef = {
    id: 'test_song', name: 'Test Song', bpm: 100, lanes: 4, chordProgression: 'C', waveform: 'triangle',
    arrangements: [
      { id: 'base', label: 'Base', description: '', noteDensity: 1, notes: [{ t: 0, l: 0, type: 'tap' }], cues: [] },
      { id: 'alt', label: 'Alt', description: '', noteDensity: 2, notes: [{ t: 0, l: 0, type: 'tap' }, { t: 1, l: 1, type: 'tap' }], cues: [] },
    ],
  };

  it('falls back to the base (first) arrangement with no matching flag', () => {
    expect(pickArrangement(song, []).id).toBe('base');
  });

  it('a story flag unlocks a non-default arrangement — this is the chart mutation proof', () => {
    const picked = pickArrangement(song, ['arrangement_alt']);
    expect(picked.id).toBe('alt');
    expect(picked.notes.length).not.toBe(song.arrangements[0].notes.length);
  });
});

describe('buildPerformanceResult', () => {
  it('never throws and always returns a result, even with zero hits (no-fail mode)', () => {
    const ctx = {
      cityId: 'test', songId: 'test_song', arrangement: { id: 'base', label: '', description: '', noteDensity: 1, notes: [], cues: [] },
      bandHarmony: 50, energy: 50, audienceMood: 0, storyFlags: [],
    };
    const result = buildPerformanceResult([], [], ctx);
    expect(result.grade).toBeDefined();
    expect(result.timingScore).toBe(0);
  });

  it('a run of all-perfect hits scores higher than a run of all-miss hits', () => {
    const ctx = {
      cityId: 'test', songId: 'test_song', arrangement: { id: 'base', label: '', description: '', noteDensity: 1, notes: [], cues: [] },
      bandHarmony: 50, energy: 50, audienceMood: 50, storyFlags: [],
    };
    const perfectResult = buildPerformanceResult(Array(20).fill('perfect'), [], ctx);
    const missResult = buildPerformanceResult(Array(20).fill('miss'), [], ctx);
    expect(perfectResult.timingScore).toBeGreaterThan(missResult.timingScore);
    expect(perfectResult.grade).toBe('perfect');
    expect(missResult.grade).toBe('miss');
    expect(perfectResult.ratio).toBeCloseTo(1);
    expect(missResult.ratio).toBe(0);
  });
});

describe('audio offset calibration (Settings "Audio sync")', () => {
  it('a positive offset judges the same raw tap earlier — the mandatory-for-Android case', () => {
    const windows = { perfect: 50, good: 100, ok: 160 };
    const baseHitMs = 1000;
    // A tap 40ms after the raw note time — 'perfect' with no offset.
    const now = 1040;
    expect(judgeHit(now - adjustedHitMs(baseHitMs, 0), windows)).toBe('perfect');
    // +100ms offset (audio arrives late on this device) shifts the note's judged time earlier,
    // so the same real-world tap now reads as later relative to it — no longer 'perfect'.
    expect(judgeHit(now - adjustedHitMs(baseHitMs, 100), windows)).toBe('ok');
    // -100ms offset shifts the other way.
    expect(judgeHit(now - adjustedHitMs(baseHitMs, -100), windows)).toBe('good');
  });

  it('offset 0 is a no-op', () => {
    expect(adjustedHitMs(12345, 0)).toBe(12345);
  });
});

describe('letter grade (Results plate)', () => {
  it('maps the timing ratio across six bands, so the letter actually says something', () => {
    expect(letterGrade(1)).toBe('S');
    expect(letterGrade(0.9)).toBe('S');
    expect(letterGrade(0.8)).toBe('A');
    expect(letterGrade(0.72)).toBe('A');
    expect(letterGrade(0.5)).toBe('B');
    expect(letterGrade(0.3)).toBe('C');
    expect(letterGrade(0.12)).toBe('D');
    expect(letterGrade(0)).toBe('E');
  });

  // C used to be the floor, so it spanned 0.00-0.50 -- half the whole scale. A player who
  // deliberately touched nothing got the same letter as one who landed 81 of 125 notes, which is
  // not a gentle curve, it is the score refusing to report. Reported live from a zero-score run.
  it('a deliberate zero and a real attempt never share a letter', () => {
    expect(letterGrade(0)).not.toBe(letterGrade(0.462));
    expect(letterGrade(0)).not.toBe(letterGrade(0.30));
  });

  // No-fail means the score never gates the story. It does not mean the letter has to flatter.
  it('still returns a letter for every possible ratio, never a blank', () => {
    for (let r = 0; r <= 1.0001; r += 0.02) {
      expect(['S', 'A', 'B', 'C', 'D', 'E']).toContain(letterGrade(r));
    }
  });

  // The thresholds exist to be reachable, which is a claim about the SCORING, not about the
  // numbers in letterGrade. Reported live as "why always C?": the ratio is measured against a run
  // where every note is 'perfect' (100 pts) and 'good' is worth 60, so a player who landed every
  // single note in the good window scored 0.60 and sat under the old 0.70 floor for B. C was the
  // ceiling for anyone not hitting the +/-50ms window nearly every time, in a game whose premise
  // is that there are no wrong answers.
  it('a player who lands every note in the good window earns at least a B', () => {
    const judgements = Array.from({ length: 60 }, () => 'good' as const);
    const result = buildPerformanceResult(judgements, [], { cityId: 'berlin', songId: 'test_song', arrangement: { id: 'base', label: '', description: '', noteDensity: 1, notes: [], cues: [] }, bandHarmony: 50, energy: 50, audienceMood: 50, storyFlags: [] });
    expect(result.ratio).toBeCloseTo(0.6, 1);
    expect(letterGrade(result.ratio)).not.toBe('C');
  });

  it('reports the judgement breakdown so a score is explainable, not just a letter', () => {
    const judgements = ['perfect', 'good', 'good', 'ok', 'miss', 'miss'] as const;
    const result = buildPerformanceResult([...judgements], [], { cityId: 'berlin', songId: 'test_song', arrangement: { id: 'base', label: '', description: '', noteDensity: 1, notes: [], cues: [] }, bandHarmony: 50, energy: 50, audienceMood: 50, storyFlags: [] });
    expect(result.judgementCounts).toEqual({ perfect: 1, good: 2, ok: 1, miss: 2 });
  });
});
