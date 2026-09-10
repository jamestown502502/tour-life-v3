// A minigame that sets a reward flag nothing reads has no story impact at all.
//
// Reported live: "check all mini games and how they impact story actually dynamically." Three of
// the ten -- the sequence, sustain and pressure types added most recently -- were setting
// `modular_locked_in`, `mix_held_steady` and `radio_quick_witted` on a clean run, and NOTHING
// anywhere consumed them. Acing those minigames moved a stat and then vanished.
//
// This asserts the property rather than the three specific cases: every reward flag any minigame
// can set must be read by something -- a gated dialogue node, an epilogue callback, a story gate.
// Adding a minigame with a dead flag now fails here instead of shipping silently.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const CITY_FILES = readdirSync('content/cities').filter((f) => f.endsWith('.json'));
const cities = CITY_FILES.map((f) => JSON.parse(readFileSync(`content/cities/${f}`, 'utf8')));

/** Everything a minigame can write, from any of its outcome tiers. */
function minigameFlags(): { flag: string; where: string }[] {
  const out: { flag: string; where: string }[] = [];
  for (const city of cities) {
    for (const mg of city.minigames ?? []) {
      for (const tier of ['reward', 'roughReward', 'perfectReward'] as const) {
        for (const flag of mg[tier]?.flags ?? []) out.push({ flag, where: `${city.id}/${mg.id}.${tier}` });
      }
    }
  }
  return out;
}

/** Everywhere a flag could be consumed: conditions in any city's dialogue, plus the TS content. */
const consumers = [
  ...CITY_FILES.map((f) => readFileSync(`content/cities/${f}`, 'utf8')),
  readFileSync('content/epilogues.ts', 'utf8'),
  readFileSync('content/social.ts', 'utf8'),
  readFileSync('content/van.ts', 'utf8'),
  readFileSync('content/promises.ts', 'utf8'),
].join('\n');

describe('minigames actually change the story', () => {
  it('every minigame reward flag is read by something', () => {
    const orphans: string[] = [];
    for (const { flag, where } of minigameFlags()) {
      // A consumer reference is one that is NOT the flag's own declaration inside a rewards block.
      const refs = consumers.split(flag).length - 1;
      const declarations = consumers.split(`"${flag}"`).length - 1;
      if (refs - declarations <= 0) orphans.push(`${flag} (set by ${where})`);
    }
    expect(orphans, `minigame flags nothing reads: ${orphans.join(', ')}`).toEqual([]);
  });

  it('every minigame has all three outcome tiers authored', () => {
    const thin: string[] = [];
    for (const city of cities) {
      for (const mg of city.minigames ?? []) {
        if (!mg.outroText || !mg.outroTextRough) thin.push(`${city.id}/${mg.id}: missing a base outcome`);
        // The flawless tier is what stops a competent player seeing one identical line every city.
        if (!mg.outroTextPerfect) thin.push(`${city.id}/${mg.id}: no flawless-run line`);
      }
    }
    expect(thin, thin.join(' | ')).toEqual([]);
  });

  it('the three soundchecks are structurally different, not one reskinned three times', () => {
    const timing = cities.flatMap((c) => (c.minigames ?? []).filter((m: any) => m.type === 'timing')
      .map((m: any) => ({ id: m.id, rounds: m.timingRoundsSec.length, zone: m.timingZoneW ?? 140 })));
    expect(timing.length).toBeGreaterThan(2);
    // Distinct round counts: a level check that is 2 rounds wide-open reads differently from one
    // that is 5 rounds closing down, even though the mechanic is the same.
    expect(new Set(timing.map((t) => t.rounds)).size, `round counts: ${timing.map((t) => t.id + '=' + t.rounds).join(', ')}`).toBe(timing.length);
    expect(new Set(timing.map((t) => t.zone)).size, `zone widths: ${timing.map((t) => t.id + '=' + t.zone).join(', ')}`).toBe(timing.length);
  });
});
