// The show as the climax of every city (2026-10-07, from an outside design critique). Pure rules,
// read by RhythmScene; every one is unit-tested in src/tests/showcraft.test.ts.
//
//  - Band perks: a bandmate you are close to changes how tonight's show PLAYS, not only what they
//    say. Each perk is one rule the player can feel and the banner names before the song.
//  - Show goals: one optional objective per show, seeded, so a known song still asks something new.
//  - Chart patterns: the same arrangement, re-fingered (mirrored or rotated lanes) per run and
//    visit, so the eighth play of a song is not muscle memory.
//  - Wildcard nights: the tour's wildcard reaches into the show (a scout at the midpoint, festival
//    crowds, a fan club in front, new arrangements).
import type { BandmateId, StatKey } from '../../content/schema';
import { rapportFor } from './bandHelp';
import { makeRng } from '../core/rng';

export interface BandPerks {
  /** Multiplier on the timing windows (Theo). */
  windowScale: number;
  /** Misses that do not break the combo (Jun). */
  comboShield: number;
  /** Fraction of a hold that keeps its grade (Mira; default 0.85). */
  holdKeep: number;
  /** Crowd added at the start, and extra crowd per perfect (Rowan). */
  crowdStart: number;
  crowdPerPerfect: number;
  /** Who is helping, as banner lines, e.g. "Theo locks the tempo". */
  lines: string[];
}

export const PERK_LINES: Record<BandmateId, string> = {
  theo: 'Theo locks the tempo: wider timing',
  jun: 'Jun covers your slips: 3 misses keep your combo',
  mira: 'Mira carries the long notes: holds forgive early release',
  rowan: 'Rowan works the room: the crowd starts warmer',
};

/** Perks from every bandmate you are CLOSE with (rapport, src/game/bandHelp.ts). */
export function bandPerks(relationships: Partial<Record<BandmateId, number>>): BandPerks {
  const close = (id: BandmateId) => rapportFor(relationships[id]) === 'close';
  const p: BandPerks = { windowScale: 1, comboShield: 0, holdKeep: 0.85, crowdStart: 0, crowdPerPerfect: 0, lines: [] };
  if (close('theo')) { p.windowScale = 1.15; p.lines.push(PERK_LINES.theo); }
  if (close('jun')) { p.comboShield = 3; p.lines.push(PERK_LINES.jun); }
  if (close('mira')) { p.holdKeep = 0.7; p.lines.push(PERK_LINES.mira); }
  if (close('rowan')) { p.crowdStart = 12; p.crowdPerPerfect = 1; p.lines.push(PERK_LINES.rowan); }
  return p;
}

// ---------------------------------------------------------------- show goals
export type GoalId = 'streak' | 'holds' | 'cues' | 'crowd' | 'clean';
export interface ShowGoal { id: GoalId; text: string; }
export const SHOW_GOALS: ShowGoal[] = [
  { id: 'streak', text: 'Hit a 25-note streak' },
  { id: 'holds', text: 'Hold every long note to the end' },
  { id: 'cues', text: 'Take every choice cue' },
  { id: 'crowd', text: 'Win over all five fans' },
  { id: 'clean', text: 'Finish with 3 misses or fewer' },
];

export function showGoalFor(seed: string, cityId: string, visit: number): ShowGoal {
  const rng = makeRng(`${seed}:showgoal:${cityId}:${visit}`);
  return SHOW_GOALS[rng.int(0, SHOW_GOALS.length)];
}

export interface GoalProgress { bestStreak: number; holdsDropped: number; cuesTaken: number; cuesTotal: number; misses: number; crowdPeak: number; holdsTotal: number; }

/** True once the goal is met (some goals can only be judged at the end: `final`). */
export function goalMet(goal: ShowGoal, p: GoalProgress, final: boolean): boolean {
  switch (goal.id) {
    case 'streak': return p.bestStreak >= 25;
    case 'crowd': return p.crowdPeak >= 100;
    case 'cues': return final ? p.cuesTotal > 0 ? p.cuesTaken >= p.cuesTotal : true : p.cuesTotal > 0 && p.cuesTaken >= p.cuesTotal;
    case 'holds': return final && p.holdsDropped === 0;
    case 'clean': return final && p.misses <= 3;
    default: return false;
  }
}

// ---------------------------------------------------------------- chart patterns
export type ChartPattern = 'original' | 'mirror' | 'shift' | 'shiftBack';
export const PATTERN_LABEL: Record<ChartPattern, string> = { original: 'Pattern A', mirror: 'Pattern B', shift: 'Pattern C', shiftBack: 'Pattern D' };

/** Which fingering tonight's chart uses. The first show of a first tour is always the original. */
export function chartPatternFor(seed: string, cityId: string, visit: number, forceNew = false): ChartPattern {
  const all: ChartPattern[] = ['original', 'mirror', 'shift', 'shiftBack'];
  const rng = makeRng(`${seed}:pattern:${cityId}:${visit}`);
  const pick = all[rng.int(0, all.length)];
  return forceNew && pick === 'original' ? 'mirror' : pick;
}

/** The lane a note lands in under a pattern (lanes 0..n-1). Rhythm and chords are unchanged:
 *  only which finger plays them moves, so a chord stays a chord. */
export function remapLane(lane: number, lanes: number, pattern: ChartPattern): number {
  if (pattern === 'mirror') return lanes - 1 - lane;
  if (pattern === 'shift') return (lane + 1) % lanes;
  if (pattern === 'shiftBack') return (lane + lanes - 1) % lanes;
  return lane;
}

// ---------------------------------------------------------------- wildcard nights
export interface WildcardNight {
  /** A line for the pre-song banner, or null. */
  line: string | null;
  crowdStart: number;
  /** Multiplier on the show goal's reward. */
  goalRewardScale: number;
  /** Funds added when the goal is met. */
  goalFunds: number;
  /** Always a new chart pattern (never the original). */
  newPattern: boolean;
  /** This is the scouted show. */
  scouted: boolean;
}

export function wildcardNight(wildcardId: string | undefined, arcRole: 'opener' | 'midpoint' | 'finale' | null): WildcardNight {
  const n: WildcardNight = { line: null, crowdStart: 0, goalRewardScale: 1, goalFunds: 0, newPattern: false, scouted: false };
  switch (wildcardId) {
    case 'scout':
      if (arcRole === 'midpoint') { n.scouted = true; n.goalRewardScale = 2; n.line = 'The label scout is in the room tonight. Make the goal count double.'; }
      break;
    case 'festival': n.crowdStart = 10; n.goalFunds = 20; n.line = 'Festival crowd: bigger and warmer. The goal pays $20 more.'; break;
    case 'fanClub': n.crowdStart = 20; n.line = 'The fan club is up front. Two fans start on your side.'; break;
    case 'newSongs': n.newPattern = true; n.line = 'A brand-new setlist: tonight\'s chart is a fresh pattern.'; break;
    case 'shoestring': n.goalFunds = 15; n.line = 'Shoestring tour: meet the goal and the merch table earns $15.'; break;
    default: break;
  }
  return n;
}

/** What meeting the goal is worth: local love, and stat/fund extras from the wildcard. */
export function goalReward(night: WildcardNight): { localLove: number; deltas: Partial<Record<StatKey, number>> } {
  const deltas: Partial<Record<StatKey, number>> = { inspiration: Math.round(2 * night.goalRewardScale) };
  if (night.goalFunds) deltas.funds = night.goalFunds;
  return { localLove: Math.round(5 * night.goalRewardScale), deltas };
}
