// The stage comes alive (2026-11-10). The show was the plainest screen in the game: white bars
// falling over a painting, no band, five small fans. These are the rules for what the show now
// puts on screen, kept apart from Phaser so they can be tested:
//
//   - each lane belongs to one bandmate, who stands under it and reacts to that lane's hits
//   - notes wear that bandmate's colour
//   - the hit line glows hotter as the combo grows
//   - a back row of the crowd fills in as the room warms up
//   - every city has its own light rig
//   - a slow device gets the same show without the moving lights
import type { BandmateId } from '../../content/schema';

/** Who plays which lane, left to right. Four lanes, four friends. */
export const LANE_MATES: BandmateId[] = ['mira', 'theo', 'jun', 'rowan'];

export function laneMate(lane: number): BandmateId {
  return LANE_MATES[((lane % LANE_MATES.length) + LANE_MATES.length) % LANE_MATES.length];
}

/** A bandmate's colour mixed halfway to white: a note has to stay bright on a dark stage, so it
 *  carries a tint of its player rather than their full clothing colour. `base` is 0xRRGGBB. */
export function noteTint(base: number): number {
  const mix = (c: number) => Math.round(c + (255 - c) * 0.5);
  return (mix((base >> 16) & 255) << 16) | (mix((base >> 8) & 255) << 8) | mix(base & 255);
}

/** The painted portrait moods (public/assets/manifest.json). The stage only ever asks for these,
 *  so a bandmate never drops to a code-drawn fallback face mid-show. */
export const PAINTED_MOODS = ['happy', 'inspired', 'tense', 'tired', 'wistful', 'worried'];
/** How a bandmate looks between notes. */
export const MATE_REST_MOOD = 'happy';

/** The face a bandmate wears right after a note in their lane. */
export function mateMoodFor(judgement: 'perfect' | 'good' | 'ok' | 'miss'): string {
  return judgement === 'miss' ? 'worried' : judgement === 'perfect' ? 'inspired' : 'happy';
}

/** How strongly the hit line glows for a combo: nothing under 5, full at 50. */
export function glowAlpha(combo: number): number {
  if (combo < 5) return 0;
  return Math.min(0.5, 0.08 + (combo - 5) * (0.42 / 45));
}

/** The back row: how many of its `seats` are filled at a crowd level of 0 to 100. The front five
 *  fans carry the first third of the meter on their own; the back row fills over the rest, so a
 *  full room is something the player sees arrive. */
export function backRowFilled(crowd: number, seats: number): number {
  if (crowd <= 33) return 0;
  return Math.min(seats, Math.round(((crowd - 33) / 67) * seats));
}

export interface LightRig { name: string; colors: [number, number]; sweepMs: number }

/** One rig per city: two beam colours and how slowly they sweep. */
export const CITY_LIGHTS: Record<string, LightRig> = {
  lisbon: { name: 'Warm tungsten', colors: [0xf9a421, 0xc4704f], sweepMs: 5200 },
  tokyo: { name: 'Neon', colors: [0xe24a9a, 0x39c5d8], sweepMs: 3600 },
  mexico_city: { name: 'Fiesta', colors: [0xf2683a, 0xe6d24a], sweepMs: 4200 },
  berlin: { name: 'Cold white', colors: [0x9fc2ff, 0xf2f0e3], sweepMs: 6400 },
};
const DEFAULT_RIG: LightRig = { name: 'House', colors: [0xd9a441, 0x8fb7c9], sweepMs: 5000 };

export function lightRigFor(cityId: string): LightRig {
  return CITY_LIGHTS[cityId] ?? DEFAULT_RIG;
}

/** Moving lights are the first thing to go on a device that cannot keep up: under 35 frames a
 *  second, three seconds or more into the song. The notes and the band never drop. */
export function stageLite(fps: number, secondsIn: number): boolean {
  return secondsIn >= 3 && fps > 0 && fps < 35;
}

/** The lanes' key letters, shown only to someone playing on keys. */
export const LANE_KEYS = ['D', 'F', 'J', 'K'];

/** A timing check from real play (2026-11-10). `deltasMs` are tap time minus note time for every
 *  note landed in a show. If the player was early or late by a steady 35 ms or more over at least
 *  12 notes, this is how far, to the nearest 5 ms and at most 100: positive means their taps ran
 *  late. 0 means leave the timing alone. The two worst taps at each end are dropped first, so a
 *  few fumbles never trigger it. */
export function timingHint(deltasMs: number[]): number {
  if (deltasMs.length < 12) return 0;
  const sorted = [...deltasMs].sort((a, b) => a - b).slice(2, -2);
  const mean = sorted.reduce((a, d) => a + d, 0) / sorted.length;
  if (Math.abs(mean) < 35) return 0;
  return Math.max(-100, Math.min(100, Math.round(mean / 5) * 5));
}

/** The saved audio offset after accepting a timing hint. A positive offset draws and judges notes
 *  earlier (game/rhythm.ts adjustedHitMs), so taps that ran late need the offset lowered. */
export function offsetAfterHint(currentOffsetMs: number, hintMs: number): number {
  return Math.max(-150, Math.min(150, currentOffsetMs - hintMs));
}
