import { describe, expect, it } from 'vitest';
import { getEpilogue } from '../../content/epilogues';
import { generateEnding } from '../game/endings';
import { freshAccessibility, freshMeta, freshRun } from '../core/state';

// Sweeps a wide range of stat/relationship/localLove combinations through the real
// generateEnding() to enumerate every (endingId, tags) pair the game can actually produce today
// (route.length never reaches 6 with a 4-city pool — HANDOFF.md §7.3 — so the "Ambitious" bonus
// tag from route length never fires; this sweep will start covering it automatically once a 5th+
// city makes it reachable, at which point this test is the thing that will catch a missing
// epilogue for the newly-reachable combo). Every combination found this way must resolve to a
// BESPOKE entry, not the generic per-ending fallback — that's the actual "every reachable
// ending+tags combination renders distinct prose" claim, checked against real generator output
// instead of hand-guessed combinations.
function sweepReachableCombos(): { endingId: string; tags: string[] }[] {
  const seen = new Map<string, { endingId: string; tags: string[] }>();
  const levels = [0, 20, 40, 60, 80, 100];
  for (const harmony of levels) {
    for (const funds of [0, 200, 500, 1000]) {
      for (const inspiration of levels) {
        for (const rel of levels) {
          for (const localLove of levels) {
            const state = freshRun('sweep', freshMeta(), freshAccessibility());
            state.stats = { harmony, funds, inspiration, energy: 70 };
            state.relationships = { mira: rel, theo: rel, jun: rel, rowan: rel };
            state.localLove = { lisbon: localLove, tokyo: localLove };
            const ending = generateEnding(state);
            const k = `${ending.id}::${[...ending.tags].sort().join(',')}`;
            seen.set(k, { endingId: ending.id, tags: ending.tags });
          }
        }
      }
    }
  }
  return Array.from(seen.values());
}

describe('epilogues (close-out item 7: written payoff per ending+tags)', () => {
  const reachable = sweepReachableCombos();

  it('the sweep actually found more than one combo (sanity check on the test itself)', () => {
    expect(reachable.length).toBeGreaterThan(5);
  });

  it('every reachable (endingId, tags) combo from the real generator has bespoke prose, not the generic fallback', () => {
    const genericTexts = new Set([
      'found_family_tour', 'beloved_small_tour', 'breakout_circuit', 'live_album', 'next_chapter', 'quiet_ending',
    ].map((id) => getEpilogue(id, ['__no_such_tag__'])));
    for (const { endingId, tags } of reachable) {
      const text = getEpilogue(endingId, tags);
      expect(genericTexts.has(text), `${endingId} [${tags.join(',')}] fell back to generic`).toBe(false);
    }
  });

  it('an unrecognized tag combination falls back to that ending\'s generic paragraph, never blank', () => {
    const text = getEpilogue('found_family_tour', ['NotARealTag']);
    expect(text.length).toBeGreaterThan(20);
  });

  it('an unrecognized ending id still returns non-empty text (universal fallback)', () => {
    const text = getEpilogue('not_a_real_ending', []);
    expect(text.length).toBeGreaterThan(10);
  });

  it('tag order does not matter for the lookup', () => {
    const a = getEpilogue('found_family_tour', ['Tender', 'Community-Minded']);
    const b = getEpilogue('found_family_tour', ['Community-Minded', 'Tender']);
    expect(a).toBe(b);
  });
});
