// Enter, leave, enter again. Phaser reuses scene INSTANCES, so a collection field initialised at
// declaration survives into the next visit holding destroyed objects from the last one (memory
// gotchas_phaser_code_drawn #3). Found by scripts/gotcha-guard.mjs on 2026-10-08: How to Play's
// page dots — on the second open the visible dots sat after the dead ones, so none ever lit up.
import { test, expect } from './fixtures';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene } from './helpers';

test('How to Play lights the current page dot on every visit, not just the first', async ({ page }) => {
  await skipFirstTimeOnboarding(page);
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);

  for (const visit of [1, 2]) {
    await page.evaluate(() => {
      const title: any = (window as any).__game.scene.getScene('Title');
      title.scene.launch('HowToPlay', { returnTo: 'Title' });
    });
    await waitForActiveScene(page, 'HowToPlay', 10000);
    await page.waitForTimeout(300);
    const dots = await page.evaluate(() => {
      const s: any = (window as any).__game.scene.getScene('HowToPlay');
      s.go(1);                                         // page 2
      return {
        total: s.dots.length,
        lit: s.dots.filter((d: any) => d.active && d.visible && d.fillAlpha === 1).length,
        litIndex: s.dots.findIndex((d: any) => d.fillAlpha === 1),
        page: s.page,
      };
    });
    expect(dots.lit, `visit ${visit}: exactly one live dot is lit (${JSON.stringify(dots)})`).toBe(1);
    expect(dots.litIndex, `visit ${visit}: the lit dot is the current page`).toBe(dots.page);
    await page.evaluate(() => (window as any).__game.scene.getScene('HowToPlay').close());
    await page.waitForTimeout(500);
  }
});
