// The Setlist (2026-10-03): build tonight's set from a hand of the band's songs.
//
// Pick 4 of 6, in order. Every change between two songs is scored on the circle of fifths (keys
// that sit next to each other flow; a big jump clashes, and so does a tempo lurch), and the whole
// set on its energy arc (open strong, give them a breather, build, close on the biggest song).
// That is how bands and DJs actually sequence a night, and the circle of fifths is the most useful
// single piece of music theory there is. Pure logic only; MiniGameScene draws it.
//
// (Not to be confused with src/game/setlist.ts, which picks which song a CITY plays.)
import { getSong } from './content';
import type { RNG } from '../core/rng';

export interface SetCard { id: string; name: string; key: string; bpm: number; energy: number }

const PCS: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

/** "Am7" -> "Am", "Fmaj7" -> "F", "Cm" -> "Cm": the key a song's first chord puts it in. */
export function keyOfChord(chord: string): string {
  const m = /^([A-G][#b]?)(m(?!aj))?/.exec(chord);
  if (!m) return 'C';
  return m[1] + (m[2] ? 'm' : '');
}

export function energyFor(bpm: number): number {
  return bpm <= 85 ? 1 : bpm <= 97 ? 2 : bpm <= 109 ? 3 : bpm <= 120 ? 4 : 5;
}

/** Position on the circle of fifths (C = 0, G = 1, ... F = 11); a minor key sits with its relative major. */
export function circlePos(key: string): number {
  const minor = key.endsWith('m');
  const pc = PCS[minor ? key.slice(0, -1) : key] ?? 0;
  const major = minor ? (pc + 3) % 12 : pc;
  return (major * 7) % 12;
}

export function circleSteps(a: string, b: string): number {
  const d = Math.abs(circlePos(a) - circlePos(b));
  return Math.min(d, 12 - d);
}

/** The band's eight songs, plus six B-sides so the hand spans the circle (four of the eight are in A minor). */
const SONG_IDS = ['callejon_groove', 'hallenbad', 'kreuzberg_static', 'last_train_home', 'mercado_electrico', 'neon_rain', 'sailor_lullaby', 'tejo_after_midnight'];
const B_SIDES: SetCard[] = [
  { id: 'b_paper_lanterns', name: 'Paper Lanterns', key: 'G', bpm: 112, energy: energyFor(112) },
  { id: 'b_ferry_lights', name: 'Ferry Lights', key: 'D', bpm: 100, energy: energyFor(100) },
  { id: 'b_rooftop_static', name: 'Rooftop Static', key: 'E', bpm: 130, energy: energyFor(130) },
  { id: 'b_slow_postcard', name: 'Slow Postcard', key: 'C', bpm: 80, energy: energyFor(80) },
  { id: 'b_night_bus_north', name: 'Night Bus North', key: 'Bm', bpm: 116, energy: energyFor(116) },
  { id: 'b_gold_hour', name: 'Gold Hour', key: 'Bb', bpm: 94, energy: energyFor(94) },
];

export function setCards(): SetCard[] {
  const songs = SONG_IDS.map((id) => {
    const s = getSong(id);
    return { id, name: s.name, key: keyOfChord(s.chordProgression.split('-')[0]), bpm: s.bpm, energy: energyFor(s.bpm) };
  });
  return [...songs, ...B_SIDES];
}

export type SegueVerdict = 'smooth' | 'okay' | 'clash';
export interface Segue { verdict: SegueVerdict; points: number; why: string }

export const TEMPO_LURCH = 30;

/** One change between songs: key distance on the circle, then a tempo lurch knocks it down. */
export function segue(a: SetCard, b: SetCard): Segue {
  const steps = circleSteps(a.key, b.key);
  let points = steps <= 1 ? 100 : steps === 2 ? 55 : 0;
  let why = steps === 0 ? `${a.key} to ${b.key}: the same key family` : steps === 1 ? `${a.key} to ${b.key}: neighbors on the circle` : steps === 2 ? `${a.key} to ${b.key}: two steps apart, workable` : `${a.key} to ${b.key}: ${steps} steps apart on the circle`;
  const jump = Math.abs(a.bpm - b.bpm);
  if (jump > TEMPO_LURCH) { points = Math.max(0, points - 45); why += `, and a ${jump} bpm lurch`; }
  return { verdict: points >= 80 ? 'smooth' : points >= 40 ? 'okay' : 'clash', points, why };
}

export interface ArcCheck { label: string; ok: boolean }
/** The energy arc of a four-song set. */
export function arc(set: SetCard[]): ArcCheck[] {
  const [a, b, c, d] = set.map((s) => s.energy);
  return [
    { label: 'Open with energy', ok: a >= 3 },
    { label: 'Give them a breather', ok: b < a },
    { label: 'Build back up', ok: c > b },
    { label: 'Close on the biggest song', ok: d >= Math.max(a, b, c) },
  ];
}

/** 60% the three changes, 40% the arc. */
export function scoreSet(set: SetCard[]): number {
  const seg = [0, 1, 2].map((i) => segue(set[i], set[i + 1]).points);
  const segAvg = seg.reduce((x, y) => x + y, 0) / 3;
  const arcPts = arc(set).filter((c) => c.ok).length * 25;
  return Math.round(segAvg * 0.6 + arcPts * 0.4);
}

/** The best four-song order this hand allows (6P4 = 360 orders, checked exhaustively). */
export function bestSet(hand: SetCard[]): { set: SetCard[]; score: number } {
  let best = { set: hand.slice(0, 4), score: -1 };
  for (const a of hand) for (const b of hand) for (const c of hand) for (const d of hand) {
    if (new Set([a, b, c, d]).size < 4) continue;
    const s = scoreSet([a, b, c, d]);
    if (s > best.score) best = { set: [a, b, c, d], score: s };
  }
  return best;
}

/** A hand of six, seeded. Redrawn (a few times at most) until a strong set is possible, so a great
 *  score is always there to find. */
export function drawHand(rng: RNG): SetCard[] {
  const all = setCards();
  let hand = rng.shuffle(all).slice(0, 6);
  for (let tries = 0; tries < 12 && bestSet(hand).score < 85; tries++) hand = rng.shuffle(all).slice(0, 6);
  return hand;
}

/** Tiers against what this hand allows: the best order is perfect, 70% of it is good. */
export function setTier(score: number, best: number): 1 | 2 | 3 {
  return score >= best ? 3 : score >= Math.round(best * 0.7) ? 2 : 1;
}

export const CIRCLE_MAJORS = ['Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E'];
export const CIRCLE_MINORS = ['Cm', 'Gm', 'Dm', 'Am', 'Em', 'Bm', 'F#m', 'C#m'];
