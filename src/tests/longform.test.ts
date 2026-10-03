// Long-form minigames (2026-10-03): The Setlist and The Long Haul. Pure rules, plus the content.
import { describe, expect, it } from 'vitest';
import { keyOfChord, energyFor, circlePos, circleSteps, setCards, segue, arc, scoreSet, bestSet, drawHand, setTier, TEMPO_LURCH, type SetCard } from '../game/setbuilder';
import { haulOffers, playDay, bestHaul, breakEven, doorPay, turnoutFor, haulTier, HAUL_FLOAT, MOTEL, TIRED_MAX, type Stop } from '../game/longhaul';
import { makeRng } from '../core/rng';
import { CITIES } from '../game/content';

const card = (key: string, bpm: number, energy = energyFor(bpm)): SetCard => ({ id: key + bpm, name: key, key, bpm, energy });

describe('The Setlist: the circle of fifths', () => {
  it('reads keys from first chords and places them on the circle', () => {
    expect(keyOfChord('Am7')).toBe('Am');
    expect(keyOfChord('Fmaj7')).toBe('F');
    expect(keyOfChord('Cm')).toBe('Cm');
    expect(circlePos('C')).toBe(0);
    expect(circlePos('G')).toBe(1);
    expect(circlePos('F')).toBe(11);
    expect(circlePos('Am')).toBe(circlePos('C'));   // relative minor sits with its major
    expect(circleSteps('C', 'F#')).toBe(6);         // directly across
  });
  it('neighbors flow, far keys clash, and a tempo lurch knocks a change down', () => {
    expect(segue(card('C', 100), card('G', 104)).verdict).toBe('smooth');
    expect(segue(card('Am', 100), card('C', 104)).verdict).toBe('smooth');
    expect(segue(card('C', 100), card('D', 104)).verdict).toBe('okay');
    expect(segue(card('C', 100), card('E', 104)).verdict).toBe('clash');
    const lurch = segue(card('C', 80), card('G', 80 + TEMPO_LURCH + 10));
    expect(lurch.verdict).not.toBe('smooth');
    expect(lurch.why).toMatch(/lurch/);
  });
  it('the energy arc: open strong, breather, build, close biggest', () => {
    expect(arc([card('C', 110), card('G', 90), card('D', 112), card('A', 126)]).every((c) => c.ok)).toBe(true);
    expect(arc([card('C', 80), card('G', 90), card('D', 85), card('A', 84)]).filter((c) => c.ok).length).toBeLessThan(2);
  });
  it('fourteen cards, spanning the circle; every hand has a strong best order that a careless order misses', () => {
    const all = setCards();
    expect(all.length).toBe(14);
    expect(new Set(all.map((c) => circlePos(c.key))).size).toBeGreaterThanOrEqual(6);
    let careless = 0;
    for (let i = 0; i < 60; i++) {
      const hand = drawHand(makeRng(`hand${i}`));
      const best = bestSet(hand);
      expect(best.score, `hand ${i}`).toBeGreaterThanOrEqual(85);
      careless += scoreSet(hand.slice(0, 4));
    }
    expect(careless / 60).toBeLessThan(70);   // just playing what you drew rarely works
  });
  it('tiers are against what the hand allows', () => {
    expect(setTier(100, 100)).toBe(3);
    expect(setTier(75, 100)).toBe(2);
    expect(setTier(60, 100)).toBe(1);
  });
});

describe('The Long Haul: cash flow is not profit', () => {
  const near: Stop = { venue: 'A', miles: 100, fuel: 30, guarantee: 70, doorPct: 70, capacity: 50, ticket: 5, turnout: 0.8, hintLo: 70, hintHi: 90 };
  const far: Stop = { venue: 'B', miles: 250, fuel: 75, guarantee: 150, doorPct: 70, capacity: 90, ticket: 6, turnout: 0.6, hintLo: 50, hintHi: 70 };
  it('fuel and the bed come out before the show pays: a far stop plus a motel can be unaffordable', () => {
    expect(playDay(far, { stop: 1, deal: 'flat', bed: 'motel' }, 100, 0)).toBeNull();
    const van = playDay(far, { stop: 1, deal: 'flat', bed: 'van' }, 100, 0)!;
    expect(van.floatAfter).toBe(100 - 75 + 150);
  });
  it('a tired band draws a smaller crowd; the van tires, a motel rests', () => {
    expect(turnoutFor(near, 2)).toBeLessThan(turnoutFor(near, 0));
    expect(playDay(near, { stop: 0, deal: 'door', bed: 'van' }, 100, 0)!.tiredAfter).toBe(1);
    expect(playDay(near, { stop: 0, deal: 'door', bed: 'motel' }, 100, 2)!.tiredAfter).toBe(1);
    expect(playDay(near, { stop: 0, deal: 'door', bed: 'van' }, 100, TIRED_MAX)!.tiredAfter).toBe(TIRED_MAX);
    const fresh = playDay(near, { stop: 0, deal: 'door', bed: 'van' }, 100, 0)!.pay;
    const tired = playDay(near, { stop: 0, deal: 'door', bed: 'van' }, 100, 3)!.pay;
    expect(tired).toBeLessThan(fresh);
  });
  it('break-even is where the door pays exactly the guarantee', () => {
    expect(doorPay(near, breakEven(near))).toBe(near.guarantee);
  });
  it('every leg is a real decision: the door is not always right, and cash runs tight on day one', () => {
    let doorAlwaysBetter = 0, dayOneSqueeze = 0;
    for (let i = 0; i < 200; i++) {
      const o = haulOffers(`leg${i}`);
      if (o.flat().every((s) => doorPay(s, s.turnout) > s.guarantee)) doorAlwaysBetter++;
      if (!playDay(o[0][1], { stop: 1, deal: 'flat', bed: 'motel' }, HAUL_FLOAT, 0)) dayOneSqueeze++;
      const best = bestHaul(o);
      expect(best, `leg ${i}`).toBeGreaterThan(HAUL_FLOAT);
    }
    expect(doorAlwaysBetter).toBeLessThan(40);
    expect(dayOneSqueeze).toBeGreaterThan(100);
  });
  it('a naive leg (always the near stop, always flat, always a motel) is rarely perfect; the best is', () => {
    let naivePerfect = 0;
    for (let i = 0; i < 100; i++) {
      const o = haulOffers(`naive${i}`);
      let f = HAUL_FLOAT, t = 0;
      for (const day of o) { const r = playDay(day[0], { stop: 0, deal: 'flat', bed: f - day[0].fuel >= MOTEL ? 'motel' : 'van' }, f, t)!; f = r.floatAfter; t = r.tiredAfter; }
      if (haulTier(f, bestHaul(o)) === 'perfect') naivePerfect++;
      expect(haulTier(bestHaul(o), bestHaul(o))).toBe('perfect');
    }
    expect(naivePerfect).toBeLessThan(30);
  });
  it('offers are seeded: the same run sees the same leg', () => {
    expect(haulOffers('x')).toEqual(haulOffers('x'));
    expect(haulOffers('x')).not.toEqual(haulOffers('y'));
  });
});

describe('content', () => {
  it('each long-form game appears in two cities, with all three outcomes and a story flag', () => {
    const all = CITIES.flatMap((c) => (c.minigames ?? []).map((m) => ({ city: c.id, m })));
    for (const type of ['setlist', 'longhaul']) {
      const found = all.filter((x) => x.m.type === type);
      expect(found.length, type).toBe(2);
      for (const { m } of found) {
        expect(m.outroTextPerfect, m.id).toBeTruthy();
        expect(m.reward.flags?.length, m.id).toBeGreaterThan(0);
      }
    }
  });
});
