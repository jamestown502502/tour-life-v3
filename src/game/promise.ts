// Whether the tour kept the promise it made itself, judged once at the end.
//
// Each test is against a number the player actually moved, with a threshold set from the ranges
// the existing endings already use — so "kept" means something specific rather than "the run
// finished". Nothing here can block or fail a run; it only selects which paragraph the epilogue
// gets, exactly like the ending tags do.
import type { RunState } from '../core/state';
import { PROMISE_MOMENTS, type PromiseMoment } from '../../content/promiseMoments';

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function keptPromise(state: RunState): { flag: string; kept: boolean } | null {
  const flag = state.flags.find((f) => f.startsWith('promise_'));
  if (!flag) return null;
  const avgRelationship = average(Object.values(state.relationships));
  const avgLocalLove = average(Object.values(state.localLove));
  switch (flag) {
    // Came home as four people who still like each other.
    case 'promise_together':
      return { flag, kept: avgRelationship >= 45 && state.stats.harmony >= 50 };
    // Won the rooms — the towns' own affection is the only honest measure of that.
    case 'promise_rooms':
      return { flag, kept: avgLocalLove >= 12 };
    // Came back with something that did not exist before.
    case 'promise_something_new':
      return { flag, kept: state.stats.inspiration >= 70 };
    default:
      return { flag, kept: false };
  }
}

// ---- promise moments (publisher polish 2026-10-12, content/promiseMoments.ts) -------------------

/** The promise moment due on arrival at route stop `stopIndex` (0-based), or null: stops 1, 2 and 3
 *  each have one, once, and only for the promise this run made. */
export function promiseMomentFor(state: Pick<RunState, 'flags' | 'promiseMoments'>, stopIndex: number): PromiseMoment | null {
  const flag = state.flags.find((f) => f.startsWith('promise_'));
  const set = flag ? PROMISE_MOMENTS[flag] : undefined;
  if (!set || stopIndex < 1 || stopIndex > 3) return null;
  const moment = set[stopIndex - 1];
  return (state.promiseMoments ?? []).some((m) => m.id === moment.id) ? null : moment;
}

/** The epilogue's evidence: the moments that pushed the way the promise actually went (the first
 *  option keeps it, the second protects something else), at most two, oldest first. When no moment
 *  pushed that way, the first one answered, so a run that answered any is always cited. */
export function promiseCitation(state: Pick<RunState, 'flags' | 'promiseMoments'>, kept: boolean, cityName: (id: string) => string): string {
  const flag = state.flags.find((f) => f.startsWith('promise_'));
  const set = flag ? PROMISE_MOMENTS[flag] : undefined;
  const answered = state.promiseMoments ?? [];
  if (!set || answered.length === 0) return '';
  const want = kept ? 0 : 1;
  const picked = answered.filter((a) => a.option === want).slice(0, 2);
  const chosen = picked.length ? picked : answered.slice(0, 1);
  const lines = chosen.map((a) => {
    const m = set.find((x) => x.id === a.id);
    return m ? `In ${cityName(a.cityId)}, ${m.options[a.option].cite}.` : '';
  }).filter(Boolean);
  return lines.length ? ` ${lines.join(' ')}` : '';
}
