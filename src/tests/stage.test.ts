// The stage comes alive + road comforts (2026-11-10): the rules behind the show's new look
// (src/game/stage.ts) and the short tour (src/game/route.ts).
import { describe, it, expect } from 'vitest';
import {
  LANE_MATES, laneMate, noteTint, mateMoodFor, MATE_REST_MOOD, PAINTED_MOODS, glowAlpha, backRowFilled,
  CITY_LIGHTS, lightRigFor, stageLite, LANE_KEYS, timingHint, offsetAfterHint,
} from '../game/stage';
import { generateRoute, shortTour, SHORT_TOUR_STOPS } from '../game/route';
import { makeRng } from '../core/rng';
import { CITIES } from '../game/content';
import { generateEnding } from '../game/endings';
import { State } from '../core/state';

describe('the band on stage', () => {
  it('four lanes, four different friends', () => {
    expect(new Set([0, 1, 2, 3].map(laneMate)).size).toBe(4);
    expect(LANE_MATES).toEqual(['mira', 'theo', 'jun', 'rowan']);
    expect(laneMate(4)).toBe('mira');
  });
  it('every face the stage asks for is a painted one', () => {
    for (const j of ['perfect', 'good', 'ok', 'miss'] as const) expect(PAINTED_MOODS).toContain(mateMoodFor(j));
    expect(PAINTED_MOODS).toContain(MATE_REST_MOOD);
    expect(mateMoodFor('miss')).not.toBe(mateMoodFor('perfect'));
  });
  it('a note tint is its player colour, kept bright enough to read on a dark stage', () => {
    const lum = (c: number) => 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255);
    const bases = [0xc4704f, 0x3e7c7b, 0xd9a441, 0x8fb7c9];
    const tints = bases.map(noteTint);
    expect(new Set(tints).size).toBe(4);
    for (const t of tints) expect(lum(t)).toBeGreaterThan(150);
    expect(noteTint(0x000000)).toBe(0x808080);
    expect(noteTint(0xffffff)).toBe(0xffffff);
  });
  it('one key letter per lane', () => {
    expect(LANE_KEYS).toEqual(['D', 'F', 'J', 'K']);
  });
});

describe('the room responds', () => {
  it('the hit line is dark under a combo of 5, grows with it, and tops out', () => {
    expect(glowAlpha(0)).toBe(0);
    expect(glowAlpha(4)).toBe(0);
    expect(glowAlpha(5)).toBeGreaterThan(0);
    expect(glowAlpha(25)).toBeGreaterThan(glowAlpha(10));
    expect(glowAlpha(50)).toBeCloseTo(0.5);
    expect(glowAlpha(500)).toBe(0.5);
  });
  it('the back row is empty in a cold room and full in a hot one', () => {
    expect(backRowFilled(0, 8)).toBe(0);
    expect(backRowFilled(33, 8)).toBe(0);
    expect(backRowFilled(100, 8)).toBe(8);
    const fills = [0, 20, 40, 60, 80, 100].map((c) => backRowFilled(c, 8));
    expect([...fills].sort((a, b) => a - b)).toEqual(fills);
    expect(new Set(fills).size).toBeGreaterThan(3);
  });
  it('every city in the game has its own light rig', () => {
    const rigs = CITIES.map((c) => lightRigFor(c.id));
    expect(new Set(rigs.map((r) => r.name)).size).toBe(CITIES.length);
    expect(new Set(rigs.map((r) => r.colors.join())).size).toBe(CITIES.length);
    for (const c of CITIES) expect(CITY_LIGHTS[c.id], c.id).toBeTruthy();
    expect(lightRigFor('nowhere').name).toBe('House');
  });
  it('moving lights drop on a slow device, but only after the song is under way', () => {
    expect(stageLite(20, 1)).toBe(false);
    expect(stageLite(20, 4)).toBe(true);
    expect(stageLite(58, 30)).toBe(false);
    expect(stageLite(0, 30)).toBe(false);   // no reading yet is not a slow device
  });
});

describe('the timing check', () => {
  const steady = (ms: number, n = 20) => Array.from({ length: n }, (_, i) => ms + ((i % 5) - 2) * 4);
  it('says nothing for a player who is on time, or for too few notes', () => {
    expect(timingHint(steady(10))).toBe(0);
    expect(timingHint(steady(60, 8))).toBe(0);
    expect(timingHint([])).toBe(0);
  });
  it('reads a steady drift, in 5 ms steps, with its direction', () => {
    expect(timingHint(steady(52))).toBe(50);
    expect(timingHint(steady(-48))).toBe(-50);
    expect(timingHint(steady(400))).toBe(100);
  });
  it('a few fumbled taps do not trigger it', () => {
    expect(timingHint([...steady(5, 16), 300, 280])).toBe(0);
  });
  it('accepting it moves the saved offset the right way and stays in range', () => {
    expect(offsetAfterHint(0, 50)).toBe(-50);     // taps late: draw and judge notes later
    expect(offsetAfterHint(0, -50)).toBe(50);
    expect(offsetAfterHint(-140, 50)).toBe(-150);
  });
});

describe('the short tour', () => {
  const route = (seed: string) => generateRoute(makeRng(`${seed}:route`), CITIES).stops;
  it('is the first two stops of the same route, never the return leg, as fresh copies', () => {
    for (const seed of ['golden-van-2026', 'quiet-harbor', 'neon-rain', 'a', 'b', 'c']) {
      const full = route(seed), short = shortTour(full);
      expect(short.length).toBe(SHORT_TOUR_STOPS);
      expect(short.map((s) => s.cityId)).toEqual(full.filter((s) => !s.revisit).slice(0, 2).map((s) => s.cityId));
      expect(short.some((s) => s.revisit)).toBe(false);
      expect(short[0]).not.toBe(full[0]);
      expect(new Set(short.map((s) => s.cityId)).size).toBe(2);
    }
  });
  it('a two-stop tour still ends in a real ending', () => {

    const data = JSON.parse(JSON.stringify(State.data));
    data.route = shortTour(route('golden-van-2026')).map((s: { cityId: string }) => ({ ...s, visited: true }));
    for (const s of data.route) data.localLove[s.cityId] = 30;
    const ending = generateEnding(data);
    expect(ending.label.length).toBeGreaterThan(3);
    expect(ending.tags.length).toBeGreaterThan(0);
  });
});
