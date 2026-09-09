// The very first screen a brand-new player sees is the How to Play overlay, auto-opened from
// TitleScene.create(). It dims the Title at 0.78 rather than hiding it — that is the project's
// "overlays dim rather than hide" contract, and the Title's painted backdrop is supposed to read
// through it.
//
// It does not, on a first run. `openHowToPlay()` calls `this.scene.pause()` in the same tick that
// `fadeIn(this)` started the camera's fade-in tween. A paused scene still RENDERS but stops
// UPDATING, so the camera fade never advances past alpha 0 and the Title underneath renders as
// flat fill. A new player's first impression of the game is a bare navy rectangle — the exact
// "no barren screens" failure the close-out pass was meant to end, on the one screen that matters
// most for a shared link.
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { bootGame, waitForActiveScene } from './helpers';

test('first-run How to Play dims the painted title rather than hiding it', async ({ page }) => {
  test.setTimeout(120000);
  // Deliberately NOT calling skipFirstTimeOnboarding: the auto-open is the thing under test.
  await bootGame(page);
  await waitForActiveScene(page, 'HowToPlay');
  await page.waitForTimeout(2500);

  const shot = PNG.sync.read(await page.locator('canvas').first().screenshot());
  // Sample BELOW the card and below the Next button (card is y260..880 of 1280, button lower
  // still) — the one strip of this screen that is pure backdrop. Sampling the top instead is a
  // trap: the overlay's own "How to Play" heading sits there, and its glyph edges register as
  // variation, so a flat backdrop measures as textured and the test passes when it should not.
  const y0 = Math.round(shot.height * 0.88), y1 = Math.round(shot.height * 0.99);
  const lums: number[] = [];
  for (let y = y0; y < y1; y += 3) {
    for (let x = 0; x < shot.width; x += 3) {
      const i = (shot.width * y + x) << 2;
      lums.push(0.2126 * shot.data[i] + 0.7152 * shot.data[i + 1] + 0.0722 * shot.data[i + 2]);
    }
  }
  const mean = lums.reduce((a, b) => a + b, 0) / lums.length;
  const sd = Math.sqrt(lums.reduce((a, b) => a + (b - mean) ** 2, 0) / lums.length);
  console.log(`[first-run title] mean=${mean.toFixed(1)} sd=${sd.toFixed(2)}`);
  // A flat fill measures sd ~0. Painted art read through a 0.78 dim still varies measurably.
  expect(sd, `backdrop behind the first-run overlay is flat (sd=${sd.toFixed(2)}) — the painted title is not showing through`).toBeGreaterThan(2);
});
