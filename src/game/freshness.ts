// Fresh tours (2026-11-19 depth pass). A tour's character comes from three seed-derived draws: the
// wildcard that bends its rules, the goal it chases, and the city it opens in. Drawn independently,
// back-to-back tours often repeated one or two of them, so a second tour could open in the same city
// chasing the same goal. Roguelites that hold up over many runs (Hades, Slay the Spire, Into the
// Breach) avoid repeating the last run's defining draw. Here an AUTO-generated seed is redrawn until
// all three differ from the last finished tour. Typed and daily seeds are never touched: a shared
// seed must stay the same tour for everyone.
import type { MetaProgress } from '../core/state';
import { generateSeed, makeRng } from '../core/rng';
import { generateRoute } from './route';
import { CITIES, getCity } from './content';
import { goalFor, wildcardFor } from './wildcard';

export interface TourSignature { wildcard: string; goal: string; opener: string }

export function tourSignature(seed: string): TourSignature {
  return {
    wildcard: wildcardFor(seed).id,
    goal: goalFor(seed).id,
    opener: generateRoute(makeRng(`${seed}:route`), CITIES).stops[0]?.cityId ?? '',
  };
}

function lastSeed(meta: MetaProgress): string | null {
  const h = meta.runHistory;
  return h.length ? h[h.length - 1].seed : null;
}

/** An auto seed whose wildcard, goal and opening city all differ from the last finished tour.
 *  Falls back to the best partial match (fewest repeats) if no seed in `tries` clears all three. */
export function freshSeed(meta: MetaProgress, gen: () => string = generateSeed, tries = 40): string {
  const prev = lastSeed(meta);
  if (!prev) return gen();
  const p = tourSignature(prev);
  let best = '', bestRepeats = 4;
  for (let i = 0; i < tries; i++) {
    const s = gen();
    if (s === prev) continue;
    const t = tourSignature(s);
    const repeats = Number(t.wildcard === p.wildcard) + Number(t.goal === p.goal) + Number(t.opener === p.opener);
    if (repeats === 0) return s;
    if (repeats < bestRepeats) { best = s; bestRepeats = repeats; }
  }
  return best || gen();
}

/** "Unlike your last tour: ..." for the route screen, naming what changed. Null on a first tour or
 *  when replaying the same seed. */
export function freshnessLine(seed: string, meta: MetaProgress): string | null {
  const prev = lastSeed(meta);
  if (!prev || prev === seed) return null;
  const a = tourSignature(prev), b = tourSignature(seed);
  const parts: string[] = [];
  if (a.opener !== b.opener) parts.push(`you open in ${getCity(b.opener).name}, not ${getCity(a.opener).name}`);
  if (a.wildcard !== b.wildcard) parts.push(`a new wildcard, ${wildcardFor(seed).name}`);
  if (a.goal !== b.goal) parts.push('a new tour goal');
  if (!parts.length) return null;
  return `Unlike your last tour: ${parts.join(', ')}.`;
}
