// Content loading + validation entry point. Every city/song JSON is checked against
// content/schema.ts before it touches state (dev assert + runtime console warning).

import type { CityDef, SongDef } from '../../content/schema';
import { assertValid, validateCity, validateSong } from '../../content/schema';

import lisbonRaw from '../../content/cities/lisbon.json';
import tokyoRaw from '../../content/cities/tokyo.json';
import mexicoCityRaw from '../../content/cities/mexico_city.json';
import sailorLullabyRaw from '../../content/songs/sailor_lullaby.json';
import neonRainRaw from '../../content/songs/neon_rain.json';
import callejonGrooveRaw from '../../content/songs/callejon_groove.json';

assertValid(validateCity(lisbonRaw), 'cities/lisbon.json');
assertValid(validateCity(tokyoRaw), 'cities/tokyo.json');
assertValid(validateCity(mexicoCityRaw), 'cities/mexico_city.json');
assertValid(validateSong(sailorLullabyRaw), 'songs/sailor_lullaby.json');
assertValid(validateSong(neonRainRaw), 'songs/neon_rain.json');
assertValid(validateSong(callejonGrooveRaw), 'songs/callejon_groove.json');

export const CITIES: CityDef[] = [lisbonRaw as CityDef, tokyoRaw as CityDef, mexicoCityRaw as CityDef];
export const SONGS: SongDef[] = [sailorLullabyRaw as SongDef, neonRainRaw as SongDef, callejonGrooveRaw as SongDef];

const cityIndex = new Map(CITIES.map((c) => [c.id, c]));
const songIndex = new Map(SONGS.map((s) => [s.id, s]));

export function getCity(id: string): CityDef {
  const c = cityIndex.get(id);
  if (!c) throw new Error(`[content] unknown city "${id}"`);
  return c;
}

export function getSong(id: string): SongDef {
  const s = songIndex.get(id);
  if (!s) throw new Error(`[content] unknown song "${id}"`);
  return s;
}
