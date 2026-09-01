// Geometry, palette refs, and timing constants only. Never import from main.ts (circular deps).

export const W = 720;
export const H = 1280;

export const PALETTE = {
  cream: 0xf5ebdd,
  sand: 0xe8d5b7,
  terracotta: 0xc4704f,
  teal: 0x3e7c7b,
  plum: 0x4a2c40,
  gold: 0xd9a441,
  night: 0x2b3a55,
  sky: 0x8fb7c9,
  softRed: 0xc94f4f,
} as const;

export const PALETTE_HEX = {
  cream: '#F5EBDD',
  sand: '#E8D5B7',
  terracotta: '#C4704F',
  teal: '#3E7C7B',
  plum: '#4A2C40',
  gold: '#D9A441',
  night: '#2B3A55',
  sky: '#8FB7C9',
  softRed: '#C94F4F',
} as const;

// Rhythm timing windows in ms, at "standard" difficulty.
export const RHYTHM_WINDOWS = {
  perfect: 50,
  good: 100,
  ok: 160,
} as const;

export const RHYTHM_DIFFICULTY_SCALE = {
  relaxed: 1.5,
  standard: 1.0,
  expert: 0.7,
} as const;

export const TYPEWRITER_CHARS_PER_SEC = 45;
export const SCREEN_FADE_MS = 250;

export const SAVE_KEY = 'tourlife.run';
export const SAVE_SCHEMA_VERSION = 1 as const;
