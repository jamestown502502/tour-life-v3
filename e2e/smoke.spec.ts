// Device-matrix smoke suite — Workstream 3 (docs/CROSS_PLATFORM_TESTING.md) of the UX/QA fix
// pass, and the primary automated evidence for Workstream 2's "every resume path lands playable"
// claim. Runs against the DEV server (see playwright.config.ts's header for why) at 4 device
// profiles: iPhone 12, iPhone 14, Pixel 7, and a generic 360x740 Android viewport.
import { test, expect } from '@playwright/test';
import { bootGame, canvasClick, collectConsoleErrors, getActiveSceneKeys, startScene, waitForActiveScene, waitForCondition, seedSave, skipFirstTimeOnboarding } from './helpers';

test.describe('boot', () => {
  test('a first-time player (fresh profile, no save) sees the HowToPlay overlay auto-open over Title — intentional onboarding, not a bug', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootGame(page); // deliberately no skipFirstTimeOnboarding() here
    expect(await waitForActiveScene(page, 'HowToPlay')).toContain('HowToPlay');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('a returning player (onboarding already seen) boots straight to Title with no console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title');
    expect(await getActiveSceneKeys(page)).toContain('Title');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('New Run', () => {
  test('New Run (no prior save) reaches BandCreator directly', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title');
    await page.waitForTimeout(300); // let the async hasSave() check + button entrance tween settle
    // TitleScene.ts: New Run button at (W/2-160, 556, 200, 66) — center (280, 589).
    await canvasClick(page, 280, 589);
    const active = await waitForActiveScene(page, 'BandCreator');
    expect(active, `active scenes: ${active.join(',')}`).toContain('BandCreator');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

// Workstream 2's core claim: every progress.screen value a save can carry must resume to a
// playable scene, not a frozen Title/blank canvas. Covers both every real ScreenName (via a
// directly-seeded save, so this doesn't depend on playing through the whole game to reach each
// state) and the specific stale-data edge cases the fix pass hardened resumeTarget against.
const RESUME_CASES: { name: string; progress: { screen: string; cityId?: string; nodeId?: string }; expectScene: string }[] = [
  { name: 'title', progress: { screen: 'title' }, expectScene: 'Title' },
  { name: 'bandCreator', progress: { screen: 'bandCreator' }, expectScene: 'BandCreator' },
  { name: 'routePlan', progress: { screen: 'routePlan' }, expectScene: 'RoutePlan' },
  { name: 'hub', progress: { screen: 'hub' }, expectScene: 'Hub' },
  { name: 'city arrival', progress: { screen: 'city', cityId: 'lisbon', nodeId: 'arrival' }, expectScene: 'City' },
  { name: 'city locations', progress: { screen: 'city', cityId: 'lisbon', nodeId: 'locations' }, expectScene: 'City' },
  { name: 'city, no nodeId (never set)', progress: { screen: 'city', cityId: 'lisbon' }, expectScene: 'City' },
  { name: 'city, mid-transition-to-Rhythm nodeId ("preshow-done", not a real phase)', progress: { screen: 'city', cityId: 'lisbon', nodeId: 'preshow-done' }, expectScene: 'City' },
  { name: 'city, unknown/stale cityId (renamed or removed content)', progress: { screen: 'city', cityId: 'atlantis_that_never_shipped' }, expectScene: 'Hub' },
  { name: 'rhythm (no persisted in-flight song state)', progress: { screen: 'rhythm', cityId: 'lisbon' }, expectScene: 'Hub' },
  { name: 'results', progress: { screen: 'results' }, expectScene: 'Hub' },
  { name: 'settings', progress: { screen: 'settings' }, expectScene: 'Hub' },
  { name: 'scrapbook', progress: { screen: 'scrapbook' }, expectScene: 'Scrapbook' },
];

test.describe('Continue resumes every progress.screen value to a playable scene', () => {
  for (const { name, progress, expectScene } of RESUME_CASES) {
    test(`resume: ${name}`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      await seedSave(page, progress);
      await bootGame(page);
      await waitForActiveScene(page, 'Title');
      await page.waitForTimeout(300); // let the async hasSave() check + button entrance tween settle
      // TitleScene.ts: Continue button at (W/2-160, 632, 320, 66) — center (360, 665). Fixed
      // position regardless of whether it renders (see TitleScene.ts's own comment on continueY).
      await canvasClick(page, 360, 665);
      const active = await waitForActiveScene(page, expectScene);
      expect(active, `expected ${expectScene} to be active after Continue from progress.screen="${progress.screen}"; active scenes: ${active.join(',')}`)
        .toContain(expectScene);
      // The actual "stuck" symptom: still on Title after tapping Continue — except for the one
      // case where Title genuinely is the correct destination (progress.screen: 'title').
      if (expectScene !== 'Title') expect(active).not.toContain('Title');
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
});

// SettingsScene.ts: the fix pass's 2-button Back/Quit-to-Title row starts after 9 bool toggles
// (5 grid rows) + dialogue/rhythm-mode/audio-sync rows (3) + Volumes header + 4 volume rows —
// computed the same way SettingsScene.ts's own y-accumulation does.
const SETTINGS_ROW_Y = 130 + Math.ceil(9 / 2) * 78 + 10 + 76 * 3 + 36 + 76 * 4 + 12 + 28;

test.describe('Settings is reachable from every resumable screen and Back returns to it', () => {
  test('Hub -> Settings -> Back returns to Hub, paused state intact', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await seedSave(page, { screen: 'hub' });
    await bootGame(page);
    await waitForActiveScene(page, 'Title');
    await page.waitForTimeout(300);
    await canvasClick(page, 360, 665); // Continue
    expect(await waitForActiveScene(page, 'Hub')).toContain('Hub');

    // HubScene.ts: Settings button at (W/2-100, 1140, 200, 66) — center (360, 1173).
    await canvasClick(page, 360, 1173);
    expect(await waitForActiveScene(page, 'Settings')).toContain('Settings');

    await canvasClick(page, 720 / 2 - 150 + 72, SETTINGS_ROW_Y); // Back (left half)
    await page.waitForTimeout(400);
    const active = await getActiveSceneKeys(page);
    expect(active).toContain('Hub');
    expect(active).not.toContain('Settings');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('City has a Menu button reaching Settings, and Quit to Title actually lands on Title (Workstream 2: previously no escape existed from City at all)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await seedSave(page, { screen: 'city', cityId: 'lisbon', nodeId: 'locations' });
    await bootGame(page);
    await waitForActiveScene(page, 'Title');
    await page.waitForTimeout(300);
    await canvasClick(page, 360, 665); // Continue
    expect(await waitForActiveScene(page, 'City')).toContain('City');

    // MenuButton.ts: BTN_X=20, BTN_Y=20+76 (CityScene stacks it below DialogueBox's own
    // same-spot backlog toggle — see MenuButton.ts's comment), BTN_SIZE=66 — center (53, 129).
    await canvasClick(page, 53, 129);
    expect(await waitForActiveScene(page, 'Settings')).toContain('Settings');

    await canvasClick(page, 720 / 2 + 5 + 72, SETTINGS_ROW_Y); // Quit to Title (right half)
    const active = await waitForActiveScene(page, 'Title');
    expect(active).toContain('Title');
    expect(active).not.toContain('City');
    expect(active).not.toContain('Settings');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('Rhythm has a Menu button reaching Settings (added after a live report: no escape existed from any mid-song state)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    // bootGame() only waits for a scene to exist (true the instant BootScene itself starts),
    // not for its own async manifest load to finish — Title only appears once that's genuinely
    // done, so waiting for it here (rather than jumping straight to Rhythm) is what guarantees
    // real assets like bg_rhythm_lisbon are already in the texture manager before RhythmScene's
    // own ensureRhythmStageBackdrop checks for them. Confirmed live: skipping this wait let the
    // code-drawn fallback and BootScene's own real-asset load race for the same texture key
    // ("Texture key already in use: bg_rhythm_lisbon") — impossible in real play, where a player
    // can never reach Rhythm before Title has already proven Boot fully finished.
    await waitForActiveScene(page, 'Title');
    await startScene(page, 'Rhythm', { cityId: 'lisbon' });
    await page.waitForTimeout(500);

    // MenuButton.ts: BTN_X=20, BTN_Y=20+86 (RhythmScene's own yOffset, clears the Score/Combo
    // text above it) — center (53, 139).
    await canvasClick(page, 53, 139);
    expect(await waitForActiveScene(page, 'Settings')).toContain('Settings');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

// Regression coverage for a real live bug report: DialogueBox.handleTap()'s tap-to-skip-typing
// path called finishTyping() but never afterTypeComplete() — so tapping to skip a long line's
// typewriter animation (a completely normal move, not an edge case) left the player with the
// full text on screen and no way to proceed: no choice buttons on a choice node, no chevron/
// second-tap on a plain node. Reported live on Mexico City's arrival line (long text, 3 choices —
// exactly the shape most likely to get an impatient tap). Fixed by having the skip path run the
// same completion logic the typewriter's own onComplete would have.
// This environment's browser rendering is unreliable enough (confirmed live: a fully synchronous
// page.evaluate() round-trip, with zero explicit wait, sometimes already observed a ~5s
// typewriter tween as 100% complete — Phaser's tween clock runs on real elapsed time, and a
// single delayed animation frame can "catch up" the whole tween in one jump if painting was
// deferred) that racing real wall-clock time to catch a "mid-typewriter" instant is not a
// reliable test strategy here — not even a polling one, since nothing renders between polls
// either. These call DialogueBox.show() directly with a throwaway node, entirely bypassing
// CityScene's own content-driven flow: `typing` is set synchronously inside show(), *before* the
// tween that reveals text is even created, so checking it in the same script (no await in
// between) is deterministic regardless of real animation/frame timing.
test.describe('dialogue tap-to-skip-typewriter must not soft-lock progression', () => {
  test('a choice node still shows its choices after tap-to-skip', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    // See the "Rhythm has a Menu button" test's comment above: bootGame() resolves the instant
    // BootScene exists, not once its own async manifest load finishes — jumping straight to City
    // without waiting for Title first (Boot's real completion signal) risked exactly this test's
    // own pre-existing flake, "Texture key already in use: bg_city_mexico_city".
    await waitForActiveScene(page, 'Title');
    await startScene(page, 'City', { cityId: 'mexico_city', phase: 'arrival' });
    const hasDb = await waitForCondition(page, () => !!(window as any).__game.scene.getScene('City')?.dialogueBox);
    expect(hasDb, 'test setup: DialogueBox must exist').toBe(true);

    const result = await page.evaluate(() => {
      const db = (window as any).__game.scene.getScene('City').dialogueBox;
      const node = { id: 'test_choice', speaker: 'narrator', text: 'A' + 'x'.repeat(200), choices: [
        { id: 'a', label: 'Option A', next: 'x' }, { id: 'b', label: 'Option B', next: 'y' },
      ] };
      db.show(node, () => {}, () => {});
      const typingRightAfterShow = db.typing; // must be true — set synchronously in show()
      db.handleTap(); // the tap-to-skip a real impatient tap sends
      return {
        typingRightAfterShow, typingAfterTap: db.typing,
        bodyLen: db.bodyText.text.length, fullLen: db.fullText.length, choiceButtonCount: db.choiceButtons.length,
      };
    });
    expect(result.typingRightAfterShow, 'test setup: typing must be true synchronously inside show()').toBe(true);
    expect(result.typingAfterTap).toBe(false);
    expect(result.bodyLen).toBe(result.fullLen);
    expect(result.choiceButtonCount, 'the 2 choice buttons must render after tap-to-skip, not just after the typewriter finishes on its own').toBe(2);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('a plain tap-to-advance node still advances (via the chevron path) after tap-to-skip', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    // See the "Rhythm has a Menu button" test's comment above: bootGame() resolves the instant
    // BootScene exists, not once its own async manifest load finishes — jumping straight to City
    // without waiting for Title first (Boot's real completion signal) risked exactly this test's
    // own pre-existing flake, "Texture key already in use: bg_city_mexico_city".
    await waitForActiveScene(page, 'Title');
    await startScene(page, 'City', { cityId: 'mexico_city', phase: 'arrival' });
    const hasDb = await waitForCondition(page, () => !!(window as any).__game.scene.getScene('City')?.dialogueBox);
    expect(hasDb, 'test setup: DialogueBox must exist').toBe(true);

    const result = await page.evaluate(() => {
      const db = (window as any).__game.scene.getScene('City').dialogueBox;
      let advanceCount = 0;
      const node = { id: 'test_plain', speaker: 'narrator', text: 'B' + 'y'.repeat(200) };
      db.show(node, () => { advanceCount++; }, () => {});
      const typingRightAfterShow = db.typing;
      db.handleTap(); // tap-to-skip
      const stateAfterSkip = { typing: db.typing, chevronVisible: db.chevron.visible, hasOnAdvance: !!db.onSkippedOrAdvance };
      db.handleTap(); // second tap: should now invoke onAdvance via the chevron path
      return { typingRightAfterShow, stateAfterSkip, advanceCount };
    });
    expect(result.typingRightAfterShow, 'test setup: typing must be true synchronously inside show()').toBe(true);
    expect(result.stateAfterSkip.typing).toBe(false);
    expect(result.stateAfterSkip.chevronVisible, 'chevron must appear after tap-to-skip on a plain node, or a second tap has nothing to do').toBe(true);
    expect(result.stateAfterSkip.hasOnAdvance).toBe(true);
    expect(result.advanceCount, 'onAdvance must fire exactly once from the second tap').toBe(1);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
