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

export interface CityDef {
  id: string;
  name: string;
  tone: string;
  weather: string[];
  tempo: number;
  tint: 'warm_amber' | 'teal_pink';
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

  return { valid: errors.length === 0, errors };
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
