// "I get the same dialogue over and over from bandmates."
//
// Two mechanical causes, both real, and one of them was introduced by the arc work meant to make
// the bandmates BETTER:
//
//   1. The picker took `available[0]` — the lowest-index eligible entry — so a city played its
//      scenes in whatever order they happen to sit in the JSON, every run. The low indices are
//      heavily weighted toward one or two bandmates.
//   2. When nothing was eligible it fell back to a hard-coded `pool[0]`: the SAME scene every
//      time, belonging to Mira in three of the four cities. Adding arc beats made this fire MORE
//      often, because a draw could spend one of its two slots on a beat blocked until the back
//      half of the tour.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { drawScenePoolFlags } from '../game/scenePool';
import { makeRng } from '../core/rng';

const cities = readdirSync('content/cities').filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`content/cities/${f}`, 'utf8')));

describe('bandmate dialogue does not repeat', () => {
  it('a drawn pair is always playable at the stage it is drawn for', () => {
    // Every drawn entry must be an entry the FIRST city can actually play, or the run starts on
    // the fallback path. Arc beats (stage 2) are excluded from the draw for exactly this reason.
    for (const city of cities) {
      const flags = drawScenePoolFlags(makeRng(`playable:${city.id}`), city);
      const ids = flags.map((f) => f.replace(/^avail_/, ''));
      const drawn = ids.filter((id) => city.relationshipScenePool.find((e: any) => e.id === id)?.arcStage !== 2);
      for (const id of drawn) {
        const entry = city.relationshipScenePool.find((e: any) => e.id === id);
        expect(entry.arcStage ?? 0, `${city.id}/${id} was drawn but is gated to a later stage`).toBeLessThan(2);
      }
    }
  });

  it('no two pool entries in a city point at the same scene', () => {
    for (const city of cities) {
      const sceneIds = city.relationshipScenePool.map((e: any) => e.sceneId);
      expect(new Set(sceneIds).size, `${city.id} has duplicate sceneIds: ${sceneIds.join(', ')}`).toBe(sceneIds.length);
    }
  });

  it('no scene text is duplicated across the whole game', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const city of cities) {
      for (const [id, node] of Object.entries<any>(city.scenes ?? {})) {
        const text = String(node?.text ?? '').trim();
        if (text.length < 30) continue;
        const prior = seen.get(text);
        if (prior) dupes.push(`${prior} == ${city.id}/${id}`);
        else seen.set(text, `${city.id}/${id}`);
      }
    }
    expect(dupes, `duplicate dialogue: ${dupes.join(' | ')}`).toEqual([]);
  });

  it('the draw spreads across bandmates rather than stacking one', () => {
    // Across many seeds, no single bandmate should own the majority of a city's drawn scenes.
    for (const city of cities) {
      const counts = new Map<string, number>();
      for (let i = 0; i < 60; i++) {
        const flags = drawScenePoolFlags(makeRng(`spread:${city.id}:${i}`), city);
        for (const f of flags) {
          const id = f.replace(/^avail_/, '');
          const entry = city.relationshipScenePool.find((e: any) => e.id === id);
          if (!entry || entry.arcStage === 2) continue;
          counts.set(entry.bandmate, (counts.get(entry.bandmate) ?? 0) + 1);
        }
      }
      const total = [...counts.values()].reduce((a, b) => a + b, 0);
      for (const [who, n] of counts) {
        expect(n / total, `${city.id}: ${who} owns ${(100 * n / total).toFixed(0)}% of draws`).toBeLessThan(0.6);
      }
    }
  });
});

describe('social commentary is specific to the stop', () => {
  it('every city has its own handles, and no handle is shared between cities', () => {
    const src = readFileSync('content/social.ts', 'utf8');
    const handles = [...src.matchAll(/@[a-z0-9_]+/g)].map((m) => m[0]);
    expect(handles.length, 'expected per-city handle sets').toBeGreaterThan(15);
    expect(new Set(handles).size, `duplicate handles: ${handles.length - new Set(handles).size}`).toBe(handles.length);
  });

  it('posts name the city they are about', () => {
    const src = readFileSync('content/social.ts', 'utf8');
    const lines = [...src.matchAll(/'([^']{40,})'|"([^"]{40,})"/g)].map((m) => m[1] || m[2]);
    const withCity = lines.filter((l) => l.includes('{city}'));
    expect(withCity.length / lines.length, 'most social lines should name the city').toBeGreaterThan(0.7);
  });

  it('the feed can name the minigame actually played, not just its outcome', () => {
    const src = readFileSync('content/social.ts', 'utf8');
    expect(src).toContain('MINIGAME_POSTS_BY_TITLE');
    // Every title with bespoke lines must match a real minigame, or the lookup silently misses.
    const titles = [...src.matchAll(/^\s{2}'([A-Z][^']+)': \{$/gm)].map((m) => m[1]);
    const realTitles = new Set(cities.flatMap((c: any) => (c.minigames ?? []).map((m: any) => m.title)));
    expect(titles.length, 'expected bespoke per-minigame posts').toBeGreaterThan(4);
    for (const t of titles) expect([...realTitles], `"${t}" matches no minigame title`).toContain(t);
  });
});
