// "Every playthrough should feel unique" — asserted as a property, not hoped for.
//
// The per-run seed alone was never enough. It re-draws from each city's whole relationship pool
// every time, so a player replaying could be handed the same two Berlin scenes three runs running
// and correctly conclude the game had nothing new. Supergiant's Hades treats this as the moment a
// game stops feeling alive, and answers it by refusing to repeat material until the unused pool is
// spent. Same principle here, at this game's scale: 30 scenes, 2 shown per city visit.
import { describe, it, expect } from 'vitest';
import { drawScenePoolFlags, availabilityFlag, SCENES_PER_CITY } from '../game/scenePool';
import { makeRng } from '../core/rng';
import { getCity } from '../game/content';
import { VAN_CARRY } from '../../content/van';

const idsFrom = (flags: string[]): string[] => flags.map((f) => f.replace(/^avail_/, ''));

/** The flags that were actually DRAWN. Arc-resolution beats (arcStage 2) are always returned —
 *  they are gated by arc stage at play time, not by the draw — so counting raw flags conflates
 *  "how many scenes did this run draw" with "how many exist". Letting them compete for the two
 *  draw slots was the bug that made a run fall back to the same scene every time. */
const drawnFrom = (flags: string[], city: any): string[] =>
  idsFrom(flags).filter((id) => !(city.relationshipScenePool.find((e: any) => e.id === id)?.arcStage === 2));

describe('run variety: relationship scenes across playthroughs', () => {
  it('draws scenes the player has never seen before ones they have', () => {
    const city = getCity('berlin');
    // Arc beats are never drawn, so they are not part of this comparison.
    const all = city.relationshipScenePool.filter((e: any) => e.arcStage !== 2).map((e: any) => e.id);
    // Everything seen except two: those two must be exactly what a new run draws.
    const unseen = all.slice(0, 2);
    const seen = all.slice(2);
    const drawn = drawnFrom(drawScenePoolFlags(makeRng('any-seed'), city, seen), city);
    expect(drawn.sort()).toEqual([...unseen].sort());
  });

  it('a replay of the SAME seed still moves on to fresh material', () => {
    const city = getCity('berlin');
    const first = drawnFrom(drawScenePoolFlags(makeRng('seed:berlin:pool'), city, []), city);
    // The player has now seen those. Same seed, same city, second playthrough.
    const second = drawnFrom(drawScenePoolFlags(makeRng('seed:berlin:pool'), city, first), city);
    expect(second).toHaveLength(SCENES_PER_CITY);
    for (const id of second) expect(first).not.toContain(id);
  });

  it('falls back to seen material rather than showing nothing once a pool is exhausted', () => {
    const city = getCity('berlin');
    const all = city.relationshipScenePool.map((e: any) => e.id);
    const drawn = drawnFrom(drawScenePoolFlags(makeRng('exhausted'), city, all), city);
    expect(drawn).toHaveLength(SCENES_PER_CITY);
  });

  it('is still fully seeded — same seed and same history reproduces the same draw', () => {
    const city = getCity('tokyo');
    const a = drawScenePoolFlags(makeRng('repeatable'), city, []);
    const b = drawScenePoolFlags(makeRng('repeatable'), city, []);
    expect(a).toEqual(b);
  });
});

describe('run variety: the drive carries the last city with it', () => {
  it('every show outcome has carry lines, each naming the city and within the 40-word budget', () => {
    for (const outcome of ['triumph', 'solid', 'rough'] as const) {
      expect(VAN_CARRY[outcome].length).toBeGreaterThan(1);
      for (const line of VAN_CARRY[outcome]) {
        expect(line, `${outcome}: "${line}" must name the city`).toContain('{city}');
        expect(line.split(/\s+/).length, `${outcome}: "${line}" over budget`).toBeLessThanOrEqual(40);
      }
    }
  });

  it('a triumph and a rough night never produce the same drive', () => {
    expect(VAN_CARRY.triumph).not.toEqual(VAN_CARRY.rough);
    const overlap = VAN_CARRY.triumph.filter((l) => VAN_CARRY.rough.includes(l));
    expect(overlap).toEqual([]);
  });
});
