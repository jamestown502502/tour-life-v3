// Player feedback 2026-10-12, verified fixes:
//  1. The live-radio clock: 3 s was shorter than reading the question; when it ran out the answers
//     stayed bright and tappable but did nothing. Now 6 s, and both answers dim and lock.
//  2. "My taps didn't score": a tap with no note in its window showed nothing at all. Every tap
//     now shows on its lane.
// (The transpose quiz's missing answer is covered by src/tests/quizIntegrity.test.ts.)
import { test, expect, type Page } from './fixtures';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene, startScene, clickButtonByLabel, answerSpotlightOffer, clickPreShowChoice, pressPlay, waitForCondition, canvasClick } from './helpers';

test.beforeEach(async ({ page }) => { await skipFirstTimeOnboarding(page); });

async function toTitle(page: Page) {
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  await page.evaluate(() => {
    const g: any = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => s.sys.settings.key !== 'Transition' && g.scene.stop(s.sys.settings.key));
    const S: any = (window as any).__state;
    S.newRun('feedback-fixes');
    S.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'feedback', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = [{ cityId: 'lisbon', visited: false }, { cityId: 'berlin', visited: false }];
  });
}

test('the radio clock gives 6 s, then both answers dim and stop taking taps', async ({ page }) => {
  test.setTimeout(90000);
  await toTitle(page);
  await startScene(page, 'MiniGame', { cityId: 'lisbon', minigameId: 'lis_live_radio', returnPhase: 'locations' });
  await waitForActiveScene(page, 'MiniGame', 10000);
  await page.waitForTimeout(800);
  await clickButtonByLabel(page, 'MiniGame', 'Start');
  // Read what the player reads: the countdown. While it shows time left, both answers are live;
  // once it says "Time's up", both are dimmed and locked. (Sampled on the game's own display, so a
  // slow runner drawing few frames cannot make this flaky.)
  const state = () => page.evaluate(() => {
    const s: any = (window as any).__game.scene.getScene('MiniGame');
    const texts = s.contentLayer.list.filter((o: any) => o.type === 'Text').map((o: any) => String(o.text));
    const clock = texts.find((t: string) => /^\d+\.\d$|^Time's up$/.test(t)) ?? null;
    const answers = s.contentLayer.list.filter((o: any) => o.type === 'Container' && o.list.some((c: any) => c.type === 'Text' && String(c.text).startsWith('"')))
      .map((o: any) => ({ alpha: o.alpha, live: !!o.list.find((c: any) => c.input && c.input.enabled) }));
    return { clock, answers };
  });
  let first: number | null = null, sawLive = false, sawUp = false;
  for (let i = 0; i < 400 && !sawUp; i++) {
    const st = await state();
    if (st.clock && st.clock !== "Time's up") {
      first ??= Number(st.clock);
      if (st.answers.length === 2 && Number(st.clock) > 0.3) {
        for (const a of st.answers) { expect(a.alpha).toBe(1); expect(a.live).toBe(true); }
        sawLive = true;
      }
    }
    if (st.clock === "Time's up") {
      expect(st.answers).toHaveLength(2);
      for (const a of st.answers) { expect(a.alpha).toBeLessThan(0.5); expect(a.live).toBe(false); }
      sawUp = true;
    }
    await page.waitForTimeout(100);
  }
  // The 6 s length itself is held by src/tests/quizIntegrity.test.ts (PRESSURE_MIN_SECONDS).
  expect(first).not.toBeNull();
  expect(sawLive).toBe(true);
  expect(sawUp).toBe(true);
});

test('every lane tap shows on its lane, scored or not', async ({ page }) => {
  test.setTimeout(150000);
  await toTitle(page);
  await page.evaluate(() => { const S: any = (window as any).__state; S.data.route = [{ cityId: 'berlin', visited: false }]; });
  await startScene(page, 'City', { cityId: 'berlin', phase: 'preshow-choices' });
  await waitForActiveScene(page, 'City', 10000);
  await page.waitForTimeout(1500);
  await answerSpotlightOffer(page, false);
  await clickPreShowChoice(page, 0);
  await waitForActiveScene(page, 'Rhythm', 15000);
  await pressPlay(page, 30000);
  expect(await waitForCondition(page, () => !!(window as any).__game.scene.getScene('Rhythm').songStarted, 60000)).toBe(true);
  // A timed tap shows its judgement flash; a mistimed one now shows a faint press (it used to show
  // nothing). Recorded at the call, so a slow runner cannot miss a 140 ms glow.
  await page.evaluate(() => {
    const r: any = (window as any).__game.scene.getScene('Rhythm');
    r.__taps = [];
    const orig = r.attemptHit.bind(r);
    r.attemptHit = (l: number) => { r.laneFlashes[l].setAlpha(0); orig(l); r.__taps.push({ l, shown: r.laneFlashes[l].alpha > 0 }); };
  });
  for (const lane of [0, 1, 2, 3]) await canvasClick(page, 30 + 165 * lane + 82, 930);
  const taps = await page.evaluate(() => (window as any).__game.scene.getScene('Rhythm').__taps);
  expect(taps.map((t: any) => t.l)).toEqual([0, 1, 2, 3]);
  for (const t of taps) expect(t.shown, `lane ${t.l}`).toBe(true);
});
