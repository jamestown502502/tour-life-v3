// Pure minigame logic — kept apart from MiniGameScene.ts (which imports Phaser) so this stays
// importable from a plain Vitest test, same split as game/rhythm.ts vs ui/RhythmScene.ts.
import type { MiniGameDef } from '../../content/schema';

export function minigamePlayedFlag(id: string): string {
  return `minigame_${id}_played`;
}

/** The first minigame in a city's list not yet played this run, or undefined if there is none
 *  (either the city has no minigames, or all of them are already flagged played). */
export function nextUnplayedMinigame(minigames: MiniGameDef[] | undefined, hasFlag: (flag: string) => boolean): MiniGameDef | undefined {
  return (minigames ?? []).find((mg) => !hasFlag(minigamePlayedFlag(mg.id)));
}
