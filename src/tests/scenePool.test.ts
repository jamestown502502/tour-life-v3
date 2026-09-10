import { describe, expect, it } from 'vitest';
import { availabilityFlag, drawScenePoolFlags, SCENES_PER_CITY } from '../game/scenePool';
import { makeRng } from '../core/rng';
import { getCity } from '../game/content';

/** The flags that were actually DRAWN. Arc-resolution beats (arcStage 2) are always returned —
 *  they are gated by arc stage at play time, not by the draw — so counting raw flags conflates
 *  "how many scenes did this run draw" with "how many exist". */
const drawnFrom = (flags: string[], city: any): string[] =>
  flags.map((f) => f.replace(/^avail_/, ''))
    .filter((id) => city.relationshipScenePool.find((e: any) => e.id === id)?.arcStage !== 2);

describe('scene-pool draw (close-out item 5: 2 relationship scenes per city, up from 1)', () => {
  it('draws exactly SCENES_PER_CITY flags for a real city (pools are 5-7, well over the count)', () => {
    const city = getCity('lisbon');
    const flags = drawScenePoolFlags(makeRng('draw-test'), city);
    expect(new Set(flags).size).toBe(flags.length); // never the same entry twice
    expect(drawnFrom(flags, city).length).toBe(SCENES_PER_CITY);
  });

  // Arc-resolution beats are ALWAYS returned, never drawn. Letting them compete for the two draw
  // slots meant a run could spend a slot on a beat that is blocked until the back half of the
  // tour, leaving nothing eligible early and dropping the picker onto its fixed fallback entry --
  // the same scene every time, belonging to the same bandmate in three of four cities.
  it('always makes arc beats available without spending a draw slot on them', () => {
    for (const id of ['berlin', 'tokyo', 'lisbon', 'mexico_city']) {
      const city = getCity(id);
      const arcIds = city.relationshipScenePool.filter((e: any) => e.arcStage === 2).map((e: any) => e.id);
      const flags = drawScenePoolFlags(makeRng('arc-' + id), city);
      const ids = flags.map((f) => f.replace(/^avail_/, ''));
      for (const arcId of arcIds) expect(ids, `${id}: ${arcId} must always be available`).toContain(arcId);
      expect(drawnFrom(flags, city).length, `${id} should still draw exactly ${SCENES_PER_CITY}`).toBe(SCENES_PER_CITY);
    }
  });

  it('never draws more than the pool actually has', () => {
    const tinyPool = { relationshipScenePool: [{ id: 'only_one', bandmate: 'mira' as const, sceneId: 'x' }] } as any;
    const flags = drawScenePoolFlags(makeRng('tiny'), tinyPool);
    expect(flags).toEqual([availabilityFlag('only_one')]);
  });

  it('two different seeds draw different pairs from the same city (real per-run variance)', () => {
    const city = getCity('lisbon');
    const a = drawScenePoolFlags(makeRng('seed-a'), city);
    const b = drawScenePoolFlags(makeRng('seed-b'), city);
    expect(a.join(',')).not.toBe(b.join(','));
  });
});
