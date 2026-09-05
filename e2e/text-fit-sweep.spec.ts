// Final Polish Addendum v2, Item 6 — the per-screen screenshot sweep half of "make garbled text
// impossible" (scripts/text-fit-audit.mjs is the content-string half). Visits every major screen
// at 390x844 (the same measurement viewport the rest of this codebase's touch-target/contrast
// audits use), screenshots each as a CI artifact, and asserts every button label actually has
// non-zero rendered bounds — a real assertion that Button.ts's wordWrap/shrink fix produced a
// laid-out, visible label, not just "the scene didn't crash."
import { test, expect, type Page } from '@playwright/test';
import { bootGame, skipFirstTimeOnboarding } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

async function seedRun(page: Page, cityId: string): Promise<void> {
  await page.evaluate((cityId) => {
    const State = (window as any).__state;
    State.newRun(`textfit-sweep-${cityId}`);
    State.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'x', members: ['mira', 'theo', 'jun', 'rowan'] };
    State.data.route = [{ cityId, visited: false, weather: 'clear' }];
    State.data.currentCityIndex = 0;
    State.data.flags = ['onboard_hub_seen', 'onboard_routeplan_seen'];
  }, cityId);
}

/** Every visible button label in the active scene(s) has non-zero width/height — a real,
 *  structural check that text actually laid out (a garbled/zero-sized label would fail this),
 *  not just "no console error." */
async function assertLabelsHaveBounds(page: Page): Promise<void> {
  const bad = await page.evaluate(() => {
    const g = (window as any).__game;
    const problems: string[] = [];
    for (const scene of g.scene.getScenes(true)) {
      const walk = (container: any) => {
        if (!container?.list) return;
        for (const child of container.list) {
          if (child?.type === 'Text' && child.visible !== false) {
            const b = child.getBounds?.();
            if (b && (b.width <= 0 || b.height <= 0) && child.text?.trim()) {
              problems.push(`${scene.scene.key}: text "${child.text.slice(0, 30)}" has zero bounds`);
            }
          }
          if (child?.list) walk(child);
        }
      };
      walk(scene.children);
    }
    return problems;
  });
  expect(bad, bad.join('\n')).toEqual([]);
}

test.describe('Item 6 — per-screen text-fit sweep at 390x844', () => {
  test('Title', async ({ page }) => {
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await page.waitForTimeout(300);
    await assertLabelsHaveBounds(page);
    await page.screenshot({ path: 'docs/polish-before-after/sweep-390-title.png' });
  });

  test('Hub', async ({ page }) => {
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await seedRun(page, 'lisbon');
    await page.evaluate(() => {
      (window as any).__game.scene.stop('Title');
      (window as any).__game.scene.start('Hub');
    });
    await page.waitForTimeout(300);
    await assertLabelsHaveBounds(page);
    await page.screenshot({ path: 'docs/polish-before-after/sweep-390-hub.png' });
  });

  test('City — location picker (the exact reported bug screen, Berlin)', async ({ page }) => {
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await seedRun(page, 'berlin');
    await page.evaluate(() => {
      (window as any).__game.scene.stop('Title');
      (window as any).__game.scene.start('City', { cityId: 'berlin' });
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => (window as any).__game.scene.getScene('City').renderLocationButtons());
    await page.waitForTimeout(300);
    await assertLabelsHaveBounds(page);
    await page.screenshot({ path: 'docs/polish-before-after/sweep-390-city-locations-berlin.png' });
  });

  test('City — preshow choices (Mexico City, the longest labels)', async ({ page }) => {
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await seedRun(page, 'mexico_city');
    await page.evaluate(() => {
      (window as any).__game.scene.stop('Title');
      (window as any).__game.scene.start('City', { cityId: 'mexico_city' });
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => (window as any).__game.scene.getScene('City').renderPreShowChoices?.());
    await page.waitForTimeout(300);
    await assertLabelsHaveBounds(page);
    await page.screenshot({ path: 'docs/polish-before-after/sweep-390-city-preshow-mexico.png' });
  });

  test('MiniGame — Interview choice options (Mexico City, the originally reported class)', async ({ page }) => {
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await seedRun(page, 'mexico_city');
    await page.evaluate(() => {
      (window as any).__game.scene.stop('Title');
      (window as any).__game.scene.start('MiniGame', { cityId: 'mexico_city', minigameId: 'mex_interview', returnPhase: 'locations' });
    });
    await page.waitForTimeout(500);
    // Skip past the intro card to the question/options screen if the scene needs a tap first.
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (box) await canvas.click({ position: { x: box.width / 2, y: box.height * 0.4 }, force: true });
    await page.waitForTimeout(400);
    await assertLabelsHaveBounds(page);
    await page.screenshot({ path: 'docs/polish-before-after/sweep-390-minigame-interview.png' });
  });

  test('Rhythm', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('tourlife.seenRhythmTutorial', '1'));
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await seedRun(page, 'lisbon');
    await page.evaluate(() => {
      (window as any).__game.scene.stop('Title');
      (window as any).__game.scene.start('Rhythm', { cityId: 'lisbon' });
    });
    await page.waitForTimeout(500);
    await assertLabelsHaveBounds(page);
    await page.screenshot({ path: 'docs/polish-before-after/sweep-390-rhythm.png' });
  });

  test('Settings', async ({ page }) => {
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await page.evaluate(() => {
      // scene.launch() is a per-scene ScenePlugin method (this.scene.launch(...), as
      // TitleScene.ts's real Settings button calls it) — not available on the global manager.
      (window as any).__game.scene.getScene('Title').scene.launch('Settings', { returnTo: 'Title' });
    });
    await page.waitForTimeout(300);
    await assertLabelsHaveBounds(page);
    await page.screenshot({ path: 'docs/polish-before-after/sweep-390-settings.png' });
  });

  test('HowToPlay', async ({ page }) => {
    await bootGame(page); // deliberately no skipFirstTimeOnboarding — this is the screen it auto-opens
    await page.waitForTimeout(300);
    await assertLabelsHaveBounds(page);
    await page.screenshot({ path: 'docs/polish-before-after/sweep-390-howtoplay.png' });
  });
});
