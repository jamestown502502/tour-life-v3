// Which song a city plays, and why it is never the same one twice.
//
// Every city used to have exactly one song (CityDef.songId), so a full run heard four tracks and
// the return leg replayed the first night's song note for note. Setlist variety is genre-core for
// rhythm games, and the repetition was the single most obvious "this is a demo" tell left in the
// build.
//
// Each city now carries `songs: [a, b]`. The rules:
//   - the FIRST visit plays a seed-chosen one of the pair, so two runs of the same city can open
//     with different songs
//   - the RETURN leg always plays THE OTHER one — structurally, never the same song twice in a city
//
// Kept deliberately pure and seeded so a replayed seed reproduces the whole setlist, exactly like
// the route, the scene pool and the social feed.
import type { CityDef } from '../../content/schema';
import { makeRng } from '../core/rng';

/** Every song this city can play, oldest field first. `songs` is additive — a city (or a save)
 *  written before second songs existed still resolves through `songId`. */
export function songsFor(city: CityDef): string[] {
  const pair = city.songs ?? [];
  if (pair.length > 0) return pair;
  return [city.songId];
}

/** The song for a given visit.
 *
 *  `visitIndex` is 0 for the first night in a city and 1 for the return leg. The seed picks which
 *  of the pair opens the city; the return leg takes the other. With only one song authored, both
 *  visits fall back to it rather than failing — variety is a content property, not a hard
 *  requirement of the engine. */
export function songForVisit(city: CityDef, seed: string, visitIndex: number): string {
  const songs = songsFor(city);
  if (songs.length < 2) return songs[0];
  // Seeded per city, so different cities in one run don't all make the same choice.
  const opener = makeRng(`${seed}:setlist:${city.id}`).int(0, songs.length);
  return visitIndex === 0 ? songs[opener] : songs[(opener + 1) % songs.length];
}

/** How many times this city has been played already — 0 on a first visit, 1 on the return leg.
 *  Derived from run memory rather than the route, so a resumed save gets the same answer. */
export function visitIndexFor(cityId: string, playedCityIds: readonly string[]): number {
  return playedCityIds.includes(cityId) ? 1 : 0;
}
