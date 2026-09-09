// Coverage for the depth pass: dialogue chains, relationship arcs, tour promises, van beats and
// the three new minigame types. Content-shape assertions live here rather than in content.test.ts
// so a failure names the FEATURE that broke, not just "a city is invalid".
import { describe, expect, it } from 'vitest';
import lisbonRaw from '../../content/cities/lisbon.json';
import tokyoRaw from '../../content/cities/tokyo.json';
import mexicoRaw from '../../content/cities/mexico_city.json';
import berlinRaw from '../../content/cities/berlin.json';
import { validateCity } from '../../content/schema';
import { TOUR_PROMISES, PROMISE_EPILOGUE } from '../../content/promises';
import { VAN_BEATS, VAN_OPENERS } from '../../content/van';
import { getEpilogue } from '../../content/epilogues';
import { keptPromise } from '../game/promise';
import { State } from '../core/state';
import type { CityDef } from '../../content/schema';

const CITY_FILES: [string, unknown][] = [
  ['lisbon', lisbonRaw], ['tokyo', tokyoRaw], ['mexico_city', mexicoRaw], ['berlin', berlinRaw],
];

describe('multi-node dialogue chains', () => {
  it('every location outcome leads to a further beat, so scenes are more than one line deep', () => {
    for (const [name, raw] of CITY_FILES) {
      const city = raw as CityDef;
      for (const loc of city.locations) {
        const node = city.scenes[loc.sceneId];
        for (const choice of node.choices ?? []) {
          const outcome = city.scenes[choice.next];
          expect(outcome, `${name}: ${choice.next} missing`).toBeDefined();
          expect(outcome.next, `${name}: ${choice.next} is still a dead end`).toBeDefined();
          const beat = city.scenes[outcome.next!];
          expect(beat, `${name}: ${outcome.next} referenced but not defined`).toBeDefined();
          expect(beat.text.length, `${name}: ${outcome.next} is empty`).toBeGreaterThan(10);
        }
      }
    }
  });

  it('a chain long enough to make the back button reachable exists in every city', () => {
    // CityScene clears walkHistory on a choice, so the button needs >=2 nodes AFTER the choice.
    for (const [name, raw] of CITY_FILES) {
      const city = raw as CityDef;
      const reachable = city.locations.some((loc) => {
        const node = city.scenes[loc.sceneId];
        return (node.choices ?? []).some((c) => city.scenes[c.next]?.next !== undefined);
      });
      expect(reachable, `${name} has no chain that would ever show the back button`).toBe(true);
    }
  });

  it('every chained beat stays inside the 40-word dialogue budget', () => {
    for (const [name, raw] of CITY_FILES) {
      const city = raw as CityDef;
      for (const [id, node] of Object.entries(city.scenes)) {
        if (!id.endsWith('_after')) continue;
        const words = node.text.trim().split(/\s+/).length;
        expect(words, `${name}: ${id} is ${words} words`).toBeLessThanOrEqual(40);
      }
    }
  });
});

describe('relationship arcs', () => {
  it('gates later beats behind standing, and leaves opening beats always available', () => {
    for (const [name, raw] of CITY_FILES) {
      const city = raw as CityDef;
      const gated = city.relationshipScenePool.filter((e) => e.minRelationship !== undefined);
      const ungated = city.relationshipScenePool.filter((e) => e.minRelationship === undefined);
      expect(gated.length, `${name} has no later-arc beat`).toBeGreaterThan(0);
      expect(ungated.length, `${name} must keep opening beats reachable from the start`).toBeGreaterThan(0);
      for (const e of gated) {
        expect(e.minRelationship!, `${name}: ${e.id} gate should be above the 20 starting value`).toBeGreaterThan(20);
      }
    }
  });

  it('every city still validates with the arc gates present', () => {
    for (const [name, raw] of CITY_FILES) {
      expect(validateCity(raw).errors, name).toEqual([]);
    }
  });
});

describe('tour promises', () => {
  it('every promise has an epilogue paragraph for both outcomes', () => {
    for (const p of TOUR_PROMISES) {
      expect(PROMISE_EPILOGUE[p.flag], `${p.id} has no epilogue entry`).toBeDefined();
      expect(PROMISE_EPILOGUE[p.flag].kept.length).toBeGreaterThan(40);
      expect(PROMISE_EPILOGUE[p.flag].missed.length).toBeGreaterThan(40);
    }
  });

  it('is judged against numbers the player actually moved', () => {
    State.newRun('promise-test');
    State.addFlag('promise_together');
    // Starting values (relationships 20, harmony 60) should NOT clear the bar on their own.
    expect(keptPromise(State.data)!.kept).toBe(false);
    for (const id of ['mira', 'theo', 'jun', 'rowan'] as const) State.data.relationships[id] = 60;
    State.data.stats.harmony = 70;
    expect(keptPromise(State.data)!.kept).toBe(true);
  });

  it('a run with no promise is unaffected', () => {
    State.newRun('no-promise');
    expect(keptPromise(State.data)).toBeNull();
    const base = getEpilogue('quiet_ending', ['Tender'], []);
    expect(getEpilogue('quiet_ending', ['Tender'], [], null)).toBe(base);
  });

  it('adds its paragraph to the epilogue, and says something different when missed', () => {
    const kept = getEpilogue('quiet_ending', ['Tender'], [], { flag: 'promise_rooms', kept: true });
    const missed = getEpilogue('quiet_ending', ['Tender'], [], { flag: 'promise_rooms', kept: false });
    const base = getEpilogue('quiet_ending', ['Tender'], []);
    expect(kept.length).toBeGreaterThan(base.length);
    expect(missed.length).toBeGreaterThan(base.length);
    expect(kept).not.toBe(missed);
  });
});

describe('van beats', () => {
  it('has an opener and both a warm and a cool beat for every bandmate', () => {
    expect(VAN_OPENERS.length).toBeGreaterThanOrEqual(3);
    for (const id of ['mira', 'theo', 'jun', 'rowan'] as const) {
      expect(VAN_BEATS[id], `${id} missing`).toBeDefined();
      expect(VAN_BEATS[id].warm.length).toBeGreaterThan(20);
      expect(VAN_BEATS[id].cool.length).toBeGreaterThan(20);
      expect(VAN_BEATS[id].warm).not.toBe(VAN_BEATS[id].cool);
    }
  });

  it('keeps every beat inside the 40-word dialogue budget', () => {
    const all = [...VAN_OPENERS, ...Object.values(VAN_BEATS).flatMap((b) => [b.warm, b.cool])];
    for (const line of all) {
      expect(line.trim().split(/\s+/).length, line.slice(0, 40)).toBeLessThanOrEqual(40);
    }
  });
});

describe('the three new minigame types', () => {
  it('each new type ships with the config its round logic requires', () => {
    for (const [name, raw] of CITY_FILES) {
      for (const mg of (raw as CityDef).minigames ?? []) {
        if (mg.type === 'sequence') {
          expect(mg.sequenceRounds?.length, `${name}: ${mg.id}`).toBeGreaterThan(0);
          expect(Math.min(...mg.sequenceRounds!), `${name}: ${mg.id} rounds too short`).toBeGreaterThanOrEqual(2);
        }
        if (mg.type === 'sustain') expect(mg.sustainSeconds!, `${name}: ${mg.id}`).toBeGreaterThan(0);
        if (mg.type === 'pressure') {
          expect(mg.pressureSeconds!, `${name}: ${mg.id}`).toBeGreaterThan(0);
          expect(mg.questions?.length, `${name}: ${mg.id}`).toBe(3);
          // The whole point of 'pressure' is being tighter than 'choice''s 6.5s soft timer.
          expect(mg.pressureSeconds!, `${name}: ${mg.id} is not actually pressured`).toBeLessThan(6.5);
        }
      }
    }
  });

  it('every minigame reaches the epilogue through a reward flag', () => {
    for (const [name, raw] of CITY_FILES) {
      for (const mg of (raw as CityDef).minigames ?? []) {
        expect(mg.reward.flags?.length, `${name}: ${mg.id} awards no flag, so it can never be referenced later`).toBeGreaterThan(0);
      }
    }
  });
});
