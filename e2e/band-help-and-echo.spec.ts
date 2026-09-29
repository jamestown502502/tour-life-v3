// Bandmates change the game (rapport help) and money decisions echo later (2026-09-29), driven
// through the real scenes.
import { test, expect, type Page } from '@playwright/test';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene, collectConsoleErrors, canvasClick } from './helpers';

async function seedRun(page: Page, rel: number, ledger: unknown[] = []) {
  await page.evaluate(({ rel, ledger }) => {
    const S: any = (window as any).__state;
    S.newRun('band-help-e2e');
    S.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because CI said so', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = [{ cityId: 'lisbon', visited: true }, { cityId: 'tokyo', visited: false }];
    S.data.currentCityIndex = 1;
    S.data.relationships = { mira: rel, theo: rel, jun: rel, rowan: rel };
    S.data.ledger = ledger;
  }, { rel, ledger });
}

/** Every text in the minigame's content layer, plus how many answer buttons are greyed out. */
async function readMinigame(page: Page) {
  return page.evaluate(() => {
    const s: any = (window as any).__game.scene.getScene('MiniGame');
    const list: any[] = s.contentLayer.list;
    const texts = list.filter((o) => o.type === 'Text').map((o) => String(o.text));
    const buttons = list.filter((o) => o.type === 'Container');
    const labels = buttons.map((b: any) => (b.list.find((c: any) => c.type === 'Text')?.text ?? '') + (b.visible ? '' : ' [hidden]'));
    return { texts, labels, dimmed: buttons.filter((b: any) => b.alpha < 0.6).length };
  });
}

/** Transpose always offers three chords, so a hint has a wrong one it can grey out. */
async function openTransposeGame(page: Page) {
  await page.evaluate(() => (window as any).__game.scene.stop('Title'));
  await page.evaluate(() => (window as any).__game.scene.start('MiniGame', { cityId: 'lisbon', minigameId: 'lis_step_down', returnPhase: 'arrival' }));
  await waitForActiveScene(page, 'MiniGame', 15000);
  await page.waitForTimeout(500);
  await canvasClick(page, 360, 533); // Start
  await page.waitForTimeout(700);
}

test.describe('bandmates change the game', () => {
  test.beforeEach(async ({ page }) => { await skipFirstTimeOnboarding(page); });

  test('close: Mira helps unasked and greys out a wrong chord', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await seedRun(page, 40);
    await openTransposeGame(page);
    const m = await readMinigame(page);
    expect(m.texts.join(' | ')).toContain('Mira · close');
    expect(m.texts.join(' | ')).toContain('Same shape');
    expect(m.dimmed).toBe(1);
    expect(m.labels.some((l) => l.startsWith('Ask '))).toBe(false);
    await page.screenshot({ path: 'docs/polish-before-after/band-help-close.png' });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('steady: one "Ask Mira", which helps once and then disappears', async ({ page }) => {
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await seedRun(page, 20);
    await openTransposeGame(page);
    let m = await readMinigame(page);
    expect(m.texts.join(' | ')).toContain('Mira · steady');
    expect(m.labels).toContain('Ask Mira');
    expect(m.dimmed).toBe(0);
    await canvasClick(page, 612, 349); // Ask Mira (W-196..W-20, 320..378)
    await page.waitForTimeout(300);
    m = await readMinigame(page);
    expect(m.dimmed).toBe(1);
    expect(m.labels).toContain('Ask Mira [hidden]');
  });

  test('distant: Mira keeps to themselves, no help', async ({ page }) => {
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await seedRun(page, 5);
    await openTransposeGame(page);
    const m = await readMinigame(page);
    expect(m.texts.join(' | ')).toContain('Mira · distant');
    expect(m.texts.join(' | ')).toContain("You're on your own");
    expect(m.dimmed).toBe(0);
  });
});

test.describe('money decisions echo later', () => {
  test.beforeEach(async ({ page }) => { await skipFirstTimeOnboarding(page); });

  test('the next drive brings back a Lisbon door deal, applies it once, and saves it as echoed', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await seedRun(page, 20, [{ cityId: 'lisbon', label: 'Door split, $540', funds: 12, type: 'split', tier: 'perfect' }]);
    const before = await page.evaluate(() => (window as any).__state.data.stats.inspiration);
    await page.evaluate(() => (window as any).__game.scene.stop('Title'));
    await page.evaluate(() => (window as any).__game.scene.start('Van', { cityId: 'tokyo' }));
    await waitForActiveScene(page, 'Van', 15000);
    const after = await page.evaluate(() => (window as any).__state.data.stats.inspiration);
    expect(after - before).toBe(3);
    expect(await page.evaluate(() => (window as any).__state.data.ledger[0].echoed)).toBe(true);
    // Replaying the drive (a resume) does not apply it again.
    await page.evaluate(() => { const g: any = (window as any).__game; g.scene.stop('Van'); g.scene.start('Van', { cityId: 'tokyo' }); });
    await waitForActiveScene(page, 'Van', 15000);
    expect(await page.evaluate(() => (window as any).__state.data.stats.inspiration)).toBe(after);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('the Scrapbook has a "What the ledger taught us" page with the lesson', async ({ page }) => {
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await seedRun(page, 20, [
      { cityId: 'lisbon', label: 'Door split, $540', funds: 12, type: 'split', tier: 'perfect', echoed: true },
      { cityId: 'tokyo', label: 'Merch, +$210', funds: 21, type: 'pricing', tier: 'good' },
    ]);
    await page.evaluate(() => { const g: any = (window as any).__game; g.scene.stop('Title'); g.scene.start('Scrapbook'); });
    await waitForActiveScene(page, 'Scrapbook', 15000);
    await page.waitForTimeout(400);
    await canvasClick(page, 360, 1023); // What the ledger taught us
    await page.waitForTimeout(400);
    const panel = await page.evaluate(() => {
      const s: any = (window as any).__game.scene.getScene('Scrapbook');
      const c = s.children.getByName('ledgerPanel');
      return c ? c.list.filter((o: any) => o.type === 'Text').map((o: any) => String(o.text)).join(' | ') : null;
    });
    expect(panel).toContain('What the ledger taught us');
    expect(panel).toContain('Door split, $540 (Lisbon)');
    expect(panel).toContain('break-even');
    expect(panel).toContain('margin');
    await page.screenshot({ path: 'docs/polish-before-after/ledger-lessons.png' });
  });
});
