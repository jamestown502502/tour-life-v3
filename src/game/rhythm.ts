import type { ChoiceCueType, SongArrangement, SongDef } from '../../content/schema';
import { RHYTHM_DIFFICULTY_SCALE, RHYTHM_WINDOWS } from '../const';
import type { RhythmMode } from '../core/state';

export type HitJudgement = 'perfect' | 'good' | 'ok' | 'miss';

export interface TimingWindows {
  perfect: number;
  good: number;
  ok: number;
}

/** Accessibility composition: mode scales the windows, wiggle room widens them further —
 *  wiggle room never touches scoring, and easy scoring never touches windows (PRD §15.7). */
export function effectiveWindows(mode: RhythmMode, wiggleRoom: boolean): TimingWindows {
  const scale = RHYTHM_DIFFICULTY_SCALE[mode] * (wiggleRoom ? 1.3 : 1);
  return {
    perfect: RHYTHM_WINDOWS.perfect * scale,
    good: RHYTHM_WINDOWS.good * scale,
    ok: RHYTHM_WINDOWS.ok * scale,
  };
}

export function judgeHit(deltaMs: number, windows: TimingWindows): HitJudgement {
  const abs = Math.abs(deltaMs);
  if (abs <= windows.perfect) return 'perfect';
  if (abs <= windows.good) return 'good';
  if (abs <= windows.ok) return 'ok';
  return 'miss';
}

const HOLD_DOWNGRADE: Record<HitJudgement, HitJudgement> = { perfect: 'good', good: 'ok', ok: 'ok', miss: 'miss' };

/** Real hold-note grading (previously cosmetic — any single tap anywhere in the note's window
 *  judged the whole hold, ignoring `dur` entirely). `startJudgement` comes from judging the
 *  initial press against the note's start time exactly like a tap; `completion` is how much of
 *  the note's duration the player actually held for (0..1). Holding through >=85% keeps the
 *  start judgement; letting go early softens it one tier; releasing before halfway is a miss —
 *  they didn't hold the note, no-fail mode just means it doesn't block the story. */
export function combineHoldJudgement(startJudgement: HitJudgement, completion: number): HitJudgement {
  if (completion >= 0.85) return startJudgement;
  if (completion >= 0.5) return HOLD_DOWNGRADE[startJudgement];
  return 'miss';
}

const BASE_POINTS: Record<HitJudgement, number> = { perfect: 100, good: 60, ok: 30, miss: 0 };
const EASY_POINTS: Record<HitJudgement, number> = { perfect: 100, good: 85, ok: 70, miss: 0 };

export function comboMultiplier(combo: number): number {
  return 1 + Math.min(combo, 50) * 0.02;
}

export function scoreForHit(judgement: HitJudgement, combo: number, easyScoring: boolean): number {
  const table = easyScoring ? EASY_POINTS : BASE_POINTS;
  return Math.round(table[judgement] * comboMultiplier(combo));
}

/** Story-flag-driven arrangement selection: a dialogue choice can set `arrangement:<id>` to
 *  unlock a non-default arrangement for the city's song. Falls back to the base arrangement. */
export function arrangementFlag(arrangementId: string): string {
  return `arrangement_${arrangementId}`;
}

export function pickArrangement(song: SongDef, storyFlags: readonly string[]): SongArrangement {
  const unlocked = song.arrangements.find((a) => storyFlags.includes(arrangementFlag(a.id)));
  return unlocked ?? song.arrangements[0];
}

export interface PerformanceContext {
  cityId: string;
  songId: string;
  arrangement: SongArrangement;
  bandHarmony: number;
  energy: number;
  audienceMood: number;
  storyFlags: string[];
}

export interface PerformanceResult {
  timingScore: number;
  grade: HitJudgement;
  expressionChoices: ChoiceCueType[];
  crowdConnection: number;
  unlockedFlags: string[];
}

/** Aggregates a played-through song's hits + chosen cues into the result handed back to the
 *  story. Rhythm score never gates narrative content — this is informational, not a gate. */
export function buildPerformanceResult(
  judgements: HitJudgement[],
  expressionChoices: ChoiceCueType[],
  ctx: PerformanceContext,
): PerformanceResult {
  const timingScore = judgements.reduce((sum, j, i) => sum + scoreForHit(j, i, false), 0);
  // The true achievable max for this many hits (every hit 'perfect', combo never breaks) —
  // not judgements.length * 100 * comboMultiplier(length), which assumes every hit already
  // sits at the final capped multiplier and so is unreachable even by a flawless run.
  const maxPossible = judgements.reduce((sum, _j, i) => sum + scoreForHit('perfect', i, false), 0);
  const ratio = maxPossible > 0 ? timingScore / maxPossible : 0;
  const grade: HitJudgement = ratio >= 0.9 ? 'perfect' : ratio >= 0.6 ? 'good' : ratio >= 0.3 ? 'ok' : 'miss';

  const crowdConnection = Math.round(
    Math.max(0, Math.min(100, ctx.audienceMood * 0.4 + ratio * 60 + expressionChoices.length * 2)),
  );

  const unlockedFlags: string[] = [];
  if (grade === 'perfect') unlockedFlags.push(`show_${ctx.cityId}_triumphant`);
  if (expressionChoices.includes('invite_crowd')) unlockedFlags.push(`show_${ctx.cityId}_crowd_moment`);

  return { timingScore, grade, expressionChoices, crowdConnection, unlockedFlags };
}
