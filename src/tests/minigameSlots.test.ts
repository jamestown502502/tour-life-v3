// Which minigames a run actually plays.
//
// Written after a 500-seed simulation found that selection by AUTHORED ORDER made the financial
// and music minigames close to invisible: six of nine were reached in 0% of runs, the rest ~25%,
// and every run played the same two minigames in every city. These tests assert the properties
// the fix promises, over many seeds, rather than checking a single example.
import { describe, expect, it } from 'vitest';
import { makeRng } from '../core/rng';
import { generateRoute } from '../game/route';
import { bandTally, minigameForSlot, minigamePlayedFlag, MONEY_TYPES, MUSIC_TYPES, type MinigameSlot } from '../game/minigame';
import { COPY_TOKENS } from '../game/ledger';
import lisbon from '../../content/cities/lisbon.json';
import tokyo from '../../content/cities/tokyo.json';
import mexico from '../../content/cities/mexico_city.json';
import berlin from '../../content/cities/berlin.json';
import type { CityDef, MiniGameDef } from '../../content/schema';

const POOL = [lisbon, tokyo, mexico, berlin] as unknown as CityDef[];
const BY_ID = Object.fromEntries(POOL.map((c) => [c.id, c]));
const ALL = POOL.flatMap((c) => c.minigames ?? []);

/** Play a whole run's minigame slots exactly the way CityScene does: per stop, the band slot at
 *  arrival and the craft slot before the show, with the visit index and the running tally. */
function simulateRun(seed: string): MiniGameDef[] {
  const route = generateRoute(makeRng(seed), POOL);
  const flags = new Set<string>();
  const has = (f: string): boolean => flags.has(f);
  const seenCities: string[] = [];
  const played: MiniGameDef[] = [];
  for (const stop of route.stops) {
    const visit = seenCities.filter((c) => c === stop.cityId).length;
    for (const slot of ['band', 'craft'] as MinigameSlot[]) {
      const mg = minigameForSlot(BY_ID[stop.cityId].minigames, has, seed, stop.cityId, visit, slot, bandTally(ALL, has));
      if (!mg) continue;
      flags.add(minigamePlayedFlag(mg.id));
      played.push(mg);
    }
    seenCities.push(stop.cityId);
  }
  return played;
}

const SEEDS = Array.from({ length: 500 }, (_, i) => `slot-seed-${i}`);
const RUNS = SEEDS.map(simulateRun);

describe('minigame slot selection', () => {
  it('every authored minigame is reachable in normal play', () => {
    const reached = new Set(RUNS.flat().map((m) => m.id));
    const missing = ALL.map((m) => m.id).filter((id) => !reached.has(id));
    expect(missing, `never reached across ${SEEDS.length} seeds: ${missing.join(', ')}`).toEqual([]);
  });

  it('every run plays at least four bandmate games, and at least one money and one music game', () => {
    for (const [i, run] of RUNS.entries()) {
      const band = run.filter((m) => m.hostBandmate);
      expect(band.length, SEEDS[i]).toBeGreaterThanOrEqual(4);
      expect(band.some((m) => MONEY_TYPES.includes(m.type)), `${SEEDS[i]} had no money game`).toBe(true);
      expect(band.some((m) => MUSIC_TYPES.includes(m.type)), `${SEEDS[i]} had no music game`).toBe(true);
    }
  });

  it('no minigame repeats within a run', () => {
    for (const run of RUNS) expect(new Set(run.map((m) => m.id)).size).toBe(run.length);
  });

  it('the same seed plays the same tour', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      expect(simulateRun(seed).map((m) => m.id)).toEqual(simulateRun(seed).map((m) => m.id));
    }
  });

  it('different seeds play genuinely different tours', () => {
    const distinctBandSets = new Set(RUNS.map((run) => run.filter((m) => m.hostBandmate).map((m) => m.id).sort().join('|')));
    // 16 hosted games, ~5 slots a run: a selector that ignored the seed would produce one set.
    expect(distinctBandSets.size).toBeGreaterThan(100);
  });

  it('selection never locks onto one minigame the way authored order did', () => {
    // Authored order played the same minigame in 100% of runs. The floor here is set by pool size,
    // not by the selector: every run visits every city, so a city with only two craft games (Berlin)
    // plays each about half the time, plus the other one whenever Berlin is the return leg — about
    // 62%. 75% catches a selector that stops varying without failing on a small, honest pool.
    const counts: Record<string, number> = {};
    for (const run of RUNS) for (const m of run) counts[m.id] = (counts[m.id] ?? 0) + 1;
    const over = Object.entries(counts).filter(([, n]) => n / RUNS.length > 0.75).map(([id, n]) => `${id} ${Math.round((n / RUNS.length) * 100)}%`);
    expect(over, over.join(', ')).toEqual([]);
  });
});

describe('bandmate-hosted content', () => {
  const hosted = ALL.filter((m) => m.hostBandmate);

  it('every city hosts one game per bandmate', () => {
    for (const c of POOL) {
      const hosts = (c.minigames ?? []).filter((m) => m.hostBandmate).map((m) => m.hostBandmate).sort();
      expect(hosts, c.id).toEqual(['jun', 'mira', 'rowan', 'theo']);
    }
  });

  it('every hosted game moves its host’s relationship, more for a better outcome', () => {
    for (const m of hosted) {
      const h = m.hostBandmate!;
      const rough = m.roughReward?.relationshipEffects?.[h] ?? 0;
      const good = m.reward?.relationshipEffects?.[h] ?? 0;
      const perfect = m.perfectReward?.relationshipEffects?.[h] ?? 0;
      expect(rough, `${m.id} rough`).toBeGreaterThan(0);
      expect(good, `${m.id} good`).toBeGreaterThan(rough);
      expect(perfect, `${m.id} perfect`).toBeGreaterThan(good);
    }
  });

  it('copy strings only use tokens their type can fill', () => {
    const bad: string[] = [];
    for (const m of ALL) {
      if (!m.copy) continue;
      const allowed = COPY_TOKENS[m.type] ?? [];
      for (const [field, value] of Object.entries(m.copy)) {
        const strings = Array.isArray(value) ? value : [value];
        for (const str of strings) {
          for (const [, tok] of String(str).matchAll(/\{(\w+)\}/g)) {
            if (!allowed.includes(tok)) bad.push(`${m.id}.copy.${field}: {${tok}}`);
          }
        }
      }
    }
    expect(bad, bad.join(', ')).toEqual([]);
  });

  it('perdiem labels, when authored, name exactly three categories', () => {
    for (const m of ALL) if (m.copy?.labels) expect(m.copy.labels.length, m.id).toBe(3);
  });
});
