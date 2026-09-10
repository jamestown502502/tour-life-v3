// Regression guards for the 3 critical issues reported live after the stuck-screens follow-up
// pass: (1) rhythm/minigames "skipping" gameplay, (2) VN text repeating on resume, (3) the
// canvas rendering off-center. Each test here is a specific, deterministic assertion for the
// root cause actually found and fixed — not a generic smoke check — so a future regression in
// any of these three mechanisms fails a specific, named test instead of only being caught by a
// live bug report again.
import { test, expect } from '@playwright/test';
import { bootGame, canvasClick, collectConsoleErrors, skipFirstTimeOnboarding, startScene, waitForActiveScene, waitForCondition, clickPreShowChoice } from './helpers';

test.describe('Critical-issues follow-up: regression guards', () => {
  // Root cause: only the PHASE ('arrival'/'preshow'/etc.) was persisted, not the exact dialogue
  // node within it — CityScene.ts's walk() now saves Progress.dialogueNodeId on every node
  // shown, and consumeResumeNode() uses it once on resume. This proves the full path: play two
  // real dialogue steps (including a choice), reload as a genuine interruption would, and assert
  // the resumed scene shows the THIRD line, not the first one again.
  test('VN resume lands on the exact dialogue node left off at, not a replay from the phase start', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title');

    await page.evaluate(() => {
      const State = (window as any).__state;
      State.newRun('resume-no-repeat-seed');
      State.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because', members: ['mira', 'theo', 'jun', 'rowan'] };
      State.data.route = [{ cityId: 'berlin', visited: false, weather: 'clear' }];
      State.data.currentCityIndex = 0;
      State.data.flags = ['onboard_hub_seen', 'onboard_routeplan_seen'];
      (window as any).__game.scene.stop('Title');
    });
    await startScene(page, 'City', { cityId: 'berlin', phase: 'arrival' });
    await waitForActiveScene(page, 'City');

    // Berlin's arrival node (ber_arrival): tap to skip the typewriter, tap the "gear" choice
    // (index 1 of 3), matching content/cities/berlin.json exactly.
    await canvasClick(page, 360, 800); // finish typing ber_arrival's line
    await page.waitForTimeout(150);
    const choiceLanded = await page.evaluate(() => {
      const scene = (window as any).__game.scene.getScene('City');
      const btn = scene.dialogueBox.choiceButtons[1];
      const bg = btn?.list.find((o: any) => o.type === 'Image' && o.input);
      if (!bg) return false;
      bg.emit('pointerdown');
      return true;
    });
    expect(choiceLanded, 'the gear choice button should exist and be clickable').toBe(true);
    await page.waitForTimeout(150);

    const beforeReload = await page.evaluate(() => ({
      dialogueNodeId: (window as any).__state.data.progress.dialogueNodeId,
      fullText: (window as any).__game.scene.getScene('City').dialogueBox.fullText,
    }));
    expect(beforeReload.dialogueNodeId, 'progress should now point at the second node, not the first').toBe('ber_arrival_gear');
    expect(beforeReload.fullText).toContain('parking attendant');

    // The actual interruption: a fresh page load, then resume through the real save/load/
    // resumeTarget path (loadRun -> resumeTarget -> scene.start), exactly what Continue does.
    await page.reload();
    await waitForActiveScene(page, 'Title');
    const resumed = await page.evaluate(async () => {
      const { loadRun } = await import('/src/core/save.ts');
      const { resumeTarget } = await import('/src/game/resume.ts');
      const data = await loadRun();
      const target = resumeTarget(data!.progress);
      (window as any).__state.data = data;
      (window as any).__game.scene.stop('Title');
      (window as any).__game.scene.start(target.key, target.data);
      return target;
    });
    expect(resumed.data.dialogueNodeId, 'the resume target should carry the saved dialogueNodeId through').toBe('ber_arrival_gear');
    await waitForActiveScene(page, 'City');

    const afterResume = await page.evaluate(() => {
      const scene = (window as any).__game.scene.getScene('City');
      scene.dialogueBox.handleTap(); // finish typing if still typing
      return scene.dialogueBox.fullText as string;
    });
    expect(afterResume, 'resuming should show the SECOND line directly — never replaying the first, already-seen line')
      .toContain('parking attendant');
    expect(afterResume).not.toContain('van dies in traffic');

    expect(errors, errors.join('\n')).toEqual([]);
  });

  // Root cause: transition.ts's tween/destroy race (fixed in commit e55455e) could freeze a
  // scene permanently right after a transition — from a player's seat, indistinguishable from
  // "the game skipped the gameplay entirely." This is the no-skip detector: a real song, real
  // autoplay judging, and a floor on elapsed real time before Results appears — Berlin's song
  // (content/songs/kreuzberg_static.json) runs ~58-61s; any transition-freeze or skip bug would
  // reach Results in well under a second instead.
  test('a rhythm song plays a real amount of gameplay before Results — never an instant skip', async ({ page }) => {
    test.setTimeout(120000);
    const errors = collectConsoleErrors(page);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title');

    await page.evaluate(() => {
      const State = (window as any).__state;
      State.newRun('no-skip-detector-seed');
      State.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because', members: ['mira', 'theo', 'jun', 'rowan'] };
      State.data.route = [{ cityId: 'berlin', visited: false, weather: 'clear' }];
      State.data.currentCityIndex = 0;
      State.data.flags = ['onboard_hub_seen', 'onboard_routeplan_seen'];
      // A pre-seen tutorial flag skips the practice pass so this test measures the REAL song's
      // own duration, not the tutorial's — the tutorial is separately proven not to skip by
      // the (already-passing) diagnostic trace run during this pass's own investigation.
      localStorage.setItem('tourlife.seenRhythmTutorial', '1');
      State.data.accessibility.autoplay = true;
      (window as any).__game.scene.stop('Title');
    });
    await startScene(page, 'City', { cityId: 'berlin', phase: 'preshow-choices' });
    await waitForActiveScene(page, 'City');

    const clickStart = Date.now();
    await clickPreShowChoice(page, 0); // Berlin's first preshow choice -> Rhythm ('lights')
    const reachedRhythm = await waitForCondition(page, () => (window as any).__game.scene.getScenes(true).map((s: any) => s.scene.key).includes('Rhythm'), 10000);
    expect(reachedRhythm, 'preshow choice should hand off to Rhythm').toBe(true);

    const reachedResults = await waitForCondition(page, () => (window as any).__game.scene.getScenes(true).map((s: any) => s.scene.key).includes('Results'), 100000);
    const elapsedMs = Date.now() - clickStart;
    expect(reachedResults, 'the song should reach Results on its own (no-fail, autoplay on)').toBe(true);
    expect(elapsedMs, `reached Results in only ${elapsedMs}ms — Berlin's song runs ~58-61s; this fast means gameplay was skipped, not played`)
      .toBeGreaterThan(20000);

    // PerformanceResult (src/game/rhythm.ts) doesn't expose the raw judgement list, only the
    // aggregate timingScore — with autoplay on, a song that actually ran judges every note as a
    // hit, so a positive score is real evidence gameplay happened (a skip would leave it at its
    // init() default of 0, never touched).
    const timingScore = await page.evaluate(() => (window as any).__game.scene.getScene('Results')?.result?.timingScore ?? -1);
    expect(timingScore, 'a real timing score should be recorded — 0 (or missing) means no notes were ever judged').toBeGreaterThan(0);

    expect(errors, errors.join('\n')).toEqual([]);
  });

  // Root cause: main.ts's Phaser scale config previously used autoCenter: CENTER_BOTH while
  // index.html's #app is ALSO a flex-centered container — Phaser's own inline margin-left/
  // margin-top compounded with the flexbox's centering, pushing the canvas well right of center
  // (confirmed live at 1366x768: canvas x=700.5 instead of the correct 467). Fixed with
  // autoCenter: NO_CENTER, leaving centering entirely to the CSS flexbox. This asserts the
  // canvas is centered within 2px at every device profile this suite already runs on.
  test('the canvas is centered in the viewport, not offset to one side', async ({ page }) => {
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title');

    const { canvasRect, viewport } = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')!;
      const r = canvas.getBoundingClientRect();
      return {
        canvasRect: { x: r.x, y: r.y, width: r.width, height: r.height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      };
    });

    const canvasCenterX = canvasRect.x + canvasRect.width / 2;
    const viewportCenterX = viewport.width / 2;
    expect(Math.abs(canvasCenterX - viewportCenterX),
      `canvas center x=${canvasCenterX} vs viewport center x=${viewportCenterX} (rect=${JSON.stringify(canvasRect)}, viewport=${JSON.stringify(viewport)})`,
    ).toBeLessThanOrEqual(2);

    const canvasCenterY = canvasRect.y + canvasRect.height / 2;
    const viewportCenterY = viewport.height / 2;
    expect(Math.abs(canvasCenterY - viewportCenterY),
      `canvas center y=${canvasCenterY} vs viewport center y=${viewportCenterY}`,
    ).toBeLessThanOrEqual(2);
  });
});
