// Fresh tours (2026-11-19): consecutive auto-seeded tours never repeat the last tour's wildcard,
// goal or opening city, and shared seeds are never rewritten.
import { describe, expect, it } from 'vitest';
import { freshSeed, freshnessLine, tourSignature } from '../game/freshness';
import { freshMeta } from '../core/state';
import { makeRng } from '../core/rng';
import { completeRun } from '../game/meta';

function seededGen(name: string): () => string {
  const rng = makeRng(name);
  return () => `s-${rng.int(0, 1_000_000)}`;
}

describe('fresh tours', () => {
  it('a first tour takes the generator as is', () => {
    expect(freshSeed(freshMeta(), () => 'only-one')).toBe('only-one');
  });

  it('twenty tours in a row: each differs from the one before in wildcard, goal and opening city', () => {
    let meta = freshMeta();
    const gen = seededGen('chain');
    let prev: ReturnType<typeof tourSignature> | null = null;
    for (let i = 0; i < 20; i++) {
      const seed = freshSeed(meta, gen);
      const sig = tourSignature(seed);
      if (prev) {
        expect(sig.wildcard).not.toBe(prev.wildcard);
        expect(sig.goal).not.toBe(prev.goal);
        expect(sig.opener).not.toBe(prev.opener);
      }
      prev = sig;
      meta = completeRun(meta, { seed, bandName: 'B', endingId: 'x', tags: [], completedAt: i });
    }
  });

  it('the route screen names what changed, and says nothing for a first tour or a replayed seed', () => {
    const meta = completeRun(freshMeta(), { seed: 'amber-echo-101', bandName: 'B', endingId: 'x', tags: [], completedAt: 1 });
    expect(freshnessLine('amber-echo-101', freshMeta())).toBeNull();
    expect(freshnessLine('amber-echo-101', meta)).toBeNull();
    const next = freshSeed(meta, seededGen('line'));
    expect(freshnessLine(next, meta)).toMatch(/^Unlike your last tour: you open in .+, a new wildcard, .+, a new tour goal\.$/);
  });
});
