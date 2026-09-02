import { describe, expect, it } from 'vitest';
import { dailySeed, generateSeed, makeRng } from '../core/rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng('lantern-42').next();
    const b = makeRng('lantern-42').next();
    expect(a).toBe(b);
  });

  it('produces different streams for different seeds', () => {
    const a = makeRng('seed-one').next();
    const b = makeRng('seed-two').next();
    expect(a).not.toBe(b);
  });

  it('a full sequence is reproducible from the same seed', () => {
    const streamOf = () => {
      const rng = makeRng('reykjavik-7');
      return Array.from({ length: 10 }, () => rng.next());
    };
    expect(streamOf()).toEqual(streamOf());
  });

  it('int() stays within bounds', () => {
    const rng = makeRng('bounds-test');
    for (let i = 0; i < 200; i++) {
      const v = rng.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(9);
    }
  });

  it('shuffle preserves all elements', () => {
    const rng = makeRng('shuffle-test');
    const arr = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(arr);
    expect(shuffled.slice().sort()).toEqual(arr.slice().sort());
  });

  it('generateSeed returns a non-empty word-word-digits string', () => {
    const seed = generateSeed();
    expect(seed).toMatch(/^[a-z]+-[a-z]+-\d{3}$/);
  });
});

describe('dailySeed (close-out item 4a: "Today\'s Tour")', () => {
  it('is the same seed for the same UTC date, called twice', () => {
    const date = new Date('2026-03-14T09:00:00Z');
    expect(dailySeed(date)).toBe(dailySeed(new Date('2026-03-14T23:59:59Z')));
  });

  it('changes at UTC midnight, not local midnight', () => {
    const a = dailySeed(new Date('2026-03-14T23:59:59Z'));
    const b = dailySeed(new Date('2026-03-15T00:00:01Z'));
    expect(a).not.toBe(b);
  });

  it('two different days produce different seeds', () => {
    const a = dailySeed(new Date('2026-01-01T12:00:00Z'));
    const b = dailySeed(new Date('2026-06-15T12:00:00Z'));
    expect(a).not.toBe(b);
  });

  it('matches generateSeed\'s word-word-digits format', () => {
    expect(dailySeed(new Date('2026-09-02T12:00:00Z'))).toMatch(/^[a-z]+-[a-z]+-\d{3}$/);
  });
});
