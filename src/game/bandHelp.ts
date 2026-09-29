// Bandmates change the game itself.
//
// A bandmate-hosted minigame used to play identically whether the host was your closest friend in
// the van or someone you had not spoken to in three cities; the relationship only moved the reward.
// Now it moves the help. Florence (Mountains, 2018) is the reference: its mechanics get easier or
// harder with how the relationship is going, so the player FEELS the relationship in their hands.
//
//   close   - the host helps on every question, unasked
//   steady  - one "Ask <name>" per game
//   distant - the host keeps to themselves
//
// Pure logic only (MiniGameScene draws it), so every rule is testable from plain Vitest.
import type { BandmateId } from '../../content/schema';
import { bestPrice, resolvePerDiem, type PerDiemAlloc } from './ledger';

export type Rapport = 'distant' | 'steady' | 'close';

/** The same bar the story already uses for "close" (the journal and dialogue minRelationship). */
export const CLOSE_AT = 32;
/** Everyone starts at 20; a bandmate falls to distant only after real friction. */
export const STEADY_AT = 18;

export function rapportFor(value: number | undefined): Rapport {
  const v = value ?? 20;
  return v >= CLOSE_AT ? 'close' : v >= STEADY_AT ? 'steady' : 'distant';
}

export const HOST_NAMES: Record<BandmateId, string> = { mira: 'Mira', theo: 'Theo', jun: 'Jun', rowan: 'Rowan' };

export const RAPPORT_LABEL: Record<Rapport, string> = {
  close: 'close: helping without being asked',
  steady: 'steady: will help if you ask, once',
  distant: 'distant: keeping to themselves',
};

export function quietLine(host: BandmateId): string {
  return `${HOST_NAMES[host]} doesn't look up from the chart. You're on your own for this one.`;
}

/** How many wrong answers a hint greys out: always leaves the answer and at least one wrong one,
 *  so help narrows the choice but never hands it over. Two options: none (the help is the replay). */
export function wrongToRemove(optionCount: number): number {
  return optionCount >= 4 ? 2 : optionCount === 3 ? 1 : 0;
}

// ---- the hint each game type gets, in the host's voice --------------------------------------

export function chordHint(host: BandmateId): string {
  return `${HOST_NAMES[host]} plays it again, slower, and shakes their head at the wrong ones.`;
}

export function transposeHint(host: BandmateId, semis: number): string {
  const n = Math.abs(semis);
  return `${HOST_NAMES[host]}: "Same shape, ${n} fret${n === 1 ? '' : 's'} ${semis < 0 ? 'down' : 'up'}. Count it on your fingers."`;
}

export function meterHint(host: BandmateId): string {
  return `${HOST_NAMES[host]} claps only the heavy beats: "Count what falls between the loud ones."`;
}

export function tempoHint(host: BandmateId): string {
  return `${HOST_NAMES[host]} taps the beat on the pad with you. Follow the gold pulse.`;
}

/** Rowan's read of the room: a range around the real turnout, rounded to fives. */
export function splitHint(host: BandmateId, actualTurnout: number): string {
  const pct = Math.round(actualTurnout * 100);
  const lo = Math.max(0, Math.floor((pct - 8) / 5) * 5), hi = Math.min(100, Math.ceil((pct + 8) / 5) * 5);
  return `${HOST_NAMES[host]}: "I've seen this room. I'd say ${lo} to ${hi}% full tonight."`;
}

export function pricingHint(host: BandmateId, def: { unitCost: number; stock: number; minPrice: number; maxPrice: number }): string {
  const { price } = bestPrice(def);
  return `${HOST_NAMES[host]}: "Somewhere around $${Math.max(def.minPrice, price - 2)} to $${Math.min(def.maxPrice, price + 2)}. People here pay for a good shirt, not a gold one."`;
}

/** The cheapest split of a per diem that still rates perfect, on the screen's own $10 steps. */
export function suggestPerDiem(budget: number): PerDiemAlloc | null {
  let best: PerDiemAlloc | null = null;
  for (let food = 0; food <= 60; food += 10) for (let lodging = 0; lodging <= 60; lodging += 10) for (let rest = 0; rest <= 40; rest += 10) {
    const a = { food, lodging, rest };
    if (resolvePerDiem({ budget }, a).tier !== 'perfect') continue;
    if (!best || food + lodging + rest < best.food + best.lodging + best.rest) best = a;
  }
  return best;
}

export function perDiemHint(host: BandmateId, budget: number, labels: readonly string[]): string {
  const s = suggestPerDiem(budget);
  if (!s) return `${HOST_NAMES[host]}: "Eat something real and sleep somewhere flat. The rest is a bonus."`;
  return `${HOST_NAMES[host]}: "$${s.food} ${labels[0].toLowerCase()}, $${s.lodging} ${labels[1].toLowerCase()}, $${s.rest} ${labels[2].toLowerCase()}. That's how I'd do it."`;
}

export function gearHint(host: BandmateId, price: number, rentPerShow: number, showsLeft: number): string {
  const breakEven = Math.ceil(price / rentPerShow);
  return `${HOST_NAMES[host]}: "Renting costs more than buying after ${breakEven} show${breakEven === 1 ? '' : 's'}. There ${showsLeft === 1 ? 'is' : 'are'} ${showsLeft} left."`;
}
