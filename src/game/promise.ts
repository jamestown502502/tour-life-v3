// Whether the tour kept the promise it made itself, judged once at the end.
//
// Each test is against a number the player actually moved, with a threshold set from the ranges
// the existing endings already use — so "kept" means something specific rather than "the run
// finished". Nothing here can block or fail a run; it only selects which paragraph the epilogue
// gets, exactly like the ending tags do.
import type { RunState } from '../core/state';

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
