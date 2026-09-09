// The return leg: arriving in a city the band has already played shows what that town posted
// about the first night, before the night's dialogue starts.
//
// Driven through the real CityScene arrival path (not by calling showSocialFeed directly), because
// the thing worth guarding is the WIRING: memory is read, the feed appears once, dismissing it
// hands off to the arrival dialogue, and a first visit is completely unaffected.
import { test, expect } from '@playwright/test';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene, collectConsoleErrors } from './helpers';

/** Seeds a run that has already played Tokyo, and is now arriving there for the second time. */
async function seedReturnToTokyo(page: import('@playwright/test').Page, show: string, minigameGood: boolean | null) {
  await page.evaluate(({ show, minigameGood }) => {
    const S: any = (window as any).__state;
    S.newRun('return-leg-e2e');
    S.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because CI said so', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = [
      { cityId: 'tokyo', visited: true },
      { cityId: 'tokyo', visited: false, revisit: true },
    ];
    S.data.currentCityIndex = 1;
    const mem: any = { cityId: 'tokyo', show, love: 6, firstShowRecorded: true };
    if (minigameGood !== null) { mem.minigameGood = minigameGood; mem.minigameTitle = 'Pack the Van'; }
    S.data.cityMemories = [mem];
  }, { show, minigameGood });
}

/** Every post currently on screen, read off the feed container's own text objects. */
async function readFeed(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const s: any = (window as any).__game.scene.getScene('City');
    const feed = s.children.list.find((o: any) => o.depth === 120 && Array.isArray(o.list));
    if (!feed) return null;
    return feed.list.filter((o: any) => o.type === 'Text').map((t: any) => String(t.text));
  });
}

test.describe('Return leg — the town remembers the first night', () => {
  test.beforeEach(async ({ page }) => { await skipFirstTimeOnboarding(page); });

  test('a return visit opens with the social feed, and it reflects that city\'s actual first night', async ({ page }) => {
    test.setTimeout(120000);
    const errors = collectConsoleErrors(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await page.evaluate(() => (window as any).__game.scene.stop('Title'));
    await seedReturnToTokyo(page, 'rough', false);

    await page.evaluate(() => (window as any).__game.scene.start('City', { cityId: 'tokyo', phase: 'arrival' }));
    await waitForActiveScene(page, 'City', 15000);
    await page.waitForTimeout(1200);

    const feed = await readFeed(page);
    console.log('[return-leg feed]', JSON.stringify(feed, null, 1));
    expect(feed, 'the return leg should open with a social feed').not.toBeNull();
    const joined = feed!.join(' ');
    expect(joined, 'the feed should name the city').toContain('Tokyo');
    expect(joined, 'no unsubstituted template placeholder').not.toContain('{city}');
    // Four posts, each with a handle line and a body line, plus the two headings and the button.
    expect(feed!.filter((t) => t.startsWith('@')).length, 'four posts, four handles').toBe(4);
    await page.screenshot({ path: 'docs/polish-before-after/return-leg-feed.png' });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('dismissing the feed hands off to the arrival dialogue', async ({ page }) => {
    test.setTimeout(120000);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await page.evaluate(() => (window as any).__game.scene.stop('Title'));
    await seedReturnToTokyo(page, 'triumph', true);
    await page.evaluate(() => (window as any).__game.scene.start('City', { cityId: 'tokyo', phase: 'arrival' }));
    await waitForActiveScene(page, 'City', 15000);
    await page.waitForTimeout(1200);

    // Press the feed's own button, as a tap would.
    const pressed = await page.evaluate(() => {
      const s: any = (window as any).__game.scene.getScene('City');
      const feed = s.children.list.find((o: any) => o.depth === 120 && Array.isArray(o.list));
      const btn = feed?.list.find((o: any) => Array.isArray(o.list) && o.list.some((c: any) => c.type === 'Text' && String(c.text).includes('Tonight')));
      const bg = btn?.list.find((c: any) => c.input?.enabled);
      if (!bg) return false;
      bg.emit('pointerdown');
      return true;
    });
    expect(pressed, 'the feed should have a dismiss button').toBe(true);
    await page.waitForTimeout(1200);

    const after = await page.evaluate(() => {
      const s: any = (window as any).__game.scene.getScene('City');
      return {
        feedGone: !s.children.list.some((o: any) => o.depth === 120 && Array.isArray(o.list)),
        dialogueVisible: !!s.dialogueBox?.container?.visible,
      };
    });
    expect(after.feedGone, 'the feed should close when dismissed').toBe(true);
    expect(after.dialogueVisible, 'the arrival dialogue should take over').toBe(true);
  });

  test('a FIRST visit shows no feed at all', async ({ page }) => {
    test.setTimeout(120000);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await page.evaluate(() => (window as any).__game.scene.stop('Title'));
    await page.evaluate(() => {
      const S: any = (window as any).__state;
      S.newRun('first-visit-e2e');
      S.data.route = [{ cityId: 'tokyo', visited: false }];
      S.data.currentCityIndex = 0;
      S.data.cityMemories = [];
    });
    await page.evaluate(() => (window as any).__game.scene.start('City', { cityId: 'tokyo', phase: 'arrival' }));
    await waitForActiveScene(page, 'City', 15000);
    await page.waitForTimeout(1200);

    expect(await readFeed(page), 'a city being played for the first time has nothing to report').toBeNull();
    const dialogueVisible = await page.evaluate(() =>
      !!(window as any).__game.scene.getScene('City').dialogueBox?.container?.visible);
    expect(dialogueVisible, 'a first visit goes straight to arrival dialogue').toBe(true);
  });
});
