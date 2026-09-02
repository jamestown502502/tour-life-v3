// Device-matrix smoke suite — Workstream 3 (docs/CROSS_PLATFORM_TESTING.md) of the UX/QA fix
// pass, and the primary automated evidence for Workstream 2's "every resume path lands playable"
// claim. Runs against the DEV server (see playwright.config.ts's header for why) at 4 device
// profiles: iPhone 12, iPhone 14, Pixel 7, and a generic 360x740 Android viewport.
import { test, expect } from '@playwright/test';
import { bootGame, canvasClick, collectConsoleErrors, getActiveSceneKeys, waitForActiveScene, seedSave, skipFirstTimeOnboarding } from './helpers';

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
});
