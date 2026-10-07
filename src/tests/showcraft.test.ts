// Depth pass (2026-10-07): the show as the climax, Fix the Mix, and endings you can trace.
import { describe, it, expect } from 'vitest';
import { bandPerks, showGoalFor, goalMet, chartPatternFor, remapLane, wildcardNight, goalReward, SHOW_GOALS } from '../game/showcraft';
import { problemSequence, channelLevel, inPocket, mixOutcome, DRIVE, POCKET, FADER_MAX, MIX_CHANNELS } from '../game/mixdesk';
import { explainEnding, generateEnding, endingCandidates } from '../game/endings';
import { freshRun, freshMeta, freshAccessibility } from '../core/state';

describe('band perks: closeness changes how the show plays', () => {
  it('nobody close: no perks', () => {
    const p = bandPerks({ mira: 20, theo: 20, jun: 20, rowan: 20 });
    expect(p.lines).toEqual([]);
    expect(p.windowScale).toBe(1);
  });
  it('each close bandmate brings one rule', () => {
    const p = bandPerks({ mira: 40, theo: 40, jun: 40, rowan: 40 });
    expect(p.windowScale).toBeGreaterThan(1);
    expect(p.comboShield).toBe(3);
    expect(p.holdKeep).toBeLessThan(0.85);
    expect(p.crowdStart).toBeGreaterThan(0);
    expect(p.lines.length).toBe(4);
  });
});

describe('show goals', () => {
  it('seeded per city and visit, and varied across a tour', () => {
    expect(showGoalFor('s1', 'tokyo', 0)).toEqual(showGoalFor('s1', 'tokyo', 0));
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(showGoalFor(`seed${i}`, 'lisbon', 0).id);
    expect(seen.size).toBe(SHOW_GOALS.length);
  });
  it('judged on the right evidence', () => {
    const base = { bestStreak: 0, holdsDropped: 0, cuesTaken: 0, cuesTotal: 2, misses: 0, crowdPeak: 0, holdsTotal: 4 };
    expect(goalMet({ id: 'streak', text: '' }, { ...base, bestStreak: 25 }, false)).toBe(true);
    expect(goalMet({ id: 'clean', text: '' }, { ...base, misses: 3 }, false)).toBe(false);   // only at the end
    expect(goalMet({ id: 'clean', text: '' }, { ...base, misses: 3 }, true)).toBe(true);
    expect(goalMet({ id: 'cues', text: '' }, { ...base, cuesTaken: 2 }, false)).toBe(true);
    expect(goalMet({ id: 'holds', text: '' }, { ...base, holdsDropped: 1 }, true)).toBe(false);
  });
});

describe('chart patterns', () => {
  it('re-finger the lanes without changing rhythm or chords', () => {
    for (const p of ['original', 'mirror', 'shift', 'shiftBack'] as const) {
      const lanes = [0, 1, 2, 3].map((l) => remapLane(l, 4, p));
      expect(new Set(lanes).size).toBe(4);   // a chord stays a chord
    }
    expect(remapLane(0, 4, 'mirror')).toBe(3);
  });
  it('a new-setlist tour never plays the original', () => {
    for (let i = 0; i < 30; i++) expect(chartPatternFor(`s${i}`, 'tokyo', 0, true)).not.toBe('original');
  });
});

describe('wildcard nights', () => {
  it('the scout comes to the midpoint, and the goal counts double there', () => {
    expect(wildcardNight('scout', 'opener').scouted).toBe(false);
    const n = wildcardNight('scout', 'midpoint');
    expect(n.scouted).toBe(true);
    expect(goalReward(n).localLove).toBe(10);
    expect(goalReward(wildcardNight(undefined, null)).localLove).toBe(5);
  });
  it('fan club and festival warm the crowd; festival and shoestring pay the goal', () => {
    expect(wildcardNight('fanClub', null).crowdStart).toBe(20);
    expect(goalReward(wildcardNight('festival', null)).deltas.funds).toBe(20);
    expect(goalReward(wildcardNight('shoestring', null)).deltas.funds).toBe(15);
  });
});

describe('Fix the Mix', () => {
  it('six problems, every kind, never the same channel twice running', () => {
    const seq = problemSequence('abc');
    expect(seq.length).toBe(6);
    expect(new Set(seq.map((p) => p.kind)).size).toBe(2);
    for (let i = 1; i < seq.length; i++) expect(seq[i].ch).not.toBe(seq[i - 1].ch);
    for (const p of seq) expect(p.ch).toBeLessThan(MIX_CHANNELS.length);
  });
  it('every problem is fixable with its own fader', () => {
    for (const kind of ['hot', 'gone'] as const) {
      const target = ((POCKET.lo + POCKET.hi) / 2) / DRIVE[kind];
      expect(target).toBeLessThanOrEqual(FADER_MAX);
      expect(inPocket(channelLevel(target, DRIVE[kind]))).toBe(true);
      expect(inPocket(channelLevel(0.7, DRIVE[kind]))).toBe(false);   // the problem really moves it out
    }
  });
  it('outcome tiers', () => {
    expect(mixOutcome([1, 2, 2.5, 1, 3, 2])).toEqual({ good: true, perfect: true, fixed: 6 });
    expect(mixOutcome([1, null, 4, 5, null, 2]).good).toBe(true);
    expect(mixOutcome([null, null, null, 4, null, 2]).good).toBe(false);
  });
});

describe('endings you can trace', () => {
  it('names the numbers behind the ending and the one that came closest', () => {
    const s = freshRun('why-seed', freshMeta(), freshAccessibility());
    s.stats = { energy: 60, harmony: 85, inspiration: 50, funds: 300 };
    s.relationships = { mira: 70, theo: 65, jun: 60, rowan: 60 };
    s.localLove = { lisbon: 30, tokyo: 20 };
    const e = explainEnding(s);
    expect(e.label).toBe(generateEnding(s).label);
    expect(e.reasons[0]).toMatch(/\d/);
    expect(e.nearly).toMatch(/^Almost /);
    expect(e.runnerUp).toBe(endingCandidates(s)[1].label);
  });
});
