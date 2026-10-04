// The polish rules (2026-10-04): every minigame kind has a verb and its own perfect stamp, the
// celebration is for flawless runs only, the beat follows the bed, and haptics stay short.
import { describe, expect, it } from 'vitest';
import { VERB, resultStamp, ledgerStamp, LEVEL_STAMP, cameoMood, beatMs, tickPitch, HAPTIC, shouldEncore } from '../game/juiceRules';
import { CITIES } from '../game/content';

const TYPES = [...new Set(CITIES.flatMap((c) => (c.minigames ?? []).map((m) => m.type)))];

describe('every minigame kind speaks its own words', () => {
  it('a one-word verb and a distinct perfect stamp for every kind in the game', () => {
    for (const t of TYPES) {
      expect(VERB[t], t).toMatch(/^[A-Z ]+!$/);
      expect(resultStamp(t, 3), t).not.toBe('NAILED IT');
      expect(resultStamp(t, 3).length, t).toBeLessThanOrEqual(14);
    }
    expect(resultStamp('drag', 2)).toBe('SOLID');
    expect(resultStamp('drag', 1)).toBe('ROUGH');
  });
  it('the ledger stamp follows the money: the long haul is in the black or in the red', () => {
    expect(ledgerStamp('longhaul', 'good')).toBe('IN THE BLACK');
    expect(ledgerStamp('longhaul', 'rough')).toBe('IN THE RED');
    expect(ledgerStamp('pricing', 'perfect')).toBe('SOLD OUT');
    expect(ledgerStamp('split', 'rough')).toBe('COSTLY');
    expect(LEVEL_STAMP.clip).toBe('CLIPPED');
  });
});

describe('timing, celebration and touch', () => {
  it('the beat follows the bed, with a sane default', () => {
    expect(beatMs(120)).toBe(500);
    expect(beatMs(undefined)).toBe(625);
    expect(beatMs(10)).toBe(1500);   // clamped, never absurd
  });
  it('count-up ticks rise in pitch and stay in range', () => {
    expect(tickPitch(0)).toBeLessThan(tickPitch(0.5));
    expect(tickPitch(0.5)).toBeLessThan(tickPitch(1));
    expect(tickPitch(2)).toBe(tickPitch(1));
  });
  it('the Encore is for a flawless run only, and never in practice', () => {
    expect(shouldEncore(3, false)).toBe(true);
    expect(shouldEncore(3, true)).toBe(false);
    expect(shouldEncore(2, false)).toBe(false);
  });
  it('the host looks inspired, happy or worried to match the result', () => {
    expect([cameoMood(3), cameoMood(2), cameoMood(1)]).toEqual(['inspired', 'happy', 'worried']);
  });
  it('haptics are short and clear: nothing longer than 40 ms in one pulse', () => {
    for (const v of Object.values(HAPTIC)) for (const ms of ([] as number[]).concat(v as number | number[])) expect(ms).toBeLessThanOrEqual(40);
  });
});
