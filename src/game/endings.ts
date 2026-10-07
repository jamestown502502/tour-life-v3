import type { RunState } from '../core/state';

export interface EndingResult {
  id: string;
  label: string;
  tags: string[];
}

interface Candidate {
  id: string;
  label: string;
  score: number;
  tags: string[];
}

function average(values: number[]): number {
  if (values.length === 0) return 50;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Deterministic given the run's tracked stats — every distinct combination of stats/route/
 *  relationships can land a different ending, but the same final state always yields the same
 *  one (PRD §15.4.8: harmony, funds, localLove avg, route, key choices all feed in). */
/** Every ending's score for this run, best first (generateEnding picks the first). */
export function endingCandidates(state: RunState): Candidate[] {
  const avgLocalLove = average(Object.values(state.localLove));
  const avgRelationship = average(Object.values(state.relationships));
  const { harmony, funds, inspiration } = state.stats;

  const candidates: Candidate[] = [
    { id: 'found_family_tour', label: 'Found Family Tour', score: avgRelationship + harmony, tags: ['Tender', 'Community-Minded'] },
    { id: 'breakout_circuit', label: 'Breakout Circuit', score: funds / 10 + avgLocalLove, tags: ['Electric', 'Ambitious'] },
    { id: 'live_album', label: 'Live Album', score: inspiration + harmony * 0.5, tags: ['Electric', 'Ambitious'] },
    { id: 'beloved_small_tour', label: 'Beloved Small Tour', score: avgLocalLove + harmony * 0.5, tags: ['Tender', 'Community-Minded'] },
    { id: 'next_chapter', label: 'Next Chapter', score: inspiration + funds / 20, tags: ['Restless', 'Ambitious'] },
    { id: 'quiet_ending', label: 'Quiet Ending', score: (100 - harmony) + (100 - avgRelationship), tags: ['Weathered', 'Tender'] },
  ];
  return candidates.sort((a, b) => b.score - a.score);
}

export function generateEnding(state: RunState): EndingResult {
  const avgRelationship = average(Object.values(state.relationships));
  const candidates = endingCandidates(state);
  const winner = candidates[0];

  const extraTags: string[] = [];
  if (state.route.length >= 6) extraTags.push('Ambitious');
  if (avgRelationship > 50 && !winner.tags.includes('Community-Minded')) extraTags.push('Community-Minded');

  const tags = Array.from(new Set([...winner.tags, ...extraTags])).slice(0, 4);
  return { id: winner.id, label: winner.label, tags };
}

/** Why THIS ending (2026-10-07): the numbers that chose it, in the player's terms, and what came
 *  closest with the one change that would have tipped it. An ending you cannot trace back to your
 *  own choices reads as random. */
export interface EndingExplanation { label: string; reasons: string[]; runnerUp: string; nearly: string; }

export function explainEnding(state: RunState): EndingExplanation {
  const c = endingCandidates(state);
  const win = c[0], next = c[1];
  const R = Math.round(average(Object.values(state.relationships)));
  const L = Math.round(average(Object.values(state.localLove)));
  const { harmony: H, funds: F, inspiration: I } = state.stats;
  const why: Record<string, string> = {
    found_family_tour: `Your bandmates ended at ${R} with you on average, and Harmony finished at ${Math.round(H)}. You looked after each other.`,
    breakout_circuit: `You brought $${Math.round(F)} home and the towns ended at ${L} love for you on average. You built an audience and a bank account.`,
    live_album: `Inspiration finished at ${Math.round(I)}, with Harmony at ${Math.round(H)}. The music itself was the story of this tour.`,
    beloved_small_tour: `The towns ended at ${L} love for you on average, with Harmony at ${Math.round(H)}. Small rooms that remembered you.`,
    next_chapter: `Inspiration at ${Math.round(I)} and $${Math.round(F)} saved point past this tour, to what comes next.`,
    quiet_ending: `Harmony fell to ${Math.round(H)} and the band ended at ${R} with you on average. The tour cost more than it gave.`,
  };
  const gap = Math.max(1, Math.ceil(win.score - next.score));
  const tip: Record<string, string> = {
    found_family_tour: `about ${gap} more closeness with the band, on average`,
    breakout_circuit: `about $${gap * 10} more in the van fund`,
    live_album: `about ${gap} more Inspiration`,
    beloved_small_tour: `about ${gap} more love from the towns`,
    next_chapter: `about ${gap} more Inspiration`,
    quiet_ending: `about ${gap} less Harmony`,
  };
  return {
    label: win.label,
    reasons: [why[win.id] ?? ''],
    runnerUp: next.label,
    nearly: `Almost ${next.label}: ${tip[next.id] ?? 'a little more'} would have tipped it.`,
  };
}
