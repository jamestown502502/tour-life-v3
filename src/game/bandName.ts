// A seeded band-name suggestion for BandCreator. QA asked for "Hit the road" to be disabled
// until a name is typed; the design answer is the opposite — never block the first screen — so
// the field arrives filled with a name the run seed picked, and the player can keep or replace it.
import { makeRng } from '../core/rng';

const FIRST = ['Paper', 'Velvet', 'Neon', 'Quiet', 'Tidal', 'Copper', 'Midnight', 'Static', 'Honey', 'Glass', 'Northern', 'Feral', 'Hollow', 'Golden', 'Slow', 'Electric'];
const SECOND = ['Lanterns', 'Radio', 'Harbor', 'Cassette', 'Signal', 'Orchard', 'Postcards', 'Weather', 'Motel', 'Parade', 'Satellites', 'Moth', 'Atlas', 'Hymn', 'Arcade', 'Tigers'];

export function suggestBandName(seed: string): string {
  const rng = makeRng(seed + ':bandname');
  return `${FIRST[rng.int(0, FIRST.length)]} ${SECOND[rng.int(0, SECOND.length)]}`;
}
