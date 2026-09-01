export { PALETTE, PALETTE_HEX } from '../const';

// Named color stories for city backgrounds. Content only uses 2 of these today (Lisbon:
// warm_amber, Tokyo: teal_pink) — the other 6 exist so future cities aren't forced into one
// of those two just because that's all the art system happened to support.
export const CITY_TINTS: Record<string, number> = {
  warm_amber: 0xc4704f,
  teal_pink: 0x3e7c7b,
  lavender_dusk: 0x8a6fa3,
  rose_gold: 0xd98a8a,
  forest_moss: 0x6b8a5a,
  desert_clay: 0xc98a54,
  midnight_indigo: 0x4a4a8a,
  citrus_bloom: 0xe0a458,
};

// Whether a tint reads as a "night" city (gets bright lit windows) vs "day" (softer glass tint).
export const NIGHT_TINTS = new Set(['teal_pink', 'midnight_indigo', 'lavender_dusk']);
