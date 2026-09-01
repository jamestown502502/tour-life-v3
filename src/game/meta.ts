import type { MetaProgress, RunHistoryEntry } from '../core/state';

// Padded out past 2/4 entries: a pool that small exhausted after the 2nd-3rd completed run,
// silently stopping the replay reward exactly when a player would notice most.
export const UNLOCKABLE_GENRES = [
  'punk', 'jazz_pop', 'synthwave', 'shoegaze', 'bossa_nova', 'post_rock',
] as const;
export const UNLOCKABLE_DECOR = [
  'vintage_poster', 'string_lights', 'polaroid_wall', 'shared_playlist',
  'pressed_flowers', 'city_postcards', 'hand-me-down_rug', 'tour_patches', 'mismatched_mugs', 'window_charms',
] as const;

/** Pure function: completing a run never weakens a fresh run, only ever adds. */
export function completeRun(meta: MetaProgress, entry: RunHistoryEntry): MetaProgress {
  const next: MetaProgress = {
    completedRuns: meta.completedRuns + 1,
    unlockedGenres: [...meta.unlockedGenres],
    unlockedDecor: [...meta.unlockedDecor],
    runHistory: [...meta.runHistory, entry],
  };
  const nextGenre = UNLOCKABLE_GENRES.find((g) => !next.unlockedGenres.includes(g));
  if (nextGenre) next.unlockedGenres.push(nextGenre);
  const nextDecor = UNLOCKABLE_DECOR.find((d) => !next.unlockedDecor.includes(d));
  if (nextDecor) next.unlockedDecor.push(nextDecor);
  return next;
}
