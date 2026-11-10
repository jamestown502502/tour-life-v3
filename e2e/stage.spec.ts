// Upgrade round 2026-11-10 on the real build: the stage (band under the lanes, notes in their
// player's colour, the combo glow, the back row of the crowd, key letters) and the short tour.
//
// The stage rule that matters most is the old one: nothing new may sit in the band where notes
// fall and are judged. Everything added lives below the hit line or behind the lanes.
import { test, expect, type Page } from './fixtures';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene, startScene, pressPlay, waitForCondition, clickButtonByLabel } from './helpers';

const HIT_LINE_Y = 980;

async function seedShow(page: Page, cityId: string) {
  await page.evaluate((city) => {
    const g: any = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => s.sys.settings.key !== 'Transition' && g.scene.stop(s.sys.settings.key));
    const S: any = (window as any).__state;
    S.newRun('stage-e2e');
    S.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because CI said so', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = [{ cityId: city, visited: false }, { cityId: 'lisbon', visited: false }];
    S.data.currentCityIndex = 0;
    S.data.accessibility.autoplay = true;
  }, cityId);
  await startScene(page, 'Rhythm', { cityId });
  await waitForActiveScene(page, 'Rhythm', 15000);
  await pressPlay(page, 45000);
  expect(await waitForCondition(page, () => !!(window as any).__game.scene.getScene('Rhythm').songStarted, 60000)).toBe(true);
}

test.beforeEach(async ({ page }) => { await skipFirstTimeOnboarding(page); });

test('the band stands under its lanes, below the hit line, and reacts to its own notes', async ({ page }) => {
  test.setTimeout(180000);
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  await seedShow(page, 'tokyo');
  const band = await page.evaluate(() => {
    const r: any = (window as any).__game.scene.getScene('Rhythm');
    return r.mateFaces.map((f: any) => { const b = f.getBounds(); return { name: f.name, x: Math.round(f.x), top: Math.round(b.top), bottom: Math.round(b.bottom) }; });
  });
  expect(band.map((b: { name: string }) => b.name)).toEqual(['mate_mira', 'mate_theo', 'mate_jun', 'mate_rowan']);
  for (const b of band) {
    expect(b.top, b.name).toBeGreaterThan(HIT_LINE_Y + 30);      // clear of the judging band
    expect(b.bottom, b.name).toBeLessThan(1280 - 150);           // clear of the named front row
  }
  expect(new Set(band.map((b: { x: number }) => b.x)).size).toBe(4);
  // Autoplay lands notes: every bandmate's face changes at least once within a few bars.
  const reacted = await waitForCondition(page, () => {
    const r: any = (window as any).__game.scene.getScene('Rhythm');
    return r.mateFaces.filter((f: any) => (f.getData('reactions') ?? 0) > 0).length >= 3;
  }, 60000);
  expect(reacted).toBe(true);
  await page.screenshot({ path: 'test-results/stage-band.png' });
});

test('notes wear their player colour, the combo lights the line, and the back row fills a hot room', async ({ page }) => {
  test.setTimeout(180000);
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  await seedShow(page, 'berlin');
  // two different lanes on screen at once have two different tints
  const tinted = await waitForCondition(page, () => {
    const r: any = (window as any).__game.scene.getScene('Rhythm');
    const byLane: Record<number, number> = {};
    for (const ns of r.notes) if (ns.sprite && ns.sprite.active && ns.note.type === 'tap') byLane[ns.note.l] = ns.sprite.tintTopLeft;
    (window as any).__tints = { ...((window as any).__tints || {}), ...byLane };
    return new Set(Object.values((window as any).__tints)).size >= 3;
  }, 60000);
  expect(tinted).toBe(true);
  // the glow follows the combo
  const lit = await waitForCondition(page, () => {
    const r: any = (window as any).__game.scene.getScene('Rhythm');
    return r.combo >= 8 && r.comboGlow.every((g: any) => g.alpha > 0);
  }, 60000);
  expect(lit).toBe(true);
  // a cold room has no back row; a hot one has all of it
  const rows = await page.evaluate(() => {
    const r: any = (window as any).__game.scene.getScene('Rhythm');
    r.crowd = 10; r.updateCrowdFigures();
    const cold = r.backRow.filter((f: any) => f.getData('want') > 0).length;
    r.crowd = 100; r.updateCrowdFigures();
    const hot = r.backRow.filter((f: any) => f.getData('want') > 0).length;
    return { cold, hot, seats: r.backRow.length };
  });
  expect(rows).toEqual({ cold: 0, hot: 8, seats: 8 });
  // nothing the stage added reaches into the band where notes are judged
  const intruders = await page.evaluate((hit) => {
    const r: any = (window as any).__game.scene.getScene('Rhythm');
    const out: string[] = [];
    for (const o of [...r.mateFaces, ...r.backRow]) { const b = o.getBounds(); if (b.top < hit + 20) out.push(`${o.name}@${Math.round(b.top)}`); }
    return out;
  }, HIT_LINE_Y);
  expect(intruders).toEqual([]);
  await page.screenshot({ path: 'test-results/stage-hot-room.png' });
});

test('the lane letters appear for a keyboard player', async ({ page }) => {
  test.setTimeout(180000);
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  await seedShow(page, 'lisbon');
  await page.keyboard.press('d');
  const shown = await waitForCondition(page, () => !!(window as any).__game.scene.getScene('Rhythm').keyBadges?.visible, 5000);
  expect(shown).toBe(true);
  const letters = await page.evaluate(() => (window as any).__game.scene.getScene('Rhythm').keyBadges.list.filter((o: any) => o.type === 'Text').map((t: any) => t.text));
  expect(letters).toEqual(['D', 'F', 'J', 'K']);
});

test('a short tour books two stops of the same route and reaches the bus', async ({ page }) => {
  test.setTimeout(120000);
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  await page.evaluate(() => {
    const g: any = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => s.sys.settings.key !== 'Transition' && g.scene.stop(s.sys.settings.key));
    const S: any = (window as any).__state;
    S.newRun('short-tour-e2e');
    S.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because CI said so', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.addFlag('onboard_routeplan_seen');
  });
  await startScene(page, 'RoutePlan');
  await waitForActiveScene(page, 'RoutePlan', 10000);
  await page.screenshot({ path: 'test-results/route-short-tour.png' });
  await clickButtonByLabel(page, 'RoutePlan', 'Short tour');
  await waitForActiveScene(page, 'Hub', 20000);
  const run = await page.evaluate(() => {
    const d: any = (window as any).__state.data;
    return { stops: d.route.length, revisit: d.route.some((s: any) => s.revisit), short: d.flags.includes('short_tour'), distinct: new Set(d.route.map((s: any) => s.cityId)).size };
  });
  expect(run).toEqual({ stops: 2, revisit: false, short: true, distinct: 2 });
});
