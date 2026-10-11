// Regression (2026-10-10, found while recording store footage): the Tonight card prepares the chart
// before the song starts, while startTime is still 0. update() ran anyway, so every note's hit time
// sat in the past by the whole session length. A player who had been in the game for longer than
// a song had the ENTIRE chart judged as misses behind the card: after Play the notes hung frozen,
// the score stayed 0 and nothing could be hit. Every other spec enters a show seconds after boot,
// when only the first few notes are affected, which is why the suite stayed green.
import { test, expect, type Page } from './fixtures';
import { skipFirstTimeOnboarding, waitForActiveScene, clickPreShowChoice, clickButtonByLabel } from './helpers';

async function play(page: Page, ms: number): Promise<void> {
  for (let t = 0; t < ms; t += 100) await page.clock.runFor(Math.min(100, ms - t));
}

const rhythm = (page: Page) => page.evaluate(() => {
  const s: any = (window as any).__game.scene.getScene('Rhythm');
  const active = (window as any).__game.scene.getScenes(true).some((x: any) => x.scene.key === 'Rhythm');
  if (!active) return null;
  return {
    started: !!s.songStarted,
    judged: s.notes.filter((n: any) => n.judged).length,
    misses: s.judgements.filter((j: unknown) => j === 'miss').length,
    hits: s.judgements.filter((j: unknown) => j !== 'miss').length,
  };
});

test('a show entered late in a session starts with a whole, unjudged chart', async ({ page }) => {
  test.setTimeout(180000);
  await skipFirstTimeOnboarding(page);
  await page.addInitScript(() => {
    for (const k of ['seenRhythmTutorial', 'seenHoldHint', 'seenCueHint']) window.localStorage.setItem(`tourlife.${k}`, '1');
  });
  await page.clock.install();
  await page.goto('/');
  await waitForActiveScene(page, 'Title', 30000);
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 3000);

  // A player who has spent 90 s in menus and dialogue: longer than any song.
  await page.clock.fastForward(90000);
  await play(page, 300);

  await page.evaluate(() => {
    const S = (window as any).__state;
    S.newRun('tonight-prejudge');
    S.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'regression', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = [{ cityId: 'lisbon', visited: false, weather: 'clear' }];
    S.data.flags = ['onboard_hub_seen', 'onboard_routeplan_seen'];
    S.data.accessibility.autoplay = true;
    (window as any).__game.scene.stop('Title');
    (window as any).__game.scene.start('City', { cityId: 'lisbon', phase: 'preshow-choices' });
  });
  await play(page, 1500);
  await clickPreShowChoice(page, 0);
  for (let i = 0; i < 40 && !(await rhythm(page)); i++) await play(page, 100);

  // Behind the Tonight card: nothing judged yet.
  await play(page, 1000);
  const onCard = await rhythm(page);
  expect(onCard, 'Rhythm should be up').not.toBeNull();
  expect(onCard!.started).toBe(false);
  expect(onCard!.judged, 'no note may be judged before the song starts').toBe(0);

  // After Play, autoplay hits notes: the chart is alive.
  await clickButtonByLabel(page, 'Rhythm', 'Play');
  let playing = await rhythm(page);
  for (let i = 0; i < 60 && !(playing!.started && playing!.hits > 0); i++) {
    await play(page, 250);
    playing = await rhythm(page);
  }
  expect(playing!.started).toBe(true);
  expect(playing!.hits, 'autoplay should be hitting notes').toBeGreaterThan(0);
  expect(playing!.misses).toBe(0);
});
