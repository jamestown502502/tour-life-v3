// Promise moments (publisher polish 2026-10-12): the tour promise is tested on arrival in the 2nd,
// 3rd and 4th city, and the epilogue cites the moments that decided it.
import { describe, it, expect } from 'vitest';
import { PROMISE_MOMENTS } from '../../content/promiseMoments';
import { TOUR_PROMISES } from '../../content/promises';
import { promiseMomentFor, promiseCitation, keptPromise } from '../game/promise';
import { generateEnding } from '../game/endings';
import { getEpilogue } from '../../content/epilogues';
import { freshRun, freshMeta, freshAccessibility } from '../core/state';
import type { RunState, PromiseMomentRecord } from '../core/state';

const run = (flag: string, answered: PromiseMomentRecord[] = []): RunState => {
  const s = freshRun('pm', freshMeta(), freshAccessibility());
  s.flags = [flag];
  s.promiseMoments = answered;
  return s;
};

describe('promise moment content', () => {
  it('every promise has three moments with two real options each', () => {
    for (const p of TOUR_PROMISES) {
      const set = PROMISE_MOMENTS[p.flag];
      expect(set, p.flag).toHaveLength(3);
      for (const m of set) for (const o of m.options) {
        expect(o.label.length).toBeGreaterThan(5);
        expect(o.after.length).toBeGreaterThan(20);
        expect(o.cite).not.toMatch(/\.$/);   // "In <city>, <cite>." adds the full stop
      }
    }
  });
  it('nudges, never decides: every effect is small', () => {
    for (const set of Object.values(PROMISE_MOMENTS)) for (const m of set) for (const o of m.options) {
      for (const [k, v] of Object.entries(o.stats ?? {})) expect(Math.abs(v), `${m.id} ${k}`).toBeLessThanOrEqual(k === 'funds' ? 20 : 6);
      for (const v of Object.values(o.relationships ?? {})) expect(Math.abs(v)).toBeLessThanOrEqual(5);
      expect(Math.abs(o.localLove ?? 0)).toBeLessThanOrEqual(4);
    }
  });
});

describe('when a moment comes', () => {
  it('stops 2, 3 and 4 only, once each, only for the promise this run made', () => {
    const s = run('promise_rooms');
    expect(promiseMomentFor(s, 0)).toBeNull();
    expect(promiseMomentFor(s, 1)!.id).toBe('rooms_tiny');
    expect(promiseMomentFor(s, 3)!.id).toBe('rooms_request');
    expect(promiseMomentFor(s, 4)).toBeNull();
    s.promiseMoments = [{ id: 'rooms_tiny', cityId: 'tokyo', option: 0 }];
    expect(promiseMomentFor(s, 1)).toBeNull();
    expect(promiseMomentFor(run('no_promise_flag'), 1)).toBeNull();
  });
});

describe('the epilogue cites what decided it', () => {
  const names = (id: string) => ({ tokyo: 'Tokyo', berlin: 'Berlin', lisbon: 'Lisbon' } as Record<string, string>)[id] ?? id;
  const answered: PromiseMomentRecord[] = [
    { id: 'new_morning', cityId: 'tokyo', option: 0 },
    { id: 'new_sound', cityId: 'berlin', option: 1 },
    { id: 'new_cover', cityId: 'lisbon', option: 0 },
  ];
  it('kept: the moments that kept it, at most two', () => {
    const c = promiseCitation(run('promise_something_new', answered), true, names);
    expect(c).toContain('In Tokyo, you got up at six');
    expect(c).toContain('In Lisbon, you played the new song');
    expect(c).not.toContain('Berlin');
  });
  it('missed: the moment that cost it', () => {
    expect(promiseCitation(run('promise_something_new', answered), false, names)).toBe(' In Berlin, you saved Rowan\'s pedal for a safer soundcheck.');
  });
  it('nothing answered: no citation, and the epilogue reads exactly as before', () => {
    const s = run('promise_together');
    expect(promiseCitation(s, true, names)).toBe('');
    const kept = keptPromise(s)!;
    expect(getEpilogue('steady_climb', [], s.flags, { ...kept, cite: '' })).toBe(getEpilogue('steady_climb', [], s.flags, kept));
  });
});

describe('no answer closes off an ending', () => {
  // Endings are chosen from the run's stats (src/game/endings.ts). For every promise and all eight
  // ways of answering its three moments, apply the answers on top of a sweep of starting stats:
  // all six endings must still be reachable.
  const levels = [0, 20, 40, 60, 80, 100];
  for (const p of TOUR_PROMISES) {
    it(`${p.flag}: all endings reachable under every answer pattern`, () => {
      const all = new Set<string>();
      const perPattern: Set<string>[] = [];
      for (let pattern = 0; pattern < 8; pattern++) {
        const seen = new Set<string>();
        for (const harmony of levels) for (const inspiration of levels) for (const rel of levels) for (const love of [0, 10, 20, 25, 50, 100]) for (const funds of [0, 300, 900, 2000]) {
          const s = freshRun('pm-sweep', freshMeta(), freshAccessibility());
          s.stats = { harmony, inspiration, funds, energy: 60 };
          s.relationships = { mira: rel, theo: rel, jun: rel, rowan: rel };
          s.localLove = { lisbon: love, tokyo: love };
          PROMISE_MOMENTS[p.flag].forEach((m, i) => {
            const o = m.options[(pattern >> i) & 1];
            for (const [k, v] of Object.entries(o.stats ?? {})) s.stats[k as keyof typeof s.stats] = Math.max(0, Math.min(k === 'funds' ? 99999 : 100, s.stats[k as keyof typeof s.stats] + v));
            for (const [k, v] of Object.entries(o.relationships ?? {})) s.relationships[k as keyof typeof s.relationships] += v;
            if (o.localLove) s.localLove.tokyo += o.localLove;
          });
          const e = generateEnding(s).id;
          seen.add(e); all.add(e);
        }
        perPattern.push(seen);
      }
      for (const seen of perPattern) expect([...seen].sort()).toEqual([...all].sort());
      expect(all.size).toBeGreaterThanOrEqual(6);
    });
  }
});
