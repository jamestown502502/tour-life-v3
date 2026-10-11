// Keyboard-only play (web pivot, 2026-10-11). A desktop player must be able to finish every minigame
// in every city without touching the mouse: arrows move the focus ring (ui/keyNav.ts), Enter presses
// where it is, holding Enter and pressing arrows drags (load-ins, faders). No page.mouse and no
// canvasClick anywhere in this file: the test walks the ring onto a target with arrow keys, the way a
// player would, and only ever presses keys.
import { test, expect, type Page } from './fixtures';
import { readFileSync } from 'node:fs';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene, collectConsoleErrors } from './helpers';

const CITY_FILES = ['lisbon', 'tokyo', 'mexico_city', 'berlin'];
const cities = CITY_FILES.map((f) => JSON.parse(readFileSync(new URL(`../content/cities/${f}.json`, import.meta.url), 'utf8')) as { id: string; minigames?: { id: string; type: string }[] });
type Pt = { x: number; y: number };

/** The minigame's tap targets by kind, in game units (same reading as minigame-playthrough.spec.ts). */
async function look(page: Page) {
  return page.evaluate(() => {
    const g: any = (window as any).__game;
    const m: any = g.scene.getScene('MiniGame');
    const active = g.scene.isActive('MiniGame');
    if (!active || !m.contentLayer) return { active, buttons: [] as any[], chips: [] as any[], slots: [] as any[], tracks: [] as any[], result: false };
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
    const chips = kids.filter((o: any) => o.type === 'Image' && o.input?.draggable && o.input?.enabled && shown(o)).map((o: any) => { const b = o.getBounds(); return { x: b.centerX, y: b.centerY }; });
    const slots = kids.filter((o: any) => o.type === 'Rectangle' && o.width === 190 && o.height === 60).map((o: any) => ({ x: o.x + 95, y: o.y + 30 }));
    const tracks = kids.filter((o: any) => o.type === 'Rectangle' && o.input?.enabled && o.alpha < 0.01 && o.height > 300).map((o: any) => { const b = o.getBounds(); return { x: b.centerX, y: b.centerY }; });
    kids.filter((o: any) => o.type === 'Rectangle' && o.width === 150 && o.height === 150 && o.input?.enabled).forEach((o: any) => buttons.push({ label: 'pad', x: o.x + 75, y: o.y + 75 }));
    return { active, buttons, chips, slots, tracks, result, mix: m.mixHint ?? null };
  });
}

const ring = (page: Page) => page.evaluate(() => (window as any).__keyFocus?.() ?? { ring: null, down: null, active: false });

/** Walk the focus ring onto the target nearest `to` with arrow keys. True when it got there. */
async function focusOn(page: Page, to: Pt): Promise<boolean> {
  for (let i = 0; i < 16; i++) {
    const f = await ring(page);
    if (!f.ring) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(60); continue; }
    const dx = to.x - f.ring.x, dy = to.y - f.ring.y;
    if (Math.hypot(dx, dy) < 40) return true;
    await page.keyboard.press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp'));
    await page.waitForTimeout(60);
  }
  return false;
}

/** Hold Enter where the ring is and walk the press toward `to` with arrows (40 game units a step). */
async function dragTo(page: Page, to: Pt): Promise<void> {
  await page.keyboard.down('Enter');
  await page.waitForTimeout(80);
  for (let i = 0; i < 40; i++) {
    const f = await ring(page);
    if (!f.down) break;
    const dx = to.x - f.down.x, dy = to.y - f.down.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) break;
    await page.keyboard.press(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp'));
    await page.waitForTimeout(40);
  }
  await page.keyboard.up('Enter');
}

async function playOne(page: Page, cityId: string, mgId: string): Promise<string[]> {
  await page.evaluate(({ cityId, mgId }) => {
    const g: any = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => { if (s.scene.key !== 'Transition') g.scene.stop(s.scene.key); });
    g.scene.start('MiniGame', { cityId, minigameId: mgId, returnPhase: 'locations' });
  }, { cityId, mgId });
  await page.waitForTimeout(700);
  // The game records its own result (as minigame-playthrough.spec.ts does): an Enter can press
  // Continue before a poll ever sees the card.
  await page.evaluate(() => {
    const w: any = window; const m: any = w.__game.scene.getScene('MiniGame');
    w.__kb = { finished: 0 };
    if (m.__kbHooked) return; m.__kbHooked = true;
    const f = m.finish;
    m.finish = function (...a: any[]) { w.__kb.finished++; return f.apply(this, a); };
  });
  const start = Date.now();
  let k = 0, resultAt = 0, slotIx = 0;
  // Keyboard play walks the ring one arrow at a time, so it is slower than direct taps: 300 s a game.
  while (Date.now() - start < 300_000) {
    const s = await look(page);
    if (!s.active) {
      const inCity = await page.evaluate(() => (window as any).__game.scene.isActive('City'));
      const finished = await page.evaluate(() => (window as any).__kb.finished);
      return inCity && finished > 0 ? [] : [`left the minigame without reaching its result (city ${inCity}, finished ${finished})`];
    }
    if (s.result) {
      if (!resultAt) resultAt = Date.now();
      if (Date.now() - resultAt < 1600) { await page.waitForTimeout(200); continue; }
      const c = s.buttons.find((b) => b.label === 'Continue');
      if (!c) return ['result card has no Continue'];
      // During the card's entrance a full-screen skip layer is the only target (Enter skips, as a
      // tap would); keep walking the ring until Continue can take it.
      if (!(await focusOn(page, c))) { await page.waitForTimeout(300); continue; }
      await page.keyboard.press('Enter');
      const back = await page.waitForFunction(() => (window as any).__game.scene.isActive('City'), null, { timeout: 8000 }).then(() => true, () => false);
      if (back) return [];
      continue;
    }
    if (s.chips.length && s.slots.length) {
      if (await focusOn(page, s.chips[0])) await dragTo(page, s.slots[slotIx++ % s.slots.length]);
      await page.waitForTimeout(150);
      continue;
    }
    if (s.tracks.length) {
      const tr = s.tracks[k++ % s.tracks.length];
      if (await focusOn(page, tr)) await dragTo(page, { x: tr.x, y: tr.y + (k % 2 ? -120 : 80) });
      await page.waitForTimeout(250);
      continue;
    }
    if (s.buttons.length) {
      const b = s.buttons[(k++ * 7 + mgId.length) % s.buttons.length];
      if (await focusOn(page, b)) await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
      continue;
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
  }
  return ['never reached the result card in 300 s'];
}

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'Pixel 7', 'keyboard play runs on one profile'); });

for (const city of cities) {
  test(`every ${city.id} minigame plays through with the keyboard only`, async ({ page }) => {
    test.setTimeout(3_600_000);
    const errors = collectConsoleErrors(page);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await page.evaluate((cityId) => {
      const S: any = (window as any).__state;
      S.newRun('keyboard-' + cityId);
      S.data.band.name = 'The Keys';
    }, city.id);
    await page.keyboard.press('ArrowDown');   // the first key wakes the focus ring
    const out: string[] = [];
    const only = process.env.MG_ONLY?.split(',');
    for (const mg of city.minigames ?? []) {
      if (only && !only.includes(mg.id)) continue;
      const t0 = Date.now();
      const p = await playOne(page, city.id, mg.id);
      console.log(`${city.id}/${mg.id} (${mg.type}): ${p.length ? 'PROBLEM ' + p.join('; ') : 'ok'} in ${Math.round((Date.now() - t0) / 1000)} s`);
      p.forEach((x) => out.push(`${city.id}/${mg.id} (${mg.type}): ${x}`));
    }
    expect(out, out.join('\n')).toEqual([]);
    expect(errors.filter((e) => !/favicon|404/.test(e)), errors.join('\n')).toEqual([]);
  });
}

test('Escape pauses a minigame into Settings and Escape resumes it', async ({ page }) => {
  await skipFirstTimeOnboarding(page);
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  await page.evaluate(() => {
    const g: any = (window as any).__game, S: any = (window as any).__state;
    S.newRun('keyboard-esc');
    g.scene.getScenes(true).forEach((s: any) => { if (s.scene.key !== 'Transition') g.scene.stop(s.scene.key); });
    g.scene.start('MiniGame', { cityId: 'lisbon', minigameId: 'lis_soundcheck', returnPhase: 'locations' });
  });
  await page.waitForTimeout(1200);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.isActive('Settings'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.isActive('Settings'))).toBe(false);
});
