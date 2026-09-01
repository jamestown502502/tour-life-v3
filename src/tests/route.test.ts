import { describe, expect, it } from 'vitest';
import type { CityDef } from '../../content/schema';
import { makeRng } from '../core/rng';
import { generateRoute } from '../game/route';
import { CITIES } from '../game/content';

function mockCity(id: string, weather: string[]): CityDef {
  return {
    id, name: id, tone: 'test', weather, tempo: 100, tint: 'warm_amber',
    locations: [], arrivalSceneId: 'x', preShowSceneId: 'x',
    relationshipScenePool: [], collaborator: { npcName: 'x', role: 'x', gift: 'x' },
    preShowChoices: [], songId: 'x', afterShowSceneId: 'x', journalSceneId: 'x', scenes: {},
  };
}

describe('route generation', () => {
  it('includes every city when the pool is small (v1: 2-city pool)', () => {
    const route = generateRoute(makeRng('a'), CITIES);
    const ids = route.stops.map((s) => s.cityId).sort();
    expect(ids).toEqual(CITIES.map((c) => c.id).sort());
  });

  it('picks a weather value that belongs to that city', () => {
    const route = generateRoute(makeRng('b'), CITIES);
    for (const city of CITIES) {
      expect(city.weather).toContain(route.weatherByCity[city.id]);
    }
  });

  it('picks 6-8 cities from a larger pool', () => {
    const pool = Array.from({ length: 12 }, (_, i) => mockCity(`city${i}`, ['sunny']));
    const route = generateRoute(makeRng('pool-seed'), pool);
    expect(route.stops.length).toBeGreaterThanOrEqual(6);
    expect(route.stops.length).toBeLessThanOrEqual(8);
    const ids = route.stops.map((s) => s.cityId);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
  });

  it('is deterministic for the same seed and non-deterministic across seeds (usually)', () => {
    const pool = Array.from({ length: 12 }, (_, i) => mockCity(`city${i}`, ['sunny']));
    const routeA1 = generateRoute(makeRng('same-seed'), pool).stops.map((s) => s.cityId);
    const routeA2 = generateRoute(makeRng('same-seed'), pool).stops.map((s) => s.cityId);
    expect(routeA1).toEqual(routeA2);

    const routeB = generateRoute(makeRng('different-seed'), pool).stops.map((s) => s.cityId);
    expect(routeB).not.toEqual(routeA1);
  });

  it('throws on an empty pool rather than silently returning nothing', () => {
    expect(() => generateRoute(makeRng('x'), [])).toThrow();
  });
});
