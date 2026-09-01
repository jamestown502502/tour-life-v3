import type { MetaProgress, RunHistoryEntry } from '../core/state';

export const UNLOCKABLE_GENRES = ['punk', 'jazz_pop'] as const;
export const UNLOCKABLE_DECOR = ['vintage_poster', 'string_lights', 'polaroid_wall', 'shared_playlist'] as const;

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
