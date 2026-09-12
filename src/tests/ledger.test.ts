// The Van Ledger (src/game/ledger.ts): every rule is a pure function, and every exercise has to
// be no-fail — the worst tier is 'rough', never a loss of the game — while still grading the
// reasoning. Plus the seeded host selection that decides which two bandmate beats a run offers.
import { describe, expect, it } from 'vitest';
import {
  breakEvenTurnout, doorTake, resolveSplit, demandAt, profitAt, bestPrice, resolvePricing,
  perDiemForecast, resolvePerDiem, resolveGearCall, effectiveRate, resolveExchange, hostedSelection, DEFAULT_LEDGER,
} from '../game/ledger';
import { offeredMinigames, nextUnplayedMinigame } from '../game/minigame';
import { transposeChord, splitChord } from '../core/musicTheory';
import { validateCity } from '../../content/schema';
import lisbonRaw from '../../content/cities/lisbon.json';
import tokyoRaw from '../../content/cities/tokyo.json';
import mexicoRaw from '../../content/cities/mexico_city.json';
import berlinRaw from '../../content/cities/berlin.json';
import type { MiniGameDef } from '../../content/schema';

const SPLIT = DEFAULT_LEDGER.split;

describe('split: guarantee vs door', () => {
  it('break-even is where the door equals the guarantee', () => {
    const t = breakEvenTurnout(SPLIT);
    expect(Math.abs(doorTake(SPLIT, t) - SPLIT.guarantee)).toBeLessThanOrEqual(6);
  });
  it('perfect = the right deal for the estimate AND a close estimate; rough = wrong deal and worse money', () => {
    const t = breakEvenTurnout(SPLIT);
    expect(resolveSplit(SPLIT, 'door', t + 0.2, t + 0.25).tier).toBe('perfect');
    expect(resolveSplit(SPLIT, 'guarantee', t - 0.2, t - 0.25).tier).toBe('perfect');
    expect(resolveSplit(SPLIT, 'door', t - 0.3, t - 0.3).tier).toBe('rough');
    expect(resolveSplit(SPLIT, 'guarantee', t + 0.3, t + 0.3).tier).toBe('rough');
  });
  it('funds delta is a tenth of the dollars relative to the guarantee', () => {
    const r = resolveSplit(SPLIT, 'door', 0.9, 0.9);
    expect(r.funds).toBe(Math.round((doorTake(SPLIT, 0.9) - SPLIT.guarantee) / 10));
    expect(resolveSplit(SPLIT, 'guarantee', 0.5, 0.5).funds).toBe(0);
  });
});

describe('pricing: the merch table', () => {
  const P = DEFAULT_LEDGER.pricing;
  it('demand falls with price and the best price sits inside the range', () => {
    expect(demandAt(P, P.minPrice)).toBe(P.stock);
    expect(demandAt(P, P.maxPrice)).toBe(0);
    const best = bestPrice(P);
    expect(best.price).toBeGreaterThan(P.minPrice);
    expect(best.price).toBeLessThan(P.maxPrice);
    expect(best.profit).toBeGreaterThan(0);
  });
  it('tiers by share of the best possible profit; a giveaway price is rough', () => {
    const best = bestPrice(P);
    expect(resolvePricing(P, best.price).tier).toBe('perfect');
    expect(resolvePricing(P, P.minPrice).tier).toBe('rough');
    expect(profitAt(P, P.minPrice)).toBe(P.stock * P.minPrice - P.stock * P.unitCost);
  });
});

describe("perdiem: tomorrow's budget", () => {
  it('over budget is rough, starving a category is rough, a balanced spend is perfect', () => {
    expect(resolvePerDiem({ budget: 60 }, { food: 40, lodging: 30, rest: 10 }).tier).toBe('rough');
    expect(resolvePerDiem({ budget: 60 }, { food: 0, lodging: 30, rest: 0 }).tier).toBe('rough');
    const balanced = resolvePerDiem({ budget: 60 }, { food: 30, lodging: 20, rest: 10 });
    expect(balanced.tier).toBe('perfect');
    expect(balanced.funds).toBe(0);
    expect(perDiemForecast({ food: 0, lodging: 0, rest: 0 }).energy).toBeLessThan(0);
  });
});

describe('gearcall: buy vs rent vs pass', () => {
  it('the cheaper paid option is perfect, the other paid option good, passing rough', () => {
    const d = DEFAULT_LEDGER.gearcall; // 240 to buy, 45 a show
    expect(resolveGearCall(d, 8, 'buy').tier).toBe('perfect');   // 8 shows: renting is 360
    expect(resolveGearCall(d, 8, 'rent').tier).toBe('good');
    expect(resolveGearCall(d, 3, 'rent').tier).toBe('perfect');  // 3 shows: renting is 135
    expect(resolveGearCall(d, 3, 'buy').tier).toBe('good');
    expect(resolveGearCall(d, 3, 'pass').tier).toBe('rough');
    expect(resolveGearCall(d, 3, 'pass').funds).toBe(0);
    expect(resolveGearCall(d, 8, 'buy').funds).toBe(-24);
  });
});

describe('exchange: the fee is part of the rate', () => {
  it('the best-looking rate is not the best window once the fee is applied', () => {
    const rates = DEFAULT_LEDGER.exchange.rates;
    const eff = rates.map(effectiveRate);
    const bestIdx = eff.indexOf(Math.max(...eff));
    const rawRates: number[] = rates.map((r) => r.rate);
    const prettiest = rawRates.indexOf(Math.max(...rawRates));
    expect(bestIdx).not.toBe(prettiest);
    expect(resolveExchange(rates, bestIdx).tier).toBe('perfect');
    expect(resolveExchange(rates, prettiest).tier).not.toBe('perfect');
  });
});

describe('theory helpers', () => {
  it('transposes roots and keeps qualities', () => {
    expect(transposeChord('Am7', -2)).toBe('Gm7');
    expect(transposeChord('C', 2)).toBe('D');
    expect(transposeChord('B', 1)).toBe('C');
    expect(transposeChord('Fmaj7', 7)).toBe('Cmaj7');
    expect(splitChord('G6')).toEqual({ root: 'G', quality: '6' });
  });
});

describe('hosted selection', () => {
  const cities = [lisbonRaw, tokyoRaw, mexicoRaw, berlinRaw] as unknown as { id: string; minigames: MiniGameDef[] }[];
  it('every shipped city validates with the new types and every new type ships somewhere', () => {
    for (const c of cities) expect(validateCity(c).errors, c.id).toEqual([]);
    const types = cities.flatMap((c) => c.minigames.map((m) => m.type));
    for (const t of ['split', 'pricing', 'perdiem', 'gearcall', 'exchange', 'chordquality', 'transpose', 'meter', 'tempo']) {
      expect(types, t).toContain(t);
    }
  });
  it('offers every non-hosted minigame plus exactly two hosted ones, deterministically per seed', () => {
    for (const c of cities) {
      const hosted = c.minigames.filter((m) => m.hostBandmate);
      const plain = c.minigames.filter((m) => !m.hostBandmate);
      const a = offeredMinigames(c.minigames, 'seed-one', c.id);
      const b = offeredMinigames(c.minigames, 'seed-one', c.id);
      expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
      expect(a.filter((m) => !m.hostBandmate).length).toBe(plain.length);
      expect(a.filter((m) => m.hostBandmate).length).toBe(Math.min(2, hosted.length));
      const ids = c.minigames.map((m) => m.id);
      const order = a.map((m) => ids.indexOf(m.id));
      expect(order).toEqual([...order].sort((x, y) => x - y));
    }
  });
  it('across many seeds every host gets offered', () => {
    for (const c of cities) {
      const hosts = new Set<string>();
      for (let i = 0; i < 60; i++) for (const m of offeredMinigames(c.minigames, `seed-${i}`, c.id)) if (m.hostBandmate) hosts.add(m.hostBandmate);
      const authored = new Set(c.minigames.filter((m) => m.hostBandmate).map((m) => m.hostBandmate as string));
      expect(hosts).toEqual(authored);
    }
  });
  it('legacy callers without a seed still see everything, and a played flag is skipped', () => {
    const list = lisbonRaw.minigames as unknown as MiniGameDef[];
    expect(offeredMinigames(list).length).toBe(list.length);
    const first = nextUnplayedMinigame(list, () => false, 'seed-x', 'lisbon')!;
    const second = nextUnplayedMinigame(list, (f) => f === `minigame_${first.id}_played`, 'seed-x', 'lisbon')!;
    expect(second.id).not.toBe(first.id);
  });
  it('hostedSelection picks by the supplied index function', () => {
    const items = [{ id: 'a', hostBandmate: 'mira' }, { id: 'b' }, { id: 'c', hostBandmate: 'theo' }, { id: 'd', hostBandmate: 'jun' }];
    const out = hostedSelection(items, () => 0, 2);
    expect(out.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});
