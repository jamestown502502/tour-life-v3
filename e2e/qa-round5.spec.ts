// QA round 5 (Fiverr sheet "Issue Report Round 4", 2026-11-19): one check per tester row, plus the
// Theo -> Phillip rename and the fresh-tour rule.
import { test, expect, type Page } from './fixtures';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene, waitForCondition, clickButtonByLabel, canvasClick } from './helpers';

async function newRun(page: Page, seed = 'qa-round5-seed'): Promise<void> {
  await page.evaluate((seed) => {
    const S = (window as any).__state;
    S.newRun(seed);
    S.data.band = { name: 'Copper Atlas', genre: 'indie_rock', whyTour: 'A label finally said yes.', members: ['mira', 'phillip', 'jun', 'rowan'] };
    S.data.route = ['mexico_city', 'tokyo', 'lisbon', 'berlin'].map((cityId) => ({ cityId, visited: false, weather: 'clear' }));
    S.addFlag('onboard_hub_seen');
    S.addFlag('onboard_routeplan_seen');
  }, seed);
}

async function startOnly(page: Page, key: string, data?: object): Promise<void> {
  await page.evaluate(({ key, data }) => {
    const g: any = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => { if (s.scene.key !== 'Transition') g.scene.stop(s.scene.key); });
    g.scene.start(key, data);
  }, { key, data });
  await waitForActiveScene(page, key);
}

test.beforeEach(async ({ page }) => {
  await skipFirstTimeOnboarding(page);
  await page.addInitScript(() => localStorage.setItem('tourlife.seenRhythmTutorial', '1'));
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  await newRun(page);
});

test('#1 the guide page dots turn to their page', async ({ page }) => {
  await clickButtonByLabel(page, 'Title', 'How to Play');
  await waitForActiveScene(page, 'HowToPlay');
  const dot = await page.evaluate(() => { const d = (window as any).__game.scene.getScene('HowToPlay').dots[3]; return { x: d.x, y: d.y }; });
  await canvasClick(page, dot.x, dot.y);
  expect(await waitForCondition(page, () => (window as any).__game.scene.getScene('HowToPlay').page === 3, 3000)).toBe(true);
});

test('#2 Backspace in the band name field edits the name and stays on band setup', async ({ page }) => {
  await startOnly(page, 'BandCreator');
  await page.waitForTimeout(600);
  const field = page.locator('input').first();
  await field.click();
  await field.fill('Copper Atlass');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(800);
  expect(await field.inputValue()).toBe('Copper Atlas');
  expect(await page.evaluate(() => (window as any).__game.scene.isActive('BandCreator'))).toBe(true);
  expect(await page.evaluate(() => (window as any).__game.scene.isActive('Title'))).toBe(false);
});

test('#3 in a city, Tab reaches the Game menu first and Enter opens it', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit does not Tab to buttons by default (a macOS setting)');
  await startOnly(page, 'City', { cityId: 'mexico_city' });
  await page.waitForFunction(() => [...document.querySelectorAll('#a11y-buttons button')].some((b) => b.getAttribute('aria-label') === 'Game menu'), null, { timeout: 8000 });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Game menu');
  await page.keyboard.press('Enter');
  expect(await waitForCondition(page, () => (window as any).__game.scene.isActive('Settings'), 4000)).toBe(true);
});

test('#4 per diem: the running total sits below the third stepper row', async ({ page }) => {
  await startOnly(page, 'MiniGame', { cityId: 'mexico_city', minigameId: 'mex_per_diem', returnPhase: 'locations', practice: true });
  await page.waitForTimeout(800);
  await clickButtonByLabel(page, 'MiniGame', 'Start');
  await page.waitForTimeout(800);
  const gap = await page.evaluate(() => {
    const sc: any = (window as any).__game.scene.getScene('MiniGame');
    const out: any[] = [];
    const walk = (l: any[]) => { for (const o of l) { out.push(o); if (o.list) walk(o.list); } };
    walk(sc.children.list);
    const total = out.find((o) => o.type === 'Text' && /^\$\d+ of \$\d+/.test(String(o.text)));
    const steppers = out.filter((o) => o.type === 'Container' && o.list?.some((c: any) => c.type === 'Text' && /^[+−]$/.test(String(c.text))));
    const lowest = Math.max(...steppers.map((s: any) => s.getBounds().bottom));
    return total.getBounds().top - lowest;
  });
  expect(gap).toBeGreaterThan(0);
});

test('#5 the practice picker opens after a practice round, and never again on a later trip to the bus', async ({ page }) => {
  await startOnly(page, 'Hub', { practiceCity: 'tokyo' });
  expect(await waitForCondition(page, () => !!(window as any).__game.scene.getScene('Hub').children.getByName('practicePanel'), 4000)).toBe(true);
  // A later trip to the bus from a city passes no data (CityScene): the old practice data must not ride along.
  await page.evaluate(() => {
    const g: any = (window as any).__game;
    g.scene.getScene('Hub').children.getByName('practicePanel').destroy();
    g.scene.stop('Hub');
    g.scene.start('City', { cityId: 'tokyo' });
  });
  await waitForActiveScene(page, 'City');
  await page.evaluate(() => (window as any).__test.goTo((window as any).__game.scene.getScene('City'), 'Hub'));
  await waitForActiveScene(page, 'Hub', 8000);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => !!(window as any).__game.scene.getScene('Hub').children.getByName('practicePanel'))).toBe(false);
});

test('#6 the scrapbook has a Home button that keeps the tour', async ({ page }) => {
  await page.evaluate(() => { const S = (window as any).__state; S.data.meta.chaptersSeen = ['intro', 'tour1', 'tour2']; });
  await startOnly(page, 'Scrapbook', { endingId: 'live_album', tags: ['Electric', 'Ambitious'] });
  await page.waitForTimeout(600);
  await clickButtonByLabel(page, 'Scrapbook', 'Home');
  await waitForActiveScene(page, 'Title', 8000);
  expect(await page.evaluate(() => (window as any).__state.data.seed)).toBe('qa-round5-seed');
});

test('#7 hiding the app on the bus opens the pause menu', async ({ page }) => {
  await startOnly(page, 'Hub');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await waitForCondition(page, () => (window as any).__game.scene.isActive('Settings') && (window as any).__game.scene.getScene('Hub').sys.isPaused(), 5000)).toBe(true);
});

test('#9 on a phone the seed field is no taller than the Use seed button beside it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones only');
  await startOnly(page, 'Title');
  await page.waitForTimeout(800);
  const sizes = await page.evaluate(() => {
    const el = [...document.querySelectorAll('input')].find((i) => i.placeholder === 'Paste a seed') as HTMLInputElement;
    const sc: any = (window as any).__game.scene.getScene('Title');
    const r = document.querySelector('canvas')!.getBoundingClientRect();
    let btnH = 0;
    const walk = (l: any[]) => { for (const o of l) { if (o.type === 'Container' && o.list.some((c: any) => c.type === 'Text' && c.text === 'Use seed')) btnH = o.getBounds().height * (r.height / 1280); if (o.list) walk(o.list); } };
    walk(sc.children.list);
    return { field: el.getBoundingClientRect().height, btnH };
  });
  expect(sizes.field).toBeLessThanOrEqual(sizes.btnH + 2);
});

test('#10 Tonight card: every bandmate face sits on a light disc', async ({ page }) => {
  await startOnly(page, 'Rhythm', { cityId: 'lisbon' });
  await page.evaluate(() => { const r: any = (window as any).__game.scene.getScene('Rhythm'); r.practiceHandOff?.(); });
  expect(await waitForCondition(page, () => {
    const sc: any = (window as any).__game.scene.getScene('Rhythm');
    const out: any[] = [];
    const walk = (l: any[]) => { for (const o of l) { out.push(o); if (o.list) walk(o.list); } };
    walk(sc.children.list);
    return out.filter((o) => o.type === 'Arc' && o.fillColor === 0xf5ebdd && o.radius === 40).length === 4;
  }, 8000)).toBe(true);
});

test('rename: the drummer is Phillip on the How to Play page and no screen text says Theo', async ({ page }) => {
  await clickButtonByLabel(page, 'Title', 'How to Play');
  await waitForActiveScene(page, 'HowToPlay');
  await page.evaluate(() => { const h: any = (window as any).__game.scene.getScene('HowToPlay'); h.welcome = false; h.page = 0; h.renderPage(); });
  const body = await page.evaluate(() => String((window as any).__game.scene.getScene('HowToPlay').body.text));
  expect(body).toContain('Phillip');
  expect(body).not.toMatch(/\bTheo\b/);
});
