// The craft minigames teach the craft, and hosts react and remember (2026-10-02). Pure rules from
// src/game/craft.ts, plus the content that feeds them.
import { describe, expect, it } from 'vitest';
import { gainVerdict, GAIN_FEEDBACK, GAIN_CHANNELS, isHeavy, packIssue, SIGNAL_CHAIN, CRAFT_LESSON, hostReaction, priorHosted, RECALL, recallCandidates, recallFlag, type HostedGame } from '../game/craft';
import { exchangeWorking, exchangeCalcQuestion, resolveExchange, DEFAULT_LEDGER } from '../game/ledger';
import { CITIES } from '../game/content';
import type { BandmateId, MiniGameDef } from '../../content/schema';

const ALL: MiniGameDef[] = CITIES.flatMap((c) => c.minigames ?? []);
const HOSTS: BandmateId[] = ['mira', 'theo', 'jun', 'rowan'];

describe('soundcheck is gain staging', () => {
  it('left of the window is too quiet, inside is the sweet spot, past it clips', () => {
    expect(gainVerdict(100, 290, 140)).toBe('quiet');
    expect(gainVerdict(290, 290, 140)).toBe('sweet');
    expect(gainVerdict(430, 290, 140)).toBe('sweet');
    expect(gainVerdict(431, 290, 140)).toBe('clip');
    for (const v of ['quiet', 'sweet', 'clip'] as const) expect(GAIN_FEEDBACK[v].length).toBeLessThanOrEqual(80);
    expect(GAIN_CHANNELS.length).toBeGreaterThanOrEqual(4);
  });
});

describe('load-in puts heavy on the floor', () => {
  it('a heavy item up top is an issue; on the floor, or a light item anywhere, is fine', () => {
    expect(isHeavy('Amps', ['Amps'])).toBe(true);
    expect(packIssue('Amps', ['Amps'], false)).toMatch(/crush/);
    expect(packIssue('Amps', ['Amps'], true)).toBeNull();
    expect(packIssue('Snacks', ['Amps'], false)).toBeNull();
  });
  it('every load-in names its heavy items, and the floor row fits on screen', () => {
    const drags = ALL.filter((m) => m.type === 'drag');
    expect(drags.length).toBeGreaterThanOrEqual(2);
    for (const m of drags) {
      expect(m.heavyItems?.length, m.id).toBeGreaterThan(0);
      for (const h of m.heavyItems!) expect(m.dragItems, `${m.id}: ${h}`).toContain(h);
      // slots are 190 wide with 14 between them, on a 720 canvas
      const widest = Math.max(m.heavyItems!.length, m.dragItems!.length - m.heavyItems!.length);
      expect(widest * 204 - 14, m.id).toBeLessThanOrEqual(680);
    }
  });
});

describe('interviews coach after every answer', () => {
  it('every interview question carries a short coaching note', () => {
    const qs = ALL.filter((m) => m.type === 'choice' || m.type === 'pressure').flatMap((m) => (m.questions ?? []).map((q) => ({ m: m.id, q })));
    expect(qs.length).toBe(9);
    for (const { m, q } of qs) {
      expect(q.coach, `${m}.${q.id}`).toBeTruthy();
      expect(q.coach!.length, `${m}.${q.id}`).toBeLessThanOrEqual(120);
    }
  });
});

describe('every craft type ends on a lesson', () => {
  it('timing, drag, choice, pressure, sequence and sustain each have one', () => {
    for (const t of ['timing', 'drag', 'choice', 'pressure', 'sequence', 'sustain'] as const) {
      expect(CRAFT_LESSON[t], t).toBeTruthy();
      expect(CRAFT_LESSON[t]!.length, t).toBeLessThanOrEqual(120);
    }
    // hosted money and theory games teach through their own rounds; they get no extra caption
    expect(CRAFT_LESSON.split).toBeUndefined();
    expect(SIGNAL_CHAIN).toEqual(['OSC', 'FILTER', 'ENV', 'AMP']);
  });
});

describe('hosts react in their own voice and remember', () => {
  it('every host has a line for every tier, warmer when close', () => {
    for (const h of HOSTS) for (const tier of [1, 2, 3] as const) {
      const close = hostReaction(h, tier, true), other = hostReaction(h, tier, false);
      expect(close.reaction).toBeTruthy();
      expect(other.reaction).toBeTruthy();
      expect(close.reaction).not.toBe(other.reaction);
      expect(close.callback).toBeNull();
      expect(close.reaction.length).toBeLessThanOrEqual(110);
    }
  });
  it('a second game with the same host remembers the first, by name and by how it went', () => {
    const prior: HostedGame = { host: 'rowan', title: 'The Door Deal', tier: 1 };
    const better = hostReaction('rowan', 3, true, prior);
    expect(better.callback).toContain('The Door Deal');
    expect(better.callback).toMatch(/fixed what went wrong/);
    const worse = hostReaction('rowan', 1, true, { ...prior, tier: 3 });
    expect(worse.callback).toMatch(/Not like The Door Deal/);
    for (const h of HOSTS) for (const pt of [1, 3] as const) for (const t of [1, 3] as const) {
      const r = hostReaction(h, t, false, { host: h, title: 'X', tier: pt });
      expect(r.callback, `${h} ${pt}->${t}`).toBeTruthy();
      expect(r.callback).not.toMatch(/\{\w+\}/);
    }
  });
  it('priorHosted finds the latest game that host ran, and only theirs', () => {
    const list: HostedGame[] = [
      { host: 'mira', title: 'A', tier: 2 }, { host: 'rowan', title: 'B', tier: 1 }, { host: 'mira', title: 'C', tier: 3 },
    ];
    expect(priorHosted(list, 'mira')?.title).toBe('C');
    expect(priorHosted(list, 'theo')).toBeUndefined();
    expect(priorHosted(undefined, 'jun')).toBeUndefined();
  });
});


describe('exchange: a fee calculator step before the choice', () => {
  it('the working agrees with what the exchange actually pays', () => {
    const rates = [...DEFAULT_LEDGER.exchange.rates];
    rates.forEach((r, i) => {
      const w = exchangeWorking(r);
      expect(w.gross - w.fee).toBe(w.net);
      expect(resolveExchange(rates, i).label).toContain(`${w.net} local`);
    });
  });
  it('the calculator asks about the best HEADLINE rate, with the two classic mistakes as wrong answers', () => {
    for (const c of CITIES) for (const m of (c.minigames ?? []).filter((x) => x.type === 'exchange')) {
      const rates = [...(m.ledger?.rates ?? DEFAULT_LEDGER.exchange.rates)];
      const q = exchangeCalcQuestion(rates);
      expect(q.window.rate, m.id).toBe(Math.max(...rates.map((r) => r.rate)));
      expect(q.options, m.id).toContain(q.answer);
      expect(q.options, m.id).toContain(exchangeWorking(q.window).gross); // rate alone, fee forgotten
      expect(new Set(q.options).size, m.id).toBe(q.options.length);
    }
  });
});

describe('spaced recall on the drive', () => {
  it('every minigame type has a quiz, with three distinct options and a reason', () => {
    const types = new Set(ALL.map((m) => m.type));
    for (const t of types) expect(RECALL.some((r) => r.type === t), t).toBe(true);
    for (const r of RECALL) {
      expect(new Set(r.options).size, r.type).toBe(3);
      expect(r.q.length, r.type).toBeLessThanOrEqual(100);
      expect(r.why.length, r.type).toBeLessThanOrEqual(120);
    }
  });
  it('only skills from another city, and each only once', () => {
    const played = [{ type: 'timing' as const, cityId: 'lisbon' }, { type: 'drag' as const, cityId: 'tokyo' }];
    expect(recallCandidates(played, 'tokyo', () => false).map((r) => r.type)).toEqual(['timing']);
    expect(recallCandidates(played, 'berlin', (f) => f === recallFlag('timing')).map((r) => r.type)).toEqual(['drag']);
    expect(recallCandidates([], 'berlin', () => false)).toEqual([]);
  });
});
