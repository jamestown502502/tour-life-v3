// Which painting the van shows on each drive.
//
// Every drive used to show the same painting (bg_scene_van). There are now four: the original
// night motorway plus a coastal sunrise, a rainy mountain road, and a dusk bridge into a city.
// Each tour shuffles them by seed and takes them in order by leg, so two drives in a row never
// share a painting and a tour's first four drives are all different.
import { makeRng } from '../core/rng';

export const VAN_BACKDROPS = ['bg_scene_van', 'bg_scene_van_2', 'bg_scene_van_3', 'bg_scene_van_4'] as const;

/** A tour's van paintings in drive order: drive `leg` uses order[leg % 4]. */
export function vanBackdropOrder(seed: string): string[] {
  return makeRng(`${seed}:van-art`).shuffle(VAN_BACKDROPS);
}
