// The Long Haul (2026-10-03): route and fund a three-day tour leg out of the van's float.
//
// Each day: pick one of two stops (fuel is paid up front, so a far stop can be out of reach), pick
// the deal (a flat guarantee or a share of the door), and pick a bed (the van is free but the band
// wakes up tired; a motel costs money but rests them). The show pays at the END of the day. That
// ordering is the lesson: cash flow is not profit. You can be heading for a good week and still
// not afford tonight's fuel, and rest is an investment, because a tired band plays a smaller night.
// Pure logic, seeded; MiniGameScene draws it.
import type { RNG } from '../core/rng';
import { makeRng } from '../core/rng';

export const HAUL_DAYS = 3;
export const HAUL_FLOAT = 100;
export const FUEL_PER_MILE = 0.3;
export const MOTEL = 40;
export const TIRED_MAX = 3;
/** Each level of tiredness costs this much turnout. */
export const TIRED_TURNOUT = 0.08;

export interface Stop {
  venue: string; miles: number; fuel: number;
  guarantee: number; doorPct: number; capacity: number; ticket: number;
  /** The real turnout fraction, before tiredness. Hidden; `hintLo`-`hintHi` is what the band reads. */
  turnout: number; hintLo: number; hintHi: number;
}
export type Deal = 'flat' | 'door';
export type Bed = 'van' | 'motel';
export interface DayChoice { stop: 0 | 1; deal: Deal; bed: Bed }

const VENUES = ['Harbor Hall', 'The Record Shop', 'Old Mill Stage', 'College Union', 'Riverside Theater', 'The Warehouse', 'Market Square Stage', 'Community Center', 'Lighthouse Club', 'Station Hall'];

function stop(rng: RNG, venue: string, far: boolean): Stop {
  const miles = far ? rng.int(180, 261) : rng.int(60, 111);
  // small rooms: a house-show-sized near stop, a bigger room far away
  const capacity = far ? rng.int(6, 10) * 10 : rng.int(3, 6) * 10;
  const ticket = far ? 6 : 5;
  const doorPct = 70;
  const turnout = (far ? rng.int(35, 86) : rng.int(45, 91)) / 100;
  const pct = Math.round(turnout * 100);
  // the guarantee is pegged so the door only wins above about 45-65% full: a real decision
  const guarantee = Math.max(20, Math.round((capacity * ticket * doorPct / 100) * (rng.int(45, 66) / 100) / 5) * 5);
  return {
    venue, miles, fuel: Math.round(miles * FUEL_PER_MILE),
    guarantee, doorPct, capacity, ticket, turnout,
    hintLo: Math.max(0, Math.floor((pct - 10) / 5) * 5), hintHi: Math.min(100, Math.ceil((pct + 10) / 5) * 5),
  };
}

/** The two offers for every day of this leg, seeded by run and minigame. */
export function haulOffers(seed: string): [Stop, Stop][] {
  const rng = makeRng(`${seed}:longhaul`);
  const venues = rng.shuffle(VENUES);
  return Array.from({ length: HAUL_DAYS }, (_, d) => [stop(rng, venues[d * 2], false), stop(rng, venues[d * 2 + 1], true)] as [Stop, Stop]);
}

export function turnoutFor(s: Stop, tired: number): number {
  return Math.max(0.1, s.turnout - tired * TIRED_TURNOUT);
}
export function doorPay(s: Stop, turnout: number): number {
  return Math.round(s.capacity * turnout * s.ticket * (s.doorPct / 100));
}
/** The turnout above which the door beats the flat guarantee. */
export function breakEven(s: Stop): number {
  return s.guarantee / (s.capacity * s.ticket * (s.doorPct / 100));
}

export interface DayResult { pay: number; turnout: number; floatAfter: number; tiredAfter: number }

/** One day, in the order money actually moves: fuel, then the bed, then (after the show) the pay.
 *  Returns null if the float cannot cover a cost when it falls due. */
export function playDay(s: Stop, c: DayChoice, float: number, tired: number): DayResult | null {
  let f = float - s.fuel;
  if (f < 0) return null;
  if (c.bed === 'motel') { f -= MOTEL; if (f < 0) return null; }
  // the show happens on tonight's tiredness; the bed decides tomorrow's
  const turnout = turnoutFor(s, tired);
  const pay = c.deal === 'flat' ? s.guarantee : doorPay(s, turnout);
  const tiredAfter = c.bed === 'van' ? Math.min(TIRED_MAX, tired + 1) : Math.max(0, tired - 1);
  return { pay, turnout, floatAfter: f + pay, tiredAfter };
}

/** The best final float any sequence of choices could reach (2 stops x 2 deals x 2 beds, three days). */
export function bestHaul(offers: [Stop, Stop][]): number {
  let best = -Infinity;
  const go = (day: number, float: number, tired: number): void => {
    if (day === offers.length) { best = Math.max(best, float); return; }
    for (const stopIx of [0, 1] as const) for (const deal of ['flat', 'door'] as const) for (const bed of ['van', 'motel'] as const) {
      const r = playDay(offers[day][stopIx], { stop: stopIx, deal, bed }, float, tired);
      if (r) go(day + 1, r.floatAfter, r.tiredAfter);
    }
  };
  go(0, HAUL_FLOAT, 0);
  return best;
}

/** Tier against what this leg allowed: within 90% of the best profit is perfect, half of it good. */
export function haulTier(finalFloat: number, best: number): 'perfect' | 'good' | 'rough' {
  const profit = finalFloat - HAUL_FLOAT, bestProfit = best - HAUL_FLOAT;
  if (profit <= 0) return 'rough';
  return profit >= bestProfit * 0.9 ? 'perfect' : profit >= bestProfit * 0.5 ? 'good' : 'rough';
}

export const HAUL_LESSON = 'Cash flow is not profit: fuel and beds are paid before the show pays you. And rest is an investment: a tired band plays a smaller night.';
