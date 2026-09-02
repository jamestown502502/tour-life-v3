// Scene-pool scarcity (PRD §15.4.6 / §4.3): each city exposes more relationship scenes than a
// run can show. At route-generation time we seed-draw 2 of the pool per city (pools are 5-7 —
// real headroom) and mark them available via `avail_<sceneId>` flags — the rest stay locked out
// this run. CityScene plays every available entry in a city, in seed-shuffled order, so a run
// now sees 2 relationship beats per city instead of 1 (close-out pass item 5 — the pool
// machinery already supported this; only the draw count and CityScene's consumption changed).

import type { CityDef } from '../../content/schema';
import type { RNG } from '../core/rng';

export const SCENES_PER_CITY = 2;

export function availabilityFlag(sceneId: string): string {
  return `avail_${sceneId}`;
}

/** Returns the flags to set for one city's drawn relationship-scene availability. */
export function drawScenePoolFlags(rng: RNG, city: CityDef): string[] {
  const pool = city.relationshipScenePool;
  if (pool.length === 0) return [];
  const count = Math.min(SCENES_PER_CITY, pool.length);
  const chosen = rng.shuffle(pool).slice(0, count);
  return chosen.map((entry) => availabilityFlag(entry.id));
}
