// Live report: dialogue repeats during the intro (and after a minigame returns to the city).
//
// Mechanism under test: the stabilization revert restored transition.ts to its original simple
// form — camera.fadeOut, then once(FADE_OUT_COMPLETE, () => scene.start(key, data)) — which has
// no single-flight guard. A rapid double-tap on any button that calls goTo() runs it twice, so
// fadeOut restarts and TWO completion listeners are registered against the same fade. When it
// completes both fire, scene.start runs twice, and Phaser stops and restarts the target scene:
// its create() runs a second time and the sequence plays again from the top. That reads exactly
// as "the intro text repeated" / "duplicate text after the minigame".
//
// Measured at the SceneManager, not by eyeballing text: scene.start is wrapped in-page (test-only
// instrumentation, no production hook) and its calls counted per scene key. A double-tap must
// start the target exactly once.
import { test, expect } from '@playwright/test';
import { bootGame, skipFirstTimeOnboarding, canvasClick, waitForActiveScene, LOGICAL_W, LOGICAL_H } from './helpers';

/** Counts SceneManager.start() calls per key from this point on. */
async function countSceneStarts(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const mgr: any = (window as any).__game.scene;
    (window as any).__starts = {};
    if ((window as any).__startsPatched) return;
    (window as any).__startsPatched = true;
    const orig = mgr.start.bind(mgr);
    mgr.start = (key: string, data?: object) => {
      const s = (window as any).__starts;
      s[key] = (s[key] ?? 0) + 1;
      return orig(key, data);
    };
  });
}

/** Fires a scene's Nth interactive button handler twice, back to back, in ONE page call.
 *
 *  Real rapid clicks cannot express this on a slow harness: Phaser resolves pointer state once
 *  per frame, so at the ~4fps this environment renders at, two clicks milliseconds apart collapse
 *  into a single pointerdown and the test silently proves nothing. Emitting on the button's own
 *  interactive child is what two taps on a real 60fps phone actually deliver to the handler, and
 *  it is frame-rate independent. */
async function doubleFireButton(page: import('@playwright/test').Page, sceneKey: string, label: string): Promise<boolean> {
  return page.evaluate(({ sceneKey, label }) => {
    const s: any = (window as any).__game.scene.getScene(sceneKey);
    const findBtn = (list: any[]): any => {
      for (const o of list) {
        if (Array.isArray(o.list)) {
          const hasLabel = o.list.some((c: any) => c.type === 'Text' && String(c.text ?? '').includes(label));
          const bg = o.list.find((c: any) => c.input?.enabled);
          if (hasLabel && bg) return bg;
          const nested = findBtn(o.list);
          if (nested) return nested;
        }
      }
      return null;
    };
    const bg = findBtn(s.children.list);
    if (!bg) return false;
    bg.emit('pointerdown');
    bg.emit('pointerdown');
    return true;
  }, { sceneKey, label });
}

/** Two real clicks at the same canvas point, as close together as the driver allows. */
async function rapidDoubleClick(page: import('@playwright/test').Page, lx: number, ly: number): Promise<void> {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box) throw new Error('canvas not visible');
  const x = box.x + (lx / LOGICAL_W) * box.width;
  const y = box.y + (ly / LOGICAL_H) * box.height;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await page.mouse.down();
  await page.mouse.up();
}

test.describe('A double-tap must never start a scene twice', () => {
  test('double-tapping New Run starts the next scene exactly once', async ({ page }) => {
    test.setTimeout(120000);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await page.waitForTimeout(600);
    await countSceneStarts(page);

    // Two taps delivered to the handler, as a 60fps device would (see doubleFireButton).
    const fired = await doubleFireButton(page, 'Title', 'New Run');
    expect(fired, 'could not find the New Run button to double-fire').toBe(true);
    // Well past the 250ms fade, so every queued completion listener has fired.
    await page.waitForTimeout(2500);

    const starts = await page.evaluate(() => (window as any).__starts as Record<string, number>);
    console.log('[double-start New Run]', JSON.stringify(starts));
    const doubled = Object.entries(starts).filter(([, n]) => n > 1);
    expect(
      doubled,
      `a double-tap started ${doubled.map(([k, n]) => `${k} x${n}`).join(', ')} — ` +
      'each extra start re-runs that scene\'s create(), replaying its dialogue from the top',
    ).toEqual([]);
  });

  test('double-tapping a minigame Continue returns to the city exactly once', async ({ page }) => {
    test.setTimeout(150000);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await page.evaluate(() => (window as any).__game.scene.stop('Title'));

    await page.evaluate(() => (window as any).__game.scene.start('MiniGame', {
      cityId: 'tokyo', minigameId: 'tok_pack_van', returnPhase: 'locations',
    }));
    await waitForActiveScene(page, 'MiniGame', 15000);
    await page.waitForTimeout(600);
    await countSceneStarts(page);

    // Skip straight to the outro card, then double-tap its Continue button
    // (MiniGameScene.finish(): W/2-130, 560, 260, 66 -> center 360, 593).
    await page.evaluate(() => {
      const s: any = (window as any).__game.scene.getScene('MiniGame');
      s.finish(true);
    });
    await page.waitForTimeout(800);
    const fired2 = await doubleFireButton(page, 'MiniGame', 'Continue');
    expect(fired2, 'could not find the minigame Continue button to double-fire').toBe(true);
    await page.waitForTimeout(2500);

    const starts = await page.evaluate(() => (window as any).__starts as Record<string, number>);
    console.log('[double-start minigame Continue]', JSON.stringify(starts));
    const doubled = Object.entries(starts).filter(([, n]) => n > 1);
    expect(
      doubled,
      `a double-tap started ${doubled.map(([k, n]) => `${k} x${n}`).join(', ')} — ` +
      'restarting City replays the phase dialogue the player just finished',
    ).toEqual([]);
  });

  // The symptom itself, independent of the mechanism: whatever the player is shown during the
  // intro, no single line may be presented twice in a row. DialogueBox records every line it
  // shows in its own backlog, which is exactly what the player would perceive as "repeated".
  test('the intro never shows the same line twice', async ({ page }) => {
    test.setTimeout(150000);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await page.evaluate(() => (window as any).__game.scene.stop('Title'));
    await page.evaluate(() => (window as any).__game.scene.start('Opening'));
    await waitForActiveScene(page, 'Opening', 15000);

    // Tap through every beat of the intro, including the closing why-tour line.
    for (let i = 0; i < 14; i++) {
      const stillOpening = await page.evaluate(() =>
        (window as any).__game.scene.getScenes(true).some((s: any) => s.scene.key === 'Opening'));
      if (!stillOpening) break;
      await canvasClick(page, 360, 800);
      await page.waitForTimeout(400);
    }

    const backlog = await page.evaluate(() => {
      const s: any = (window as any).__game.scene.getScene('Opening');
      return (s?.dialogueBox?.backlog ?? []).map((b: any) => `${b.speaker}: ${b.text}`);
    });
    console.log('[intro backlog]', JSON.stringify(backlog, null, 1));

    const seen = new Set<string>();
    const repeated: string[] = [];
    for (const line of backlog) {
      if (seen.has(line)) repeated.push(line);
      seen.add(line);
    }
    expect(
      repeated,
      `the intro showed ${repeated.length} line(s) more than once:\n${repeated.join('\n')}`,
    ).toEqual([]);
  });
});
