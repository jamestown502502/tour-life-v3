// Resubmission pass (2026-09-27).
//
// 1. Return-visit art: coming back to a city shows a different painted scene and stage (a new
//    hour, new weather, a fuller room). The art is fetched after the title screen, so the checks
//    wait for the background loader before asserting which texture each scene chose.
// 2. iPhone safe-area insets: Phaser's FIT measured a padded box (padding included), so the canvas
//    filled the whole screen and spilled under the notch. Playwright cannot produce real
//    env(safe-area-inset-*) values, so the insets are simulated by setting the same offsets.
import { test, expect, type Page } from '@playwright/test';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene, collectConsoleErrors } from './helpers';

async function waitForTexture(page: Page, key: string, timeoutMs = 30000) {
  await page.waitForFunction((k) => (window as any).__game.textures.exists(k), key, { timeout: timeoutMs });
}

/** Texture key of the largest image in a scene: its full-screen background. */
async function backgroundKey(page: Page, sceneKey: string): Promise<string> {
  return page.evaluate((sk) => {
    const s: any = (window as any).__game.scene.getScene(sk);
    const imgs = s.children.list.filter((o: any) => o.type === 'Image' && o.texture);
    imgs.sort((a: any, b: any) => b.displayWidth * b.displayHeight - a.displayWidth * a.displayHeight);
    return imgs[0]?.texture.key ?? '';
  }, sceneKey);
}

async function seedCity(page: Page, cityId: string, returning: boolean) {
  await page.evaluate(({ cityId, returning }) => {
    const S: any = (window as any).__state;
    S.newRun('return-art-e2e');
    S.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because CI said so', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = returning ? [{ cityId, visited: true }, { cityId, visited: false, revisit: true }] : [{ cityId, visited: false }];
    S.data.currentCityIndex = returning ? 1 : 0;
    S.data.cityMemories = returning ? [{ cityId, show: 'solid', love: 6, firstShowRecorded: true }] : [];
  }, { cityId, returning });
}

test.describe('return-visit art', () => {
  test.beforeEach(async ({ page }) => { await skipFirstTimeOnboarding(page); });

  test('a return visit paints a different city and stage than the first visit', async ({ page }) => {
    test.setTimeout(120000);
    const errors = collectConsoleErrors(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await waitForTexture(page, 'bg_city_lisbon_return');
    await waitForTexture(page, 'bg_rhythm_lisbon_return');
    await page.evaluate(() => (window as any).__game.scene.stop('Title'));

    await seedCity(page, 'lisbon', false);
    await page.evaluate(() => (window as any).__game.scene.start('City', { cityId: 'lisbon', phase: 'arrival' }));
    await waitForActiveScene(page, 'City', 15000);
    expect(await backgroundKey(page, 'City')).toBe('bg_city_lisbon');

    await seedCity(page, 'lisbon', true);
    await page.evaluate(() => (window as any).__game.scene.start('City', { cityId: 'lisbon', phase: 'arrival' }));
    await waitForActiveScene(page, 'City', 15000);
    await page.waitForTimeout(600);
    expect(await backgroundKey(page, 'City')).toBe('bg_city_lisbon_return');
    await page.screenshot({ path: 'docs/polish-before-after/return-visit-city.png' });

    // Results after a return show: the visit is handed over by Rhythm, because the show is already
    // recorded by the time Results opens (so re-deriving it would always say "return").
    await page.evaluate(() => (window as any).__game.scene.stop('City'));
    const result = { timingScore: 800, ratio: 0.8, grade: 'good', expressionChoices: [], crowdConnection: 60, unlockedFlags: [], judgementCounts: { perfect: 10, good: 5, ok: 2, miss: 1 } };
    await page.evaluate((r) => (window as any).__game.scene.start('Results', { cityId: 'lisbon', result: r, visit: 1 }), result);
    await waitForActiveScene(page, 'Results', 15000);
    expect(await backgroundKey(page, 'Results')).toBe('bg_rhythm_lisbon_return');
    await page.evaluate(() => (window as any).__game.scene.stop('Results'));
    await page.evaluate((r) => (window as any).__game.scene.start('Results', { cityId: 'lisbon', result: r, visit: 0 }), result);
    await waitForActiveScene(page, 'Results', 15000);
    expect(await backgroundKey(page, 'Results')).toBe('bg_rhythm_lisbon');

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('every newer minigame backdrop arrives through the background loader', async ({ page }) => {
    test.setTimeout(90000);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    const later: { key: string }[] = await page.evaluate(() => fetch('assets/manifest-later.json').then((r) => r.json()));
    expect(later.length).toBeGreaterThanOrEqual(26);
    for (const { key } of later) await waitForTexture(page, key, 45000);
    const tags = await page.evaluate((keys) => keys.map((k) => (window as any).__game.textures.get(k).source[0].image?.tagName), later.map((e) => e.key));
    // A loaded file's source is an <img>; a code-drawn fallback's is a <canvas>. Any CANVAS means
    // the fallback took the key before the real image landed.
    expect(tags.every((t: string) => t === 'IMG'), JSON.stringify(tags)).toBe(true);
  });
});

test.describe('iPhone safe-area insets', () => {
  test('with notch and home-indicator insets, the whole game stays on screen', async ({ page }) => {
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    // iPhone 14 portrait insets: 47px top, 34px bottom.
    // Same values index.html's env(safe-area-inset-*) would produce on that phone.
    await page.addStyleTag({ content: '#app { top: 47px !important; bottom: 34px !important; }' });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    const measure = () => page.evaluate(() => {
      const app = document.getElementById('app')!.getBoundingClientRect();
      const canvas = document.querySelector('canvas')!.getBoundingClientRect();
      return { vh: window.innerHeight, appH: app.height, top: canvas.top, bottom: canvas.bottom };
    });
    // Phaser re-reads its parent's size on a 500 ms interval (ScaleManager resizeInterval), so wait
    // for the refit rather than sleeping a fixed time. On a real iPhone the insets exist from load.
    await expect.poll(async () => (await measure()).top, { timeout: 5000 }).toBeGreaterThanOrEqual(47 - 0.5);
    const box = await measure();
    expect(box.appH, 'the game box must not be taller than the screen').toBeLessThanOrEqual(box.vh + 0.5);
    expect(box.top, 'canvas clear of the notch').toBeGreaterThanOrEqual(47 - 0.5);
    expect(box.bottom, 'canvas clear of the home indicator').toBeLessThanOrEqual(box.vh - 34 + 0.5);
  });
});
