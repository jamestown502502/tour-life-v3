// Depth pass (2026-10-07): each new behaviour, driven for real.
import { test, expect, type Page } from '@playwright/test';
import { bootGame, skipFirstTimeOnboarding, collectConsoleErrors, canvasClick, waitForActiveScene, waitForCondition, clickButtonByLabel, startScene } from './helpers';

async function newRun(page: Page, rel = 20): Promise<void> {
  await page.evaluate((rel) => {
    const S = (window as any).__state;
    S.newRun('depth-seed');
    S.data.band = { name: 'Copper Atlas', genre: 'indie_rock', whyTour: 'A label finally said yes.', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = ['lisbon', 'tokyo', 'mexico_city', 'berlin'].map((cityId) => ({ cityId, visited: false, weather: 'clear' }));
    S.data.relationships = { mira: rel, theo: rel, jun: rel, rowan: rel };
    S.addFlag('onboard_hub_seen');
  }, rel);
}
const shot = (page: Page, name: string) => page.screenshot({ path: `${process.env.DEPTH_SHOTS ?? 'test-results'}/depth-${name}.png` });

test('first launch: a four-line welcome, with the full guide one tap away', async ({ page }) => {
  await bootGame(page);
  await waitForActiveScene(page, 'HowToPlay', 20000);
  await page.waitForTimeout(600);
  const heading = await page.evaluate(() => (window as any).__game.scene.getScene('HowToPlay').heading.text);
  expect(heading).toBe('Welcome to Tour Life');
  await shot(page, 'welcome');
  await clickButtonByLabel(page, 'HowToPlay', 'Read the full guide');
  expect(await waitForCondition(page, () => (window as any).__game.scene.getScene('HowToPlay').heading.text === 'Your tour', 4000)).toBe(true);
});

test.describe('after onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
  });

  test('Fix the Mix plays to its result by fixing each problem on its own fader', async ({ page }) => {
    test.setTimeout(120000);
    const errors = collectConsoleErrors(page);
    await newRun(page);
    await page.evaluate(() => {
      const g: any = (window as any).__game;
      g.scene.getScenes(true).forEach((s: any) => { if (s.scene.key !== 'Transition') g.scene.stop(s.scene.key); });
      g.scene.start('MiniGame', { cityId: 'tokyo', minigameId: 'tok_mix_hold', returnPhase: 'locations', practice: true });
    });
    await waitForActiveScene(page, 'MiniGame');
    await page.waitForTimeout(900);
    await clickButtonByLabel(page, 'MiniGame', 'Start');
    let shotTaken = false;
    const deadline = Date.now() + 80000;
    while (Date.now() < deadline) {
      const s = await page.evaluate(() => { const m: any = (window as any).__game.scene.getScene('MiniGame'); return { hint: m.mixHint, done: m.contentLayer.list.some((o: any) => o.type === 'Text' && o.text === '★') }; });
      if (s.done) break;
      if (s.hint) {
        if (!shotTaken) { await shot(page, 'fixthemix-problem'); shotTaken = true; }
        await canvasClick(page, s.hint.x, s.hint.y);
      }
      await page.waitForTimeout(300);
    }
    const fixed = await page.evaluate(() => { const m: any = (window as any).__game.scene.getScene('MiniGame'); return m.outcomeGood; });
    await shot(page, 'fixthemix-result');
    expect(fixed).toBe(true);
    expect(errors).toEqual([]);
  });

  test('the show opens with tonight\'s goal and the band\'s perks, and Results report them', async ({ page }) => {
    test.setTimeout(90000);
    await newRun(page, 40);
    await page.evaluate(() => { (window as any).__state.data.flags.push('rhythm_tutorial_seen'); localStorage.setItem('tourlife.seenRhythmTutorial', '1'); });
    await startScene(page, 'Rhythm', { cityId: 'lisbon' });
    await waitForActiveScene(page, 'Rhythm');
    await page.waitForTimeout(1500);
    const banner = await page.evaluate(() => (window as any).__game.scene.getScene('Rhythm').children.list.filter((o: any) => o.type === 'Text').map((o: any) => o.text).join('\n'));
    expect(banner).toMatch(/Tonight's goal: /);
    expect(banner).toMatch(/Theo locks the tempo/);
    await shot(page, 'show-banner');
    await page.evaluate(() => (window as any).__game.scene.getScene('Rhythm').finish());
    await waitForActiveScene(page, 'Results', 15000);
    await page.waitForTimeout(800);
    const results = await page.evaluate(() => (window as any).__game.scene.getScene('Results').children.list.filter((o: any) => o.type === 'Text').map((o: any) => o.text).join('\n'));
    expect(results).toMatch(/Tonight's goal: .*(MET|not this time)/);
    expect(results).toMatch(/On your side: /);
    const progress = await page.evaluate(() => (window as any).__state.data.progress);
    expect(progress).toMatchObject({ screen: 'city', nodeId: 'afterShow' });   // a kill here resumes after the show
    await shot(page, 'results-tonight');
  });

  test('an interrupted show offers the stage again, not the whole city', async ({ page }) => {
    await newRun(page);
    await startScene(page, 'City', { cityId: 'lisbon', phase: 'preshow-done' });
    await waitForActiveScene(page, 'City');
    expect(await waitForCondition(page, () => !!(window as any).__game.scene.getScene('City').children.getByName('interruptedShow'), 8000)).toBe(true);
    await shot(page, 'interrupted-show');
    await clickButtonByLabel(page, 'City', 'Take the stage again');
    await waitForActiveScene(page, 'Rhythm', 15000);
  });

  test('every city ends on Stop complete, and Stop here goes home with the tour saved', async ({ page }) => {
    await newRun(page);
    await startScene(page, 'City', { cityId: 'lisbon', phase: 'locations' });
    await waitForActiveScene(page, 'City');
    await page.waitForTimeout(800);
    await page.evaluate(() => { const c: any = (window as any).__game.scene.getScene('City'); c.finishCity(); });
    expect(await waitForCondition(page, () => !!(window as any).__game.scene.getScene('City').children.getByName('stopComplete'), 8000)).toBe(true);
    await shot(page, 'stop-complete');
    await clickButtonByLabel(page, 'City', 'Stop here for now');
    await waitForActiveScene(page, 'Title', 15000);
    // Title reads the save asynchronously, then adds Continue
    expect(await waitForCondition(page, () => { const t: any = (window as any).__game.scene.getScene('Title'); return t.children.list.some((o: any) => { const l = o.getData && o.getData('labelText'); return l && /^Continue/.test(l.text); }); }, 8000)).toBe(true);
  });

  test('the Scrapbook explains the ending and what nearly happened', async ({ page }) => {
    await newRun(page, 60);
    await startScene(page, 'Scrapbook', {});
    await waitForActiveScene(page, 'Scrapbook');
    await page.waitForTimeout(800);
    await clickButtonByLabel(page, 'Scrapbook', 'Why this ending');
    expect(await waitForCondition(page, () => !!(window as any).__game.scene.getScene('Scrapbook').children.getByName('whyPanel'), 5000)).toBe(true);
    const text = await page.evaluate(() => { const p: any = (window as any).__game.scene.getScene('Scrapbook').children.getByName('whyPanel'); return p.list.filter((o: any) => o.type === 'Text').map((o: any) => o.text).join('\n'); });
    expect(text).toMatch(/Almost /);
    await shot(page, 'why-ending');
  });

  test('Android Back: closes overlays, pauses play, and asks before leaving', async ({ page }) => {
    await newRun(page);
    await startScene(page, 'Hub');
    await waitForActiveScene(page, 'Hub');
    await page.waitForTimeout(800);
    await page.evaluate(() => (window as any).__game.scene.getScene('Hub').showPractice(0));
    await page.goBack();
    expect(await waitForCondition(page, () => !(window as any).__game.scene.getScene('Hub').children.getByName('practicePanel'), 4000)).toBe(true);
    await page.goBack();
    await waitForActiveScene(page, 'Settings', 5000);
    await page.goBack();
    expect(await waitForCondition(page, () => !(window as any).__game.scene.isActive('Settings'), 4000)).toBe(true);
    expect(page.url()).toMatch(/localhost:5183/);   // still in the game
  });
});
