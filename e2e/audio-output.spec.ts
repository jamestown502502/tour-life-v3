// "None of the audio works on iPhone" (2026-10-08). Every earlier audio spec spied on CALLS
// (playAmbience was called, isUnlocked() is true), and headless Playwright never enforces an
// autoplay rule at all, so a game that is silent on a real phone could pass all of them.
//
// These measure what comes out: an AnalyserNode is spliced in front of the speakers and each step
// asserts a real signal peak. They also apply WebKit's (iPhone's) strict rule, which a Chromium
// test otherwise never sees: a context may only start or resume INSIDE a live gesture (touchend,
// click, keydown). Touchstart, which is when every button here fires, does not count.
//
// The phone is modeled with its Ring/Silent switch ON (see installProbe).
//
// Chromium device profiles only: Playwright's WebKit build has no Web Audio on every platform we
// run, and the strict rule above is the part of iOS behavior this suite exists to hold.
import { test, expect, type Page } from './fixtures';
import { bootGame, waitForActiveScene, waitForCondition } from './helpers';

function installProbe(): void {
  const P: any = ((window as any).__probe = { ctxs: [] });
  // An iPhone with the Ring/Silent switch on silent: web audio is muted unless the page asked iOS
  // for a 'playback' session. Chromium has no audioSession, so this models one (type 'auto' is
  // the iOS default) and a gain stage stands in for the switch.
  Object.defineProperty(navigator, 'audioSession', { value: { type: 'auto' }, configurable: true });
  const Orig = window.AudioContext;
  const allowed = () => navigator.userActivation.isActive;   // WebKit: transient activation only
  const suspend = AudioContext.prototype.suspend;
  const resume = AudioContext.prototype.resume;
  AudioContext.prototype.resume = function () { return allowed() ? resume.call(this) : new Promise<void>(() => {}); };
  const connect = AudioNode.prototype.connect as any;
  (window as any).AudioContext = function (...a: any[]) {
    const ctx = new (Orig as any)(...a);
    if (!allowed()) suspend.call(ctx);
    const an = ctx.createAnalyser();
    const silentSwitch = ctx.createGain();
    connect.call(silentSwitch, an);
    connect.call(an, ctx.destination);
    P.ctxs.push({ ctx, an, silentSwitch });
    return ctx;
  };
  (window as any).AudioContext.prototype = Orig.prototype;
  (AudioNode.prototype as any).connect = function (dest: any, ...rest: any[]) {
    if (dest instanceof AudioDestinationNode) {
      const rec = P.ctxs.find((r: any) => r.ctx === dest.context);
      if (rec) return connect.call(this, rec.silentSwitch, ...rest);
    }
    return connect.call(this, dest, ...rest);
  };
}

/** Peak output level of the GAME's context (not Phaser's own loader context) over `ms`. */
async function peak(page: Page, ms = 1000): Promise<{ state: string; peak: number; session?: string; music?: boolean }> {
  return page.evaluate((ms) => new Promise<{ state: string; peak: number; session?: string; music?: boolean }>((resolve) => {
    const rec = (window as any).__probe.ctxs.find((r: any) => r.ctx === (window as any).__audio.ctx);
    if (!rec) return resolve({ state: 'no context', peak: 0 });
    rec.silentSwitch.gain.value = (navigator as any).audioSession.type === 'playback' ? 1 : 0;
    const buf = new Float32Array(2048);
    let p = 0;
    const t0 = performance.now();
    const tick = () => {
      rec.an.getFloatTimeDomainData(buf);
      for (const v of buf) p = Math.max(p, Math.abs(v));
      if (performance.now() - t0 < ms) setTimeout(tick, 20);
      else resolve({ state: rec.ctx.state, peak: p, session: (navigator as any).audioSession.type, music: !!(window as any).__audio.musicNodes });
    };
    tick();
  }), ms);
}

/** Waits for the game's own audio to be up (context running, a music bed started) instead of a
 *  fixed sleep: on a busy machine a fixed sleep measured silence that was only late. */
async function audioUp(page: Page, timeoutMs = 15000): Promise<boolean> {
  return waitForCondition(page, () => { const a = (window as any).__audio; return !!a.ctx && a.ctx.state === 'running' && !!a.musicNodes; }, timeoutMs);
}

async function tap(page: Page, x: number, y: number): Promise<void> {
  const box = (await page.locator('canvas').first().boundingBox())!;
  await page.touchscreen.tap(box.x + (x / 720) * box.width, box.y + (y / 1280) * box.height);
}

const AUDIBLE = 0.005;

test.beforeEach(async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'needs Web Audio (see header)');
  await page.addInitScript(installProbe);
});

test("first launch: the title music starts on the welcome card's Let's go tap", async ({ page }) => {
  await bootGame(page);
  await waitForActiveScene(page, 'HowToPlay', 20000);
  await page.waitForTimeout(800);
  await tap(page, 570, 937);   // Let's go
  expect(await audioUp(page), "no running context with music after Let's go").toBe(true);
  const r = await peak(page, 4000);   // the theme fades in over 2.6 s
  console.log('[audio-output] after Let\'s go', JSON.stringify(r));
  expect(r.peak, `the title was silent after the first tap: ${JSON.stringify(r)}`).toBeGreaterThan(AUDIBLE);
});

test('a returning player hears every kind of screen: menus, city, minigames, the show', async ({ page }) => {
  test.setTimeout(180000);
  await page.addInitScript(() => localStorage.setItem('tourlife.seenHowToPlay', '1'));
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  await page.waitForTimeout(1500);
  await tap(page, 300, 589);   // New Run, as the very first tap of the session
  await waitForActiveScene(page, 'BandCreator', 15000);
  expect(await audioUp(page), 'no running context with music after the first tap').toBe(true);
  await page.waitForTimeout(1500);

  const heard: Record<string, { state: string; peak: number }> = {};
  heard.BandCreator = await peak(page);
  const visit = async (label: string, key: string, data: object, settle = 2500) => {
    await page.evaluate(([key, data]) => {
      const g = (window as any).__game;
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'Transition') g.scene.stop(s.scene.key);
      g.scene.start(key, data);
    }, [key, data] as const);
    await waitForActiveScene(page, key, 15000);
    await page.waitForTimeout(settle);
    if (key === 'MiniGame') {
      await page.evaluate(() => (window as any).__game.scene.getScene('MiniGame').beginGame());
      await page.waitForTimeout(1500);
      await tap(page, 360, 700);
    }
    heard[label] = await peak(page, 1200);
  };
  await page.evaluate(() => {
    const S = (window as any).__state;
    S.newRun('audio-seed');
    S.data.band = { name: 'Copper Atlas', genre: 'indie_rock', whyTour: 'A label finally said yes.', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = ['lisbon', 'tokyo', 'mexico_city', 'berlin'].map((cityId) => ({ cityId, visited: false, weather: 'clear' }));
  });
  await visit('RoutePlan', 'RoutePlan', {});
  await visit('Hub', 'Hub', {});
  await visit('Van', 'Van', { cityId: 'tokyo' });
  await visit('City', 'City', { cityId: 'tokyo', phase: 'locations' });
  for (const [cityId, minigameId] of [['tokyo', 'tok_mix_hold'], ['lisbon', 'lis_tune_by_ear'], ['mexico_city', 'mex_find_the_clave'], ['berlin', 'ber_beatmatch'], ['tokyo', 'tok_pack_van']]) {
    await visit(`MiniGame ${minigameId}`, 'MiniGame', { cityId, minigameId, returnPhase: 'locations' }, 1200);
  }
  await visit('Rhythm', 'Rhythm', { cityId: 'tokyo' }, 4000);
  console.log('[audio-output]', JSON.stringify(heard, null, 1));
  const silent = Object.entries(heard).filter(([, r]) => !(r.peak > AUDIBLE && r.state === 'running')).map(([k, r]) => `${k} (${r.state}, ${r.peak.toFixed(4)})`);
  expect(silent, 'screens with no sound').toEqual([]);

  // Settings over the show holds every sound; Resume brings it back.
  await page.evaluate(() => { const r = (window as any).__game.scene.getScene('Rhythm'); r.scene.launch('Settings', { returnTo: 'Rhythm' }); r.scene.pause(); });
  await page.waitForTimeout(800);
  expect((await peak(page, 300)).state).toBe('suspended');
  await page.evaluate(() => (window as any).__game.scene.getScene('Settings').resumeGame());
  await tap(page, 360, 640);
  expect(await audioUp(page), 'Resume did not bring the audio back').toBe(true);
  const resumed = await peak(page, 2000);
  expect(resumed.peak, JSON.stringify(resumed)).toBeGreaterThan(AUDIBLE);
});

test('Continue applies the volumes saved in Settings', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tourlife.seenHowToPlay', '1'));
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  await page.evaluate(async () => {
    const S = (window as any).__state;
    S.newRun('volume-seed');
    S.data.band = { name: 'Copper Atlas', genre: 'indie_rock', whyTour: 'A label finally said yes.', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = ['lisbon', 'tokyo', 'mexico_city', 'berlin'].map((cityId) => ({ cityId, visited: false, weather: 'clear' }));
    S.data.progress = { screen: 'hub' };
    S.data.accessibility.volumes = { master: 0.8, music: 0, sfx: 0.3, metronome: 0.6 };
    const { saveRun } = (window as any).__test;
    await saveRun(S.data);
  });
  await page.reload();
  await waitForActiveScene(page, 'Title', 20000);
  expect(await waitForCondition(page, () => (window as any).__game.scene.getScene('Title').children.list.some((o: any) => /^Continue/.test(o.getData?.('labelText')?.text ?? '')), 8000)).toBe(true);
  await tap(page, 360, 665);   // Continue (the row below New Run)
  await waitForActiveScene(page, 'Hub', 15000);
  const v = await page.evaluate(() => (window as any).__audio.volumes);
  expect(v).toEqual({ master: 0.8, music: 0, sfx: 0.3, metronome: 0.6 });
});
