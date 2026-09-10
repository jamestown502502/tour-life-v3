// Reported live: "the title screen text is broken", "most backgrounds are now jacked up".
//
// The two symptoms share one cause. Every scene label was authored while the painted backdrops
// were NOT reaching the client — a stale service-worker manifest pinned the game to the previous
// deploy's asset index, so scene after scene rendered its code-drawn FLAT gradient instead. Cream
// and teal read fine on a flat dark gradient. The moment the real art arrived, the same labels sat
// on lit wood, a bright window and flyers, and became unreadable.
//
// The property under test is CONTRAST, not "has a scrim". An earlier version of this file asserted
// that every label had a scrim rectangle behind it and produced two false failures out of three —
// the Scrapbook's text sits on an opaque cream card and the Van's heading is gold on a dark sky,
// both perfectly legible with no scrim in sight. Measuring the actual rendered pixels is the only
// version of this test that cannot lie in either direction.
//
// Method: read every label's bounds and colour, hide the labels, screenshot the canvas, and
// measure the luminance of what was behind each one. WCAG contrast ratio, 3.0 minimum — the AA
// threshold for large text, and a floor no readable label on a painted backdrop should approach.
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene } from './helpers';

// WCAG 2.x AA: 4.5:1 for normal text, 3.0:1 only for LARGE text (>=18pt, or >=14pt bold). The
// first version of this suite applied the large-text figure to everything and passed a RoutePlan
// screen the player then reported as hard to read -- correctly, because most of its labels are
// small and were sitting between 3 and 4.5. The threshold is now chosen per label from its own
// font size, which is what the standard actually says.
const LARGE_TEXT_PX = 24;
const MIN_CONTRAST_LARGE = 3.0;
const MIN_CONTRAST_NORMAL = 4.5;

const SCENES: { key: string; data?: object }[] = [
  { key: 'Title' },
  { key: 'Opening' },
  { key: 'BandCreator' },
  { key: 'RoutePlan' },
  { key: 'Hub' },
  { key: 'Van', data: { cityId: 'berlin' } },
  { key: 'City', data: { cityId: 'berlin', phase: 'arrival' } },
  { key: 'Scrapbook', data: {} },
  { key: 'Results', data: { cityId: 'berlin', result: {
      timingScore: 4200, ratio: 0.55, grade: 'good', expressionChoices: ['invite_crowd'],
      crowdConnection: 62, unlockedFlags: [],
      judgementCounts: { perfect: 12, good: 30, ok: 9, miss: 6 },
    } } },
  { key: 'MiniGame', data: { cityId: 'berlin', minigameId: 'ber_modular_check', returnPhase: 'locations' } },
  { key: 'MiniGame', data: { cityId: 'tokyo', minigameId: 'tok_mix_hold', returnPhase: 'locations' } },
  { key: 'MiniGame', data: { cityId: 'lisbon', minigameId: 'lis_live_radio', returnPhase: 'locations' } },
  { key: 'MiniGame', data: { cityId: 'lisbon', minigameId: 'lis_tune_by_ear', returnPhase: 'locations' } },
  { key: 'MiniGame', data: { cityId: 'mexico_city', minigameId: 'mex_find_the_clave', returnPhase: 'locations' } },
];

async function seedRun(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const S: any = (window as any).__state;
    S.newRun('legibility');
    // RoutePlan returns EARLY behind an onboarding DialogueBox on a first run, so without this
    // the sweep measured that overlay's two lines and never the route screen at all -- passing
    // it three times while the real screen (zero scrims, cream on a pale painted map) was being
    // reported as unreadable. Any scene with a first-run gate needs the gate cleared here or the
    // measurement is of the gate.
    S.addFlag('onboard_routeplan_seen');
    S.addFlag('hub_onboard_seen');
    S.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because CI said so', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = [{ cityId: 'berlin', visited: false }, { cityId: 'tokyo', visited: false }];
    S.data.currentCityIndex = 0;
  });
}

/** sRGB relative luminance, per WCAG 2.x. */
function luminance(r: number, g: number, b: number): number {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Every visible label in the scene, button captions inside Containers included. Measuring real
 *  pixels means a caption sitting on its own button art simply measures as high-contrast — there
 *  is no need to special-case it the way a scrim-presence check would have. */
async function readLabels(page: import('@playwright/test').Page, sceneKey: string) {
  return page.evaluate((key) => {
    const scene: any = (window as any).__game.scene.getScene(key);
    const out: { text: string; x: number; y: number; w: number; h: number; color: string }[] = [];
    const walk = (list: any[]) => {
      for (const o of list) {
        if (!o.visible) continue;
        if (o.type === 'Container') { walk(o.list || []); continue; }
        if (o.type !== 'Text' || !String(o.text || '').trim()) continue;
        const b = o.getBounds();
        if (b.width <= 0 || b.height <= 0) continue;
          const px = parseFloat(String(o.style.fontSize || '16').replace('px', '')) || 16;
        const bold = /bold|[789]00/.test(String(o.style.fontStyle || '') + String(o.style.fontWeight || ''));
        out.push({ text: String(o.text), x: b.x, y: b.y, w: b.width, h: b.height,
          color: o.style.color || '#ffffff', px, bold });
      }
    };
    walk(scene.children.list);
    return out;
  }, sceneKey);
}

/** Hides every scene-level Text so a screenshot shows only what is BEHIND the labels. */
async function setLabelsVisible(page: import('@playwright/test').Page, sceneKey: string, visible: boolean) {
  await page.evaluate(([key, vis]) => {
    const scene: any = (window as any).__game.scene.getScene(key as string);
    const walk = (list: any[]) => {
      for (const o of list) {
        if (o.type === 'Container') { walk(o.list || []); continue; }
        if (o.type === 'Text' && String(o.text || '').trim()) o.setVisible(vis as boolean);
      }
    };
    walk(scene.children.list);
  }, [sceneKey, visible] as const);
}

test.describe('Text legibility over painted backdrops', () => {
  for (const { key, data } of SCENES) {
    const label = (data as any)?.minigameId ? `${key} (${(data as any).minigameId})` : key;
    test(`${label}: every label meets its WCAG AA floor against what is actually behind it`, async ({ page }) => {
      test.setTimeout(120000);
      await skipFirstTimeOnboarding(page);
      await bootGame(page);
      await seedRun(page);
      // Stop every running scene FIRST. `game.scene.start` is SceneManager.start, which — unlike
      // the ScenePlugin.start a scene calls on itself — does NOT stop the caller. Title therefore
      // stays live underneath, and its floating HTML seed input keeps rendering over the scene
      // under test: measured as "Start a new tour" at 1.11:1 on the Scrapbook, which is the
      // harness covering the button, not the game drawing it illegibly.
      await page.evaluate(([k, d]) => {
        const game: any = (window as any).__game;
        for (const s of game.scene.getScenes(true)) if (s.scene.key !== k) game.scene.stop(s.scene.key);
        game.scene.start(k as string, d);
      }, [key, data ?? undefined] as const);
      await waitForActiveScene(page, key);
      await page.waitForTimeout(1500);

      const labels = await readLabels(page, key);
      // Zero would mean the scene drew no text at all, which for these scenes is a bug in the
      // probe rather than a pass. Scene-loaded-at-all is asserted by waitForActiveScene above.
      expect(labels.length, `${key} reported no labels at all`).toBeGreaterThan(0);

      await setLabelsVisible(page, key, false);
      await page.waitForTimeout(250);
      const canvas = page.locator('canvas').first();
      const shot = PNG.sync.read(await canvas.screenshot());
      await setLabelsVisible(page, key, true);

      // The canvas renders the game's internal 720x1280 space; the screenshot is that space at
      // whatever device pixel ratio the profile uses.
      const gameW = await page.evaluate(() => (window as any).__game.scale.width as number);
      const scale = shot.width / gameW;

      const failures: string[] = [];
      for (const l of labels) {
        const [tr, tg, tb] = hexToRgb(l.color);
        const textLum = luminance(tr, tg, tb);
        // Worst case wins: sample the pixel behind the label whose luminance is CLOSEST to the
        // text's own. A label is only as readable as its least-contrasting patch.
        let worst = Infinity;
        const x0 = Math.max(0, Math.round(l.x * scale)), x1 = Math.min(shot.width - 1, Math.round((l.x + l.w) * scale));
        const y0 = Math.max(0, Math.round(l.y * scale)), y1 = Math.min(shot.height - 1, Math.round((l.y + l.h) * scale));
        if (x1 <= x0 || y1 <= y0) continue;
        for (let y = y0; y <= y1; y += 2) {
          for (let x = x0; x <= x1; x += 2) {
            const i = (shot.width * y + x) << 2;
            const c = contrast(textLum, luminance(shot.data[i], shot.data[i + 1], shot.data[i + 2]));
            if (c < worst) worst = c;
          }
        }
        const isLarge = l.px >= LARGE_TEXT_PX || (l.bold && l.px >= 19);
        const floor = isLarge ? MIN_CONTRAST_LARGE : MIN_CONTRAST_NORMAL;
        if (worst < floor) {
          failures.push(String.raw`` + JSON.stringify(l.text) + ` ` + worst.toFixed(2) + `:1 (` + l.px + `px needs ` + floor + `)`);
        }
      }
      expect(failures, `${key} labels below the WCAG AA floor — ${failures.join(' | ')}`).toEqual([]);
    });
  }
});
