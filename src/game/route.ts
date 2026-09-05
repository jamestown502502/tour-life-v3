import type { CityDef } from '../../content/schema';
import type { RNG } from '../core/rng';
import type { CityStop } from '../core/state';

export interface GeneratedRoute {
  stops: CityStop[];
  weatherByCity: Record<string, string>;
  midTourComplication: string;
}

export const MID_TOUR_COMPLICATIONS = [
  'van_breakdown',
  'lost_gear',
  'booking_conflict',
  'bandmate_gets_sick',
  'venue_falls_through',
  'unexpected_press',
] as const;

/** Picks 6-8 cities from the pool (or the whole pool, when it's smaller than that — true for
 *  the current 2-city vertical slice), in a seed-driven order, with a seed-driven weather pick
 *  per city and a seed-driven mid-tour complication. Deterministic for a given RNG stream. */
export function generateRoute(rng: RNG, cityPool: readonly CityDef[]): GeneratedRoute {
  if (cityPool.length === 0) throw new Error('[route] city pool is empty');
  const targetCount = cityPool.length <= 6 ? cityPool.length : rng.int(6, 9);
  const chosen = rng.shuffle(cityPool).slice(0, targetCount);

  const stops: CityStop[] = chosen.map((c) => ({ cityId: c.id, visited: false }));
  const weatherByCity: Record<string, string> = {};
  for (const c of chosen) weatherByCity[c.id] = rng.pick(c.weather);

  return {
    stops,
    weatherByCity,
    midTourComplication: rng.pick(MID_TOUR_COMPLICATIONS),
  };
}

/** Stuck-screen-hardening follow-up, Item D: a route stop's role in this run's arc — the same
 *  index math HubScene.ts's applyMidTourComplicationIfDue already uses to decide when the
 *  seed-picked complication actually fires (floor(routeLength/2), the first Hub visit at or past
 *  it), single-sourced here so RoutePlanScene, HubScene, and CityScene's transition line all
 *  agree on which stop is "the opener," "the one that matters," and where the complication
 *  lands, instead of three hand-rolled copies of the same three comparisons drifting apart. */
export type RouteArcRole = 'opener' | 'midpoint' | 'finale';

export function routeArcRole(index: number, routeLength: number): RouteArcRole | null {
  if (routeLength >= 2 && index === routeLength - 1) return 'finale';
  if (index === 0) return 'opener';
  if (routeLength >= 2 && index === Math.floor(routeLength / 2)) return 'midpoint';
  return null;
}
