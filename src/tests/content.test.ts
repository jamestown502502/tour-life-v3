// Exhaustive scene-graph reference integrity for every shipped city. headless_playtest.test.ts
// only walks whichever locations/pool entries a seeded RNG happens to draw, so a broken
// next/choice/fallback reference in an unvisited branch (e.g. a gated backstory beat's fallback,
// or a location past LOCATIONS_TO_VISIT) could ship unnoticed. This checks every node reachable
// from every declared entry point, regardless of what a bot run would actually walk.
import { describe, expect, it } from 'vitest';
import { CITIES } from '../game/content';

describe('city content — scene graph integrity', () => {
  for (const city of CITIES) {
    it(`${city.id}: every next/choice/fallback reference resolves to a real node`, () => {
      const ids = new Set(Object.keys(city.scenes));
      for (const [nodeId, node] of Object.entries(city.scenes)) {
        if (node.next) expect(ids.has(node.next), `${city.id}.${nodeId}.next -> "${node.next}"`).toBe(true);
        if (node.fallback) expect(ids.has(node.fallback), `${city.id}.${nodeId}.fallback -> "${node.fallback}"`).toBe(true);
        for (const choice of node.choices ?? []) {
          expect(ids.has(choice.next), `${city.id}.${nodeId}.choice[${choice.id}].next -> "${choice.next}"`).toBe(true);
        }
      }
    });

    it(`${city.id}: every declared entry point exists`, () => {
      const ids = new Set(Object.keys(city.scenes));
      const entries = [
        city.arrivalSceneId, city.preShowSceneId, city.afterShowSceneId, city.journalSceneId,
        ...city.locations.map((l) => l.sceneId),
        ...city.relationshipScenePool.map((e) => e.sceneId),
      ];
      for (const entry of entries) expect(ids.has(entry), `${city.id} entry point "${entry}"`).toBe(true);
    });
  }
});
