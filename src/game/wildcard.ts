// Replayability (2026-10-02): every tour draws one WILDCARD that bends the rules for the whole run,
// and one TOUR GOAL to chase on top of the story. Routes, scenes and bandmate games already varied
// by seed, but every tour started from the same numbers and asked for nothing in particular, so a
// second tour played like the first with different cities. Both are derived from the seed (pure,
// no saved fields), so a shared daily seed hands everyone the same wildcard and goal.
import type { StatDeltas, StatKey } from '../../content/schema';
import type { RunState } from '../core/state';
import { makeRng } from '../core/rng';

export interface Wildcard {
  id: string;
  name: string;
  text: string;
  /** Applied once, when the route is confirmed. */
  start: StatDeltas;
  /** Applied once per stop, when the van leaves for it. */
  perStop: StatDeltas;
}

export const WILDCARDS: Wildcard[] = [
  { id: 'shoestring', name: 'Shoestring Tour', text: 'The van fund starts $60 short, but every stop sells a little merch: +$15 per city, and $15 more from any show where you meet the goal.', start: { funds: -60 }, perStop: { funds: 15 } },
  { id: 'scout', name: 'A Label Scout Is Watching', text: 'Inspiration starts high (+6), but the pressure wears on the band: Harmony -3 per city. The scout comes to your midpoint show, where the goal counts double.', start: { inspiration: 6 }, perStop: { harmony: -3 } },
  { id: 'oldVan', name: 'The Old Van', text: 'You saved $40 on the van, and every drive costs 5 Energy.', start: { funds: 40 }, perStop: { energy: -5 } },
  { id: 'fanClub', name: 'A Fan Club Follows You', text: 'Friendly faces in every city: Harmony +5 to start and +2 per city, and two fans start every show on your side.', start: { harmony: 5 }, perStop: { harmony: 2 } },
  { id: 'newSongs', name: 'A Brand-New Setlist', text: 'Rehearsals ran late (Energy -8), but new songs keep coming: Inspiration +4 per city, and every show is a fresh chart pattern.', start: { energy: -8 }, perStop: { inspiration: 4 } },
  { id: 'festival', name: 'Festival Season', text: 'Every city has a festival slot: +$20 per city, but the days are long (Energy -3 per city). Festival crowds start warmer, and a met goal pays $20 more.', start: {}, perStop: { funds: 20, energy: -3 } },
];

export interface TourGoal {
  id: string;
  text: string;
  check: (run: RunState) => boolean;
}

export const FULL_COMBO_FLAG = 'goal_full_combo';

export const TOUR_GOALS: TourGoal[] = [
  { id: 'harmony', text: 'Finish the tour with Harmony at 70 or more.', check: (r) => r.stats.harmony >= 70 },
  { id: 'fundsHome', text: 'Bring $550 or more home in the van fund.', check: (r) => r.stats.funds >= 550 },
  { id: 'fullCombo', text: 'Play one whole show without dropping a note.', check: (r) => r.flags.includes(FULL_COMBO_FLAG) },
  { id: 'closeBand', text: 'Get every bandmate to 50 or more with you.', check: (r) => Object.values(r.relationships).every((v) => v >= 50) },
  { id: 'cityLove', text: 'Win one city over completely (local love 80 or more).', check: (r) => Object.values(r.localLove).some((v) => v >= 80) },
];

export function wildcardFor(seed: string): Wildcard {
  const rng = makeRng(`${seed}:wildcard`);
  return WILDCARDS[rng.int(0, WILDCARDS.length)];
}

export function goalFor(seed: string): TourGoal {
  const rng = makeRng(`${seed}:goal`);
  return TOUR_GOALS[rng.int(0, TOUR_GOALS.length)];
}

/** "Energy -5, +$15" for a delta set, for the Hub line. */
export function describeDeltas(d: StatDeltas): string {
  const LABEL: Record<StatKey, string> = { energy: 'Energy', harmony: 'Harmony', inspiration: 'Inspiration', funds: 'Funds' };
  return (Object.entries(d) as [StatKey, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => (k === 'funds' ? `${v > 0 ? '+' : '-'}$${Math.abs(v)}` : `${LABEL[k]} ${v > 0 ? '+' : ''}${v}`))
    .join(', ');
}
