// Workstream 2 (navigation/"Continue" fix pass). resumeTarget is what turns a saved Progress
// into a scene to start — every ScreenName value must resolve to a real, playable scene key,
// and 'city' specifically must never hand CityScene a cityId it can't resolve (CityScene.init
// calls getCity(), which throws on an unknown id — that used to freeze the game mid-transition
// instead of landing anywhere; see src/game/resume.ts's own comment).
import { describe, expect, it } from 'vitest';
import { resumeTarget, isResumable, continueLabel } from '../game/resume';
import { State } from '../core/state';
import type { ScreenName } from '../core/state';

const ALL_SCREENS: ScreenName[] = [
  'title', 'bandCreator', 'routePlan', 'hub', 'city', 'rhythm', 'results', 'scrapbook', 'settings',
];
const REAL_SCENE_KEYS = new Set(['Title', 'BandCreator', 'RoutePlan', 'Hub', 'City', 'Rhythm', 'Results', 'Scrapbook', 'Settings']);

describe('resumeTarget (Workstream 2: every resume path lands playable)', () => {
  it('every ScreenName value resolves to a real, startable scene key', () => {
    for (const screen of ALL_SCREENS) {
      const { key } = resumeTarget({ screen });
      expect(REAL_SCENE_KEYS.has(key), `progress.screen "${screen}" -> unknown scene key "${key}"`).toBe(true);
    }
  });

  it('an unrecognized/future screen value (e.g. from a newer save) falls back to Hub, not undefined', () => {
    const target = resumeTarget({ screen: 'someFutureScreen' as unknown as ScreenName });
    expect(target.key).toBe('Hub');
  });

  it('city + a valid cityId resolves to City with that cityId and the saved nodeId as phase', () => {
    const target = resumeTarget({ screen: 'city', cityId: 'lisbon', nodeId: 'locations' });
    expect(target.key).toBe('City');
    expect((target.data as { cityId: string; phase?: string }).cityId).toBe('lisbon');
    expect((target.data as { cityId: string; phase?: string }).phase).toBe('locations');
  });

  it('city + an unrecognized nodeId (e.g. "preshow-done", the mid-transition-to-Rhythm value CityScene writes) still resolves to City — CityScene.init sanitizes the phase itself', () => {
    const target = resumeTarget({ screen: 'city', cityId: 'lisbon', nodeId: 'preshow-done' });
    expect(target.key).toBe('City');
    expect((target.data as { phase?: string }).phase).toBe('preshow-done'); // passed through as-is; CityScene.init is what sanitizes it
  });

  it('city + no cityId falls back to Hub instead of starting CityScene with an undefined city', () => {
    const target = resumeTarget({ screen: 'city' });
    expect(target.key).toBe('Hub');
  });

  it('city + an unknown/stale cityId (renamed or removed content) falls back to Hub instead of letting CityScene throw', () => {
    const target = resumeTarget({ screen: 'city', cityId: 'atlantis_that_never_shipped' });
    expect(target.key).toBe('Hub');
  });

  it('rhythm/results/settings (no persisted in-flight data) all resolve to Hub, the same safe landing spot', () => {
    for (const screen of ['rhythm', 'results', 'settings'] as ScreenName[]) {
      expect(resumeTarget({ screen }).key).toBe('Hub');
    }
  });

  // QA round 2 #1: Continue "just refreshed the app". A save written from the Title screen (a
  // Settings toggle) had progress 'title', so Continue resumed to Title itself.
  it("a 'title' progress never resumes to Title (that read as a page refresh)", () => {
    expect(resumeTarget({ screen: 'title' }).key).toBe('BandCreator');
  });

  it('only a run that got past the title screen offers Continue, and the label says where it goes', () => {
    State.newRun('qa-seed');
    const fresh = structuredClone(State.data);
    expect(isResumable(fresh)).toBe(false);
    fresh.band.name = 'The Testers';
    fresh.route = [{ cityId: 'lisbon' } as never, { cityId: 'tokyo' } as never];
    fresh.currentCityIndex = 1;
    fresh.progress = { screen: 'hub' };
    expect(isResumable(fresh)).toBe(true);
    expect(continueLabel(fresh)).toBe('Tokyo (stop 2 of 2)');
    fresh.progress = { screen: 'scrapbook' };
    expect(continueLabel(fresh)).toBe('the scrapbook');
  });

  it('scrapbook resolves to Scrapbook', () => {
    expect(resumeTarget({ screen: 'scrapbook' }).key).toBe('Scrapbook');
  });

  // Critical-issues follow-up: "text repeating" was root-caused to progress only persisting the
  // PHASE ('arrival'/'preshow'/etc.), not the exact dialogue node within it — an interruption
  // (tab close, crash, refresh) mid-walk resumed the player at that phase's first line, forcing
  // a replay of everything already seen. dialogueNodeId (CityScene.ts's walk(), saved on every
  // node shown) is the fix; this is the pure-logic half of it — the threading through
  // resumeTarget — CityScene.ts's own consumeResumeNode is what actually uses it.
  it('city + a saved dialogueNodeId forwards it through to CityScene\'s data unchanged', () => {
    const target = resumeTarget({ screen: 'city', cityId: 'berlin', nodeId: 'arrival', dialogueNodeId: 'ber_arrival_gear' });
    expect(target.key).toBe('City');
    expect((target.data as { dialogueNodeId?: string }).dialogueNodeId).toBe('ber_arrival_gear');
  });

  it('city + no saved dialogueNodeId (an older save, or a phase that never sets one) forwards undefined, not a crash', () => {
    const target = resumeTarget({ screen: 'city', cityId: 'berlin', nodeId: 'locations' });
    expect(target.key).toBe('City');
    expect((target.data as { dialogueNodeId?: string }).dialogueNodeId).toBeUndefined();
  });

  // Same class of fix, one honest remainder closed: locationsVisited/relationshipsPlayed were
  // run-scoped only (reset in CityScene.init()) — an interruption between two locations (or two
  // relationship-pool entries) resumed the picker with no memory of what was already played,
  // letting an already-seen location/relationship scene be picked and shown again.
  it('city + saved locationsVisited/relationshipsPlayed forward through unchanged', () => {
    const target = resumeTarget({
      screen: 'city', cityId: 'lisbon', nodeId: 'locations',
      locationsVisited: ['fado_house'], relationshipsPlayed: ['jun_letter'],
    });
    expect(target.key).toBe('City');
    const data = target.data as { locationsVisited?: string[]; relationshipsPlayed?: string[] };
    expect(data.locationsVisited).toEqual(['fado_house']);
    expect(data.relationshipsPlayed).toEqual(['jun_letter']);
  });

  it('city + no saved locationsVisited/relationshipsPlayed (an older save) forwards undefined, not a crash', () => {
    const target = resumeTarget({ screen: 'city', cityId: 'lisbon', nodeId: 'locations' });
    const data = target.data as { locationsVisited?: string[]; relationshipsPlayed?: string[] };
    expect(data.locationsVisited).toBeUndefined();
    expect(data.relationshipsPlayed).toBeUndefined();
  });
});
