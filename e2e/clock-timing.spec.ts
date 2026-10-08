// Timing-sensitive checks on Playwright's FAKE clock (page.clock), not on the runner's wall clock.
//
// Why (2026-10-08 review): every timing flake this project has had was a test measuring how fast
// the machine was — a fixed sleep that was long enough on a quiet PC and too short on a loaded CI
// runner (double-start Continue, Lisbon Load-In, the hit-stop probe). page.clock fakes
// requestAnimationFrame, setTimeout and performance.now for the page, and Phaser's loop runs on
// rAF, so the game advances exactly as far as the test says: runFor(600) is 600 ms of game time on
// any machine, however slow.
//
// Rules for this file: install the clock BEFORE goto (Playwright requirement), boot on flowing
// time, then pauseAt and drive with small runFor steps (runFor fires every frame in between;
// fastForward does not).
import { test, expect, type Page } from './fixtures';
import { skipFirstTimeOnboarding, waitForActiveScene } from './helpers';

async function bootPaused(page: Page): Promise<void> {
  await skipFirstTimeOnboarding(page);
  await page.clock.install();
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__game?.scene.getScenes(true).length, null, { timeout: 30000 });
  await waitForActiveScene(page, 'Title', 30000);
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 3000);       // margin: the round trip itself takes time on a slow runner
}

/** Advance game time in one-frame steps so every rAF tick and timer in between fires. */
async function play(page: Page, ms: number): Promise<void> {
  for (let t = 0; t < ms; t += 100) await page.clock.runFor(Math.min(100, ms - t));
}

const continueReady = (page: Page) => page.evaluate(() => {
  const s: any = (window as any).__game.scene.getScene('MiniGame');
  const walk = (list: any[]): boolean => list.some((o: any) => Array.isArray(o.list)
    && ((o.list.some((c: any) => c.type === 'Text' && String(c.text ?? '').includes('Continue'))
      && o.list.some((c: any) => c.input?.enabled)) || walk(o.list)));
  return walk(s.children.list);
});

test('Phaser runs on the fake clock: frozen while paused, exact when advanced', async ({ page }) => {
  await bootPaused(page);
  const frame = () => page.evaluate(() => (window as any).__game.loop.frame as number);
  const f0 = await frame();
  await page.waitForTimeout(1000);                    // real time passes, game time does not
  expect(await frame(), 'the game kept running while the clock was paused').toBe(f0);
  await play(page, 1000);                             // one second of game time
  const advanced = (await frame()) - f0;
  expect(advanced, `1s of game time ran ${advanced} frames`).toBeGreaterThan(30);
});

test('a minigame Continue is inert for its first 600 ms of game time, then works', async ({ page }) => {
  await bootPaused(page);
  await page.evaluate(() => {
    const g: any = (window as any).__game;
    g.scene.stop('Title');
    g.scene.start('MiniGame', { cityId: 'tokyo', minigameId: 'tok_pack_van', returnPhase: 'locations' });
  });
  await play(page, 800);
  await waitForActiveScene(page, 'MiniGame', 5000);
  await page.evaluate(() => (window as any).__game.scene.getScene('MiniGame').finish(true));
  await play(page, 300);
  expect(await continueReady(page), 'Continue accepted taps before 600 ms (a stray tap skips the result card)').toBe(false);
  await play(page, 700);
  expect(await continueReady(page), 'Continue never woke up').toBe(true);
});

test('back-to-back hit-stops return the clock to full speed (exact game time)', async ({ page }) => {
  await bootPaused(page);
  await page.evaluate(() => {
    const g: any = (window as any).__game;
    (window as any).__state.newRun('hitstop');
    g.scene.stop('Title');
    g.scene.start('MiniGame', { cityId: 'lisbon', minigameId: 'lis_door_deal', returnPhase: 'locations' });
  });
  await play(page, 500);
  await page.evaluate(() => (window as any).__game.scene.getScene('MiniGame')
    .settleLedger({ tier: 'perfect', funds: 3, label: 'probe', explain: 'probe' }));
  await play(page, 150);                              // the second stop lands inside the first
  await page.evaluate(() => (window as any).__game.scene.getScene('MiniGame').finish(true, true));
  await play(page, 1500);
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('MiniGame').time.timeScale)).toBe(1);
});
