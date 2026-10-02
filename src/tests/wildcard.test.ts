// Replayability (2026-10-02): seeded tour wildcards and tour goals.
import { describe, it, expect } from 'vitest';
import { WILDCARDS, TOUR_GOALS, wildcardFor, goalFor, describeDeltas, FULL_COMBO_FLAG } from '../game/wildcard';
import { freshRun, freshMeta, freshAccessibility } from '../core/state';

describe('tour wildcards and goals', () => {
  it('are fixed by the seed, so a shared daily seed gives everyone the same tour', () => {
    expect(wildcardFor('2026-10-02').id).toBe(wildcardFor('2026-10-02').id);
    expect(goalFor('abc').id).toBe(goalFor('abc').id);
  });

  it('every wildcard and every goal turns up across ordinary seeds', () => {
    const w = new Set<string>(), g = new Set<string>();
    for (let i = 0; i < 400; i++) { w.add(wildcardFor(`seed-${i}`).id); g.add(goalFor(`seed-${i}`).id); }
    expect(w.size).toBe(WILDCARDS.length);
    expect(g.size).toBe(TOUR_GOALS.length);
  });

  it('no wildcard can drain a stat to zero over a five-city tour from the starting numbers', () => {
    const start = freshRun('x', freshMeta(), freshAccessibility()).stats;
    for (const wc of WILDCARDS) {
      for (const k of Object.keys(start) as (keyof typeof start)[]) {
        const end = start[k] + (wc.start[k] ?? 0) + 5 * (wc.perStop[k] ?? 0);
        expect(end, `${wc.id} ${k}`).toBeGreaterThan(20);
      }
    }
  });

  it('goals read the run state', () => {
    const run = freshRun('x', freshMeta(), freshAccessibility());
    const goal = (id: string) => TOUR_GOALS.find((t) => t.id === id)!;
    expect(goal('fullCombo').check(run)).toBe(false);
    run.flags.push(FULL_COMBO_FLAG);
    expect(goal('fullCombo').check(run)).toBe(true);
    run.stats.harmony = 75;
    expect(goal('harmony').check(run)).toBe(true);
    expect(goal('closeBand').check(run)).toBe(false);
  });

  it('describes per-city effects in words', () => {
    expect(describeDeltas({ funds: 20, energy: -3 })).toBe('+$20, Energy -3');
    expect(describeDeltas({})).toBe('');
  });
});
