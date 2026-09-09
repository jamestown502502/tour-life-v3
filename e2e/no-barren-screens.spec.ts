// Pre-public close-out, Part A3 — "no barren screens".
//
// Five scenes rendered on a flat navy rectangle instead of painted art: the opening beat, band
// creation, the route/promise screen, the scrapbook and its epilogue, and the van travel beats.
// Those are screens players LINGER on, and a bare one breaks the "single painted world" contract
// that carries the rest of the game.
//
// This asserts the property rather than the pixels: every full-screen scene must render a real
// painted background image, and no scene may fall back to a bare fill. It also captures a
// screenshot of each for the before/after record.
import { test, expect } from '@playwright/test';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene, collectConsoleErrors } from './helpers';

/** Scenes that own the whole screen and therefore need their own painted backdrop. Overlay scenes
 *  (Settings, HowToPlay) are deliberately excluded — they dim the scene behind instead, which is
 *  the standard overlay treatment and is asserted separately below. */
const FULL_SCREEN_SCENES: { key: string; data?: object; expectKey: string }[] = [
  { key: 'Title', expectKey: 'bg_title', data: undefined },
  { key: 'Opening', expectKey: 'bg_scene_opening' },
  { key: 'BandCreator', expectKey: 'bg_scene_bandcreator' },
  { key: 'RoutePlan', expectKey: 'bg_scene_routeplan' },
  { key: 'Hub', expectKey: 'bg_hub' },
  { key: 'Van', expectKey: 'bg_scene_van', data: { cityId: 'berlin' } },
  { key: 'City', expectKey: 'bg_city_berlin', data: { cityId: 'berlin', phase: 'arrival' } },
  { key: 'MiniGame', expectKey: 'bg_mini_tok_pack_van', data: { cityId: 'tokyo', minigameId: 'tok_pack_van', returnPhase: 'locations' } },
  { key: 'Rhythm', expectKey: 'bg_rhythm_berlin', data: { cityId: 'berlin' } },
  { key: 'Scrapbook', expectKey: 'bg_scene_scrapbook', data: {} },
];

/** Seeds enough run state that any scene can be started cold. */
async function seedRun(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const S: any = (window as any).__state;
    S.newRun('barren-check');
    S.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because CI said so', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = [{ cityId: 'berlin', visited: false }, { cityId: 'tokyo', visited: false }];
    S.data.currentCityIndex = 0;
  });
}

test.describe('No barren screens', () => {
  test('every full-screen scene renders a real painted backdrop', async ({ page }) => {
    test.setTimeout(300000);
    const errors = collectConsoleErrors(page);
    await skipFirstTimeOnboarding(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('tourlife.seenRhythmTutorial', '1');
    });
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await seedRun(page);

    const bare: string[] = [];
    for (const scene of FULL_SCREEN_SCENES) {
      await page.evaluate(({ key, data }) => {
        const g: any = (window as any).__game;
        for (const s of g.scene.getScenes(true)) if (s.scene.key !== key) g.scene.stop(s.scene.key);
        g.scene.start(key, data);
      }, { key: scene.key, data: scene.data });
      await waitForActiveScene(page, scene.key, 15000);
      await page.waitForTimeout(700);

      // A real backdrop is an Image whose texture is the expected key AND which is big enough to
      // cover the screen — that is exactly what addCoverBackground produces.
      // THE KEY ALONE PROVES NOTHING. ensureSceneBackdrop GENERATES a code-drawn texture under the
      // same key when the painted file is absent, so "the key exists" is true either way — the
      // first version of this test asserted exactly that and passed while production was rendering
      // flat gradient fallbacks on five screens. The painted assets are 1440x2560; every
      // code-drawn fallback is generated at the 720x1280 canvas size. Source width is what
      // actually distinguishes them.
      const found = await page.evaluate(({ key, expectKey }) => {
        const s: any = (window as any).__game.scene.getScene(key);
        const covers = (s?.children?.list ?? []).filter((o: any) =>
          o.type === 'Image' && o.displayWidth >= 700 && o.displayHeight >= 1200);
        const match = covers.find((o: any) => o.texture?.key === expectKey);
        const sourceW = match?.texture?.source?.[0]?.width ?? 0;
        return {
          keys: covers.map((o: any) => o.texture?.key),
          hasExpected: !!match,
          sourceW,
          isPainted: sourceW > 720,
          count: covers.length,
        };
      }, { key: scene.key, expectKey: scene.expectKey });

      console.log(`[barren] ${scene.key}: ${JSON.stringify(found)}`);
      if (!found.hasExpected) bare.push(`${scene.key}: expected ${scene.expectKey}, saw ${found.keys.join(',') || 'nothing'}`);
      else if (!found.isPainted) bare.push(`${scene.key}: rendering the CODE-DRAWN FALLBACK for ${scene.expectKey} (source ${found.sourceW}px wide, painted assets are 1440)`);
      await page.screenshot({ path: `docs/polish-before-after/scene-${scene.key.toLowerCase()}.png` });
    }

    expect(bare, `scenes still rendering without their painted backdrop:\n${bare.join('\n')}`).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('overlay scenes dim the scene behind rather than hiding it', async ({ page }) => {
    test.setTimeout(120000);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);

    // Settings and HowToPlay are launched OVER a scene (scene.launch), and a paused scene still
    // renders — so their full-screen fill must be translucent or the painted world behind is
    // thrown away and the overlay reads as one more bare navy screen. Both used to be effectively
    // opaque (0.98 and 0.85).
    for (const key of ['Settings', 'HowToPlay']) {
      // SceneManager.run is the manager-level equivalent of ScenePlugin.launch: it starts the
      // scene alongside the current one rather than replacing it.
      await page.evaluate((k) => (window as any).__game.scene.run(k, { returnTo: 'Title' }), key);
      await waitForActiveScene(page, key, 10000);
      await page.waitForTimeout(500);
      const alpha = await page.evaluate((k) => {
        const s: any = (window as any).__game.scene.getScene(k);
        const fills = (s?.children?.list ?? []).filter((o: any) => o.type === 'Rectangle' && o.width >= 700);
        return fills.length ? Math.max(...fills.map((o: any) => o.fillAlpha ?? o.alpha ?? 1)) : 1;
      }, key);
      console.log(`[overlay] ${key} backdrop alpha = ${alpha}`);
      expect(alpha, `${key} hides the scene behind instead of dimming it`).toBeLessThan(0.9);
      await page.screenshot({ path: `docs/polish-before-after/overlay-${key.toLowerCase()}.png` });
      await page.evaluate((k) => (window as any).__game.scene.stop(k), key);
    }
  });
});
