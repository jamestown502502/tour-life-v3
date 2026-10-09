// Nothing may be drawn over the corner buttons. Found in the 2026-10-08 visual baselines: for the
// first ~4.7 s of every show, the "Tonight's goal" banner covered the Rhythm screen's Settings gear.
import { test, expect } from './fixtures';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene } from './helpers';

test('the show-start banner never covers the Settings or Help button', async ({ page }) => {
  await skipFirstTimeOnboarding(page);
  await page.addInitScript(() => window.localStorage.setItem('tourlife.seenRhythmTutorial', '1'));
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  await page.evaluate(() => {
    const g: any = (window as any).__game;
    (window as any).__state.newRun('hud-clearance');
    g.scene.stop('Title');
    g.scene.start('Rhythm', { cityId: 'berlin' });
  });
  await waitForActiveScene(page, 'Rhythm', 15000);
  const hit = await page.waitForFunction(() => {
    const s: any = (window as any).__game.scene.getScene('Rhythm');
    const banner = s.children.list.find((o: any) => o.type === 'Text' && String(o.text).startsWith("Tonight's goal"));
    if (!banner) return null;
    const bannerBg = s.children.list.find((o: any) => o.type === 'Rectangle' && o.depth === 84);
    const buttons = s.children.list.filter((o: any) => Array.isArray(o.list)
      && o.list.some((c: any) => c.type === 'Text' && /^[⚙?]$/.test(String(c.text))));
    const r = (o: any) => o.getBounds();
    const overlaps = buttons.flatMap((b: any) => [banner, bannerBg].filter(Boolean)
      .filter((x: any) => Phaser.Geom.Rectangle.Overlaps(r(x), r(b)))
      .map((x: any) => `${x.type} over button "${b.list.find((c: any) => c.type === 'Text').text}"`));
    return { buttons: buttons.length, overlaps };
  }, null, { timeout: 15000 }).then((h) => h.jsonValue());
  expect(hit.buttons, 'expected the gear and help buttons on the Rhythm screen').toBeGreaterThanOrEqual(2);
  expect(hit.overlaps).toEqual([]);
});
