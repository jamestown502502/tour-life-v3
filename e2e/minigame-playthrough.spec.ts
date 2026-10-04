// "Get stuck" audit (2026-10-05). After the polish update, players reported minigames that froze
// partway (a Soundcheck level that never moved on after its SWEET SPOT stamp). The cause was the
// hit-stop: two in a row left the scene clock at 5% for good, and Phaser keeps a reused scene's
// clock speed, so every later minigame crawled. Nothing caught it because no test ever PLAYED a
// minigame to the end in real time: the audits start a game, look at it, and move on.
//
// This suite plays every minigame in every city the way a player would: real taps on whatever
// buttons are on screen, real drags for the load-ins, a real held finger on the faders, in real
// time with the game's own clock. Each must reach its result card, its clock must be back at full
// speed there, and Continue must take the player back to the city.
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene, collectConsoleErrors, canvasClick, LOGICAL_W, LOGICAL_H } from './helpers';

const CITY_FILES = ['lisbon', 'tokyo', 'mexico_city', 'berlin'];
const cities = CITY_FILES.map((f) => JSON.parse(readFileSync(new URL(`../content/cities/${f}.json`, import.meta.url), 'utf8')) as { id: string; minigames?: { id: string; type: string }[] });

/** What a player could do on the minigame screen right now. */
async function look(page: Page) {
  return page.evaluate(() => {
    const g: any = (window as any).__game;
    const m: any = g.scene.getScene('MiniGame');
    const active = g.scene.isActive('MiniGame');
    if (!active || !m.contentLayer) return { active, buttons: [], chips: [], slots: [], faders: [], result: false, clock: 1, tweens: 1 };
    const shown = (o: any) => { let p = o; while (p) { if (p.visible === false || p.alpha === 0) return false; p = p.parentContainer; } return true; };
    const buttons: { label: string; x: number; y: number }[] = [];
    let result = false;
    const walk = (list: any[]) => list.forEach((o) => {
      if (o.type === 'Text' && o.text === '★') result = true;
      if (o.type !== 'Container') return;
      const lbl = o.getData && o.getData('labelText');
      const bg = lbl && o.list.find((c: any) => c.type === 'Image' && c.input);
      if (bg && bg.input.enabled && shown(o)) { const b = bg.getBounds(); buttons.push({ label: lbl.text, x: b.centerX, y: b.centerY }); }
      walk(o.list);
    });
    walk(m.contentLayer.list);
    const kids = m.contentLayer.list;
    const chips = kids.filter((o: any) => o.type === 'Image' && o.input?.draggable && o.input?.enabled && shown(o))
      .map((o: any) => { const b = o.getBounds(); return { x: b.centerX, y: b.centerY }; });
    const slots = kids.filter((o: any) => o.type === 'Rectangle' && o.width === 190 && o.height === 60)
      .map((o: any) => ({ x: o.x + 95, y: o.y + 30 }));
    const faders = kids.filter((o: any) => o.type === 'Rectangle' && o.width === 90 && o.height === 72)
      .map((o: any) => ({ x: o.x + 45, y: o.y + 36 }));
    // Modular Check's four module pads are tappable rectangles, not buttons
    kids.filter((o: any) => o.type === 'Rectangle' && o.width === 150 && o.height === 150 && o.input?.enabled)
      .forEach((o: any) => buttons.push({ label: 'pad', x: o.x + 75, y: o.y + 75 }));
    return { active, buttons, chips, slots, faders, result, clock: m.time.timeScale, tweens: m.tweens.timeScale };
  });
}

/** Logical game point to page pixels. */
async function toPage(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').first().boundingBox())!;
  return { x: box.x + (x / LOGICAL_W) * box.width, y: box.y + (y / LOGICAL_H) * box.height };
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const a = await toPage(page, from.x, from.y), b = await toPage(page, to.x, to.y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 3; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 3, a.y + ((b.y - a.y) * i) / 3);
  await page.mouse.up();
}

/** Plays one minigame to its result card and back to the city. Returns problems found. */
async function playOne(page: Page, cityId: string, mgId: string): Promise<string[]> {
  const problems: string[] = [];
  await page.evaluate(({ cityId, mgId }) => {
    const g: any = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => { if (s.scene.key !== 'Transition') g.scene.stop(s.scene.key); });
    g.scene.start('MiniGame', { cityId, minigameId: mgId, returnPhase: 'locations' });
  }, { cityId, mgId });
  await page.waitForTimeout(700);
  // The game records its own result card: taps here travel 1-3 s on a loaded runner, so a tap aimed
  // at the last round's button can land on Continue before a poll ever sees the card.
  await page.evaluate(() => {
    const w: any = window; const m: any = w.__game.scene.getScene('MiniGame');
    w.__pt = { finished: 0, clock: null };
    if (m.__ptHooked) return; m.__ptHooked = true;
    const f = m.finish;
    m.finish = function (...a: any[]) {
      w.__pt.finished++;
      setTimeout(() => { if (w.__game.scene.isActive('MiniGame')) w.__pt.clock = m.time.timeScale; }, 1500);
      return f.apply(this, a);
    };
  });
  const start = Date.now();
  let slow = 0, slowSince = 0, slotIx = 0, taps = 0;
  let resultAt = 0;
  let last = 'none';
  while (Date.now() - start < 150_000) {
    const s = await look(page);
    if (!s.active) {
      const pt = await page.evaluate(() => (window as any).__pt);
      const inCity = await page.evaluate(() => (window as any).__game.scene.isActive('City'));
      if (pt.finished > 0 && inCity) { if (pt.clock !== null && pt.clock !== 1) problems.push(`result card clock at ${pt.clock}`); return problems; }
      const keys = await page.evaluate(() => (window as any).__game.scene.getScenes(true).map((x: any) => x.scene.key).join(','));
      problems.push(`left the minigame without a result card (now: ${keys}; last action: ${last})`); break;
    }
    // A clock below full speed for more than a second is the freeze players saw.
    if (s.clock < 1 || s.tweens < 1) { if (!slowSince) slowSince = Date.now(); slow = Date.now() - slowSince; if (slow > 1200) { problems.push(`clock stuck at ${s.clock} (tweens ${s.tweens}) for over 1.2 s`); break; } }
    else slowSince = 0;
    if (s.result) {
      if (!resultAt) { resultAt = Date.now(); continue; }
      if (Date.now() - resultAt < 1600) { await page.waitForTimeout(200); continue; } // let the stamp, stars and Encore play
      const c = s.buttons.find((b) => b.label === 'Continue');
      if (!c) { problems.push('result card has no Continue'); break; }
      if (s.clock !== 1) problems.push(`result card clock at ${s.clock}`);
      await canvasClick(page, c.x, c.y);
      const back = await page.waitForFunction(() => (window as any).__game.scene.isActive('City'), null, { timeout: 8000 }).then(() => true, () => false);
      if (!back) problems.push('Continue did not return to the city');
      return problems;
    }
    if (s.chips.length && s.slots.length) { last = 'drag'; await drag(page, s.chips[0], s.slots[slotIx++ % s.slots.length]); continue; }
    if (s.faders.length) {
      // hold a finger on the first track and sweep it; the rest of the time the no-fail ceiling ends it
      const f = await toPage(page, s.faders[0].x, s.faders[0].y);
      await page.mouse.move(f.x, f.y); await page.mouse.down(); await page.mouse.move(f.x, f.y - 40); await page.mouse.up();
      await page.waitForTimeout(400);
      continue;
    }
    if (s.buttons.length) {
      // a player taps something on screen; vary it so every branch gets pressed across the sweep
      const b = s.buttons[(taps++ * 7 + mgId.length) % s.buttons.length];
      last = `tap "${b.label}" at ${Math.round(b.x)},${Math.round(b.y)}`;
      await canvasClick(page, b.x, b.y);
      await page.waitForTimeout(250);
      continue;
    }
    await page.waitForTimeout(250);
  }
  if (!problems.length) problems.push('never reached the result card in 150 s');
  return problems;
}

// Long by design (every minigame, real time): one phone profile is enough; the layout suites cover the rest.
test.beforeEach(({}, info) => { test.skip(info.project.name !== 'Pixel 7', 'playthrough runs on Pixel 7 only'); });

for (const city of cities) {
  test(`every ${city.id} minigame plays through to its result and back`, async ({ page }) => {
    test.setTimeout(900_000);
    const errors = collectConsoleErrors(page);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await page.evaluate((cityId) => {
      const S: any = (window as any).__state;
      S.newRun('playthrough-' + cityId);
      S.data.band.name = 'The Sweep';
    }, city.id);
    const out: string[] = [];
    const only = process.env.MG_ONLY?.split(',');
    for (const mg of city.minigames ?? []) {
      if (only && !only.includes(mg.id)) continue;
      const t0 = Date.now();
      const p = await playOne(page, city.id, mg.id);
      const fps = await page.evaluate(() => Math.round((window as any).__game.loop.actualFps));
      console.log(`${city.id}/${mg.id} (${mg.type}): ${p.length ? 'PROBLEM ' + p.join('; ') : 'ok'} in ${Math.round((Date.now() - t0) / 1000)} s at ${fps} fps`);
      p.forEach((x) => out.push(`${city.id}/${mg.id} (${mg.type}): ${x}`));
    }
    expect(out, out.join('\n')).toEqual([]);
    expect(errors.filter((e) => !/favicon|404/.test(e)), errors.join('\n')).toEqual([]);
  });
}

// The exact bug: a perfect ledger (hit-stop) followed by its stamp (another hit-stop ~200 ms later),
// then the result stamp and the Encore. The clock must come back to full speed, and the NEXT
// minigame must start at full speed.
test('back-to-back hit-stops leave the clock at full speed, in this minigame and the next', async ({ page }) => {
  await skipFirstTimeOnboarding(page);
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  const r = await page.evaluate(async () => {
    const g: any = (window as any).__game;
    const S: any = (window as any).__state;
    S.newRun('hitstop');
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    g.scene.getScenes(true).forEach((s: any) => { if (s.scene.key !== 'Transition') g.scene.stop(s.scene.key); });
    g.scene.start('MiniGame', { cityId: 'lisbon', minigameId: 'lis_door_deal', returnPhase: 'locations' });
    await wait(500);
    const m = g.scene.getScene('MiniGame');
    m.settleLedger({ tier: 'perfect', funds: 3, label: 'probe', explain: 'probe' });
    await wait(150);
    m.finish(true, true);
    await wait(1500);
    const afterResult = m.time.timeScale;
    g.scene.stop('MiniGame');
    g.scene.start('MiniGame', { cityId: 'lisbon', minigameId: 'lis_soundcheck', returnPhase: 'locations' });
    await wait(400);
    return { afterResult, next: g.scene.getScene('MiniGame').time.timeScale };
  });
  expect(r).toEqual({ afterResult: 1, next: 1 });
});
