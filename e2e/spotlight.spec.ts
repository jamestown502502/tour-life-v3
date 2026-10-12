// Publisher polish (2026-10-12): the Spotlight Bridge, end to end on the real build, and the stage
// readability rule (nothing drawn over the hit line).
//
// Offer -> answer -> show -> bridge -> Results line. To reach the bridge without waiting out the
// song, the test moves the show's start time back (the scene clock the chart is judged against);
// notes before the bridge grade as misses, which no assertion here cares about.
import { test, expect, type Page } from './fixtures';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene, startScene, answerSpotlightOffer, clickPreShowChoice, pressPlay, waitForCondition } from './helpers';

const HIT_LINE_Y = 980;

async function seedBerlin(page: Page) {
  await page.evaluate(() => {
    const g: any = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => s.sys.settings.key !== 'Transition' && g.scene.stop(s.sys.settings.key));
    const S: any = (window as any).__state;
    S.newRun('spotlight-e2e');
    S.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because CI said so', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = [{ cityId: 'berlin', visited: false }, { cityId: 'tokyo', visited: false }];
    S.data.currentCityIndex = 0;
    S.data.relationships = { mira: 70, theo: 40, jun: 40, rowan: 40 };
    S.data.accessibility.autoplay = true;
  });
  await startScene(page, 'City', { cityId: 'berlin', phase: 'preshow-choices' });
  await waitForActiveScene(page, 'City', 10000);
}

/** Moves the show to `chartSeconds` into the chart. */
async function jumpTo(page: Page, chartSeconds: number) {
  await page.evaluate((sec) => {
    const r: any = (window as any).__game.scene.getScene('Rhythm');
    const t = (r.time.now - r.startTime) / 1000;
    r.startTime -= (sec - t) * 1000;
  }, chartSeconds);
}

/** Every text on the stage right now that reaches into the band 40 px either side of the hit line. */
async function textsOnHitLine(page: Page): Promise<string[]> {
  return page.evaluate((hit) => {
    const r: any = (window as any).__game.scene.getScene('Rhythm');
    const out: string[] = [];
    const walk = (list: any[]) => {
      for (const o of list) {
        if (o.type === 'Text' && o.visible && o.alpha > 0.05) {
          const b = o.getBounds();
          if (b.bottom > hit - 40 && b.top < hit + 40) out.push(`${o.text} @${Math.round(b.top)}-${Math.round(b.bottom)}`);
        }
        if (o.list) walk(o.list);
      }
    };
    walk(r.children.list);
    return out;
  }, HIT_LINE_Y);
}

/** Play, then wait for the real song: a first-ever show runs the tutorial's practice pass first,
 *  which on a slow WebKit runner outlasts pressPlay's own wait. */
async function startSong(page: Page) {
  await pressPlay(page, 30000);
  const started = await waitForCondition(page, () => !!(window as any).__game.scene.getScene('Rhythm').songStarted, 60000);
  if (!started) await pressPlay(page, 30000);
  expect(await waitForCondition(page, () => !!(window as any).__game.scene.getScene('Rhythm').songStarted, 30000)).toBe(true);
}

test.beforeEach(async ({ page }) => { await skipFirstTimeOnboarding(page); });

test('given the bridge: the offer, the bridge on stage, the Results line', async ({ page }) => {
  test.setTimeout(240000);
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  await seedBerlin(page);
  expect(await waitForCondition(page, () => !!(window as any).__game.scene.getScene('City').children.getByName('spotlightOffer'), 10000)).toBe(true);
  await page.screenshot({ path: 'test-results/spotlight-offer.png' });
  expect(await answerSpotlightOffer(page, true)).toBe(true);
  const rec = await page.evaluate(() => (window as any).__state.data.spotlights);
  expect(rec).toEqual([{ cityId: 'berlin', visit: 0, mate: 'mira', accepted: true }]);

  await clickPreShowChoice(page, 0);
  await waitForActiveScene(page, 'Rhythm', 15000);
  await startSong(page);
  const plan = await page.evaluate(() => (window as any).__game.scene.getScene('Rhythm').spotPlan);
  expect(plan).toMatchObject({ mate: 'mira', treatment: 'intimate' });

  await jumpTo(page, plan.start - 2);
  expect(await waitForCondition(page, () => !!(window as any).__game.scene.getScene('Rhythm').children.getByName('spotlightRoot'), 8000)).toBe(true);
  // Through the bridge with autoplay hitting every note: no judgement or caption text on the hit line.
  for (let i = 0; i < 20; i++) {
    expect(await textsOnHitLine(page)).toEqual([]);
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: 'test-results/spotlight-bridge.png' });

  await jumpTo(page, plan.end + 1);
  expect(await waitForCondition(page, () => !(window as any).__game.scene.getScene('Rhythm').children.getByName('spotlightRoot'), 5000)).toBe(true);
  // To the end of the song: Results says what the bridge did.
  await page.evaluate(() => {
    const r: any = (window as any).__game.scene.getScene('Rhythm');
    r.startTime -= (r.longestNoteEndSeconds() + 2) * 1000;
  });
  await waitForActiveScene(page, 'Results', 20000);
  const said = await waitForCondition(page, () => {
    const s: any = (window as any).__game.scene.getScene('Results');
    return s.children.list.some((o: any) => o.type === 'Text' && String(o.text).startsWith('Mira took the bridge quiet'));
  }, 10000);
  expect(said).toBe(true);
  await page.screenshot({ path: 'test-results/spotlight-results.png' });
});

test('kept as rehearsed: no bridge on stage, and Results says so', async ({ page }) => {
  test.setTimeout(240000);
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  await seedBerlin(page);
  await waitForCondition(page, () => !!(window as any).__game.scene.getScene('City').children.getByName('spotlightOffer'), 10000);
  expect(await answerSpotlightOffer(page, false)).toBe(true);
  await clickPreShowChoice(page, 0);
  await waitForActiveScene(page, 'Rhythm', 15000);
  await startSong(page);
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('Rhythm').spotPlan)).toBeNull();
  await page.evaluate(() => {
    const r: any = (window as any).__game.scene.getScene('Rhythm');
    r.startTime -= (r.longestNoteEndSeconds() + 2) * 1000;
  });
  await waitForActiveScene(page, 'Results', 20000);
  expect(await waitForCondition(page, () => (window as any).__game.scene.getScene('Results').children.list
    .some((o: any) => o.type === 'Text' && String(o.text).startsWith('You kept the bridge as rehearsed')), 10000)).toBe(true);
});
