// Press kit screenshots for the screens that changed on 2026-11-10: the three show shots and the
// route screen. The rest of the kit's shots are unchanged and stay as they are.
//
//   npm run build:e2e && npx vite preview --outDir dist-e2e --port 5194 --strictPort   (one terminal)
//   node scripts/presskit-shots.mjs                                                     (another)
//
// Uses the e2e build because only that build exposes window.__game. Writes
// public/presskit/shots/<name>.jpg at 720x1280, the canvas only. Shows are played by Autoplay
// and captured once the combo has built, so the stage is in the shot as a player would see it.
import { chromium } from '@playwright/test';

const URL = process.env.SHOTS_URL || 'http://localhost:5194/';
const OUT = 'public/presskit/shots';

// GPU flags: the show is WebGL, and software rendering on a busy machine starves it of frames.
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.addInitScript(() => {
  localStorage.setItem('tourlife.seenHowToPlay', '1');
  localStorage.setItem('tourlife.seenRhythmTutorial', '1');
});
await page.goto(URL);
await page.waitForFunction(() => {
  const g = window.__game;
  return !!g && g.scene.getScenes(true).some((s) => s.scene.key === 'Title');
}, null, { timeout: 60000 });

async function seed(route) {
  await page.evaluate((route) => {
    const g = window.__game;
    g.scene.getScenes(true).forEach((s) => s.sys.settings.key !== 'Transition' && g.scene.stop(s.sys.settings.key));
    const S = window.__state;
    S.newRun('golden-van-2026');
    S.data.band = { name: 'Paper Motel', genre: 'indie', whyTour: 'Nothing left to lose at home.', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = route.map((cityId) => ({ cityId, visited: false }));
    S.data.currentCityIndex = 0;
    S.data.relationships = { mira: 60, theo: 55, jun: 50, rowan: 58 };
    S.data.stats.harmony = 85;
    S.data.accessibility.autoplay = true;
    S.data.accessibility.visualAssist = false;
  }, route);
}

async function shot(name) {
  await page.locator('canvas').first().screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 88 });
  console.log('shot', name);
}

for (const [cityId, file] of [['tokyo', 'tokyo-show'], ['lisbon', 'lisbon-show'], ['berlin', 'berlin-show']]) {
  await seed([cityId, 'mexico_city']);
  await page.evaluate((cityId) => window.__game.scene.start('Rhythm', { cityId }), cityId);
  // the Tonight card, then Play
  await page.waitForFunction(() => {
    const s = window.__game.scene.getScene('Rhythm');
    return s && s.sys.isActive() && (s.songStarted || s.children.list.some((o) => o.type === 'Container' && o.depth === 300));
  }, null, { timeout: 60000 });
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('Rhythm');
    if (s.songStarted) return;
    const card = s.children.list.find((o) => o.type === 'Container' && o.depth === 300);
    const walk = (list) => { for (const o of list) { if (o.type === 'Container' && (o.list || []).some((c) => c.type === 'Text' && String(c.text).includes('Play'))) return o; const r = o.list && walk(o.list); if (r) return r; } return null; };
    const btn = walk(card.list);
    const hit = (btn.list || []).find((c) => c.input) || btn;
    hit.emit('pointerdown', { x: 0, y: 0 }); hit.emit('pointerup', { x: 0, y: 0 });
  });
  const started = await page.waitForFunction(() => window.__game.scene.getScene('Rhythm').songStarted, null, { timeout: 60000 }).then(() => true).catch(() => false);
  if (!started) { console.log('PROBLEM: song never started in', cityId); continue; }
  // a built combo, a warm room, and at least three notes in the air
  const ready = await page.waitForFunction(() => {
    const r = window.__game.scene.getScene('Rhythm');
    const inAir = r.notes.filter((n) => n.sprite && n.sprite.active && n.sprite.y > 220 && n.sprite.y < 900).length;
    return r.combo >= 18 && inAir >= 3;
  }, null, { timeout: 120000 }).then(() => true).catch(() => false);
  if (!ready) console.log('NOTE: captured', cityId, 'without the full combo condition');
  await shot(file);
}

// the route screen, with the short tour beside Confirm
await seed([]);
await page.evaluate(() => { window.__state.addFlag('onboard_routeplan_seen'); window.__game.scene.start('RoutePlan'); });
await page.waitForFunction(() => { const s = window.__game.scene.getScene('RoutePlan'); return s && s.sys.isActive() && s.children.list.length > 10; }, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await shot('route');

await browser.close();
