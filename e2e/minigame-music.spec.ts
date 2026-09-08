// "Should I hear different music during each minigame?" — the answer was no, and now it is yes.
// Minigames used to inherit whatever bed CityScene was already playing, so all three in a city
// sounded identical to the city itself. Each MiniGameDef can now carry its own progression
// (content/schema.ts), and leaving one must hand the city's bed back.
import { test, expect } from '@playwright/test';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene } from './helpers';

/** Records every playAmbience call (chord count, bpm, waveform) from this point on. */
async function spyAmbience(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const a: any = (window as any).__audio;
    (window as any).__beds = [];
    if ((window as any).__bedsPatched) return;
    (window as any).__bedsPatched = true;
    const orig = a.playAmbience.bind(a);
    a.playAmbience = (chords: number[][], bpm: number, waveform: string) => {
      (window as any).__beds.push({ chords: chords.length, bpm, waveform });
      return orig(chords, bpm, waveform);
    };
  });
}

test('each minigame plays its own bed, and returning to the city restores the city bed', async ({ page }) => {
  test.setTimeout(150000);
  await skipFirstTimeOnboarding(page);
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  await page.evaluate(() => (window as any).__game.scene.stop('Title'));

  // Enter the city first so its own ambience is the established baseline.
  await page.evaluate(() => (window as any).__game.scene.start('City', { cityId: 'tokyo', phase: 'locations' }));
  await waitForActiveScene(page, 'City', 15000);
  await page.waitForTimeout(500);
  await spyAmbience(page);

  await page.evaluate(() => (window as any).__game.scene.start('MiniGame', {
    cityId: 'tokyo', minigameId: 'tok_pack_van', returnPhase: 'locations',
  }));
  await waitForActiveScene(page, 'MiniGame', 15000);
  await page.waitForTimeout(500);

  // Tap Start — the bed switches when the round begins, not on the intro card.
  await page.evaluate(() => {
    const s: any = (window as any).__game.scene.getScene('MiniGame');
    s.beginGame();
  });
  await page.waitForTimeout(500);

  const afterStart = await page.evaluate(() => (window as any).__beds);
  console.log('[minigame-music] after start =', JSON.stringify(afterStart));
  expect(afterStart.length, 'starting the minigame should have played its own bed').toBeGreaterThan(0);
  // tok_pack_van: Am-F-C-G at 92, triangle.
  const bed = afterStart[afterStart.length - 1];
  expect(bed.bpm, `expected Pack the Van's own tempo, got ${bed.bpm}`).toBe(92);
  expect(bed.chords, 'expected the 4-chord Am-F-C-G bed').toBe(4);

  // Leaving restores the city's bed — CityScene.create() plays it on the way back in.
  await page.evaluate(() => (window as any).__game.scene.start('City', { cityId: 'tokyo', phase: 'locations' }));
  await waitForActiveScene(page, 'City', 15000);
  await page.waitForTimeout(700);

  const afterReturn = await page.evaluate(() => (window as any).__beds);
  console.log('[minigame-music] after return =', JSON.stringify(afterReturn));
  const last = afterReturn[afterReturn.length - 1];
  expect(
    last.bpm,
    `returning to the city should restore the city bed, but the last bed played was ${JSON.stringify(last)}`,
  ).not.toBe(92);
});
