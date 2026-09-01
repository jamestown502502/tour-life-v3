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
