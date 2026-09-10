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
  /** True for the tour's return leg — a city the route deliberately books twice. The second
   *  booking is where the town's reaction to the FIRST show comes back at you. Optional so any
   *  save written before return legs existed simply has no revisit stops. */
  revisit?: boolean;
}

/** What the tour remembers about a city after playing it once. Written when the show ends, read
 *  when the route brings the band back — the whole basis of the return-leg social feed, and the
 *  reason a second night in a city can feel earned or awkward rather than identical.
 *
 *  Deliberately small: a band, not a transcript. Everything here is derived from things the
 *  player did, never from a random roll. */
export interface CityMemory {
  cityId: string;
  /** The FIRST show, banded from the performance result's grade. Never overwritten — the return
   *  leg's whole point is comparing tonight to that night. */
  show: 'triumph' | 'solid' | 'rough';
  /** The return leg's show, once it has been played. Absent until then. */
  secondShow?: 'triumph' | 'solid' | 'rough';
  /** True once a real show has been recorded here. A memory can exist before that — the city's
   *  minigame resolves first and creates one — so `show` (which carries a default) cannot be used
   *  to tell "played a show" from "played the minigame only". */
  firstShowRecorded?: boolean;
  /** How the town felt about the band when they left (localLove at departure). */
  love: number;
  /** Whether the city's minigame went well, and which one it was — so the callback can be
   *  specific ("they still talk about that load-out") instead of generic. */
  minigameGood?: boolean;
  minigameTitle?: string;
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
  /** Relationship scenes this player has already been shown, across every run. The scene-pool
   *  draw prefers material they have never seen, so a replay is new writing rather than a
   *  reshuffle of the same two beats. Optional: a save written before this existed simply has no
   *  history, which reads as "nothing seen yet" and behaves exactly like the old draw. */
  seenSceneIds?: string[];
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
  /** screen:'city' + nodeId:'locations' only — which location ids this visit has already played,
   *  so an interruption between two locations resumes the picker remembering what's already been
   *  seen instead of re-offering (and letting the player re-play) an already-visited location. */
  locationsVisited?: string[];
  /** screen:'city' + nodeId:'relationship' only — same idea as locationsVisited, for which
   *  relationship-scene-pool entries this visit has already played. */
  relationshipsPlayed?: string[];
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
  /** Additive: absent on any save written before return legs existed, backfilled by migrate(). */
  cityMemories?: CityMemory[];
  /** How many relationship scenes each bandmate has had this run — the input to their arc stage
   *  (src/game/arc.ts). Optional and additive: a save written before arcs existed reads as zero
   *  for everyone, which is exactly the setup stage they would have been in anyway. */
  arcScenesPlayed?: Record<string, number>;
  log: string[];
  currentCityIndex: number;
  midTourComplication: string;
  progress: Progress;
  meta: MetaProgress;
  accessibility: AccessibilitySettings;
}

export function freshMeta(): MetaProgress {
  return { completedRuns: 0, unlockedGenres: [], unlockedDecor: [], runHistory: [], seenSceneIds: [] };
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
    cityMemories: [],
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

  /** Records that a relationship scene has actually been SHOWN to this player, so future runs can
   *  draw fresh material first (see scenePool.drawScenePoolFlags). Recorded on display rather than
   *  on draw: a run abandoned before reaching a city should not burn that city's unseen scenes. */
  /** One more scene spent with this bandmate. Drives arc stage, and with it which of their beats
   *  can surface next. */
  recordArcScene(bandmate: string): void {
    if (!this.data.arcScenesPlayed) this.data.arcScenesPlayed = {};
    this.data.arcScenesPlayed[bandmate] = (this.data.arcScenesPlayed[bandmate] ?? 0) + 1;
  }

  markSceneSeen(sceneId: string): void {
    const meta = this.data.meta;
    if (!meta.seenSceneIds) meta.seenSceneIds = [];
    if (!meta.seenSceneIds.includes(sceneId)) meta.seenSceneIds.push(sceneId);
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
