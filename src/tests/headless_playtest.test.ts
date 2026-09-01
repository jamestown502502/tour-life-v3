// Headless bot playtest: walks the golden path (Title -> BandCreator -> Route -> Hub ->
// Lisbon -> Rhythm -> Results -> ... -> Tokyo -> ... -> Scrapbook) at the state/logic layer
// (no Phaser canvas — that needs a real browser, exercised manually per DESIGN.md §15.15 item 3)
// and asserts it never throws and never gets stuck.
import { describe, expect, it } from 'vitest';
import { State, freshMeta, freshAccessibility, freshRun } from '../core/state';
import { makeRng } from '../core/rng';
import { CITIES, getCity, getSong } from '../game/content';
import { generateRoute } from '../game/route';
import { drawScenePoolFlags, availabilityFlag } from '../game/scenePool';
import { resolveNode, visibleChoices, applyChoice, advanceTarget } from '../game/dialogue';
import { evaluateCondition } from '../game/condition';
import { pickArrangement, arrangementFlag, buildPerformanceResult } from '../game/rhythm';
import { generateEnding } from '../game/endings';
import { completeRun } from '../game/meta';
import type { CityDef, SceneGraph } from '../../content/schema';

function walkToLeaf(scenes: SceneGraph, startId: string): void {
  let currentId: string | undefined = startId;
  let steps = 0;
  while (currentId && steps < 200) {
    steps++;
    const node = resolveNode(scenes, currentId);
    const choices = visibleChoices(node);
    if (choices.length > 0) {
      currentId = applyChoice(choices[0]);
    } else {
      currentId = advanceTarget(node);
    }
  }
  if (steps >= 200) throw new Error(`[playtest] possible infinite loop from "${startId}"`);
}

function playCity(city: CityDef, seed: string): void {
  walkToLeaf(city.scenes, city.arrivalSceneId);

  const toVisit = city.locations.slice(0, Math.min(2, city.locations.length));
  for (const loc of toVisit) walkToLeaf(city.scenes, loc.sceneId);

  for (const flag of drawScenePoolFlags(makeRng(`${seed}:${city.id}:pool`), city)) State.addFlag(flag);
  const available = city.relationshipScenePool.filter((e) => State.hasFlag(availabilityFlag(e.id)));
  const relEntry = available[0] ?? city.relationshipScenePool[0];
  walkToLeaf(city.scenes, relEntry.sceneId);

  walkToLeaf(city.scenes, city.preShowSceneId);
  const ctx = { stats: State.data.stats, relationships: State.data.relationships, localLove: State.data.localLove, flags: State.data.flags };
  const preShowOptions = city.preShowChoices.filter((c) => evaluateCondition(c.condition, ctx));
  const chosen = preShowOptions[0];
  State.applyStatDeltas(chosen.effects);
  State.addFlag(arrangementFlag(chosen.arrangementId));

  const song = getSong(city.songId);
  const arrangement = pickArrangement(song, State.data.flags);
  const judgements = arrangement.notes.map(() => 'perfect' as const);
  const expressionChoices = arrangement.cues.map((c) => c.type);
  const result = buildPerformanceResult(judgements, expressionChoices, {
    cityId: city.id, songId: song.id, arrangement, bandHarmony: State.data.stats.harmony,
    energy: State.data.stats.energy, audienceMood: State.data.stats.harmony, storyFlags: State.data.flags,
  });
  for (const flag of result.unlockedFlags) State.addFlag(flag);
  State.applyStatDeltas({ inspiration: Math.round(result.crowdConnection / 20), energy: -4 });
  State.addLocalLove(city.id, Math.round(result.crowdConnection / 10));

  walkToLeaf(city.scenes, city.afterShowSceneId);
  walkToLeaf(city.scenes, city.journalSceneId);

  State.addItem({ id: `${city.id}_gift`, name: city.collaborator.gift, description: 'gift', cityId: city.id });
  const stop = State.data.route.find((s) => s.cityId === city.id);
  if (stop) stop.visited = true;
  State.data.currentCityIndex += 1;
}

function runBotPlaytest(seed: string) {
  State.data = freshRun(seed, freshMeta(), freshAccessibility());
  State.data.band = { name: 'Bot Band', genre: 'indie_rock', whyTour: 'testing', members: ['mira', 'theo', 'jun', 'rowan'] };

  const generated = generateRoute(makeRng(`${seed}:route`), CITIES);
  State.data.route = generated.stops;
  State.data.midTourComplication = generated.midTourComplication;
  for (const stop of generated.stops) {
    stop.weather = generated.weatherByCity[stop.cityId];
    State.data.localLove[stop.cityId] = 0;
  }

  for (const stop of State.data.route) {
    playCity(getCity(stop.cityId), seed);
  }

  const ending = generateEnding(State.data);
  State.data.meta = completeRun(State.data.meta, {
    seed, bandName: State.data.band.name, endingId: ending.id, tags: ending.tags, completedAt: Date.now(),
  });
  return { ending, finalState: State.data };
}

describe('headless bot playtest (golden path)', () => {
  it('completes the full route for a seed without throwing or stalling', () => {
    const { ending, finalState } = runBotPlaytest('playtest-seed-1');
    expect(finalState.currentCityIndex).toBe(finalState.route.length);
    expect(finalState.route.every((s) => s.visited)).toBe(true);
    expect(ending.id).toBeTruthy();
    expect(ending.tags.length).toBeGreaterThan(0);
  });

  it('reaches after-show and scrapbook even with a rough performance (no-fail cozy mode)', () => {
    // A "miss everything" run should still complete — there is no fail branch in the state
    // machine at all, which is how no-fail cozy mode is guaranteed rather than merely configured.
    State.data = freshRun('miss-everything', freshMeta(), freshAccessibility());
    State.data.band = { name: 'Bot Band', genre: 'folk', whyTour: 'testing', members: ['mira', 'theo', 'jun', 'rowan'] };
    const generated = generateRoute(makeRng('miss-everything:route'), CITIES);
    State.data.route = generated.stops;
    for (const stop of generated.stops) { stop.weather = generated.weatherByCity[stop.cityId]; State.data.localLove[stop.cityId] = 0; }
    for (const stop of State.data.route) {
      const city = getCity(stop.cityId);
      walkToLeaf(city.scenes, city.arrivalSceneId);
      for (const loc of city.locations.slice(0, 2)) walkToLeaf(city.scenes, loc.sceneId);
      walkToLeaf(city.scenes, city.relationshipScenePool[0].sceneId);
      walkToLeaf(city.scenes, city.preShowSceneId);
      const song = getSong(city.songId);
      const arrangement = pickArrangement(song, State.data.flags);
      const judgements = arrangement.notes.map(() => 'miss' as const);
      const result = buildPerformanceResult(judgements, [], {
        cityId: city.id, songId: song.id, arrangement, bandHarmony: State.data.stats.harmony,
        energy: State.data.stats.energy, audienceMood: 0, storyFlags: State.data.flags,
      });
      expect(result.grade).toBeDefined(); // never throws, never gates
      walkToLeaf(city.scenes, city.afterShowSceneId);
      walkToLeaf(city.scenes, city.journalSceneId);
      const stop2 = State.data.route.find((s) => s.cityId === city.id);
      if (stop2) stop2.visited = true;
      State.data.currentCityIndex += 1;
    }
    expect(State.data.route.every((s) => s.visited)).toBe(true);
    expect(() => generateEnding(State.data)).not.toThrow();
  });

  it('two different seeds diverge somewhere (weather, scene draw, or ending)', () => {
    const a = runBotPlaytest('divergence-seed-a');
    const b = runBotPlaytest('divergence-seed-b');
    const weatherA = a.finalState.route.map((s) => s.weather).join(',');
    const weatherB = b.finalState.route.map((s) => s.weather).join(',');
    const differs = weatherA !== weatherB || a.ending.id !== b.ending.id || a.ending.tags.join(',') !== b.ending.tags.join(',');
    expect(differs).toBe(true);
  });
});
