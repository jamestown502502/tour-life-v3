// A real, full, UI-driven playthrough of one complete city loop — Hub -> City (arrival ->
// minigame -> 2 locations -> relationship -> preshow choice) -> Rhythm (autoplay) -> Results ->
// City (afterShow -> journal) -> back to Hub. Exercises actual taps through actual dialogue,
// choices, a minigame, and a full song, unlike headless_playtest.test.ts (which walks the same
// shape at the state/logic layer only, bypassing the UI entirely — exactly why it never caught
// the tap-to-skip-typewriter bug: it never taps anything). This is the "did I miss anything else"
// check for Workstream 2's navigation-fix pass.
import { test, expect } from '@playwright/test';
import { bootGame, canvasClick, collectConsoleErrors, getActiveSceneKeys, skipFirstTimeOnboarding, waitForActiveScene, waitForCondition, walkDialogueToSceneChange } from './helpers';

test('a full real playthrough of one city loop never gets stuck', async ({ page }) => {
  // 180s wasn't enough headroom for the whole chain in this sandboxed session — confirmed live
  // via a failure screenshot mid-run: Score 12590, Combo x76, autoplay actively hitting notes
  // correctly, just past the point where the overall test budget ran out before the song (its
  // own bounded 100s wait below) finished on its own terms. Not a stuck-game bug; a too-tight
  // overall budget for arrival + minigame + 2 locations + relationships + a full song combined.
  test.setTimeout(300000);
  const errors = collectConsoleErrors(page);
  await skipFirstTimeOnboarding(page);
  await bootGame(page);
  await waitForActiveScene(page, 'Title');

  // Set up a run pointed at Lisbon directly (skips BandCreator/RoutePlan's own simple forms —
  // not where a "stuck" bug like the one this pass fixed would hide; the point of this test is
  // the actual story/dialogue/minigame/rhythm content) and jump straight to Hub, matching what a
  // real run looks like once RoutePlan's "Confirm route" has run.
  await page.evaluate(() => {
    const State = (window as any).__state;
    State.newRun('fullrun-e2e-seed');
    State.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because CI said so', members: ['mira', 'theo', 'jun', 'rowan'] };
    State.data.route = [{ cityId: 'lisbon', visited: false, weather: 'clear' }];
    State.data.currentCityIndex = 0;
    State.data.flags = ['onboard_hub_seen', 'onboard_routeplan_seen'];
    State.data.accessibility.autoplay = true; // let the rhythm song auto-complete — this test is about navigation, not rhythm timing
    // .start() called from outside any running scene's own context doesn't stop the scene that
    // was active before it (that's normally Phaser's job when a scene calls this.scene.start()
    // on itself, via goTo()) — Title was left running underneath Hub, live enough to receive
    // pointer events, so a later click meant for Hub could also land on a Title button. Confirmed
    // live: caused the active-scene list to show ["BandCreator", "MiniGame"] partway through this
    // test, from Title's own New Run flow firing alongside the intended clicks.
    (window as any).__game.scene.stop('Title');
    (window as any).__game.scene.start('Hub', undefined);
  });
  expect(await waitForActiveScene(page, 'Hub')).toContain('Hub');

  // Hub -> City: "Travel to Lisbon" button (HubScene.ts: W/2-160, 820, 320, 66 — center 360, 853).
  await canvasClick(page, 360, 853);
  expect(await waitForActiveScene(page, 'City')).toContain('City');

  // Arrival dialogue, walked with real taps (this is the exact path the tap-to-skip bug broke).
  let taps = await walkDialogueToSceneChange(page, 'City');
  expect(taps, 'arrival dialogue should not exhaust the tap budget (would mean it got stuck)').toBeLessThan(40);

  // Lisbon has one "timing" minigame between arrival and the location picker — CityScene routes
  // to MiniGameScene automatically if one hasn't been played yet this run.
  const wentToMinigame = await waitForCondition(page, () => (window as any).__game.scene.getScenes(true).map((s: any) => s.scene.key).includes('MiniGame'), 3000);
  if (wentToMinigame) {
    // Intro screen's "Start" button (MiniGameScene.ts: W/2-130, 500, 260, 66 — center 360, 533).
    await canvasClick(page, 360, 533);
    await page.waitForTimeout(400);
    // Timing round: tap "Tap!" (W/2-130, 560, 260, 70 — center 360, 595) a few times; no-fail
    // means a miss is fine, this just needs to reach the outro without hanging.
    for (let i = 0; i < 5; i++) {
      await canvasClick(page, 360, 595);
      await page.waitForTimeout(700);
      const stillMiniGame = (await getActiveSceneKeys(page)).includes('MiniGame');
      if (!stillMiniGame) break;
    }
    // Outro's "Continue" (W/2-130, btnY, 260, 66) — poll back to City rather than guess btnY.
    const backInCity = await waitForCondition(page, () => (window as any).__game.scene.getScenes(true).map((s: any) => s.scene.key).includes('City'), 5000);
    if (!backInCity) {
      // Still on the outro card — MiniGameScene.ts: W/2-130, min(560, SAFE_BOTTOM_Y-66)=560,
      // 260, 66, center (360, 593).
      await canvasClick(page, 360, 593);
    }
    expect(await waitForActiveScene(page, 'City')).toContain('City');
  }

  // Location picker: pick the first available location each time (LOCATIONS_TO_VISIT = 2).
  // CityScene.ts: first grid slot at (W/2-300, 660, 290, 70) — center (205, 695). After the
  // *last* location, CityScene moves straight into its relationship scene(s) in the same tick
  // (visitLocation's callback calls startRelationship() -> playNextRelationshipScene() ->
  // walk(), synchronously re-showing the dialogue box before this loop's next check) — so the
  // final walkDialogueToSceneChange call below carries straight through every relationship-pool
  // entry CityScene plays and stops only once preshow's choice buttons hide the dialogue box.
  for (let loc = 0; loc < 2; loc++) {
    await page.waitForTimeout(300);
    await canvasClick(page, 205, 695);
    taps = await walkDialogueToSceneChange(page, 'City');
    expect(taps, `location ${loc + 1}'s dialogue (and, after the last one, any relationship scenes) should not exhaust the tap budget`).toBeLessThan(40);
  }

  // Preshow choice (first of 3 — CityScene.ts: W/2-300, 960, 600, 66, center (360, 993)) -> Rhythm.
  await canvasClick(page, 360, 993);
  const reachedRhythm = await waitForCondition(page, () => (window as any).__game.scene.getScenes(true).map((s: any) => s.scene.key).includes('Rhythm'), 5000);
  expect(reachedRhythm, 'preshow choice should hand off to Rhythm').toBe(true);

  // Autoplay (set above) judges every note automatically — just wait for the song to finish and
  // land on Results. Lisbon's song + tutorial (first-ever Rhythm visit) can run up to ~90s.
  const reachedResults = await waitForCondition(page, () => (window as any).__game.scene.getScenes(true).map((s: any) => s.scene.key).includes('Results'), 100000);
  expect(reachedResults, 'the song should reach Results on its own (no-fail, autoplay on)').toBe(true);

  // Results -> City (afterShow). ResultsScene.ts: W/2-150, 620, 300, 64 — center (360, 652).
  await canvasClick(page, 360, 652);
  expect(await waitForActiveScene(page, 'City')).toContain('City');
  taps = await walkDialogueToSceneChange(page, 'City'); // afterShow
  expect(taps, 'afterShow dialogue should not exhaust the tap budget').toBeLessThan(40);
  taps = await walkDialogueToSceneChange(page, 'City'); // journal (if a separate dialogue leg)
  expect(taps, 'journal dialogue should not exhaust the tap budget').toBeLessThan(40);

  // The full loop should land back on Hub.
  expect(await waitForActiveScene(page, 'Hub', 15000)).toContain('Hub');
  expect(errors, errors.join('\n')).toEqual([]);
});
