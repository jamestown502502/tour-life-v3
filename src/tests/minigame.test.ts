import { describe, expect, it } from 'vitest';
import { validateCity } from '../../content/schema';
import lisbonRaw from '../../content/cities/lisbon.json';
import tokyoRaw from '../../content/cities/tokyo.json';
import mexicoRaw from '../../content/cities/mexico_city.json';
import { minigamePlayedFlag, nextUnplayedMinigame } from '../game/minigame';

function baseCity(minigames: unknown) {
  const c = JSON.parse(JSON.stringify(lisbonRaw)) as Record<string, unknown>;
  c.minigames = minigames;
  return c;
}

describe('MiniGameDef schema validation', () => {
  it('the 3 shipped city minigames (one of each type) all validate', () => {
    expect(validateCity(lisbonRaw).errors).toEqual([]);
    expect(validateCity(tokyoRaw).errors).toEqual([]);
    expect(validateCity(mexicoRaw).errors).toEqual([]);
    const lisbon = lisbonRaw as { minigames?: { type: string }[] };
    const tokyo = tokyoRaw as { minigames?: { type: string }[] };
    const mexico = mexicoRaw as { minigames?: { type: string }[] };
    expect(lisbon.minigames?.[0].type).toBe('timing');
    expect(tokyo.minigames?.[0].type).toBe('drag');
    expect(mexico.minigames?.[0].type).toBe('choice');
  });

  it('a city with no minigames field at all is still valid (optional)', () => {
    const c = JSON.parse(JSON.stringify(lisbonRaw));
    delete c.minigames;
    expect(validateCity(c).errors).toEqual([]);
  });

  it('rejects a timing minigame missing timingRoundsSec', () => {
    const c = baseCity([{ id: 'x', type: 'timing', title: 't', introText: 'i', outroText: 'o', outroTextRough: 'r', reward: {} }]);
    const result = validateCity(c);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('timingRoundsSec'))).toBe(true);
  });

  it('rejects a drag minigame with < 2 items or a non-positive time limit', () => {
    const tooFewItems = baseCity([{ id: 'x', type: 'drag', title: 't', introText: 'i', outroText: 'o', outroTextRough: 'r', reward: {}, dragItems: ['one'], dragTimeSec: 10 }]);
    expect(validateCity(tooFewItems).errors.some((e) => e.includes('dragItems'))).toBe(true);
    const badTime = baseCity([{ id: 'x', type: 'drag', title: 't', introText: 'i', outroText: 'o', outroTextRough: 'r', reward: {}, dragItems: ['a', 'b'], dragTimeSec: 0 }]);
    expect(validateCity(badTime).errors.some((e) => e.includes('dragTimeSec'))).toBe(true);
  });

  it('rejects a choice minigame without exactly 3 questions', () => {
    const c = baseCity([{
      id: 'x', type: 'choice', title: 't', introText: 'i', outroText: 'o', outroTextRough: 'r', reward: {},
      questions: [{ id: 'q1', prompt: 'p', optionA: 'a', optionB: 'b', warmerOption: 'A' }],
    }]);
    expect(validateCity(c).errors.some((e) => e.includes('exactly 3 questions'))).toBe(true);
  });

  it('rejects an unknown minigame type', () => {
    const c = baseCity([{ id: 'x', type: 'nonsense', title: 't', introText: 'i', outroText: 'o', outroTextRough: 'r', reward: {} }]);
    expect(validateCity(c).errors.some((e) => e.includes("'timing' | 'drag' | 'choice'"))).toBe(true);
  });
});

describe('minigamePlayedFlag', () => {
  it('is stable and namespaced so it cannot collide with a content-authored flag', () => {
    expect(minigamePlayedFlag('lis_soundcheck')).toBe('minigame_lis_soundcheck_played');
    expect(minigamePlayedFlag('lis_soundcheck')).toBe(minigamePlayedFlag('lis_soundcheck'));
  });
});

describe('nextUnplayedMinigame', () => {
  const mgs = [{ id: 'a' }, { id: 'b' }] as import('../../content/schema').MiniGameDef[];

  it('returns undefined for a city with no minigames', () => {
    expect(nextUnplayedMinigame(undefined, () => false)).toBeUndefined();
  });

  it('returns the first entry whose played-flag is not set', () => {
    const played = new Set(['minigame_a_played']);
    expect(nextUnplayedMinigame(mgs, (f) => played.has(f))?.id).toBe('b');
  });

  it('returns undefined once every entry has been played (never offers the same minigame twice in one run)', () => {
    const played = new Set(['minigame_a_played', 'minigame_b_played']);
    expect(nextUnplayedMinigame(mgs, (f) => played.has(f))).toBeUndefined();
  });
});
