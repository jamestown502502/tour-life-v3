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

// How long a note is visible on its way to the hit line, per difficulty. Longer lead = slower
// fall = more time to read the chart; expert players shouldn't be fighting a slow scroll.
export const RHYTHM_LEAD_MS = {
  relaxed: 1800,
  standard: 1600,
  expert: 1400,
} as const;

// Wall-clock ceiling on the one-time rhythm practice pass before the real song is forced to
// start anyway. The pass itself is ~14 beats (7-9s depending on bpm) but is scheduled entirely
// with scene.time.delayedCall, which advances on clamped FRAME DELTA rather than real time — so
// a low frame rate stretches it proportionally (measured at ~4fps: 6% of real speed) and leaves
// a first-time player stranded on a note-less playfield. Generous enough that a normal-speed
// pass always finishes on its own and never sees this.
export const PRACTICE_PASS_WATCHDOG_MS = 20000;

// Rhythm playfield geometry. Hit line sits well above the bottom edge: on a phone the canvas
// scales to ~0.54x, and anything below ~1230 game px lands under the iOS home-indicator
// gesture zone (viewport-fit=cover) — the old 1100 line put the tap zones' bottom at 1180,
// right in thumb-stretch territory. 4 lanes x 165 = 660 wide, centered in the 720 canvas.
export const RHYTHM_HIT_LINE_Y = 980;
export const RHYTHM_SPAWN_Y = 160;
export const RHYTHM_LANE_W = 165;
export const RHYTHM_LANE_X_START = 30;

// Bottom edge of the "safe" interactive region (game px). Nothing tappable below this line.
export const SAFE_BOTTOM_Y = 1230;

export const TYPEWRITER_CHARS_PER_SEC = 45;
export const SCREEN_FADE_MS = 250;

// Consistent UI geometry — every panel/card/button/chip in the game draws from these so the
// whole game reads as one system rather than ad-hoc per-screen values.
export const UI_RADIUS = {
  card: 22,   // panels, cards, dialogue box
  button: 14, // buttons, rhythm notes
  chip: 10,   // small chips/tags
} as const;
export const UI_MARGIN = 24;   // screen edge margin
export const UI_PADDING = 16;  // internal padding inside a panel/card

export const SAVE_KEY = 'tourlife.run';
export const SAVE_SCHEMA_VERSION = 1 as const;
