// Pure routing logic for resuming a save — split out of src/ui/TitleScene.ts (Workstream 2 of
// the UX/QA fix pass) so it can be unit-tested without pulling in Phaser, which throws at import
// time in a plain Node test environment (no `window`). Used by TitleScene's Continue button and
// its Saves-slot Load buttons — every entry point that turns a saved Progress into a scene to
// start.
import type { Progress } from '../core/state';
import { hasCity } from './content';

export function resumeTarget(progress: Progress): { key: string; data?: object } {
  switch (progress.screen) {
    case 'title': return { key: 'Title' };
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
