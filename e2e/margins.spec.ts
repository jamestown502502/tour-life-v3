// Publisher polish (2026-10-12): the screen around the game column must not flicker.
//
// Reported with screenshots: on desktop and some phones the bands beside the portrait game "get
// glitchy". Cause: src/ui/ambient.ts re-encoded a live copy of the canvas five times a second and
// swapped it into a CSS-blurred full-screen div, hard-cutting on every change, and hid itself below
// an 80 px band so some widths flipped between glow and flat navy. The bands are now a still baked
// backdrop plus a tint that changes once per screen (never for overlays).
//
// Also the opening splash and the title wordmark: both brand assets must actually load.
import { test, expect, type Page } from './fixtures';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene, startScene } from './helpers';

test.use({ viewport: { width: 1366, height: 768 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

async function bands(page: Page) {
  return page.evaluate(() => {
    const a = getComputedStyle(document.getElementById('ambient')!);
    const t = getComputedStyle(document.getElementById('ambient-tint')!);
    return { image: a.backgroundImage, display: a.display, tint: t.backgroundColor, dataUrls: (window as any).__toDataURLCalls as number };
  });
}

test.beforeEach(async ({ page }) => {
  await skipFirstTimeOnboarding(page);
  await page.addInitScript(() => {
    (window as any).__toDataURLCalls = 0;
    const orig = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...args: any[]) {
      (window as any).__toDataURLCalls++;
      return orig.apply(this, args as any);
    };
  });
});

test('the bands stay still: one backdrop, a tint per screen, nothing per frame', async ({ page }) => {
  test.setTimeout(90000);
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  expect(await page.evaluate(() => (window as any).__game.textures.exists('brand_wordmark'))).toBe(true);
  expect(await page.locator('#splash').count()).toBe(0);   // removed once Title is up (e2e build: at once)

  const first = await bands(page);
  expect(first.display).not.toBe('none');
  expect(first.image).toContain('backdrop.webp');
  const tints = new Set<string>([first.tint]);

  // 3 s of the title screen, with Settings opened and closed over it: an overlay must not touch the bands.
  for (let i = 0; i < 15; i++) {
    if (i === 4) await page.evaluate(() => { const t = (window as any).__game.scene.getScene('Title'); t.scene.launch('Settings', { returnTo: 'Title' }); t.scene.pause(); });
    if (i === 9) await page.evaluate(() => { const t = (window as any).__game.scene.getScene('Title'); t.scene.stop('Settings'); t.scene.resume(); });
    const b = await bands(page);
    expect(b.image).toBe(first.image);
    expect(b.tint).toBe(first.tint);
    await page.waitForTimeout(100);
  }

  // A different screen: the tint moves once, the backdrop never.
  await page.evaluate(() => (window as any).__game.scene.stop('Title'));
  await startScene(page, 'RoutePlan');
  await waitForActiveScene(page, 'RoutePlan', 10000);
  await page.waitForTimeout(1200);   // the 1 s CSS fade
  for (let i = 0; i < 15; i++) {
    const b = await bands(page);
    expect(b.image).toBe(first.image);
    tints.add(b.tint);
    await page.waitForTimeout(100);
  }
  expect(tints.size).toBe(2);
  expect((await bands(page)).dataUrls).toBe(0);
});

for (const vp of [
  { width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1080 },
  { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 768, height: 1024 },
]) {
  test(`no page scroll and the bands cover the screen at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    const m = await page.evaluate(() => {
      const r = document.getElementById('ambient')!.getBoundingClientRect();
      const c = document.querySelector('#app canvas')!.getBoundingClientRect();
      return {
        scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight,
        w: innerWidth, h: innerHeight, amb: [r.left, r.top, r.right, r.bottom], canvas: [c.left, c.top, c.right, c.bottom],
      };
    });
    expect(m.scrollW).toBeLessThanOrEqual(m.w);
    expect(m.scrollH).toBeLessThanOrEqual(m.h);
    expect(m.amb[0]).toBeLessThanOrEqual(0); expect(m.amb[1]).toBeLessThanOrEqual(0);
    expect(m.amb[2]).toBeGreaterThanOrEqual(m.w); expect(m.amb[3]).toBeGreaterThanOrEqual(m.h);
    expect(m.canvas[0]).toBeGreaterThanOrEqual(0); expect(m.canvas[2]).toBeLessThanOrEqual(m.w + 0.5);
    await page.screenshot({ path: `test-results/margins-${vp.width}x${vp.height}.png` });
  });
}
