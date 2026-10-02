// Pure routing logic for resuming a save — split out of src/ui/TitleScene.ts (Workstream 2 of
// the UX/QA fix pass) so it can be unit-tested without pulling in Phaser, which throws at import
// time in a plain Node test environment (no `window`). Used by TitleScene's Continue button and
// its Saves-slot Load buttons — every entry point that turns a saved Progress into a scene to
// start.
import type { Progress, RunState } from '../core/state';
import { getCity, hasCity } from './content';

/** A save worth a Continue button: a run that got past the title screen. */
export function isResumable(saved: RunState): boolean {
  return saved.progress.screen !== 'title' && (saved.progress.screen !== 'bandCreator' || !!saved.band.name);
}

/** Where Continue will take you, short enough for the button. */
export function continueLabel(saved: RunState): string {
  const p = saved.progress;
  if (p.screen === 'scrapbook') return 'the scrapbook';
  if (p.screen === 'bandCreator') return 'your band';
  if (p.screen === 'routePlan') return 'plan the route';
  const stop = saved.route[saved.currentCityIndex];
  const cityId = p.screen === 'city' && p.cityId ? p.cityId : stop?.cityId;
  const name = cityId && hasCity(cityId) ? getCity(cityId).name : '';
  const n = saved.route.length;
  return name ? `${name}${n ? ` (stop ${Math.min(saved.currentCityIndex + 1, n)} of ${n})` : ''}` : 'the tour bus';
}

export function resumeTarget(progress: Progress): { key: string; data?: object } {
  switch (progress.screen) {
    // A run whose progress still says 'title' was started and never got further: pick it up at
    // band creation. Routing it to Title made Continue look like a page refresh (QA round 2 #1).
    case 'title': return { key: 'BandCreator' };
    case 'bandCreator': return { key: 'BandCreator' };
    case 'routePlan': return { key: 'RoutePlan' };
    case 'city':
      // CityScene.init() calls getCity(cityId), which THROWS on an unknown id — a save with a
      // stale/corrupted cityId (renamed or removed content) used to freeze the game mid scene-
      // transition instead of landing anywhere. Validated here, before the throw can happen, so
      // the fallback is Hub instead of a frozen screen.
      return progress.cityId && hasCity(progress.cityId)
        ? {
          key: 'City',
          data: {
            cityId: progress.cityId, phase: progress.nodeId, dialogueNodeId: progress.dialogueNodeId,
            locationsVisited: progress.locationsVisited, relationshipsPlayed: progress.relationshipsPlayed,
          },
        }
        : { key: 'Hub' };
    // Rhythm/Results need live in-flight data we don't persist — safest resume is the Hub.
    case 'hub': case 'rhythm': case 'results': case 'settings': default:
      return { key: 'Hub' };
    case 'scrapbook': return { key: 'Scrapbook' };
  }
}
