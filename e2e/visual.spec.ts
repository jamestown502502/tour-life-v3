// Visual baselines: twelve screens compared pixel-for-pixel against approved reference images.
//
// Why (2026-10-08 review): eight shipped bugs were "the state says yes, the screen says no" —
// Settings active but drawn UNDER the minigame, meters growing downward, skies baked transparent,
// result sparks on the wrong lane. Every one passed a state assertion. A picture catches them.
//
// Determinism, or these would flake: Math.random is seeded (the van picks a random painting),
// the page runs on a fixed fake clock and is paused before every capture (page.clock), so the
// canvas is perfectly still and every tween is at the same point on every run.
//
// Baselines are Linux-only and are generated IN CI, never on a laptop (fonts and GPU rasterizing
// differ per OS). To approve new pictures after an intended visual change, run the
// "Update visual baselines" workflow on your branch; it commits the new PNGs for review.
import { test, expect, type Page } from './fixtures';
import { skipFirstTimeOnboarding, waitForActiveScene } from './helpers';

test.skip(process.platform !== 'linux' && !process.env.VISUAL_LOCAL, 'visual baselines are Linux/CI-only; see the header');

const SCREENS: { name: string; key: string; data?: object; overlay?: string }[] = [
  { name: 'title', key: 'Title' },
  { name: 'opening', key: 'Opening' },
  { name: 'band-creator', key: 'BandCreator' },
  { name: 'route-plan', key: 'RoutePlan' },
  { name: 'hub', key: 'Hub' },
  { name: 'van', key: 'Van', data: { cityId: 'berlin' } },
  { name: 'city-berlin', key: 'City', data: { cityId: 'berlin', phase: 'arrival' } },
  { name: 'minigame-intro', key: 'MiniGame', data: { cityId: 'tokyo', minigameId: 'tok_pack_van', returnPhase: 'locations' } },
  { name: 'minigame-result', key: 'MiniGame', data: { cityId: 'tokyo', minigameId: 'tok_pack_van', returnPhase: 'locations' } },
  { name: 'settings-over-minigame', key: 'MiniGame', data: { cityId: 'lisbon', minigameId: 'lis_tune_by_ear', returnPhase: 'locations' }, overlay: 'Settings' },
  { name: 'rhythm-berlin', key: 'Rhythm', data: { cityId: 'berlin' } },
  { name: 'scrapbook', key: 'Scrapbook', data: {} },
];

async function play(page: Page, ms: number): Promise<void> {
  for (let t = 0; t < ms; t += 100) await page.clock.runFor(Math.min(100, ms - t));
}

test('twelve screens match their approved baselines', async ({ page }) => {
  test.setTimeout(300000);
  await skipFirstTimeOnboarding(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('tourlife.seenRhythmTutorial', '1');
    let a = 0x2f6b9e1d;                                // mulberry32: same "random" every run
    Math.random = () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  await page.clock.install({ time: new Date('2026-01-15T12:00:00Z') });
  await page.goto('/');
  await waitForActiveScene(page, 'Title', 30000);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 3000));
  await page.evaluate(() => {
    const S: any = (window as any).__state;
    S.newRun('visual-baseline');
    S.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because CI said so', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = [{ cityId: 'berlin', visited: false }, { cityId: 'tokyo', visited: false }];
    S.data.currentCityIndex = 0;
  });

  for (const s of SCREENS) {
    await page.evaluate(({ key, data }) => {
      const g: any = (window as any).__game;
      // every scene, not just running ones: a PAUSED scene (under Settings) is still drawn
      for (const sc of g.scene.getScenes(false)) if (sc.scene.key !== 'Transition' && (sc.sys.isActive() || sc.sys.isPaused() || sc.sys.isSleeping())) g.scene.stop(sc.scene.key);
      g.scene.start(key, data);
    }, { key: s.key, data: s.data });
    await play(page, 1500);                            // past every fade-in and transition
    if (s.name === 'minigame-result') {
      await page.evaluate(() => (window as any).__game.scene.getScene('MiniGame').finish(true));
      await play(page, 2000);
    }
    if (s.overlay) {
      await page.evaluate(({ key, overlay }) => {
        const opener: any = (window as any).__game.scene.getScene(key);
        opener.scene.launch(overlay, { returnTo: key });  // exactly what the gear button does
        opener.scene.pause();
      }, { key: s.key, overlay: s.overlay });
      await play(page, 1000);
    }
    await expect.soft(page.locator('canvas').first(), `${s.name} looks different from its baseline`)
      .toHaveScreenshot(`${s.name}.png`, { maxDiffPixelRatio: 0.01 });
  }
});
