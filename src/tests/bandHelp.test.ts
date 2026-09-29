// Bandmates change the game (bandHelp.ts) and money decisions echo later (ledger.ts).
import { describe, expect, it } from 'vitest';
import { CLOSE_AT, STEADY_AT, rapportFor, wrongToRemove, splitHint, pricingHint, suggestPerDiem, perDiemHint, gearHint, transposeHint, quietLine } from '../game/bandHelp';
import { ledgerEcho, LEDGER_LESSONS, LEDGER_TYPES, resolvePerDiem, bestPrice, DEFAULT_LEDGER } from '../game/ledger';
import lisbon from '../../content/cities/lisbon.json';
import tokyo from '../../content/cities/tokyo.json';
import mexico from '../../content/cities/mexico_city.json';
import berlin from '../../content/cities/berlin.json';
import type { CityDef } from '../../content/schema';

const ALL = ([lisbon, tokyo, mexico, berlin] as unknown as CityDef[]).flatMap((c) => c.minigames ?? []);

describe('rapport', () => {
  it('everyone starts steady (20); close is the story\'s own bar; distant needs real friction', () => {
    expect(rapportFor(20)).toBe('steady');
    expect(rapportFor(undefined)).toBe('steady');
    expect(rapportFor(CLOSE_AT)).toBe('close');
    expect(rapportFor(CLOSE_AT - 1)).toBe('steady');
    expect(rapportFor(STEADY_AT - 1)).toBe('distant');
    expect(CLOSE_AT).toBe(32); // matches minRelationship on the gated journal/dialogue nodes
  });

  it('a hint greys out wrong answers but always leaves the answer and at least one wrong one', () => {
    for (const n of [2, 3, 4, 5]) expect(n - 1 - wrongToRemove(n), `${n} options`).toBeGreaterThanOrEqual(1);
    expect(wrongToRemove(3)).toBe(1);
    expect(wrongToRemove(2)).toBe(0);
  });

  it('every theory and ledger game that has help is hosted, so the help can actually appear', () => {
    const helped = ['chordquality', 'transpose', 'meter', 'tempo', 'split', 'pricing', 'perdiem', 'gearcall'];
    for (const m of ALL.filter((x) => helped.includes(x.type))) expect(m.hostBandmate, m.id).toBeTruthy();
  });
});

describe('hints tell the truth', () => {
  it('Rowan\'s read of the room always contains the real turnout', () => {
    for (let t = 0.25; t <= 0.96; t += 0.01) {
      const [lo, hi] = splitHint('rowan', t).match(/(\d+) to (\d+)%/)!.slice(1).map(Number);
      expect(lo).toBeLessThanOrEqual(Math.round(t * 100));
      expect(hi).toBeGreaterThanOrEqual(Math.round(t * 100));
    }
  });

  it('Mira\'s price range contains the best price', () => {
    const d = { ...DEFAULT_LEDGER.pricing };
    const [lo, hi] = pricingHint('mira', d).match(/\$(\d+) to \$(\d+)/)!.slice(1).map(Number);
    const best = bestPrice(d).price;
    expect(lo).toBeLessThanOrEqual(best);
    expect(hi).toBeGreaterThanOrEqual(best);
  });

  it('Theo\'s per diem suggestion really rates perfect, and fits the budget', () => {
    for (const budget of [60, 80]) {
      const s = suggestPerDiem(budget)!;
      expect(resolvePerDiem({ budget }, s).tier).toBe('perfect');
      expect(s.food + s.lodging + s.rest).toBeLessThanOrEqual(budget);
      expect(perDiemHint('theo', budget, ['Food', 'A bed', 'Rest stop'])).toContain(`$${s.food} food`);
    }
  });

  it('the gear break-even is the real one', () => {
    expect(gearHint('theo', 180, 55, 3)).toContain('after 4 shows');
    expect(gearHint('jun', 240, 45, 1)).toContain('There is 1 left');
  });

  it('transpose hint names the direction and distance', () => {
    expect(transposeHint('mira', -2)).toContain('2 frets down');
    expect(transposeHint('mira', 7)).toContain('7 frets up');
  });

  it('a distant host says so, without a placeholder', () => {
    expect(quietLine('jun')).toMatch(/^Jun /);
  });
});

describe('ledger echoes and lessons', () => {
  it('every type echoes with the city named, helps on a good call and costs a little on a rough one', () => {
    for (const t of LEDGER_TYPES) {
      const good = ledgerEcho(t, 'good', 'Lisbon');
      const perfect = ledgerEcho(t, 'perfect', 'Lisbon');
      const rough = ledgerEcho(t, 'rough', 'Lisbon');
      for (const e of [good, perfect, rough]) {
        expect(e.text, t).toContain('Lisbon');
        expect(e.text, t).not.toMatch(/\{\w+\}/);
      }
      const sum = (fx: Record<string, number | undefined>) => Object.values(fx).reduce((a: number, v) => a + (v ?? 0), 0);
      expect(sum(good.effects), t).toBeGreaterThan(0);
      expect(sum(perfect.effects), t).toBeGreaterThan(sum(good.effects));
      expect(sum(rough.effects), t).toBeLessThan(0);
      expect(sum(rough.effects), t).toBeGreaterThanOrEqual(-3); // cozy: a nudge, never a punishment
    }
  });

  it('every kind of money decision has a lesson', () => {
    for (const t of LEDGER_TYPES) expect(LEDGER_LESSONS[t].length, t).toBeGreaterThan(40);
  });
});
