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

/** Returns the flags to set for one city's drawn relationship-scene availability.
 *
 *  `seenSceneIds` are the scenes this PLAYER has already been shown, across every previous run.
 *  Scenes they have never seen are drawn first; the already-seen ones are only reached once the
 *  city's fresh material is exhausted. This is the one change that makes a second playthrough feel
 *  like new material rather than a reshuffle: the per-run seed alone re-draws from the whole pool
 *  every time, so replaying could hand a player the same two Berlin scenes three runs running.
 *
 *  Supergiant's Hades makes the same move at a far larger scale -- its conversation system holds a
 *  bucket of candidate lines filtered by conditions, and deliberately avoids repeating any until
 *  the unused ones are spent, because hitting repeated dialogue is the moment a game stops feeling
 *  alive. With 30 relationship scenes and 2 shown per city visit, this pool has real headroom to
 *  spend before anything repeats.
 *
 *  Still fully seeded: within each tier the order is the run's own RNG, so a replayed seed on a
 *  fresh profile reproduces exactly. */
export function drawScenePoolFlags(rng: RNG, city: CityDef, seenSceneIds: readonly string[] = []): string[] {
  const pool = city.relationshipScenePool;
  if (pool.length === 0) return [];
  const count = Math.min(SCENES_PER_CITY, pool.length);
  const seen = new Set(seenSceneIds);
  const unseen = rng.shuffle(pool.filter((e) => !seen.has(e.id)));
  const alreadySeen = rng.shuffle(pool.filter((e) => seen.has(e.id)));
  const chosen = [...unseen, ...alreadySeen].slice(0, count);
  return chosen.map((entry) => availabilityFlag(entry.id));
}
