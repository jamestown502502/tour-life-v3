// A missing decorative texture must NEVER kill a playable scene.
//
// Live history that produced this file: after the service-worker fix landed, minigames and the
// VN worked but the rhythm scene still "disappeared immediately, too fast to screenshot" on the
// first entry, in production only. Every rhythm asset file and manifest entry exists in the repo,
// so the failure is a texture that fails to LOAD at runtime (a 404, a case mismatch on
// case-sensitive hosting, a transient network failure). RhythmScene.create() adds ~11 manifest
// textures (a painted stage backdrop plus 10 crowd figures); MiniGameScene adds one. That ratio
// is exactly why rhythm died and minigames survived once the stale-manifest cause was removed.
//
// Nothing in the suite ever simulated an asset failing to load, because a dev server always
// serves every file successfully — the same class of blind spot as "CI green while drag was
// broken". These tests block a real asset request and require the scene to degrade, not die.
import { test, expect } from '@playwright/test';
import {
  bootGame, skipFirstTimeOnboarding, startScene, waitForActiveScene, waitForCondition,
} from './helpers';

/** Marks the profile as a returning player so rhythm goes straight into the real song. */
async function seedReturningRhythmPlayer(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('tourlife.seenHowToPlay', '1');
    window.localStorage.setItem('tourlife.seenRhythmTutorial', '1');
    window.localStorage.setItem('tourlife.seenHoldHint', '1');
    window.localStorage.setItem('tourlife.seenCueHint', '1');
  });
}

const BLOCKED_CASES = [
  { label: 'the painted stage backdrop', pattern: '**/bg_rhythm_*' },
  { label: 'a crowd figure', pattern: '**/crowd_*' },
];

test.describe('A texture that fails to load must degrade, never crash the scene', () => {
  for (const c of BLOCKED_CASES) {
    test(`Rhythm still boots and plays with ${c.label} failing to load`, async ({ page }) => {
      test.setTimeout(120000);
      const pageErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(`${e.message}`));
      const blocked: string[] = [];

      // Fail the request the way a real 404/offline asset does — before anything boots, so the
      // texture never registers in Phaser's texture manager at all.
      await page.route(c.pattern, (route) => {
        blocked.push(route.request().url());
        return route.abort();
      });

      await seedReturningRhythmPlayer(page);
      await bootGame(page);
      await waitForActiveScene(page, 'Title', 20000);
      await page.evaluate(() => (window as any).__game.scene.stop('Title'));

      await startScene(page, 'Rhythm', { cityId: 'berlin' });
      const reached = await waitForCondition(
        page,
        () => (window as any).__game.scene.getScenes(true).some((s: any) => s.scene.key === 'Rhythm'),
        15000,
      );
      expect(reached, 'Rhythm never became active with a texture missing').toBe(true);

      // Give it well past the ~1s window in which the live bug kills the scene.
      await page.waitForTimeout(4000);

      const state = await page.evaluate(() => {
        const g: any = (window as any).__game;
        const s: any = g.scene.getScene('Rhythm');
        const active = g.scene.getScenes(true).map((x: any) => x.scene.key);
        return {
          active,
          present: active.includes('Rhythm'),
          notes: s?.notes?.length ?? 0,
          finished: s?.finished ?? null,
          songStarted: s?.songStarted ?? null,
          cityLabel: s?.cityLabel?.text ?? '',
        };
      });

      console.log(`[texture-resilience ${c.label}] blocked=${blocked.length}`, JSON.stringify(state));
      expect(blocked.length, `expected to actually block ${c.label} — the pattern matched nothing`).toBeGreaterThan(0);
      expect(
        state.present,
        `Rhythm died with ${c.label} missing — landed on [${state.active.join(',')}]. ` +
        `A decorative texture must never take the scene down. pageerrors:\n${pageErrors.join('\n')}`,
      ).toBe(true);
      expect(state.notes, 'the chart should still have loaded with art missing').toBeGreaterThan(0);
      expect(state.songStarted, 'the song should have actually started').toBe(true);
      expect(state.finished, 'the song must not have finished itself').toBe(false);
      expect(
        pageErrors,
        `a missing texture threw instead of degrading:\n${pageErrors.join('\n')}`,
      ).toEqual([]);
    });
  }

  test('a minigame still plays with its painted background failing to load', async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.route('**/bg_mini_*', (route) => route.abort());

    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await page.evaluate(() => (window as any).__game.scene.stop('Title'));
    await startScene(page, 'MiniGame', { cityId: 'tokyo', minigameId: 'tok_pack_van', returnPhase: 'locations' });
    await waitForActiveScene(page, 'MiniGame', 15000);
    await page.waitForTimeout(3000);

    const state = await page.evaluate(() => {
      const g: any = (window as any).__game;
      const s: any = g.scene.getScene('MiniGame');
      const active = g.scene.getScenes(true).map((x: any) => x.scene.key);
      const countInteractive = (list: any[]): number => list.reduce((n: number, o: any) => (
        n + (o.input?.enabled ? 1 : 0) + (Array.isArray(o.list) ? countInteractive(o.list) : 0)
      ), 0);
      return {
        active,
        present: active.includes('MiniGame'),
        interactive: countInteractive(s?.children?.list ?? []),
      };
    });

    console.log('[texture-resilience minigame bg]', JSON.stringify(state));
    expect(state.present, `MiniGame died with its background missing — [${state.active.join(',')}]`).toBe(true);
    expect(state.interactive, 'the minigame should still be interactive with art missing').toBeGreaterThan(0);
    expect(pageErrors, `a missing texture threw instead of degrading:\n${pageErrors.join('\n')}`).toEqual([]);
  });
});
