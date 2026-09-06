import type { BandmateId, StatDeltas, StatKey } from '../../content/schema';
import { SAVE_SCHEMA_VERSION } from '../const';

export interface Item {
  id: string;
  name: string;
  description: string;
  cityId?: string;
}

export interface CityStop {
  cityId: string;
  visited: boolean;
  weather?: string;
}

export interface RunHistoryEntry {
  seed: string;
  bandName: string;
  endingId: string;
  tags: string[];
  completedAt: number;
}

export interface MetaProgress {
  completedRuns: number;
  unlockedGenres: string[];
  unlockedDecor: string[];
  runHistory: RunHistoryEntry[];
}

export type ScreenName =
  | 'title' | 'bandCreator' | 'routePlan' | 'hub' | 'city'
  | 'rhythm' | 'results' | 'scrapbook' | 'settings';

export interface Progress {
  screen: ScreenName;
  cityId?: string;
  nodeId?: string;
  /** The exact dialogue-graph node currently showing, within screen:'city' + one of the linear-
   *  walk phases (arrival/preshow/afterShow/journal) — CityScene.ts's walk() sets this on every
   *  node shown so an interrupted session (tab close, crash, refresh) resumes exactly where the
   *  player left off instead of replaying that phase's dialogue from its first line. Optional and
   *  additive: an older save without it just falls back to the old "start of phase" behavior. */
  dialogueNodeId?: string;
}

export type RhythmMode = 'relaxed' | 'standard' | 'expert';

export interface AccessibilitySettings {
  visualAssist: boolean;
  audioAssist: boolean;
  wiggleRoom: boolean;
  easyScoring: boolean;
  rhythmMode: RhythmMode;
  autoplay: boolean;
  noFailCozyMode: boolean;
  reducedMotion: boolean;
  noFlash: boolean;
  /** Dialogue auto-advances a few seconds after a line finishes (never past a choice). */
  autoAdvance: boolean;
  /** Dialogue lines appear instantly instead of typing out. */
  skipReadText: boolean;
  /** ms, -150..150. Subtracted from a note's judged hit time — a positive value means audio
   *  (and so the visible/felt beat) arrives late on this device, so notes are judged earlier. */
  audioOffsetMs: number;
  /** Tap/perfect/good/ok/miss SFX during rhythm play. Music/ambience unaffected either way. */
  tapSoundEnabled: boolean;
  /** navigator.vibrate() on rhythm hits (perfect/miss). No-op on devices without vibration. */
  haptics: boolean;
  volumes: { master: number; music: number; sfx: number; metronome: number };
}

export interface RunState {
  schemaVersion: 1;
  seed: string;
  band: { name: string; genre: string; whyTour: string; members: BandmateId[] };
  stats: Record<StatKey, number>;
  localLove: Record<string, number>;
  relationships: Record<BandmateId, number>;
  flags: string[];
  inventory: Item[];
  route: CityStop[];
  log: string[];
  currentCityIndex: number;
  midTourComplication: string;
  progress: Progress;
  meta: MetaProgress;
  accessibility: AccessibilitySettings;
}

export function freshMeta(): MetaProgress {
  return { completedRuns: 0, unlockedGenres: [], unlockedDecor: [], runHistory: [] };
}

export function freshAccessibility(): AccessibilitySettings {
  return {
    visualAssist: true,
    audioAssist: false,
    wiggleRoom: false,
    easyScoring: false,
    rhythmMode: 'standard',
    autoplay: false,
    noFailCozyMode: true,
    reducedMotion: false,
    noFlash: false,
    autoAdvance: false,
    skipReadText: false,
    audioOffsetMs: 0,
    tapSoundEnabled: true,
    haptics: /Android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    volumes: { master: 1, music: 0.7, sfx: 0.9, metronome: 0.6 },
  };
}

export function freshRun(seed: string, meta: MetaProgress, accessibility: AccessibilitySettings): RunState {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    seed,
    band: { name: '', genre: '', whyTour: '', members: ['mira', 'theo', 'jun', 'rowan'] },
    stats: { energy: 70, harmony: 60, inspiration: 60, funds: 500 },
    localLove: {},
    relationships: { mira: 20, theo: 20, jun: 20, rowan: 20 },
    flags: [],
    inventory: [],
    route: [],
    log: [],
    currentCityIndex: 0,
    midTourComplication: '',
    progress: { screen: 'title' },
    meta,
    accessibility,
  };
}

const STAT_BOUNDS: Record<StatKey, [number, number]> = {
  energy: [0, 100],
  harmony: [0, 100],
  inspiration: [0, 100],
  funds: [0, Number.POSITIVE_INFINITY],
};

function clamp(v: number, [min, max]: [number, number]): number {
  return Math.max(min, Math.min(max, v));
}

class GameState {
  data: RunState = freshRun('unseeded', freshMeta(), freshAccessibility());

  newRun(seed: string): void {
    this.data = freshRun(seed, this.data.meta, this.data.accessibility);
  }

  applyStatDeltas(deltas: StatDeltas | undefined): void {
    if (!deltas) return;
    for (const [key, delta] of Object.entries(deltas) as [StatKey, number][]) {
      const current = this.data.stats[key] ?? 0;
      this.data.stats[key] = clamp(current + delta, STAT_BOUNDS[key]);
    }
  }

  applyRelationshipDeltas(deltas: Partial<Record<BandmateId, number>> | undefined): void {
    if (!deltas) return;
    for (const [id, delta] of Object.entries(deltas) as [BandmateId, number][]) {
      const current = this.data.relationships[id] ?? 0;
      this.data.relationships[id] = clamp(current + delta, [-50, 100]);
    }
  }

  addLocalLove(cityId: string, delta: number): void {
    const current = this.data.localLove[cityId] ?? 0;
    this.data.localLove[cityId] = clamp(current + delta, [0, 100]);
  }

  addFlag(flag: string): void {
    if (!this.data.flags.includes(flag)) this.data.flags.push(flag);
  }

  hasFlag(flag: string): boolean {
    return this.data.flags.includes(flag);
  }

  addItem(item: Item): void {
    this.data.inventory.push(item);
  }

  appendLog(entryId: string): void {
    if (!this.data.log.includes(entryId)) this.data.log.push(entryId);
  }

  hasLogged(entryId: string): boolean {
    return this.data.log.includes(entryId);
  }

  setProgress(progress: Progress): void {
    this.data.progress = progress;
  }
}

export const State = new GameState();
