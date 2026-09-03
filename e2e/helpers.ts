// Shared helpers for the device-matrix smoke suite (docs/CROSS_PLATFORM_TESTING.md). Phaser
// draws everything to a single <canvas> — there's no DOM for a normal Playwright locator to read
// text from or click by role/label — so these helpers click by the game's own logical (720x1280)
// coordinate space, translated to the canvas element's actual rendered box, and read scene state
// back via window.__game/__state (src/main.ts, exposed in DEV only, which is why this suite runs
// against `npm run dev` rather than the production build — see playwright.config.ts's header).
import type { Page } from '@playwright/test';

export const LOGICAL_W = 720;
export const LOGICAL_H = 1280;

/** Navigates to the app and waits for Phaser to have booted (window.__game present, at least
 *  one active scene) — the game's own boot sequence (font loading, first scene create()) can
 *  take a beat, so this polls rather than using a fixed sleep. */
export async function bootGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => {
    const g = (window as any).__game;
    return !!g && g.scene.getScenes(true).length > 0;
  }, { timeout: 15000 });
}

/** Marks this browser profile as "has played before" — a fresh Playwright context otherwise
 *  looks identical to a real first-time player, and TitleScene.create() auto-opens the
 *  first-time HowToPlay overlay over Title on every boot in that case (src/core/onboarding.ts).
 *  That's correct, intentional behavior — see e2e/smoke.spec.ts's dedicated first-time-player
 *  test — but it means most of this suite (which is testing Continue/resume/Settings, not
 *  onboarding) needs it skipped to reach Title/Hub/City directly. */
export async function skipFirstTimeOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('tourlife.seenHowToPlay', '1');
  });
}

/** The Phaser scene keys currently active (started, not necessarily visible — e.g. a paused
 *  scene under a launched Settings overlay is still "active" in Phaser's terms; use
 *  getVisibleSceneKeys for what's actually on screen). */
export async function getActiveSceneKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).__game.scene.getScenes(true).map((s: any) => s.scene.key));
}

export async function getVisibleSceneKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window as any).__game.scene.getScenes(true)
      .filter((s: any) => s.scene.settings.visible !== false)
      .map((s: any) => s.scene.key));
}

/** Polls (rather than a fixed sleep) until `key` is among the active scenes, or the timeout
 *  elapses — faster on the happy path than a worst-case-sized fixed wait, and doesn't silently
 *  eat into the per-test time budget the way several stacked waitForTimeout calls do. Returns
 *  the final active-scene list either way so the caller gets a useful assertion message on
 *  failure instead of just "timed out". */
export async function waitForActiveScene(page: Page, key: string, timeoutMs = 8000): Promise<string[]> {
  const deadline = Date.now() + timeoutMs;
  let last: string[] = [];
  while (Date.now() < deadline) {
    last = await getActiveSceneKeys(page);
    if (last.includes(key)) return last;
    await page.waitForTimeout(100);
  }
  return last;
}

/** Polls `check()` (an in-page function returning a boolean) until it's true or `timeoutMs`
 *  elapses. Used instead of a fixed waitForTimeout wherever "mid-typewriter" or similar transient
 *  game state needs to be caught reliably — a fixed delay is a race against however fast this
 *  particular run's CDP round-trips/CPU happen to be, and was confirmed flaky in practice (a
 *  300ms wait that reliably landed mid-typewriter in one run finished typing early in another,
 *  same code, just slower page.evaluate round-trips that run). Returns whether it succeeded. */
export async function waitForCondition(page: Page, check: () => boolean, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await page.evaluate(check)) return true;
    await page.waitForTimeout(30);
  }
  return false;
}

/** Generic dialogue-walker for real full-playthrough tests: repeatedly taps the dialogue panel
 *  (advancing or skip-completing a typing line — since the tap-to-skip fix, either state now
 *  converges correctly, which this exercises implicitly on every tap) and clicks the first choice
 *  whenever choices are showing. Stops when either (a) `sceneKey` is no longer active (a minigame/
 *  rhythm hand-off) or (b) the dialogue box itself goes idle/hidden — confirmed live: visiting a
 *  City location doesn't change the active scene at all, it walks that location's dialogue chain
 *  and returns to the *same* CityScene's location picker, which explicitly hides the dialogue box
 *  (`this.dialogueBox.setVisible(false)` in `renderLocationButtons()`/`renderPreShowChoices()`) —
 *  without watching for that too, this kept tapping into the void until it exhausted its tap
 *  budget, a bug in this test's own exit condition, not the app. Returns the tap count actually
 *  used — a caller asserting against `< maxTaps` gets a real "didn't get stuck" signal, not just
 *  "didn't crash". */
export async function walkDialogueToSceneChange(page: Page, sceneKey: string, maxTaps = 40): Promise<number> {
  let taps = 0;
  for (; taps < maxTaps; taps++) {
    const state = await page.evaluate((key) => {
      const g = (window as any).__game;
      const active = g.scene.getScenes(true).map((s: any) => s.scene.key);
      if (!active.includes(key)) return { done: true } as const;
      const db = g.scene.getScene(key)?.dialogueBox;
      if (!db) return { done: false, hasDb: false } as const;
      if (!db.container.visible) return { done: true } as const;
      const choice = db.choiceButtons[0];
      const b = choice?.getBounds();
      return { done: false, hasDb: true, choiceXY: b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null } as const;
    }, sceneKey);
    if (state.done) return taps;
    if (!state.hasDb) { await page.waitForTimeout(150); continue; }
    if (state.choiceXY) await canvasClick(page, state.choiceXY.x, state.choiceXY.y);
    else await canvasClick(page, 360, 800);
    await page.waitForTimeout(150);
  }
  return taps;
}

/** Starts a scene directly via the global scene manager, bypassing Title/goTo — for tests that
 *  need to land on a specific scene+data combination without playing through to reach it (e.g. a
 *  specific city's arrival dialogue). Faster and more precise than seeding a save + Continue, but
 *  doesn't stop whatever scene was previously running the way a real goTo() transition does —
 *  fine for a fresh page load where nothing else is running yet. */
export async function startScene(page: Page, key: string, data?: object): Promise<void> {
  await page.evaluate(({ key, data }) => (window as any).__game.scene.start(key, data), { key, data });
}

/** Clicks at a point in the game's own 720x1280 logical coordinate space — Phaser's Scale.FIT
 *  resizes the canvas element itself to the scaled/letterboxed content, so a position relative
 *  to the canvas element's own bounding box (not the page) lands correctly regardless of the
 *  device's actual viewport size or pixel ratio. */
export async function canvasClick(page: Page, logicalX: number, logicalY: number, opts: { timeout?: number } = {}): Promise<void> {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas not found/visible for canvasClick');
  // force: true — Playwright's default click() also waits for the target to be "stable" (its
  // bounding box unchanged across two consecutive animation frames). The canvas element's own
  // box never moves or resizes during gameplay (only its drawn *content* changes, which
  // stability-checking doesn't look at), so that wait is never actually protecting against
  // anything real here — and confirmed live, it can stall for a very long time in this sandboxed
  // environment's slower rendering (a single click waited the full length of a 180s test budget).
  // force skips straight to dispatching the event at the computed position.
  await canvas.click({
    position: { x: (logicalX / LOGICAL_W) * box.width, y: (logicalY / LOGICAL_H) * box.height },
    force: true,
    timeout: opts.timeout ?? 10000,
  });
}

/** A minimal-but-schema-valid RunState (see src/core/state.ts's freshRun/RunState) for seeding
 *  localStorage directly — lets a resume-state test start from "a save already exists with this
 *  exact progress" without having to play through the whole game to reach it. loadFromKey
 *  (src/core/save.ts) checks IndexedDB first and falls through to localStorage when that key
 *  isn't there, which is always true for a fresh Playwright browser context/profile. */
export function buildSeedState(progress: { screen: string; cityId?: string; nodeId?: string }, overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    seed: 'e2e-seed',
    band: { name: 'The Testbeds', genre: 'indie', whyTour: 'because CI said so', members: ['mira', 'theo', 'jun', 'rowan'] },
    stats: { energy: 70, harmony: 60, inspiration: 60, funds: 500 },
    localLove: {},
    relationships: { mira: 20, theo: 20, jun: 20, rowan: 20 },
    // onboard_hub_seen/onboard_routeplan_seen (State.data.flags, run-scoped) gate a one-time
    // intro DialogueBox in HubScene/RoutePlanScene — without these, a seeded save landing on
    // either scene shows that intro instead of the real screen, and every coordinate this suite
    // clicks afterward misses (confirmed live: Hub's Settings-button click landed on empty space
    // below the intro dialogue panel instead). A returning player's real save already has these.
    flags: ['onboard_hub_seen', 'onboard_routeplan_seen'],
    inventory: [],
    route: [{ cityId: 'lisbon', visited: false, weather: 'clear' }, { cityId: 'tokyo', visited: false, weather: 'clear' }],
    log: [],
    currentCityIndex: 0,
    midTourComplication: '',
    progress,
    meta: { completedRuns: 0, unlockedGenres: [], unlockedDecor: [], runHistory: [] },
    accessibility: {
      visualAssist: true, audioAssist: false, wiggleRoom: false, easyScoring: false,
      rhythmMode: 'standard', autoplay: false, noFailCozyMode: true, reducedMotion: false,
      noFlash: false, autoAdvance: false, skipReadText: false, audioOffsetMs: 0,
      tapSoundEnabled: true, haptics: false,
      volumes: { master: 1, music: 0.7, sfx: 0.9, metronome: 0.6 },
    },
    ...overrides,
  };
}

/** Writes a save directly into localStorage under the app's real save key, before the app has
 *  loaded (so it's present the moment loadRun() is first called on Continue). */
export async function seedSave(page: Page, progress: { screen: string; cityId?: string; nodeId?: string }, overrides: Record<string, unknown> = {}): Promise<void> {
  const state = buildSeedState(progress, overrides);
  await page.addInitScript((s) => {
    window.localStorage.setItem('tourlife.run', JSON.stringify(s));
    // A save existing implies a returning player — without this, TitleScene.create() auto-opens
    // the first-time HowToPlay overlay over Title on every fresh browser context (src/core/
    // onboarding.ts), which blocks the Continue button entirely (a real interaction this test
    // suite caught: a fresh profile with a save present still saw HowToPlay eat the first tap).
    window.localStorage.setItem('tourlife.seenHowToPlay', '1');
  }, state);
}

/** Collects page console errors from the moment this is called — call before bootGame(). */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}
