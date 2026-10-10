// QA round 4 (2026-10-10): the rules behind the Tonight card, the story spines, and the skill and
// takeaway every minigame now names. The scene side is covered by e2e/qa-round4.spec.ts.
import { describe, it, expect } from 'vitest';
import { bandmateHelpRows, goalProgressText, goalLost, goalRewardLine, SHOW_GOALS, wildcardNight, PERK_LINES, type GoalProgress } from '../game/showcraft';
import { SPINES, spineFor, spineBeatIndex, spineFlag } from '../../content/spines';
import { WHY_TOUR_BEATS } from '../../content/bands';
import { MINIGAME_SKILL, takeawayFor, CRAFT_LESSON } from '../game/craft';
import { freshRun, freshMeta, freshAccessibility } from '../core/state';
import { CITIES } from '../game/content';

const P = (o: Partial<GoalProgress> = {}): GoalProgress => ({ bestStreak: 0, holdsDropped: 0, cuesTaken: 0, cuesTotal: 4, misses: 0, crowdPeak: 0, holdsTotal: 6, ...o });

describe('Tonight card: every bandmate, helping or not (missing feature #2)', () => {
  it('lists all four, in band order, even when nobody is close', () => {
    const rows = bandmateHelpRows({});
    expect(rows.map((r) => r.id)).toEqual(['mira', 'theo', 'jun', 'rowan']);
    expect(rows.every((r) => !r.active)).toBe(true);
    expect(rows.every((r) => r.line.startsWith('Grow close to'))).toBe(true);
  });
  it('a close bandmate shows the help they give, in the same words as the perk', () => {
    const rows = bandmateHelpRows({ theo: 95, jun: 10 });
    const theo = rows.find((r) => r.id === 'theo')!, jun = rows.find((r) => r.id === 'jun')!;
    expect(theo.active).toBe(true);
    expect(theo.line).toBe(PERK_LINES.theo);
    expect(jun.active).toBe(false);
  });
});

describe("Tonight's goal: the live chip (missing feature #1)", () => {
  it('has progress text for every goal', () => {
    for (const g of SHOW_GOALS) expect(goalProgressText(g, P(), 0).length, g.id).toBeGreaterThan(5);
  });
  it('counts toward the goal as the song plays', () => {
    const streak = SHOW_GOALS.find((g) => g.id === 'streak')!;
    expect(goalProgressText(streak, P({ bestStreak: 12 }), 0)).toBe('Best streak 12/25');
    expect(goalProgressText(streak, P({ bestStreak: 40 }), 0)).toBe('Best streak 25/25');
    const crowd = SHOW_GOALS.find((g) => g.id === 'crowd')!;
    expect(goalProgressText(crowd, P({ crowdPeak: 60 }), 40)).toBe('Fans won 3/5');
    const cues = SHOW_GOALS.find((g) => g.id === 'cues')!;
    expect(goalProgressText(cues, P({ cuesTaken: 2 }), 0)).toBe('Choice cues 2/4');
  });
  it('says when a goal can no longer be met', () => {
    const holds = SHOW_GOALS.find((g) => g.id === 'holds')!, clean = SHOW_GOALS.find((g) => g.id === 'clean')!;
    expect(goalLost(holds, P({ holdsDropped: 1 }))).toBe(true);
    expect(goalLost(clean, P({ misses: 3 }))).toBe(false);
    expect(goalLost(clean, P({ misses: 4 }))).toBe(true);
  });
  it('names the reward, doubled for the scouted show', () => {
    expect(goalRewardLine(wildcardNight(undefined, null))).toBe('Meet it: +5 local love, +2 inspiration');
    expect(goalRewardLine(wildcardNight('scout', 'midpoint'))).toBe('Meet it: +10 local love, +4 inspiration');
    expect(goalRewardLine(wildcardNight('festival', null))).toContain('+$20');
  });
});

describe('story spines: "Why this tour?" carries the whole tour', () => {
  it('every reason the player can pick has its own spine', () => {
    expect(WHY_TOUR_BEATS.map((w) => spineFor(w).why)).toEqual(WHY_TOUR_BEATS);
    expect(new Set(SPINES.map((s) => s.id)).size).toBe(SPINES.length);
  });
  it('each spine has a stake, three two-way choices with a lesson each, and two endings', () => {
    for (const s of SPINES) {
      expect(s.stake.length).toBeGreaterThan(40);
      expect(s.beats.length).toBe(3);
      for (const b of s.beats) {
        expect(b.choices.length).toBe(2);
        for (const c of b.choices) expect(c.after.length, `${s.id}: ${c.label}`).toBeGreaterThan(30);
      }
      expect(s.kept).not.toBe(s.broken);
    }
  });
  it('choices stay small: a spine colours a tour, it never decides one', () => {
    for (const s of SPINES) for (const b of s.beats) for (const c of b.choices) {
      for (const v of Object.values(c.effects)) expect(Math.abs(v as number)).toBeLessThanOrEqual(30);
      for (const v of Object.values(c.relationships ?? {})) expect(Math.abs(v as number)).toBeLessThanOrEqual(5);
    }
  });
  it('the drives to stops 2, 3 and 4 carry the three beats; the first drive names the stake', () => {
    expect([0, 1, 2, 3, 4].map(spineBeatIndex)).toEqual([-1, 0, 1, 2, -1]);
    expect(spineFlag('label', 1, 0)).toBe('spine_label_1_0');
  });
  it('each stake is judged by the run itself', () => {
    const run = freshRun('spine-seed', freshMeta(), freshAccessibility());
    const last = spineFor('One last try before day jobs win.');
    run.stats.funds = 399; expect(last.check(run)).toBe(false);
    run.stats.funds = 400; expect(last.check(run)).toBe(true);
    const home = spineFor('Nothing left to lose at home.');
    run.relationships = { mira: 60, theo: 45, jun: 40, rowan: 39 };
    expect(home.check(run)).toBe(false);
    run.relationships.rowan = 40;
    expect(home.check(run)).toBe(true);
  });
  it('content stays alcohol-free (Play content policy)', () => {
    const all = JSON.stringify(SPINES).toLowerCase();
    for (const w of ['beer', 'wine', 'whisky', 'whiskey', 'vodka', 'drunk', 'bar tab', 'cocktail', 'pint']) expect(all).not.toContain(w);
  });
});

describe('every minigame names its skill and ends on a takeaway', () => {
  const types = [...new Set(CITIES.flatMap((c) => (c.minigames ?? []).map((m) => m.type)))];
  it('every minigame type in the content has a skill name and a takeaway', () => {
    expect(types.length).toBeGreaterThan(10);
    for (const t of types) {
      expect(MINIGAME_SKILL[t], t).toBeTruthy();
      expect(takeawayFor(t), t).toBeTruthy();
    }
  });
  it('a craft game keeps its own lesson; the others use their recall reason', () => {
    expect(takeawayFor('timing')).toBe(CRAFT_LESSON.timing);
    expect(takeawayFor('pricing')).not.toBe(undefined);
  });
});
