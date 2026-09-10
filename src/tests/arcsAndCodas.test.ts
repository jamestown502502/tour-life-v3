// Bandmate arcs and the personal codas — the two halves of "the bandmates feel dry".
//
// Dry had a mechanical cause. Each of the four is introduced with a stated want, the run tracks a
// standing, scenes were gated only on that standing, and the ending resolved none of it. So the
// material was vignettes with no escalation and no payoff, however good each individual scene was.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { arcStageFor, stageAllows, arcOutcomeFor, ARC_SETUP, ARC_STRAIN, ARC_RESOLUTION } from '../game/arc';
import { BANDMATE_CODAS, codaVariantFor, codasFor } from '../../content/codas';
import { PAINTED_MOODS, moodForNode, inferMood } from '../game/mood';

const cities = readdirSync('content/cities').filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`content/cities/${f}`, 'utf8')));
const BANDMATES = ['mira', 'theo', 'jun', 'rowan'] as const;

describe('arc stages give the bandmates somewhere to go', () => {
  it('starts everyone at setup', () => {
    expect(arcStageFor({ scenesPlayed: 0, currentCityIndex: 0, routeLength: 4 })).toBe(ARC_SETUP);
  });

  it('one scene moves them to strain', () => {
    expect(arcStageFor({ scenesPlayed: 1, currentCityIndex: 0, routeLength: 4 })).toBe(ARC_STRAIN);
  });

  it('a resolution needs BOTH investment and lateness, never one alone', () => {
    // Attentive but early: no payoff in the first city.
    expect(arcStageFor({ scenesPlayed: 4, currentCityIndex: 0, routeLength: 4 })).toBe(ARC_STRAIN);
    // Late but ignored: no payoff handed over for free.
    expect(arcStageFor({ scenesPlayed: 0, currentCityIndex: 3, routeLength: 4 })).toBe(ARC_SETUP);
    // Both.
    expect(arcStageFor({ scenesPlayed: 2, currentCityIndex: 2, routeLength: 4 })).toBe(ARC_RESOLUTION);
  });

  it('a later beat never arrives before its setup, but a missed one can still land later', () => {
    expect(stageAllows(ARC_RESOLUTION, ARC_STRAIN)).toBe(false);
    expect(stageAllows(ARC_STRAIN, ARC_RESOLUTION)).toBe(true);
    // Unstaged content written before arcs existed is always eligible.
    expect(stageAllows(undefined, ARC_SETUP)).toBe(true);
  });

  it('every bandmate has a resolution beat somewhere on the route', () => {
    const staged = cities.flatMap((c) => (c.relationshipScenePool ?? [])
      .filter((e: any) => e.arcStage === 2).map((e: any) => e.bandmate));
    for (const b of BANDMATES) {
      expect(staged, `${b} has no resolution beat — their want is never answered in-run`).toContain(b);
    }
  });

  it('every resolution beat branches on standing rather than reading the same either way', () => {
    for (const city of cities) {
      for (const entry of (city.relationshipScenePool ?? []).filter((e: any) => e.arcStage === 2)) {
        const head = city.scenes[entry.sceneId];
        expect(head, `${entry.sceneId} missing`).toBeDefined();
        const second = city.scenes[head.next];
        expect(second, `${entry.sceneId} should chain to a second beat`).toBeDefined();
        expect(second.condition, `${head.next} must branch on standing`).toBeTruthy();
        expect(city.scenes[second.fallback], `${head.next} needs a cool-standing fallback`).toBeDefined();
      }
    }
  });
});

describe('the ending says what happened to each of them', () => {
  it('every bandmate has all three outcomes written', () => {
    for (const b of BANDMATES) {
      for (const variant of ['fulfilled', 'unresolved', 'denied'] as const) {
        expect(BANDMATE_CODAS[b][variant]?.length, `${b}.${variant}`).toBeGreaterThan(40);
      }
    }
  });

  it('standing picks the variant, at both extremes and in between', () => {
    expect(codaVariantFor(90)).toBe('fulfilled');
    expect(codaVariantFor(40)).toBe('unresolved');
    expect(codaVariantFor(5)).toBe('denied');
  });

  it('two different runs produce two different closing paragraphs', () => {
    const generous = codasFor({ mira: 80, theo: 80, jun: 80, rowan: 80 }).join(' ');
    const neglectful = codasFor({ mira: 5, theo: 5, jun: 5, rowan: 5 }).join(' ');
    const mixed = codasFor({ mira: 80, theo: 5, jun: 40, rowan: 80 }).join(' ');
    expect(generous).not.toEqual(neglectful);
    expect(mixed).not.toEqual(generous);
    expect(mixed).not.toEqual(neglectful);
  });

  it('a denied coda is disappointment, never a scolding — this game has no fail states', () => {
    const denied = BANDMATES.map((b) => BANDMATE_CODAS[b].denied).join(' ').toLowerCase();
    for (const scold of ['you failed', 'your fault', 'you should have', 'you never bothered', 'because of you']) {
      expect(denied, `a coda scolds the player: "${scold}"`).not.toContain(scold);
    }
  });

  it('four bandmates times three outcomes is 81 distinct closing paragraphs per ending', () => {
    expect(3 ** 4).toBe(81);
    const seen = new Set<string>();
    for (const a of [80, 40, 5]) for (const b of [80, 40, 5]) for (const c of [80, 40, 5]) for (const d of [80, 40, 5]) {
      seen.add(codasFor({ mira: a, theo: b, jun: c, rowan: d }).join('|'));
    }
    expect(seen.size).toBe(81);
  });

  it('arc outcome distinguishes neglected from merely unfinished', () => {
    expect(arcOutcomeFor(0, 90)).toBe('neglected');
    expect(arcOutcomeFor(1, 90)).toBe('ongoing');
    expect(arcOutcomeFor(2, 60)).toBe('resolved');
  });
});

describe('the expression palette can carry the writing', () => {
  it('every painted mood has art for all four bandmates', () => {
    for (const mood of PAINTED_MOODS) {
      for (const b of BANDMATES) {
        expect(existsSync(`public/assets/img/portrait_${b}_${mood}.png`), `portrait_${b}_${mood}`).toBe(true);
      }
    }
  });

  it('every authored portrait mood is one the game can actually paint', () => {
    const bad: string[] = [];
    for (const city of cities) {
      for (const [id, node] of Object.entries<any>(city.scenes ?? {})) {
        if (node?.portrait && !(PAINTED_MOODS as string[]).includes(node.portrait)) bad.push(`${id}: ${node.portrait}`);
      }
    }
    expect(bad, bad.join(' | ')).toEqual([]);
  });

  it('refuses to guess a mood from a single weak cue', () => {
    // The exact line that shipped the wrong face: "smile" matched the happy cue set while the
    // sentence describes suppressing one. One cue is not evidence.
    expect(inferMood('Her smile flickers, just slightly, before she catches it and buries it back out of long habit.')).toBe('happy');
    expect(moodForNode('wistful', 'Her smile flickers, before she buries it back.')).toBe('wistful');
  });
});
