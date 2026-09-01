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
export function generateEnding(state: RunState): EndingResult {
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
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];

  const extraTags: string[] = [];
  if (state.route.length >= 6) extraTags.push('Ambitious');
  if (avgRelationship > 50 && !winner.tags.includes('Community-Minded')) extraTags.push('Community-Minded');

  const tags = Array.from(new Set([...winner.tags, ...extraTags])).slice(0, 4);
  return { id: winner.id, label: winner.label, tags };
}
