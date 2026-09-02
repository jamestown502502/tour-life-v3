// Content types + runtime validation. Every content JSON file is checked against this at load
// (dev assert + console warning) before it touches state. No external JSON-schema library —
// content is small and hand-authored, so a structural check here is sufficient.

export type BandmateId = 'mira' | 'theo' | 'jun' | 'rowan';
export const BANDMATE_IDS: BandmateId[] = ['mira', 'theo', 'jun', 'rowan'];

export type StatKey = 'energy' | 'harmony' | 'inspiration' | 'funds';

export type StatDeltas = Partial<Record<StatKey, number>>;

/** "stat.harmony>=30" | "relationship.mira>=20" | "localLove.lisbon>=10" | "flag:x" | "!flag:x",
 *  joined with "&&" for AND. See src/game/condition.ts for the evaluator. */
export type ConditionExpr = string;

export interface DialogueChoice {
  id: string;
  label: string;
  next: string;
  effects?: StatDeltas;
  relationshipEffects?: Partial<Record<BandmateId, number>>;
  flags?: string[];
  condition?: ConditionExpr;
}

export interface DialogueNode {
  id: string;
  speaker: string; // BandmateId, 'narrator', or an NPC name
  portrait?: string; // mood key, e.g. "worried" | "happy" | "tense" | "inspired"
  text: string;
  choices?: DialogueChoice[];
  /** Only present when there are no choices — tap advances straight to this node. */
  next?: string;
  condition?: ConditionExpr;
  /** Node to visit instead, if `condition` fails. Required whenever `condition` is set. */
  fallback?: string;
  /** Hands off to a non-dialogue system: "rhythm:<songId>:<arrangementId>" | "scene:<sceneId>" | "end" */
  triggerEvent?: string;
}

export type SceneGraph = Record<string, DialogueNode>;

export interface LocationDef {
  id: string;
  name: string;
  sound: string;
  sceneId: string; // entry node id in the city's scene graph for this location
}

export interface RelationshipScenePoolEntry {
  id: string;
  bandmate: BandmateId;
  sceneId: string;
  condition?: ConditionExpr;
}

export interface PreShowChoiceDef {
  id: string;
  label: string;
  description: string;
  arrangementId: string;
  effects?: StatDeltas;
  condition?: ConditionExpr;
}

export interface StoryGate {
  condition: ConditionExpr;
  unlock: string; // arrangementId or flag unlocked
}

export interface CollaboratorDef {
  npcName: string;
  role: string;
  gift: string;
}

// Minigames break up the pure-dialogue flow with a short (20-45s), touch-first, NO-FAIL
// interactive beat that uses one of the tour's own verbs. Every type always reaches an outcome
// — 'timing'/'drag' have a graded-but-never-failing result, 'choice' has no wrong answer, only
// a warmer or cooler one — matching the same no-fail philosophy as the rhythm minigame.
export type MiniGameType = 'timing' | 'drag' | 'choice';

export interface MiniGameReward {
  effects?: StatDeltas;
  relationshipEffects?: Partial<Record<BandmateId, number>>;
  flags?: string[];
}

/** 'choice' type only: one prompt, exactly 2 options. Neither is "wrong" — `warmer` just picks
 *  which reward tier applies, same spirit as a dialogue choice's effects. */
export interface MiniGameQuestion {
  id: string;
  prompt: string;
  optionA: string;
  optionB: string;
  /** Which option is treated as the "warmer" (full reward) pick. The other still gets `roughReward`, never nothing. */
  warmerOption: 'A' | 'B';
}

export interface MiniGameDef {
  id: string;
  type: MiniGameType;
  title: string;
  introText: string;
  /** Shown on a good outcome (timing: >=2/3 good hits; drag: all items placed in time; choice: majority-warmer answers). */
  outroText: string;
  /** Shown otherwise — "rough but fine," never a failure or scold. */
  outroTextRough: string;
  reward: MiniGameReward;
  /** Applied instead of `reward` on the rough outcome. Omit for "no reward either way, just flavor." */
  roughReward?: MiniGameReward;
  /** Backdrop texture key (see art/sprites.ts ensureMiniGameBackdrop / the real-asset manifest). Falls back to a code-drawn panel if absent. */
  backdropKey?: string;
  /** 'timing' only: seconds the needle takes to sweep the gauge once, per round (gets faster). */
  timingRoundsSec?: number[];
  /** 'drag' only: item labels to place into slots before the timer runs out. */
  dragItems?: string[];
  /** 'drag' only: seconds allowed to place every item. */
  dragTimeSec?: number;
  /** 'choice' only: exactly 3 questions. */
  questions?: MiniGameQuestion[];
}

export interface CityDef {
  id: string;
  name: string;
  tone: string;
  weather: string[];
  tempo: number;
  tint: 'warm_amber' | 'teal_pink' | 'lavender_dusk' | 'rose_gold' | 'forest_moss' | 'desert_clay' | 'midnight_indigo' | 'citrus_bloom';
  locations: LocationDef[];
  arrivalSceneId: string;
  preShowSceneId: string;
  relationshipScenePool: RelationshipScenePoolEntry[];
  collaborator: CollaboratorDef;
  preShowChoices: PreShowChoiceDef[];
  songId: string;
  storyGate?: StoryGate;
  scenes: SceneGraph;
  afterShowSceneId: string;
  journalSceneId: string;
  /** Optional — a city with no minigames plays exactly as before. At most one is offered per
   *  city per run (CityScene picks the first unplayed entry), inserted after arrival. */
  minigames?: MiniGameDef[];
}

export type NoteType = 'tap' | 'hold' | 'choice';
export type ChoiceCueType = 'pull_back' | 'build' | 'invite_crowd' | 'improvise' | 'spotlight_bandmate';

export interface ChartNote {
  t: number; // seconds
  l: number; // lane 0-3
  type: NoteType;
  dur?: number; // for holds, seconds
}

export interface ChartCue {
  t: number;
  type: ChoiceCueType;
}

export interface SongArrangement {
  id: string;
  label: string;
  description: string;
  notes: ChartNote[];
  cues: ChartCue[];
  /** Multiplier applied to note density relative to the base arrangement, informational only. */
  noteDensity: number;
}

export interface SongDef {
  id: string;
  name: string;
  bpm: number;
  lanes: number;
  chordProgression: string;
  waveform: 'triangle' | 'square' | 'sine';
  arrangements: SongArrangement[]; // arrangements[0] is the default/base
}

export interface BandmateDef {
  id: BandmateId;
  name: string;
  instrument: string;
  wants: string;
  fears: string;
}

export interface GenreDef {
  id: string;
  label: string;
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}
function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function fail(errors: string[], msg: string): void {
  errors.push(msg);
}

export function validateSceneGraph(scenes: unknown, path: string, errors: string[]): void {
  if (typeof scenes !== 'object' || scenes === null) {
    fail(errors, `${path}: scenes must be an object`);
    return;
  }
  for (const [nodeId, node] of Object.entries(scenes as Record<string, any>)) {
    const p = `${path}.scenes.${nodeId}`;
    if (node.id !== nodeId) fail(errors, `${p}: node.id ("${node.id}") must match its key`);
    if (!isString(node.speaker)) fail(errors, `${p}: speaker must be a string`);
    if (!isString(node.text)) fail(errors, `${p}: text must be a string`);
    if (node.text && node.text.split(/\s+/).length > 40) {
      fail(errors, `${p}: text exceeds 40-word pacing budget (PRD §15.4.4)`);
    }
    if (node.choices !== undefined) {
      if (!isArray(node.choices)) fail(errors, `${p}: choices must be an array`);
      else {
        for (const c of node.choices) {
          if (!isString(c.id) || !isString(c.label) || !isString(c.next)) {
            fail(errors, `${p}: each choice needs id/label/next strings`);
          }
        }
      }
    }
  }
}

export function validateCity(data: unknown): ValidationResult {
  const errors: string[] = [];
  const c = data as Partial<CityDef>;
  if (!c || typeof c !== 'object') return { valid: false, errors: ['city: not an object'] };
  const path = c.id ? `city:${c.id}` : 'city:?';
  if (!isString(c.id)) fail(errors, `${path}: id must be a string`);
  if (!isString(c.name)) fail(errors, `${path}: name must be a string`);
  if (!isString(c.tone)) fail(errors, `${path}: tone must be a string`);
  if (!isArray(c.weather) || c.weather.length === 0) fail(errors, `${path}: weather must be a non-empty array`);
  if (!isNumber(c.tempo)) fail(errors, `${path}: tempo must be a number`);
  if (!isArray(c.locations) || c.locations.length < 3) {
    fail(errors, `${path}: locations must have >= 3 entries`);
  } else {
    for (const loc of c.locations) {
      if (!isString(loc.id) || !isString(loc.name) || !isString(loc.sceneId)) {
        fail(errors, `${path}: each location needs id/name/sceneId`);
      }
    }
  }
  if (!isArray(c.relationshipScenePool) || c.relationshipScenePool.length < 2) {
    fail(errors, `${path}: relationshipScenePool must have >= 2 entries`);
  }
  if (!isArray(c.preShowChoices) || c.preShowChoices.length < 2) {
    fail(errors, `${path}: preShowChoices must have >= 2 entries`);
  }
  if (!isString(c.songId)) fail(errors, `${path}: songId must be a string`);
  if (!isString(c.arrivalSceneId)) fail(errors, `${path}: arrivalSceneId required`);
  if (!isString(c.preShowSceneId)) fail(errors, `${path}: preShowSceneId required`);
  if (!isString(c.afterShowSceneId)) fail(errors, `${path}: afterShowSceneId required`);
  if (!isString(c.journalSceneId)) fail(errors, `${path}: journalSceneId required`);
  if (c.scenes) validateSceneGraph(c.scenes, path, errors);
  else fail(errors, `${path}: scenes required`);
  if (c.minigames !== undefined) validateMiniGames(c.minigames, path, errors);

  return { valid: errors.length === 0, errors };
}

function validateMiniGames(minigames: unknown, path: string, errors: string[]): void {
  if (!isArray(minigames)) { fail(errors, `${path}.minigames: must be an array`); return; }
  for (const mg of minigames as Partial<MiniGameDef>[]) {
    const p = `${path}.minigames.${mg.id ?? '?'}`;
    if (!isString(mg.id) || !isString(mg.title) || !isString(mg.introText) ||
        !isString(mg.outroText) || !isString(mg.outroTextRough)) {
      fail(errors, `${p}: id/title/introText/outroText/outroTextRough must all be strings`);
    }
    if (mg.type === 'timing') {
      if (!isArray(mg.timingRoundsSec) || mg.timingRoundsSec.length < 1) {
        fail(errors, `${p}: timing type needs timingRoundsSec with >= 1 entry`);
      }
    } else if (mg.type === 'drag') {
      if (!isArray(mg.dragItems) || mg.dragItems.length < 2) {
        fail(errors, `${p}: drag type needs dragItems with >= 2 entries`);
      }
      if (!isNumber(mg.dragTimeSec) || mg.dragTimeSec! <= 0) {
        fail(errors, `${p}: drag type needs a positive dragTimeSec`);
      }
    } else if (mg.type === 'choice') {
      if (!isArray(mg.questions) || mg.questions.length !== 3) {
        fail(errors, `${p}: choice type needs exactly 3 questions`);
      } else {
        for (const q of mg.questions as MiniGameQuestion[]) {
          if (!isString(q.id) || !isString(q.prompt) || !isString(q.optionA) || !isString(q.optionB) ||
              (q.warmerOption !== 'A' && q.warmerOption !== 'B')) {
            fail(errors, `${p}: each question needs id/prompt/optionA/optionB and warmerOption 'A'|'B'`);
          }
        }
      }
    } else {
      fail(errors, `${p}: type must be 'timing' | 'drag' | 'choice'`);
    }
  }
}

export function validateSong(data: unknown): ValidationResult {
  const errors: string[] = [];
  const s = data as Partial<SongDef>;
  const path = s.id ? `song:${s.id}` : 'song:?';
  if (!isString(s.id)) fail(errors, `${path}: id must be a string`);
  if (!isNumber(s.bpm) || s.bpm <= 0) fail(errors, `${path}: bpm must be a positive number`);
  if (!isNumber(s.lanes) || s.lanes < 1) fail(errors, `${path}: lanes must be a positive number`);
  if (!isArray(s.arrangements) || s.arrangements.length < 1) {
    fail(errors, `${path}: arrangements must have >= 1 entry`);
  } else {
    for (const arr of s.arrangements) {
      if (!isString(arr.id)) fail(errors, `${path}: arrangement id must be a string`);
      if (!isArray(arr.notes) || arr.notes.length === 0) {
        fail(errors, `${path}.${arr.id}: notes must be a non-empty array`);
      } else {
        for (const n of arr.notes) {
          if (!isNumber(n.t) || !isNumber(n.l) || !isString(n.type)) {
            fail(errors, `${path}.${arr.id}: each note needs t/l/type`);
          }
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Dev assert + console warning, per CLAUDE.md: never let invalid content silently reach state. */
export function assertValid(result: ValidationResult, label: string): void {
  if (!result.valid) {
    const msg = `[content] ${label} failed validation:\n` + result.errors.map((e) => `  - ${e}`).join('\n');
    console.warn(msg);
    if (import.meta.env?.DEV) throw new Error(msg);
  }
}
