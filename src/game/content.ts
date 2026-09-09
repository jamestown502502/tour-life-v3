// Content loading + validation entry point. Every city/song JSON is checked against
// content/schema.ts before it touches state (dev assert + runtime console warning).

import type { CityDef, SongDef } from '../../content/schema';
import { assertValid, validateCity, validateSong } from '../../content/schema';

import lisbonRaw from '../../content/cities/lisbon.json';
import tokyoRaw from '../../content/cities/tokyo.json';
import mexicoCityRaw from '../../content/cities/mexico_city.json';
import berlinRaw from '../../content/cities/berlin.json';
import sailorLullabyRaw from '../../content/songs/sailor_lullaby.json';
import neonRainRaw from '../../content/songs/neon_rain.json';
import callejonGrooveRaw from '../../content/songs/callejon_groove.json';
import kreuzbergStaticRaw from '../../content/songs/kreuzberg_static.json';
// Second songs (close-out Part B) — one per city, so the return leg never replays the first night.
import tejoAfterMidnightRaw from '../../content/songs/tejo_after_midnight.json';
import lastTrainHomeRaw from '../../content/songs/last_train_home.json';
import mercadoElectricoRaw from '../../content/songs/mercado_electrico.json';
import hallenbadRaw from '../../content/songs/hallenbad.json';

assertValid(validateCity(lisbonRaw), 'cities/lisbon.json');
assertValid(validateCity(tokyoRaw), 'cities/tokyo.json');
assertValid(validateCity(mexicoCityRaw), 'cities/mexico_city.json');
assertValid(validateCity(berlinRaw), 'cities/berlin.json');
assertValid(validateSong(sailorLullabyRaw), 'songs/sailor_lullaby.json');
assertValid(validateSong(neonRainRaw), 'songs/neon_rain.json');
assertValid(validateSong(callejonGrooveRaw), 'songs/callejon_groove.json');
assertValid(validateSong(kreuzbergStaticRaw), 'songs/kreuzberg_static.json');
assertValid(validateSong(tejoAfterMidnightRaw), 'songs/tejo_after_midnight.json');
assertValid(validateSong(lastTrainHomeRaw), 'songs/last_train_home.json');
assertValid(validateSong(mercadoElectricoRaw), 'songs/mercado_electrico.json');
assertValid(validateSong(hallenbadRaw), 'songs/hallenbad.json');

export const CITIES: CityDef[] = [lisbonRaw as CityDef, tokyoRaw as CityDef, mexicoCityRaw as CityDef, berlinRaw as CityDef];
export const SONGS: SongDef[] = [
  sailorLullabyRaw as SongDef, neonRainRaw as SongDef, callejonGrooveRaw as SongDef, kreuzbergStaticRaw as SongDef,
  tejoAfterMidnightRaw as SongDef, lastTrainHomeRaw as SongDef, mercadoElectricoRaw as SongDef, hallenbadRaw as SongDef,
];

const cityIndex = new Map(CITIES.map((c) => [c.id, c]));
const songIndex = new Map(SONGS.map((s) => [s.id, s]));

export function getCity(id: string): CityDef {
  const c = cityIndex.get(id);
  if (!c) throw new Error(`[content] unknown city "${id}"`);
  return c;
}

/** For validating a resume target BEFORE routing to CityScene (which calls getCity and throws
 *  on an unknown id) — a save with a stale cityId (renamed/removed content, or corrupted
 *  storage) should fall back to Hub, not throw mid scene-transition and freeze the game. */
export function hasCity(id: string): boolean {
  return cityIndex.has(id);
}

export function getSong(id: string): SongDef {
  const s = songIndex.get(id);
  if (!s) throw new Error(`[content] unknown song "${id}"`);
  return s;
}
