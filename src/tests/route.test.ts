import { describe, expect, it } from 'vitest';
import type { CityDef } from '../../content/schema';
import { makeRng } from '../core/rng';
import { generateRoute, routeArcRole } from '../game/route';
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

// Stuck-screen-hardening follow-up, Item D: routeArcRole is the single source RoutePlanScene,
// HubScene, and CityScene's transition line all read from — these lock its exact behavior at the
// project's real current route length (4 cities, per CITIES) and a couple of edge lengths.
describe('routeArcRole (Item D: route framing)', () => {
  it('the current 4-city route: index 0 opener, index 2 midpoint, index 3 finale', () => {
    expect(routeArcRole(0, 4)).toBe('opener');
    expect(routeArcRole(1, 4)).toBeNull();
    expect(routeArcRole(2, 4)).toBe('midpoint');
    expect(routeArcRole(3, 4)).toBe('finale');
  });

  it('a 2-stop route: the last stop wins over the opener/midpoint ties, never null and never double-labeled', () => {
    expect(routeArcRole(0, 2)).toBe('opener');
    expect(routeArcRole(1, 2)).toBe('finale');
  });

  it('a single-stop route: index 0 is the opener, not the finale (no real midpoint/finale distinction below 2 stops)', () => {
    expect(routeArcRole(0, 1)).toBe('opener');
  });

  it('an out-of-range index returns null rather than throwing', () => {
    expect(routeArcRole(-1, 4)).toBeNull();
    expect(routeArcRole(99, 4)).toBeNull();
  });
});
