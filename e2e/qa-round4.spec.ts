// QA round 4 (2026-10-10): one check per tester row that changed behaviour, plus the two client
// features testers could not find (Tonight's goal, bandmates helping on stage).
import { test, expect, type Page } from './fixtures';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene, waitForCondition, clickButtonByLabel, seedSave } from './helpers';

async function newRun(page: Page): Promise<void> {
  await page.evaluate(() => {
    const S = (window as any).__state;
    S.newRun('qa-round4-seed');
    S.data.band = { name: 'Copper Atlas', genre: 'indie_rock', whyTour: 'A label finally said yes.', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = ['lisbon', 'tokyo', 'mexico_city', 'berlin'].map((cityId) => ({ cityId, visited: false, weather: 'clear' }));
    S.addFlag('onboard_hub_seen');
  });
}

async function startOnly(page: Page, key: string, data?: object): Promise<void> {
  await page.evaluate(({ key, data }) => {
    const g: any = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => { if (s.scene.key !== 'Transition') g.scene.stop(s.scene.key); });
    g.scene.start(key, data);
  }, { key, data });
  await waitForActiveScene(page, key);
}

/** Every text on a scene's own display list (containers included), for "is this on screen". */
async function sceneTexts(page: Page, key: string): Promise<string[]> {
  return page.evaluate((k) => {
    const out: string[] = [];
    const walk = (list: any[]) => { for (const o of list) { if (o.type === 'Text' && o.visible) out.push(String(o.text)); if (o.list) walk(o.list); } };
    walk((window as any).__game.scene.getScene(k).children.list);
    return out;
  }, key);
}

test.describe('fresh title', () => {
  test.beforeEach(async ({ page }) => {
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
  });

  test('#1 the Continue slot is never empty: with no tour saved it says so', async ({ page }) => {
    expect(await waitForCondition(page, () => {
      const t: string[] = [];
      const walk = (l: any[]) => { for (const o of l) { if (o.type === 'Text') t.push(String(o.text)); if (o.list) walk(o.list); } };
      walk((window as any).__game.scene.getScene('Title').children.list);
      return t.includes('Continue (no tour yet)');
    }, 8000)).toBe(true);
    await clickButtonByLabel(page, 'Title', 'Continue (no tour yet)');
    expect((await sceneTexts(page, 'Title')).some((t) => t.startsWith('No tour in progress yet'))).toBe(true);
    expect(await page.evaluate(() => (window as any).__game.scene.isActive('Title'))).toBe(true);
  });

  test('#4 TalkBack can reach every title button: each is a labelled DOM button over the canvas', async ({ page }) => {
    await page.waitForFunction(() => document.querySelectorAll('#a11y-buttons button').length >= 5, null, { timeout: 8000 });
    const labels = await page.locator('#a11y-buttons button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label')));
    for (const want of ['New Run', 'Settings', 'How to Play', 'Saves']) expect(labels).toContain(want);
    // placed over the drawn button, and focusable with a visible ring
    const box = await page.locator('#a11y-buttons button', { hasText: 'New Run' }).boundingBox();
    expect(box && box.width > 30 && box.height > 20).toBe(true);
    await page.locator('#a11y-buttons button', { hasText: 'New Run' }).focus();
    expect(await page.locator('#a11y-buttons button', { hasText: 'New Run' }).evaluate((b) => getComputedStyle(b).outlineStyle)).toBe('solid');
  });

  test('#5 How to Play turns pages with a swipe, and long text scrolls inside the card', async ({ page }) => {
    await clickButtonByLabel(page, 'Title', 'How to Play');
    await waitForActiveScene(page, 'HowToPlay');
    const page0 = await page.evaluate(() => (window as any).__game.scene.getScene('HowToPlay').page);
    const canvas = await page.locator('canvas').first().boundingBox();
    const at = (x: number, y: number) => ({ x: canvas!.x + (x / 720) * canvas!.width, y: canvas!.y + (y / 1280) * canvas!.height });
    let a = at(600, 520), b = at(150, 520);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
    expect(await page.evaluate(() => (window as any).__game.scene.getScene('HowToPlay').page)).toBe(page0 + 1);
    // make the page longer than the card, the way a large font or a small phone does, and drag it
    const scrolled = await page.evaluate(() => {
      const s: any = (window as any).__game.scene.getScene('HowToPlay');
      s.body.setText(Array(30).fill('A long line of guide text that keeps going.').join('\n'));
      s.maxScroll = Math.max(0, s.body.height - 408); s.scrollHint.setVisible(true); s.setScroll(0);
      return { max: s.maxScroll, y: s.body.y };
    });
    expect(scrolled.max).toBeGreaterThan(0);
    a = at(360, 700); b = at(360, 450);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
    expect(await page.evaluate(() => (window as any).__game.scene.getScene('HowToPlay').body.y)).toBeLessThan(scrolled.y - 100);
  });

  test('#7 #11 band setup: the name field starts empty with a suggestion, and Back lines up with the gear', async ({ page }) => {
    await startOnly(page, 'BandCreator');
    await page.waitForTimeout(600);
    const field = await page.evaluate(() => { const el = document.querySelector('input') as HTMLInputElement; return { value: el.value, placeholder: el.placeholder }; });
    expect(field.value).toBe('');
    expect(field.placeholder).toMatch(/^e\.g\. /);
    const rows = await page.evaluate(() => {
      const sc: any = (window as any).__game.scene.getScene('BandCreator');
      const boxes: any[] = [];
      const walk = (l: any[]) => { for (const o of l) { if (o.type === 'Container' && o.list.some((c: any) => c.type === 'Text' && /^(Back|⚙)$/.test(String(c.text)))) { const b = o.getBounds(); boxes.push({ label: o.list.find((c: any) => c.type === 'Text').text, top: Math.round(b.y), h: Math.round(b.height) }); } } };
      walk(sc.children.list);
      return boxes;
    });
    const back = rows.find((r) => r.label === 'Back'), gear = rows.find((r) => r.label === '⚙');
    expect(back && gear).toBeTruthy();
    expect(Math.abs(back!.top - gear!.top)).toBeLessThanOrEqual(2);
    expect(Math.abs(back!.h - gear!.h)).toBeLessThanOrEqual(2);
  });
});

test.describe('in a tour', () => {
  test.beforeEach(async ({ page }) => {
    await skipFirstTimeOnboarding(page);
    await page.addInitScript(() => localStorage.setItem('tourlife.seenRhythmTutorial', '1'));
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await newRun(page);
  });

  test("missing features: the show opens on Tonight's goal and all four bandmates; Play starts it; the goal stays on screen", async ({ page }) => {
    test.setTimeout(60000);
    await page.evaluate(() => { (window as any).__state.data.relationships.theo = 95; });
    await startOnly(page, 'Rhythm', { cityId: 'lisbon' });
    await page.waitForTimeout(900);
    const card = await sceneTexts(page, 'Rhythm');
    expect(card).toContain('TONIGHT IN LISBON');
    expect(card.some((t) => t.startsWith('Goal: '))).toBe(true);
    expect(card.some((t) => t.startsWith('✓ Theo locks the tempo'))).toBe(true);
    for (const n of ['Mira', 'Jun', 'Rowan']) expect(card.some((t) => t.startsWith(`Grow close to ${n}`))).toBe(true);
    expect(await page.evaluate(() => (window as any).__game.scene.getScene('Rhythm').songStarted)).toBe(false);
    await clickButtonByLabel(page, 'Rhythm', 'Play');
    expect(await waitForCondition(page, () => (window as any).__game.scene.getScene('Rhythm').songStarted === true, 5000)).toBe(true);
    const during = await sceneTexts(page, 'Rhythm');
    expect(during.some((t) => t.startsWith('GOAL '))).toBe(true);
    expect(during).not.toContain('TONIGHT IN LISBON');
  });

  test('missing features: Results stamp the goal MET or NOT THIS TIME, above Continue', async ({ page }) => {
    const result = { timingScore: 812, ratio: 0.83, grade: 'good', expressionChoices: [], crowdConnection: 74, unlockedFlags: [], judgementCounts: { perfect: 40, good: 30, ok: 8, miss: 6 } };
    await startOnly(page, 'Results', { cityId: 'lisbon', visit: 0, result, tonight: { goal: 'Hit a 25-note streak', met: true, perks: ['Theo locks the tempo: wider timing'], night: null, scouted: false, scoutImpressed: false, letter: 'A' } });
    await page.waitForTimeout(1500);
    const texts = await sceneTexts(page, 'Results');
    expect(texts).toContain('MET');
    expect(texts).toContain("TONIGHT'S GOAL");
    expect(texts.some((t) => t.startsWith('Helping on stage: Theo'))).toBe(true);
  });

  test('#3 hiding the app mid-minigame opens the pause menu, and Resume goes back to a live game', async ({ page }) => {
    await startOnly(page, 'MiniGame', { cityId: 'tokyo', minigameId: 'tok_mix_hold', returnPhase: 'locations', practice: true });
    await page.waitForTimeout(800);
    await clickButtonByLabel(page, 'MiniGame', 'Start');
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await waitForCondition(page, () => (window as any).__game.scene.isActive('Settings') && (window as any).__game.scene.getScene('MiniGame').sys.isPaused(), 5000)).toBe(true);
    // #1: in a run, the menu says Paused and Resume is right at the top
    const texts = await sceneTexts(page, 'Settings');
    expect(texts).toContain('Paused');
    await clickButtonByLabel(page, 'Settings', 'Resume game');
    expect(await waitForCondition(page, () => !(window as any).__game.scene.isActive('Settings') && !(window as any).__game.scene.getScene('MiniGame').sys.isPaused(), 5000)).toBe(true);
  });

  test('#2 turning a phone sideways covers the game with the rotate prompt and pauses the show', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch phones only');
    await startOnly(page, 'Rhythm', { cityId: 'lisbon' });
    await page.waitForTimeout(600);
    await clickButtonByLabel(page, 'Rhythm', 'Play');
    await page.waitForTimeout(500);
    const vp = page.viewportSize()!;
    await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) + 120 });   // a big phone held sideways, over 500 px tall
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('rotate-prompt')!).display)).toBe('flex');
    expect(await waitForCondition(page, () => (window as any).__game.scene.isActive('Settings'), 5000)).toBe(true);
    await page.setViewportSize(vp);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('rotate-prompt')!).display)).toBe('none');
  });
});

test('#1 with a tour saved, Continue names where it goes', async ({ page }) => {
  await seedSave(page, { screen: 'city', cityId: 'lisbon', nodeId: 'locations' });
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  expect(await waitForCondition(page, () => {
    const t: string[] = [];
    const walk = (l: any[]) => { for (const o of l) { if (o.type === 'Text') t.push(String(o.text)); if (o.list) walk(o.list); } };
    walk((window as any).__game.scene.getScene('Title').children.list);
    return t.some((x) => x.startsWith('Continue: '));
  }, 8000)).toBe(true);
});
