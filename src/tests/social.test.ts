import { beforeEach, describe, expect, it } from 'vitest';
import { makeRng } from '../core/rng';
import { buildFeed, showBandFor } from '../game/social';
import { memoryFor, recordMinigame, recordShow, returnFeedFlag, returnLegFlag } from '../game/memory';
import { getEpilogue } from '../../content/epilogues';
import { State } from '../core/state';
import { generateRoute } from '../game/route';
import { CITIES } from '../game/content';
import type { CityMemory } from '../core/state';

const base: CityMemory = { cityId: 'tokyo', show: 'solid', love: 8 };

describe('city memory', () => {
  beforeEach(() => { State.newRun('memory-test'); });

  it('records a show and reads it back', () => {
    recordShow('tokyo', 'triumph', 22);
    expect(memoryFor('tokyo')).toMatchObject({ cityId: 'tokyo', show: 'triumph', love: 22 });
  });

  it('a city never played has no memory', () => {
    expect(memoryFor('berlin')).toBeUndefined();
  });

  it('merges a minigame result into an existing memory rather than replacing it', () => {
    recordShow('tokyo', 'rough', 3);
    recordMinigame('tokyo', true, 'Pack the Van');
    expect(memoryFor('tokyo')).toMatchObject({ show: 'rough', love: 3, minigameGood: true, minigameTitle: 'Pack the Van' });
  });

  it('a minigame recorded BEFORE the show still leaves a valid memory', () => {
    // Ordering matters live: the minigame resolves before the show does.
    recordMinigame('lisbon', false, 'Load-In');
    const m = memoryFor('lisbon');
    expect(m).toBeDefined();
    expect(m!.show).toBe('solid'); // the "played, unremarkable" default, not undefined
    recordShow('lisbon', 'triumph', 30);
    expect(memoryFor('lisbon')).toMatchObject({ show: 'triumph', minigameGood: false });
  });

  it('grades band into the three reputations a town can hold', () => {
    expect(showBandFor('perfect')).toBe('triumph');
    expect(showBandFor('good')).toBe('solid');
    expect(showBandFor('ok')).toBe('rough');
    expect(showBandFor('miss')).toBe('rough');
  });
});

describe('return-leg social feed', () => {
  beforeEach(() => { State.newRun('feed-test'); });

  it('always includes BOTH a supportive and a hostile voice, however the night went', () => {
    for (const show of ['triumph', 'solid', 'rough'] as const) {
      const feed = buildFeed({ ...base, show }, 'Tokyo', makeRng('s'));
      const tones = feed.map((p) => p.tone);
      expect(tones, `${show} should still have a fan`).toContain('fan');
      expect(tones, `${show} should still have a hater`).toContain('hater');
    }
  });

  it('leads with the opinion the night actually earned', () => {
    expect(buildFeed({ ...base, show: 'triumph' }, 'Tokyo', makeRng('s'))[0].tone).toBe('fan');
    expect(buildFeed({ ...base, show: 'rough' }, 'Tokyo', makeRng('s'))[0].tone).toBe('hater');
  });

  it('substitutes the real city name into every post', () => {
    const feed = buildFeed(base, 'Tokyo', makeRng('s'));
    for (const p of feed) {
      expect(p.text, 'no unsubstituted placeholder should survive').not.toContain('{city}');
      expect(p.handle.startsWith('@')).toBe(true);
    }
  });

  it('is deterministic for a given seed, and different across seeds', () => {
    const a = buildFeed(base, 'Tokyo', makeRng('seed-a'));
    const b = buildFeed(base, 'Tokyo', makeRng('seed-a'));
    expect(a).toEqual(b);
    const c = buildFeed(base, 'Tokyo', makeRng('seed-z'));
    expect(JSON.stringify(c)).not.toEqual(JSON.stringify(a));
  });

  it('makes the minigame the specific callback when there was one', () => {
    const good = buildFeed({ ...base, minigameGood: true, minigameTitle: 'Pack the Van' }, 'Tokyo', makeRng('s'));
    const rough = buildFeed({ ...base, minigameGood: false, minigameTitle: 'Pack the Van' }, 'Tokyo', makeRng('s'));
    // Slot 3 is the specific callback — it should flip tone with the outcome.
    expect(good[2].tone).toBe('fan');
    expect(rough[2].tone).toBe('hater');
  });

  it('falls back to the town\'s affection when no minigame was played', () => {
    const loved = buildFeed({ ...base, love: 40 }, 'Tokyo', makeRng('s'));
    const ignored = buildFeed({ ...base, love: 0 }, 'Tokyo', makeRng('s'));
    expect(loved[2].tone).toBe('fan');
    expect(ignored[2].tone).toBe('hater');
  });

  it('the seen-flag is per city, so one return does not suppress another', () => {
    expect(returnFeedFlag('tokyo')).not.toBe(returnFeedFlag('berlin'));
  });
});

describe('the return leg', () => {
  it('books exactly one city twice, and marks the second booking as a revisit', () => {
    const route = generateRoute(makeRng('route-seed'), CITIES);
    const revisits = route.stops.filter((s) => s.revisit);
    expect(revisits).toHaveLength(1);
    // The revisited city must be one the tour already played earlier in the route.
    const firstIndex = route.stops.findIndex((s) => s.cityId === revisits[0].cityId);
    const secondIndex = route.stops.lastIndexOf(revisits[0]);
    expect(firstIndex).toBeLessThan(secondIndex);
    expect(route.stops[firstIndex].revisit).toBeFalsy();
  });

  it('puts the return leg after the city it returns to, in the back half of the tour', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const route = generateRoute(makeRng(seed), CITIES);
      const idx = route.stops.findIndex((s) => s.revisit);
      expect(idx, `seed ${seed}`).toBe(route.stops.length - 1);
    }
  });

  it('is deterministic for a seed', () => {
    const a = generateRoute(makeRng('same'), CITIES).stops.map((s) => `${s.cityId}${s.revisit ? '*' : ''}`);
    const b = generateRoute(makeRng('same'), CITIES).stops.map((s) => `${s.cityId}${s.revisit ? '*' : ''}`);
    expect(a).toEqual(b);
  });
});

describe('the return leg remembers both nights', () => {
  beforeEach(() => { State.newRun('return-test'); });

  it('keeps the FIRST show as the reputation and records the second alongside it', () => {
    recordShow('tokyo', 'rough', 2);
    recordShow('tokyo', 'triumph', 30);
    const m = memoryFor('tokyo')!;
    expect(m.show, 'the first night is the lasting reputation').toBe('rough');
    expect(m.secondShow).toBe('triumph');
  });

  it('a minigame played before the first show does not count as a first show', () => {
    // The live ordering: minigame resolves, THEN the show. Getting this wrong made the real
    // first show look like a return leg.
    recordMinigame('berlin', true, 'Synth Soundcheck');
    recordShow('berlin', 'solid', 10);
    const m = memoryFor('berlin')!;
    expect(m.show).toBe('solid');
    expect(m.secondShow, 'that was the FIRST show, not a return').toBeUndefined();
    expect(State.data.flags.filter((f) => f.startsWith('return_'))).toEqual([]);
  });

  it('flags the comparison between the two nights', () => {
    expect(returnLegFlag('rough', 'triumph')).toBe('return_redeemed');
    expect(returnLegFlag('triumph', 'rough')).toBe('return_slipped');
    expect(returnLegFlag('solid', 'solid')).toBe('return_held');
  });

  it('sets the comparison flag when the second show lands', () => {
    recordShow('lisbon', 'rough', 1);
    recordShow('lisbon', 'triumph', 25);
    expect(State.data.flags).toContain('return_redeemed');
  });

  it('the epilogue tells the return-leg story, on top of the minigame flourish', () => {
    const base = getEpilogue('found_family_tour', ['Tender'], []);
    const redeemed = getEpilogue('found_family_tour', ['Tender'], ['return_redeemed']);
    expect(redeemed.length).toBeGreaterThan(base.length);
    expect(redeemed).toContain('at their worst');

    // Both callbacks can apply — the return leg is the larger story and comes first.
    const both = getEpilogue('found_family_tour', ['Tender'], ['return_redeemed', 'fast_load_out']);
    expect(both).toContain('at their worst');
    expect(both).toContain('load-out');
    expect(both.indexOf('at their worst')).toBeLessThan(both.indexOf('load-out'));
  });

  it('every minigame now reaches the epilogue', () => {
    for (const flag of ['fast_load_out', 'synth_check_smooth', 'smooth_load_in',
      'clean_soundcheck_tokyo', 'radio_callin_warm', 'warm_interview', 'lisbon_soundcheck_clean']) {
      const withFlag = getEpilogue('quiet_ending', ['Tender'], [flag]);
      const without = getEpilogue('quiet_ending', ['Tender'], []);
      expect(withFlag.length, `${flag} should add a line`).toBeGreaterThan(without.length);
    }
  });
});
