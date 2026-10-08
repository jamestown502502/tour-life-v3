// QA round 3 (2026-10-06): one regression check per tester row that changed behaviour or layout.
import { test, expect, type Page } from './fixtures';
import { bootGame, skipFirstTimeOnboarding, collectConsoleErrors, canvasClick, waitForActiveScene, waitForCondition, clickButtonByLabel, startScene } from './helpers';

async function newRun(page: Page): Promise<void> {
  await page.evaluate(() => {
    const S = (window as any).__state;
    S.newRun('qa-round3-seed');
    S.data.band = { name: 'Copper Atlas', genre: 'indie_rock', whyTour: 'A label finally said yes.', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = ['lisbon', 'tokyo', 'mexico_city', 'berlin'].map((cityId) => ({ cityId, visited: false, weather: 'clear' }));
    S.addFlag('onboard_hub_seen');
  });
}

async function startPractice(page: Page, cityId: string, minigameId: string): Promise<void> {
  await page.evaluate(({ cityId, minigameId }) => {
    const g: any = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => { if (s.scene.key !== 'Transition') g.scene.stop(s.scene.key); });
    g.scene.start('MiniGame', { cityId, minigameId, returnPhase: 'locations', practice: true });
  }, { cityId, minigameId });
  await waitForActiveScene(page, 'MiniGame');
}

/** The scene is alive: its clock moves, and the page answers. */
async function framesAdvance(page: Page): Promise<boolean> {
  const a = await page.evaluate(() => (window as any).__game.loop.frame);
  await page.waitForTimeout(600);
  const b = await page.evaluate(() => (window as any).__game.loop.frame);
  return b > a;
}

test.beforeEach(async ({ page }) => {
  await skipFirstTimeOnboarding(page);
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
});

test('#2 Settings over a practice minigame opens, and Resume returns to a live game', async ({ page }) => {
  test.setTimeout(90000);
  const errors = collectConsoleErrors(page);
  await newRun(page);
  await startPractice(page, 'tokyo', 'tok_mix_hold');
  await page.waitForTimeout(900);
  await clickButtonByLabel(page, 'MiniGame', 'Start');
  await page.waitForTimeout(1200);
  await canvasClick(page, 53, 53); // the gear
  expect(await waitForCondition(page, () => (window as any).__game.scene.isActive('Settings'), 8000)).toBe(true);
  expect(await framesAdvance(page)).toBe(true);
  // Drawn ABOVE the minigame: it used to open underneath it, invisible (the actual bug).
  const order = await page.evaluate(() => { const keys = (window as any).__game.scene.scenes.map((x: any) => x.scene.key); return { settings: keys.indexOf('Settings'), mini: keys.indexOf('MiniGame'), transition: keys.indexOf('Transition') }; });
  expect(order.settings).toBeGreaterThan(order.mini);
  expect(order.transition).toBeGreaterThan(order.settings);
  await page.screenshot({ path: 'test-results/qa-round3-settings-over-minigame.png' });
  await clickButtonByLabel(page, 'Settings', 'Resume');
  expect(await waitForCondition(page, () => !(window as any).__game.scene.isActive('Settings') && !(window as any).__game.scene.getScene('MiniGame').sys.isPaused(), 8000)).toBe(true);
  expect(await framesAdvance(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('#6 a practice minigame has a Back that returns to the same city in the picker', async ({ page }) => {
  await newRun(page);
  await startPractice(page, 'tokyo', 'tok_mix_hold');
  await page.waitForTimeout(900);
  await clickButtonByLabel(page, 'MiniGame', 'Back to practice');
  await waitForActiveScene(page, 'Hub', 10000);
  expect(await waitForCondition(page, () => !!(window as any).__game.scene.getScene('Hub').children.getByName('practicePanel'), 8000)).toBe(true);
  const tab = await page.evaluate(() => {
    const hub: any = (window as any).__game.scene.getScene('Hub');
    const panel = hub.children.getByName('practicePanel');
    const titles: string[] = [];
    const walk = (l: any[]) => l.forEach((o: any) => { if (o.type === 'Text') titles.push(o.text); if (o.list) walk(o.list); });
    walk(panel.list);
    return titles;
  });
  expect(tab.some((t) => t.includes('Fix the Mix'))).toBe(true);
});

test('#7 #8 the practice picker: re-tapping the open city does nothing; switching never blinks or resizes', async ({ page }) => {
  await newRun(page);
  await startScene(page, 'Hub');
  await waitForActiveScene(page, 'Hub');
  await page.waitForTimeout(800);
  await page.evaluate(() => (window as any).__game.scene.getScene('Hub').showPractice(0));
  const first = await page.evaluate(() => {
    const hub: any = (window as any).__game.scene.getScene('Hub');
    const p = hub.children.getByName('practicePanel'); (window as any).__p0 = p;
    const card = p.list[1]; return { h: card.height };
  });
  await page.evaluate(() => (window as any).__game.scene.getScene('Hub').showPractice(0)); // the open city again
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('Hub').children.getByName('practicePanel') === (window as any).__p0)).toBe(true);
  await page.evaluate(() => (window as any).__game.scene.getScene('Hub').showPractice(1));
  const after = await page.evaluate(() => {
    const hub: any = (window as any).__game.scene.getScene('Hub');
    const p = hub.children.getByName('practicePanel');
    const alphas = p.list.filter((o: any) => o.type === 'Container').map((o: any) => o.alpha);
    return { h: p.list[1].height, minAlpha: Math.min(...alphas) };
  });
  expect(after.h).toBe(first.h);
  expect(after.minAlpha).toBe(1); // drawn at once: no fade-in on a city switch
});

test('#4 the help panel closes on a tap anywhere, without pressing what is underneath', async ({ page }) => {
  await newRun(page);
  await startPractice(page, 'tokyo', 'tok_mix_hold');
  await page.waitForTimeout(900);
  await canvasClick(page, 720 - 53, 53); // "?"
  const open = () => (window as any).__game.scene.getScene('MiniGame').children.list.some((o: any) => o.type === 'Container' && o.depth === 150);
  expect(await waitForCondition(page, open, 4000)).toBe(true);
  await canvasClick(page, 360, 553); // on top of the Start button
  expect(await waitForCondition(page, () => !(window as any).__game.scene.getScene('MiniGame').children.list.some((o: any) => o.type === 'Container' && o.depth === 150), 4000)).toBe(true);
  // the tap closed the panel only: still on the intro card
  expect(await page.evaluate(() => { const t: string[] = []; const m: any = (window as any).__game.scene.getScene('MiniGame'); const w = (l: any[]) => l.forEach((o: any) => { if (o.type === 'Text') t.push(o.text); if (o.list) w(o.list); }); w(m.contentLayer.list); return t.some((x) => x === 'Start'); })).toBe(true);
});

test('#3 #5 Name your band: the picks show, faces swap the line directly, every want is one line', async ({ page }) => {
  await newRun(page);
  await startScene(page, 'BandCreator');
  await waitForActiveScene(page, 'BandCreator');
  await page.waitForTimeout(900);
  const picks = await page.evaluate(() => {
    const s: any = (window as any).__game.scene.getScene('BandCreator');
    const rings = s.children.list.filter((o: any) => o.type === 'Container' && o.getData('selectedRing')?.visible);
    const wants = s.children.list.filter((o: any) => o.type === 'Text' && String(o.text).startsWith('wants '));
    return { genre: s.genre, why: s.whyTour, selected: rings.length, wantLines: wants.map((t: any) => t.getWrappedText().length) };
  });
  expect(picks.genre).not.toBe('');
  expect(picks.why).not.toBe('');
  expect(picks.selected).toBe(2); // one genre, one reason
  expect(picks.wantLines.every((n: number) => n === 1)).toBe(true);
  const meet = (id: string) => page.evaluate((id) => (window as any).__game.scene.getScene('BandCreator').meetBandmate(id), id);
  const state = () => page.evaluate(() => { const s: any = (window as any).__game.scene.getScene('BandCreator'); const b = s.meetCard?.getBounds(); return { id: s.meetId, bottom: b ? b.bottom : null, castY: s.castY }; });
  await meet('jun');
  let st = await state();
  expect(st.id).toBe('jun');
  expect(st.bottom!).toBeLessThan(st.castY - 55); // the faces stay uncovered
  await meet('rowan');
  expect((await state()).id).toBe('rowan');
  await meet('rowan');
  expect((await state()).id).toBeNull();
});

test('#11 the Livehouse Deal value sits midway between − and +', async ({ page }) => {
  await newRun(page);
  await startPractice(page, 'tokyo', 'tok_door_split');
  await page.waitForTimeout(900);
  await clickButtonByLabel(page, 'MiniGame', 'Start');
  await page.waitForTimeout(900);
  const pos = await page.evaluate(() => {
    const m: any = (window as any).__game.scene.getScene('MiniGame');
    const btns: any[] = []; let value: any = null;
    m.contentLayer.list.forEach((o: any) => {
      const lbl = o.type === 'Container' && o.getData && o.getData('labelText');
      if (lbl && (lbl.text === '−' || lbl.text === '+')) btns.push(o.getBounds());
      if (o.type === 'Text' && /^\d+%$/.test(o.text)) value = o;
    });
    const minus = btns.find((b) => b.x < 400), plus = btns.find((b) => b.x > 400);
    return { mid: (minus.right + plus.left) / 2, x: value.x };
  });
  expect(Math.abs(pos.x - pos.mid)).toBeLessThanOrEqual(1);
});

test('#9 How to Play: seven pages, each fits its card', async ({ page }) => {
  await page.evaluate(() => { const t: any = (window as any).__game.scene.getScene('Title'); t.scene.launch('HowToPlay', { returnTo: 'Title' }); t.scene.pause(); });
  await waitForActiveScene(page, 'HowToPlay');
  const pages = await page.evaluate(() => {
    const s: any = (window as any).__game.scene.getScene('HowToPlay');
    const out: { title: string; bottom: number }[] = [];
    for (let i = 0; i < 7; i++) { s.page = i; s.renderPage(); out.push({ title: s.heading.text, bottom: s.body.getBounds().bottom }); }
    return out;
  });
  expect(pages.length).toBe(7);
  expect(new Set(pages.map((p) => p.title)).size).toBe(7);
  for (const p of pages) expect(p.bottom, p.title).toBeLessThan(260 + 620 - 60);
});

test('#10 the seed field lines up with its button and clears the buttons above', async ({ page }) => {
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const el = document.querySelector('input') as HTMLInputElement;
    const box = el.getBoundingClientRect();
    const canvas = document.querySelector('canvas')!.getBoundingClientRect();
    const s = canvas.height / 1280;
    const title: any = (window as any).__game.scene.getScene('Title');
    let use: any = null, saves: any = null;
    title.children.list.forEach((o: any) => {
      const lbl = o.type === 'Container' && o.getData && o.getData('labelText');
      if (lbl?.text === 'Use seed') use = o.getBounds();
      if (lbl?.text === 'Saves') saves = o.getBounds();
    });
    return {
      inputTop: (box.top - canvas.top) / s, inputBottom: (box.bottom - canvas.top) / s, inputMid: (box.top + box.height / 2 - canvas.top) / s,
      useMid: use.centerY, savesBottom: saves.bottom, heightPx: box.height, fontPx: parseFloat(getComputedStyle(el).fontSize),
    };
  });
  expect(Math.abs(r.inputMid - r.useMid)).toBeLessThan(4);
  expect(r.inputTop).toBeGreaterThan(r.savesBottom + 8);
  expect(r.heightPx).toBeGreaterThanOrEqual(r.fontPx * 1.25);
});

test('#1 a file that never finishes loading cannot hold the game on the loading screen', async ({ page, context }) => {
  test.setTimeout(90000);
  const fresh = await context.newPage();
  // One painted image hangs forever (as a decode did on a phone after a reload): Title still comes.
  let hung = false;
  await fresh.route('**/assets/**', (route) => { if (!hung) { hung = true; return; } return route.continue(); });
  await fresh.goto('/');
  await fresh.waitForFunction(() => { const g = (window as any).__game; return !!g && g.scene.isActive('Title'); }, null, { timeout: 60000 });
  expect(hung).toBe(true);
  await fresh.close();
});
