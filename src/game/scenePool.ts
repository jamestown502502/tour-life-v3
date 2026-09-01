// Scene-pool scarcity (PRD §15.4.6 / §4.3): each city exposes more relationship scenes than a
// run can show. At route-generation time we seed-draw 1-2 of the pool per city and mark them
// available via `avail_<sceneId>` flags — the rest stay locked out this run.

import type { CityDef } from '../../content/schema';
import type { RNG } from '../core/rng';

export function availabilityFlag(sceneId: string): string {
  return `avail_${sceneId}`;
}

/** Returns the flags to set for one city's drawn relationship-scene availability. */
export function drawScenePoolFlags(rng: RNG, city: CityDef): string[] {
  const pool = city.relationshipScenePool;
  if (pool.length === 0) return [];
  const count = pool.length <= 2 ? pool.length : rng.int(1, 3); // 1-2 when pool is bigger than 2
  const chosen = rng.shuffle(pool).slice(0, count);
  return chosen.map((entry) => availabilityFlag(entry.id));
}
