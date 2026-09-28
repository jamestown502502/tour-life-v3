// Pure minigame logic — kept apart from MiniGameScene.ts (which imports Phaser) so this stays
// importable from a plain Vitest test, same split as game/rhythm.ts vs ui/RhythmScene.ts.
import type { MiniGameDef } from '../../content/schema';
import { makeRng } from '../core/rng';

export function minigamePlayedFlag(id: string): string {
  return `minigame_${id}_played`;
}

/** The first minigame in a city's list not yet played this run, or undefined if there is none
 *  (either the city has no minigames, or all of them are already flagged played). */
export function nextUnplayedMinigame(minigames: MiniGameDef[] | undefined, hasFlag: (flag: string) => boolean): MiniGameDef | undefined {
  return (minigames ?? []).find((mg) => !hasFlag(minigamePlayedFlag(mg.id)));
}

/** A city visit has two minigame slots. 'band' is a bandmate-hosted money or music game; 'craft'
 *  is a city-authored one (a soundcheck, a load-in, a radio interview, a currency window).
 *
 *  Why this exists: minigames used to be taken in AUTHORED ORDER, first unplayed wins. The money
 *  and theory games were appended to the end of each city's list, and a city only has two slots
 *  per visit, so a 500-seed simulation found six of the nine never played at all (0%) and the
 *  rest only on a return leg (~25%). Every run played the same two minigames in every city. */
export type MinigameSlot = 'band' | 'craft';

export const MONEY_TYPES: readonly string[] = ['split', 'pricing', 'perdiem', 'gearcall', 'exchange'];
export const MUSIC_TYPES: readonly string[] = ['chordquality', 'transpose', 'meter', 'tempo', 'interval', 'clave'];

export interface BandTally { money: number; music: number }

/** How many bandmate-hosted money and music games this run has already played, across every city. */
export function bandTally(allMinigames: readonly MiniGameDef[], hasFlag: (flag: string) => boolean): BandTally {
  const t: BandTally = { money: 0, music: 0 };
  for (const m of allMinigames) {
    if (!m.hostBandmate || !hasFlag(minigamePlayedFlag(m.id))) continue;
    if (MONEY_TYPES.includes(m.type)) t.money++;
    else if (MUSIC_TYPES.includes(m.type)) t.music++;
  }
  return t;
}

/** The minigame for one slot of one city visit. Seeded by run, city, visit and slot, so a replayed
 *  seed replays the same tour and a different seed plays a different one. The band slot leans
 *  toward whichever of money or music this run has had less of, so every run gets both. A slot
 *  falls back to the other pool when its own is exhausted, so it is never wasted while anything in
 *  the city is unplayed. Never repeats a minigame within a run. */
export function minigameForSlot(
  minigames: MiniGameDef[] | undefined,
  hasFlag: (flag: string) => boolean,
  seed: string,
  cityId: string,
  visit: number,
  slot: MinigameSlot,
  tally: BandTally = { money: 0, music: 0 },
): MiniGameDef | undefined {
  const unplayed = (minigames ?? []).filter((m) => !hasFlag(minigamePlayedFlag(m.id)));
  const band = unplayed.filter((m) => m.hostBandmate);
  const craft = unplayed.filter((m) => !m.hostBandmate);
  let pool = slot === 'band' ? band : craft;
  if (pool.length === 0) pool = slot === 'band' ? craft : band;
  if (pool.length === 0) return undefined;
  if (slot === 'band' && tally.money !== tally.music) {
    const want = tally.money < tally.music ? MONEY_TYPES : MUSIC_TYPES;
    const leaning = pool.filter((m) => want.includes(m.type));
    if (leaning.length > 0) pool = leaning;
  }
  const rng = makeRng(`${seed}:mg:${cityId}:${visit}:${slot}`);
  return pool[rng.int(0, pool.length)];
}

/** Close-out item 5c: a band already playing well gets one extra, faster timing round rather
 *  than a flat difficulty for everyone — reads as the game noticing the run is going well, not
 *  as an arbitrary extra step. `ui/MiniGameScene.ts` calls this with the content-authored rounds
 *  and the run's current harmony stat. */
export function timingRoundsForHarmony(baseRounds: number[], harmony: number): number[] {
  return harmony >= 50 ? [...baseRounds, 1.0] : baseRounds;
}
