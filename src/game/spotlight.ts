// The Spotlight Bridge: pure rules (publisher polish 2026-10-12). Content in content/spotlight.ts;
// the offer is drawn by CityScene before the pre-show choices, the bridge by RhythmScene, the
// sound by audio.spotlight(). Unit-tested in src/tests/spotlight.test.ts.
//
// The design promise, from the publisher blueprint: a choice on the road produces a payoff you can
// HEAR and SEE on stage, then comes back later in the story, without touching the rhythm game.
// Nothing here changes a note, a timing window or a grade: the chart is identical either way.
import type { BandmateId } from '../../content/schema';
import { SPOTLIGHT, SPOTLIGHT_DECLINED } from '../../content/spotlight';
import { arcStageFor, type ArcStage } from './arc';
import { makeRng } from '../core/rng';
import type { RunState, SpotlightRecord } from '../core/state';

export type { SpotlightRecord };

const MATES: BandmateId[] = ['mira', 'theo', 'jun', 'rowan'];

/** Who offers tonight: the bandmate of the last relationship scene played in this city, or, if
 *  none played, whoever is closest to you (ties broken by the run's seed, so a replay matches). */
export function proposerFor(state: Pick<RunState, 'seed' | 'relationships'>, cityId: string, lastSceneMate: BandmateId | undefined): BandmateId {
  if (lastSceneMate && MATES.includes(lastSceneMate)) return lastSceneMate;
  const order = makeRng(`${state.seed}:spotlight:${cityId}`).shuffle([...MATES]);
  return order.reduce((best, m) => ((state.relationships[m] ?? 0) > (state.relationships[best] ?? 0) ? m : best), order[0]);
}

export function stageOf(state: Pick<RunState, 'arcScenesPlayed' | 'currentCityIndex' | 'route'>, mate: BandmateId): ArcStage {
  return arcStageFor({
    scenesPlayed: state.arcScenesPlayed?.[mate] ?? 0,
    currentCityIndex: state.currentCityIndex,
    routeLength: state.route.length,
  });
}

export function offerLine(mate: BandmateId, stage: ArcStage): string {
  return SPOTLIGHT[mate].offer[stage];
}

/** The bridge: 55% to 70% of the way through the chart's notes, in chart seconds. Null for a chart
 *  too short to have one (under 20 s of notes) — then there is no offer either. */
export function bridgeWindow(noteTimes: readonly number[]): { start: number; end: number } | null {
  if (noteTimes.length < 8) return null;
  const first = Math.min(...noteTimes), last = Math.max(...noteTimes);
  const span = last - first;
  if (span < 20) return null;
  return { start: first + span * 0.55, end: first + span * 0.7 };
}

export function recordFor(state: Pick<RunState, 'spotlights'>, cityId: string, visit: number): SpotlightRecord | undefined {
  return (state.spotlights ?? []).find((s) => s.cityId === cityId && s.visit === visit);
}

/** Tonight's plan for RhythmScene: who has the bridge, how it sounds, and when. Null when the
 *  bridge was kept as rehearsed (or never offered). */
export function spotlightPlan(state: Pick<RunState, 'spotlights'>, cityId: string, visit: number, noteTimes: readonly number[]) {
  const rec = recordFor(state, cityId, visit);
  const window = bridgeWindow(noteTimes);
  if (!rec || !rec.accepted || !window) return null;
  const v = SPOTLIGHT[rec.mate];
  return { mate: rec.mate, treatment: v.treatment, light: v.light, ...window };
}

/** The oldest accepted bridge from an earlier city that the drive has not brought back yet. */
export function pendingEcho(state: Pick<RunState, 'spotlights'>, currentCityId: string): SpotlightRecord | undefined {
  return (state.spotlights ?? []).find((s) => s.accepted && !s.echoed && s.cityId !== currentCityId);
}

export const BANDMATE_NAME: Record<BandmateId, string> = { mira: 'Mira', theo: 'Theo', jun: 'Jun', rowan: 'Rowan' };

/** The Results line for tonight's bridge, or null when nobody was offered it. */
export function spotlightAfterLine(state: Pick<RunState, 'spotlights'>, cityId: string, visit: number): string | null {
  const rec = recordFor(state, cityId, visit);
  if (!rec) return null;
  return rec.accepted ? SPOTLIGHT[rec.mate].after : SPOTLIGHT_DECLINED;
}

/** The van line for a bridge from an earlier city. */
export function echoLine(rec: SpotlightRecord, cityName: string): string {
  return SPOTLIGHT[rec.mate].echo.replace('{city}', cityName);
}
