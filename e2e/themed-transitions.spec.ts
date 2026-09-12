// Themed transitions (2026-09-12 QA pass): the persistent TransitionScene must (1) play every
// theme to completion and leave zero children behind, (2) never own an interactive object,
// (3) survive a double-tap on a themed edge with a single scene start, and (4) collapse to the
// plain fade under reduced motion. This is the transition-leak assertion pattern from
// docs/TESTING_PROCEDURES.md applied to the new layer.
import { test, expect } from '@playwright/test';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene, waitForCondition, collectConsoleErrors, buildSeedState, canvasClick } from './helpers';

const THEMES = ['drive', 'ticket', 'card', 'lights', 'vinyl', 'pages'];

test.describe('TransitionScene', () => {
  test.beforeEach(async ({ page }) => { await skipFirstTimeOnboarding(page); });

  test('every theme completes, leaves no children, and never creates an interactive object', async ({ page }) => {
    test.setTimeout(90000);
    const errors = collectConsoleErrors(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    const launched = await page.evaluate(() => {
      const t = (window as any).__game.scene.getScene('Transition');
      return !!t && t.scene.isActive();
    });
    expect(launched).toBe(true);
    for (const theme of THEMES) {
      const r = await page.evaluate(async (th) => {
        const g = (window as any).__game;
        const t = g.scene.getScene('Transition');
        let interactiveSeen = false;
        let maxChildren = 0;
        let covered = false;
        t.play(th, 'Test label', () => { covered = true; });
        const t0 = performance.now();
        while (t.isPlaying && performance.now() - t0 < 6000) {
          maxChildren = Math.max(maxChildren, t.childCount);
          const walk = (list: any[]): void => { for (const o of list) { if (o.input && o.input.enabled) interactiveSeen = true; if (o.list) walk(o.list); } };
          walk(t.children.list);
          await new Promise((res) => requestAnimationFrame(res));
        }
        return { theme: th, finished: !t.isPlaying, covered, maxChildren, interactiveSeen, left: t.childCount, elapsed: performance.now() - t0 };
      }, theme);
      expect(r.finished, `${theme} finished`).toBe(true);
      expect(r.covered, `${theme} called onCovered`).toBe(true);
      expect(r.maxChildren, `${theme} drew something`).toBeGreaterThan(0);
      expect(r.left, `${theme} left nothing behind`).toBe(0);
      expect(r.interactiveSeen, `${theme} never interactive`).toBe(false);
    }
    expect(errors).toEqual([]);
  });

  test('a double-tap on the themed Hub → Van edge starts Van exactly once', async ({ page }) => {
    test.setTimeout(90000);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await page.evaluate((seed) => {
      const g = (window as any).__game; const S = (window as any).__state;
      g.scene.stop('Title');
      S.data = seed;
      g.scene.start('Hub');
    }, buildSeedState({ screen: 'hub' }));
    await waitForActiveScene(page, 'Hub', 10000);
    await page.waitForTimeout(500);
    let vanCreates = 0;
    await page.exposeFunction('__vanCreated', () => { vanCreates += 1; });
    await page.evaluate(() => {
      const g = (window as any).__game;
      const van = g.scene.getScene('Van');
      van.events.on('create', () => (window as any).__vanCreated());
    });
    // Two taps on the travel button within the same frame pair.
    const box = (await page.locator('canvas').boundingBox())!;
    const px = box.x + (360 / 720) * box.width, py = box.y + (853 / 1280) * box.height;
    await page.mouse.click(px, py);
    await page.mouse.click(px, py, { delay: 10 });
    const ok = await waitForCondition(page, () => (window as any).__game.scene.getScenes(true).some((s: any) => s.scene.key === 'Van'), 8000);
    expect(ok).toBe(true);
    await page.waitForTimeout(1200);
    expect(vanCreates).toBe(1);
    const stray = await page.evaluate(() => (window as any).__game.scene.getScene('Transition').childCount);
    expect(stray).toBe(0);
    // Hub's input is re-enabled for its next visit (the cover-half flag never sticks).
    const hubInput = await page.evaluate(() => (window as any).__game.scene.getScene('Hub').input.enabled);
    expect(hubInput).toBe(true);
  });

  test('reduced motion collapses a themed edge to the plain fade', async ({ page }) => {
    test.setTimeout(60000);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    const seed = buildSeedState({ screen: 'hub' });
    (seed.accessibility as any).reducedMotion = true;
    await page.evaluate((sd) => {
      const g = (window as any).__game; const S = (window as any).__state;
      g.scene.stop('Title');
      S.data = sd;
      g.scene.start('Hub');
    }, seed);
    await waitForActiveScene(page, 'Hub', 10000);
    await page.waitForTimeout(600);
    const before = await page.evaluate(() => (window as any).__game.scene.getScene('Transition').played);
    await canvasClick(page, 360, 853); // Travel to <city>
    const ok = await waitForCondition(page, () => (window as any).__game.scene.getScenes(true).some((s: any) => s.scene.key === 'Van'), 8000);
    expect(ok).toBe(true);
    const after = await page.evaluate(() => (window as any).__game.scene.getScene('Transition').played);
    expect(after).toBe(before);
  });
});
