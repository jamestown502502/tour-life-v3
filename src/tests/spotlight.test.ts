// The Spotlight Bridge (publisher polish 2026-10-12): rules, content and the "the chart never
// changes" promise. See src/game/spotlight.ts.
import { describe, it, expect } from 'vitest';
import { SONGS } from '../game/content';
import { SPOTLIGHT, SPOTLIGHT_DECLINED } from '../../content/spotlight';
import { bridgeWindow, echoLine, offerLine, pendingEcho, proposerFor, spotlightAfterLine, spotlightPlan, stageOf } from '../game/spotlight';
import { pickArrangement } from '../game/rhythm';
import { isValidRunState } from '../core/save';
import { State } from '../core/state';
import type { SpotlightRecord } from '../core/state';

const rel = (mira: number, theo: number, jun: number, rowan: number) => ({ mira, theo, jun, rowan });

describe('who offers the bridge', () => {
  it('is the bandmate of the last relationship scene in this city', () => {
    expect(proposerFor({ seed: 's', relationships: rel(90, 0, 0, 0) }, 'tokyo', 'jun')).toBe('jun');
  });
  it('otherwise the closest bandmate, the same on every replay of a seed', () => {
    expect(proposerFor({ seed: 's', relationships: rel(10, 80, 20, 30) }, 'tokyo', undefined)).toBe('theo');
    const tie = { seed: 'tie-seed', relationships: rel(50, 50, 50, 50) };
    const first = proposerFor(tie, 'lisbon', undefined);
    for (let i = 0; i < 5; i++) expect(proposerFor(tie, 'lisbon', undefined)).toBe(first);
  });
  it('says something different at each stage of their arc', () => {
    for (const v of Object.values(SPOTLIGHT)) expect(new Set(v.offer).size).toBe(3);
    const st = { arcScenesPlayed: { mira: 2 }, currentCityIndex: 3, route: new Array(5) } as never;
    expect(offerLine('mira', stageOf(st, 'mira'))).toBe(SPOTLIGHT.mira.offer[2]);
  });
});

describe('the bridge window', () => {
  it('every arrangement of every song has one, inside its notes', () => {
    for (const song of SONGS) for (const arr of song.arrangements) {
      const times = arr.notes.map((n) => n.t);
      const w = bridgeWindow(times);
      expect(w, `${song.id}/${arr.id}`).not.toBeNull();
      expect(w!.start).toBeGreaterThan(Math.min(...times));
      expect(w!.end).toBeLessThan(Math.max(...times));
      expect(w!.end - w!.start).toBeGreaterThanOrEqual(3);
    }
  });
  it('a chart too short for a bridge has none', () => {
    expect(bridgeWindow([0, 1, 2, 3])).toBeNull();
    expect(bridgeWindow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBeNull();
  });
});

describe('tonight\'s plan', () => {
  const times = SONGS[0].arrangements[0].notes.map((n) => n.t);
  const accepted: SpotlightRecord = { cityId: 'tokyo', visit: 0, mate: 'mira', accepted: true };
  it('only when the bridge was given', () => {
    expect(spotlightPlan({ spotlights: [] }, 'tokyo', 0, times)).toBeNull();
    expect(spotlightPlan({ spotlights: [{ ...accepted, accepted: false }] }, 'tokyo', 0, times)).toBeNull();
    expect(spotlightPlan({ spotlights: [accepted] }, 'tokyo', 1, times)).toBeNull();   // the return-leg show is its own night
    const plan = spotlightPlan({ spotlights: [accepted] }, 'tokyo', 0, times)!;
    expect(plan.mate).toBe('mira');
    expect(plan.treatment).toBe('intimate');
  });
  it('same record + same chart = same plan (deterministic)', () => {
    expect(spotlightPlan({ spotlights: [accepted] }, 'tokyo', 0, times)).toEqual(spotlightPlan({ spotlights: [{ ...accepted }] }, 'tokyo', 0, [...times]));
  });
  it('never changes the chart: the arrangement played is the same either way', () => {
    State.newRun('spotlight-invariance');
    for (const song of SONGS) {
      const before = pickArrangement(song, State.data.flags);
      State.data.spotlights = [{ cityId: 'tokyo', visit: 0, mate: 'theo', accepted: true }];
      expect(pickArrangement(song, State.data.flags)).toBe(before);
      State.data.spotlights = [];
    }
  });
  it('the Results line tells the truth either way', () => {
    expect(spotlightAfterLine({ spotlights: [accepted] }, 'tokyo', 0)).toBe(SPOTLIGHT.mira.after);
    expect(spotlightAfterLine({ spotlights: [{ ...accepted, accepted: false }] }, 'tokyo', 0)).toBe(SPOTLIGHT_DECLINED);
    expect(spotlightAfterLine({ spotlights: [] }, 'tokyo', 0)).toBeNull();
  });
});

describe('the next drive brings it back', () => {
  it('the oldest accepted bridge from another city, once', () => {
    const recs: SpotlightRecord[] = [
      { cityId: 'lisbon', visit: 0, mate: 'jun', accepted: false },
      { cityId: 'lisbon', visit: 0, mate: 'jun', accepted: true },
      { cityId: 'tokyo', visit: 0, mate: 'mira', accepted: true },
    ];
    const first = pendingEcho({ spotlights: recs }, 'berlin')!;
    expect(first.mate).toBe('jun');
    first.echoed = true;
    expect(pendingEcho({ spotlights: recs }, 'berlin')!.mate).toBe('mira');
    expect(pendingEcho({ spotlights: recs }, 'tokyo')).toBeUndefined();
    expect(echoLine(first, 'Lisbon')).toContain('Lisbon');
  });
});

describe('content', () => {
  it('Rowan is they/them everywhere', () => {
    const lines = [...SPOTLIGHT.rowan.offer, SPOTLIGHT.rowan.after, SPOTLIGHT.rowan.echo, SPOTLIGHT.rowan.take];
    for (const l of lines) expect(l, l).not.toMatch(/\b(he|she|him|her|his|hers)\b/i);
  });
  it('every echo names the city', () => {
    for (const v of Object.values(SPOTLIGHT)) expect(v.echo).toContain('{city}');
  });
});

describe('saves', () => {
  it('a save from before the bridge existed still loads, and one with bridges round-trips', () => {
    State.newRun('spotlight-save');
    const old = JSON.parse(JSON.stringify(State.data));
    delete old.spotlights;
    expect(isValidRunState(old)).toBe(true);
    State.data.spotlights = [{ cityId: 'tokyo', visit: 0, mate: 'rowan', accepted: true, echoed: true }];
    const back = JSON.parse(JSON.stringify(State.data));
    expect(isValidRunState(back)).toBe(true);
    expect(back.spotlights).toEqual(State.data.spotlights);
  });
});

describe('section lighting', () => {
  it('follows the song: dim intro, clear verse, coloured bridge, warm outro', async () => {
    const { stageSection } = await import('../game/showcraft');
    expect(stageSection(0.05, false).id).toBe('intro');
    expect(stageSection(0.3, false).alpha).toBe(0);
    expect(stageSection(0.6, false)).toMatchObject({ id: 'bridge', color: 0x862f5a });
    expect(stageSection(0.6, true).alpha).toBe(0);   // the Spotlight Bridge lights it instead
    expect(stageSection(0.95, false)).toMatchObject({ id: 'outro', color: 0xf9a421 });
    for (let f = 0; f <= 1; f += 0.01) expect(stageSection(f, false).alpha).toBeLessThanOrEqual(0.22);   // never hides the notes
  });
});
