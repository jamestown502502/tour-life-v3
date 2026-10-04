// What the polish says, decided in one place (2026-10-04). Pure data and rules, so tests can check
// them; src/art/juice.ts does the drawing. Principles: every effect is diegetic (a stamp, an LED,
// a portrait), it tells the player something, and the big celebration is only for a perfect run.
import type { MiniGameType } from '../../content/schema';

export type Tier = 1 | 2 | 3;

/** The one-word verb that punches in as a minigame starts (WarioWare-style). */
export const VERB: Record<MiniGameType, string> = {
  timing: 'LEVEL!', drag: 'LOAD!', choice: 'ANSWER!', pressure: 'ON AIR!', sequence: 'PATCH!', sustain: 'HOLD!',
  interval: 'LISTEN!', clave: 'LISTEN!', chordquality: 'LISTEN!', meter: 'COUNT!', tempo: 'TAP!', transpose: 'MOVE!',
  split: 'DEAL!', pricing: 'PRICE!', perdiem: 'BUDGET!', gearcall: 'DECIDE!', exchange: 'EXCHANGE!',
  setlist: 'SEQUENCE!', longhaul: 'ROUTE!',
};

/** The rubber stamp on a result card, per minigame kind and tier. Tier 3 is the type's own word. */
const PERFECT_STAMP: Partial<Record<MiniGameType, string>> = {
  timing: 'FLAT BOARD', drag: 'STOWED', choice: 'ON THE RECORD', pressure: 'ON THE RECORD', sequence: 'PATCHED',
  sustain: 'LOCKED IN', interval: 'PERFECT EAR', clave: 'PERFECT EAR', chordquality: 'PERFECT EAR', meter: 'IN THE POCKET',
  tempo: 'IN THE POCKET', transpose: 'PERFECT EAR', split: 'ROOM READ', pricing: 'SOLD OUT', perdiem: 'BALANCED',
  gearcall: 'SMART BUY', exchange: 'BEST RATE', setlist: 'ENCORE', longhaul: 'IN THE BLACK',
};
export function resultStamp(type: MiniGameType, tier: Tier): string {
  if (tier === 3) return PERFECT_STAMP[type] ?? 'NAILED IT';
  return tier === 2 ? 'SOLID' : 'ROUGH';
}

/** The ledger card's stamp for a money decision, from its tier. */
export function ledgerStamp(type: MiniGameType, tier: 'perfect' | 'good' | 'rough'): string {
  if (type === 'longhaul') return tier === 'rough' ? 'IN THE RED' : 'IN THE BLACK';
  return tier === 'perfect' ? (PERFECT_STAMP[type] ?? 'NAILED IT') : tier === 'good' ? 'FAIR' : 'COSTLY';
}

/** The soundcheck verdict stamp for one level. */
export const LEVEL_STAMP = { quiet: 'TOO QUIET', sweet: 'SWEET SPOT', clip: 'CLIPPED' } as const;

/** The host's portrait mood for a result: inspired for a perfect, happy for good, worried for rough. */
export function cameoMood(tier: Tier): 'inspired' | 'happy' | 'worried' {
  return tier === 3 ? 'inspired' : tier === 2 ? 'happy' : 'worried';
}

/** One beat of a minigame's music bed, in ms (96 bpm when the minigame has no bed of its own). */
export function beatMs(bpm: number | undefined): number {
  return Math.round(60000 / Math.max(40, bpm ?? 96));
}

/** Rising-pitch count-up ticks: the frequency for a tick at `progress` (0..1). */
export function tickPitch(progress: number): number {
  return Math.round(520 + Math.max(0, Math.min(1, progress)) * 700);
}

/** The haptic vocabulary, in navigator.vibrate patterns: short and clear, never buzzy. */
export const HAPTIC = { tick: 8, thud: 18, double: [12, 40, 12], soft: [30] } as const;
export type HapticName = keyof typeof HAPTIC;

/** The set-piece is for a flawless run only. */
export function shouldEncore(tier: Tier, practice: boolean): boolean {
  return tier === 3 && !practice;
}
