import { describe, expect, it } from 'vitest';
import { availabilityFlag, drawScenePoolFlags, SCENES_PER_CITY } from '../game/scenePool';
import { makeRng } from '../core/rng';
import { getCity } from '../game/content';

describe('scene-pool draw (close-out item 5: 2 relationship scenes per city, up from 1)', () => {
  it('draws exactly SCENES_PER_CITY flags for a real city (pools are 5-7, well over the count)', () => {
    const city = getCity('lisbon');
    const flags = drawScenePoolFlags(makeRng('draw-test'), city);
    expect(flags.length).toBe(SCENES_PER_CITY);
    expect(new Set(flags).size).toBe(flags.length); // never the same entry twice
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
