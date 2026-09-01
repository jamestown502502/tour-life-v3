import { describe, expect, it } from 'vitest';
import { generateSeed, makeRng } from '../core/rng';

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
