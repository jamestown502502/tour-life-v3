// A real, full, UI-driven playthrough of one complete city loop — Hub -> City (arrival ->
// minigame -> 2 locations -> relationship -> preshow choice) -> Rhythm (autoplay) -> Results ->
// City (afterShow -> journal) -> back to Hub. Exercises actual taps through actual dialogue,
// choices, a minigame, and a full song, unlike headless_playtest.test.ts (which walks the same
// shape at the state/logic layer only, bypassing the UI entirely — exactly why it never caught
// the tap-to-skip-typewriter bug: it never taps anything). This is the "did I miss anything else"
// check for Workstream 2's navigation-fix pass.
import { test, expect } from '@playwright/test';
import { bootGame, canvasClick, collectConsoleErrors, playAnyPendingMinigame, skipFirstTimeOnboarding, waitForActiveScene, waitForCondition, walkDialogueToSceneChange, clickPreShowChoice } from './helpers';

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

  // Hub -> Van -> City: "Travel to Lisbon" button (HubScene.ts: W/2-160, 820, 320, 66 — center
  // 360, 853). Travel now routes through the van (VanScene): a two-beat travel scene on the way
  // into every city. This test asserted Hub -> City directly and correctly caught the new step —
  // a real player taps through those two beats, so this walks them the same way.
  await canvasClick(page, 360, 853);
  expect(await waitForActiveScene(page, 'Van')).toContain('Van');
  await walkDialogueToSceneChange(page, 'Van');
  expect(await waitForActiveScene(page, 'City')).toContain('City');

  // Arrival dialogue, walked with real taps (this is the exact path the tap-to-skip bug broke).
  let taps = await walkDialogueToSceneChange(page, 'City');
  expect(taps, 'arrival dialogue should not exhaust the tap budget (would mean it got stuck)').toBeLessThan(40);

  // Lisbon's first minigame, between arrival and the location picker — CityScene routes to
  // MiniGameScene automatically if one hasn't been played yet this run.
  if (await playAnyPendingMinigame(page, 'City')) {
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

  // Stuck-screen-hardening follow-up: Addendum v2's Item 8a added a SECOND minigame insertion
  // point, right before preshow choices — Lisbon (this test's city) has one there
  // (lis_load_in, a 'drag' type). This test never checked for it before, so the very next click
  // (assumed to be the first preshow choice) silently landed on empty space on that minigame's
  // intro card instead, and the test failed waiting on a Rhythm scene that was never coming.
  if (await playAnyPendingMinigame(page, 'City')) {
    expect(await waitForActiveScene(page, 'City')).toContain('City');
  }

  // Preshow choice (first of 3), found by identity rather than a copied coordinate -> Rhythm,
  // via the 'lights' themed transition (Addendum v2, Item 9). This click surfaced a real crash
  // (see transition.ts's destroyOverlay comment): the completion delayedCall and the overlay's
  // own tweens raced at the same nominal duration, so destroying the overlay could null out a
  // tween's target mid-update — an uncaught exception inside Phaser's own TweenManager.step()
  // that recurred every frame afterward, silently stalling the scene forever (the apparent
  // "stuck transition" this test kept failing on, at every wait length tried up to 60s, before
  // the actual cause was found and fixed). 10s here is normal machine-load headroom, not a
  // workaround for that bug.
  await clickPreShowChoice(page, 0);
  const reachedRhythm = await waitForCondition(page, () => (window as any).__game.scene.getScenes(true).map((s: any) => s.scene.key).includes('Rhythm'), 10000);
  expect(reachedRhythm, 'preshow choice should hand off to Rhythm').toBe(true);

  // Autoplay (set above) judges every note automatically — just wait for the song to finish and
  // land on Results. Lisbon's song + tutorial (first-ever Rhythm visit) can run up to ~90s.
  const reachedResults = await waitForCondition(page, () => (window as any).__game.scene.getScenes(true).map((s: any) => s.scene.key).includes('Results'), 100000);
  expect(reachedResults, 'the song should reach Results on its own (no-fail, autoplay on)').toBe(true);

  // Results -> City (afterShow). ResultsScene.ts: W/2-150, 700, 300, 64 — center (360, 732).
  // This test's own coordinate was stale (360, 652), left over from before Addendum v2's Item 7
  // added the crowd strip (renderCrowdStrip, y=600) above the button and pushed it from wherever
  // it used to be down to y=700 — the click was landing on the crowd strip's own text, not the
  // button, and every failure here (even after generous wait increases) was this test tapping
  // the wrong spot, not a stuck transition. This is fullrun.spec.ts's first successful run past
  // this point since that content was added — nothing had exercised this exact click until the
  // stuck-screen-hardening pass's own fixes upstream (the Item 8a second-minigame handling, the
  // transition-overlay crash fix) finally let the test reach this far.
  await canvasClick(page, 360, 732);
  expect(await waitForActiveScene(page, 'City', 15000)).toContain('City');
  taps = await walkDialogueToSceneChange(page, 'City'); // afterShow
  expect(taps, 'afterShow dialogue should not exhaust the tap budget').toBeLessThan(40);
  taps = await walkDialogueToSceneChange(page, 'City'); // journal (if a separate dialogue leg)
  expect(taps, 'journal dialogue should not exhaust the tap budget').toBeLessThan(40);

  // The full loop should land back on Hub.
  expect(await waitForActiveScene(page, 'Hub', 15000)).toContain('Hub');
  expect(errors, errors.join('\n')).toEqual([]);
});
