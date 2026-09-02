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
  it('maps the timing ratio to S/A/B/C with C as the no-fail floor', () => {
    expect(letterGrade(1)).toBe('S');
    expect(letterGrade(0.95)).toBe('S');
    expect(letterGrade(0.9)).toBe('A');
    expect(letterGrade(0.7)).toBe('B');
    expect(letterGrade(0.3)).toBe('C');
    expect(letterGrade(0)).toBe('C');
  });
});
