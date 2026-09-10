// Where each bandmate is in their own story, rather than just how much they like you.
//
// The game tracked a single standing number per bandmate and drew relationship scenes from a pool
// gated only on that number. That produces vignettes, not arcs: any scene could surface at any
// point, so nothing ever built. Reported as the bandmate stories feeling dry, and that is the
// mechanical reason — a want that never escalates and never resolves is a premise, not a story.
//
// Three stages, in the shape most character writing actually uses:
//
//   SETUP    — you meet the want. Mira wants to be heard, Theo is running on empty.
//   STRAIN   — the tour presses on it. This is where it costs something.
//   RESOLUTION — late, and only late: the want is answered one way or the other.
//
// Deliberately derived, not stored. Stage is a function of what the run has actually done — how
// many scenes that person has had, how far into the route you are, where their standing sits — so
// it needs no save-schema change, cannot desync from the run, and behaves correctly on a save
// written before arcs existed. Same reasoning as `visitIndexFor`.
export type ArcStage = 0 | 1 | 2;

export const ARC_SETUP: ArcStage = 0;
export const ARC_STRAIN: ArcStage = 1;
export const ARC_RESOLUTION: ArcStage = 2;

export interface ArcInput {
  /** How many relationship scenes this bandmate has already had in this run. */
  scenesPlayed: number;
  /** Index of the city currently being played. */
  currentCityIndex: number;
  /** Total stops on the route. */
  routeLength: number;
}

/** A resolution beat has to be EARNED and it has to be LATE — a payoff in the first city is not a
 *  payoff. Both conditions, not either: a player who spends every scene on one bandmate should
 *  still not get their ending in Berlin, and a player who ignores someone entirely should not get
 *  handed a resolution just because the tour is nearly over. */
export function arcStageFor(input: ArcInput): ArcStage {
  const { scenesPlayed, currentCityIndex, routeLength } = input;
  const lateTour = routeLength > 0 && currentCityIndex >= Math.floor(routeLength / 2);
  if (scenesPlayed >= 2 && lateTour) return ARC_RESOLUTION;
  if (scenesPlayed >= 1) return ARC_STRAIN;
  return ARC_SETUP;
}

/** Whether a pool entry authored for a given stage may play now.
 *
 *  An entry with no `arcStage` is stage-agnostic and always eligible — every scene written before
 *  arcs existed keeps working exactly as it did. An entry authored for a stage plays at that stage
 *  OR LATER, so a strain beat missed in Tokyo can still land in Lisbon rather than being lost; the
 *  one thing that never happens is a later beat arriving before its setup. */
export function stageAllows(entryStage: ArcStage | undefined, current: ArcStage): boolean {
  if (entryStage === undefined) return true;
  return current >= entryStage;
}

/** How the arc came out, for the epilogue. Distinct from the coda variant (which is about their
 *  WANT): this is about whether their story got a last beat at all. */
export type ArcOutcome = 'resolved' | 'ongoing' | 'neglected';

export function arcOutcomeFor(scenesPlayed: number, standing: number): ArcOutcome {
  if (scenesPlayed === 0) return 'neglected';
  if (scenesPlayed >= 2 && standing >= 40) return 'resolved';
  return 'ongoing';
}
