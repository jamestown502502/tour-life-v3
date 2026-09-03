// Regression coverage for the narrative-depth pass: WHY_TOUR_BEATS was purely decorative before
// this (picked in BandCreatorScene, never read anywhere) — the "a promise made at a funeral" beat
// now sets a flag (BandCreatorScene.ts) that gates a real content branch (Lisbon's journal entry,
// content/cities/lisbon.json's lis_journal/lis_journal_generic pair), the same condition/fallback
// mechanism every other gated backstory beat already uses (see src/tests/dialogue.test.ts for the
// mechanism itself; this checks the real content wiring specifically).
import { describe, expect, it } from 'vitest';
import { resolveNode } from '../game/dialogue';
import { getCity } from '../game/content';
import { State } from '../core/state';
import { WHY_TOUR_BEATS } from '../../content/bands';

describe('narrative depth pass: the funeral-promise WHY_TOUR_BEATS branch', () => {
  it('WHY_TOUR_BEATS still contains the exact funeral-promise string BandCreatorScene.ts checks against', () => {
    // A literal-string match, not an index — if this beat's wording ever changes, this (and the
    // flag-setting in BandCreatorScene.ts) needs to change with it.
    expect(WHY_TOUR_BEATS).toContain('A promise made at a funeral.');
  });

  it('without the flag, Lisbon\'s journal entry resolves to the generic (original) text', () => {
    State.newRun('narrative-depth-test');
    const lisbon = getCity('lisbon');
    const node = resolveNode(lisbon.scenes, lisbon.journalSceneId);
    expect(node.id).toBe('lis_journal_generic');
    expect(node.text).toBe("You write: Lisbon smelled like rain and someone else's song. Onward.");
  });

  it('with the flag set, Lisbon\'s journal entry resolves to the grief-flavored variant', () => {
    State.newRun('narrative-depth-test');
    State.addFlag('why_tour_funeral_promise');
    const lisbon = getCity('lisbon');
    const node = resolveNode(lisbon.scenes, lisbon.journalSceneId);
    expect(node.id).toBe('lis_journal');
    expect(node.text).toContain('the promise still counts');
  });
});
