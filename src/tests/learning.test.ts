// Publisher polish (2026-10-12): every minigame meets the same three-part learning rubric.
//  1. a named real-world skill (MINIGAME_SKILL), shown before it starts;
//  2. a takeaway that is a usable rule, not praise (takeawayFor), shown on the result card;
//  3. a transfer line: where that rule works off the tour (MINIGAME_TRANSFER), shown under it.
import { describe, it, expect } from 'vitest';
import { MINIGAME_SKILL, MINIGAME_TRANSFER, takeawayFor } from '../game/craft';

const PRAISE_ONLY = /^(great|nice|well done|good job|awesome|perfect|you did it)\b/i;
const words = (s: string): number => s.trim().split(/\s+/).length;

describe('learning rubric', () => {
  const types = Object.keys(MINIGAME_SKILL) as (keyof typeof MINIGAME_SKILL)[];

  it('covers every minigame kind', () => {
    expect(types.length).toBeGreaterThanOrEqual(19);
    expect(Object.keys(MINIGAME_TRANSFER).sort()).toEqual([...types].sort());
  });

  for (const t of types) {
    it(`${t}: skill, rule and transfer`, () => {
      expect(MINIGAME_SKILL[t].length).toBeGreaterThan(5);
      const rule = takeawayFor(t);
      expect(rule, `${t} has no takeaway`).toBeTruthy();
      expect(words(rule!)).toBeGreaterThanOrEqual(8);
      expect(rule).not.toMatch(PRAISE_ONLY);
      const transfer = MINIGAME_TRANSFER[t];
      expect(words(transfer)).toBeGreaterThanOrEqual(10);
      expect(transfer).toMatch(/:/);   // "<where>: <how the rule applies there>"
      expect(transfer.length).toBeLessThanOrEqual(130);   // two lines at most on the result card
    });
  }
});
