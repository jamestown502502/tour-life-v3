// Live-regression repro (Item A1): "drag-and-drop on certain mini-games doesn't function."
//
// This suite deliberately drives REAL pointer input (mouse down / move / up through Playwright's
// own input pipeline, which Phaser's drag system sees exactly as a finger would) rather than
// calling the scene's placement logic directly. That distinction is the whole point of this file:
// CI was green while drag was broken live precisely because nothing in the suite had ever
// performed an actual drag gesture — every minigame test either clicked a button or bypassed to
// the outcome. A logic-bypass test here would have stayed green through this exact bug.
import { test, expect } from '@playwright/test';
import {
  bootGame, skipFirstTimeOnboarding, startScene, canvasClick, collectConsoleErrors,
  waitForCondition, waitForActiveScene, LOGICAL_W, LOGICAL_H,
} from './helpers';

/** Reads the live drag-minigame layout straight off the scene: every chip's current top-left and
 *  every slot's rectangle, in the game's own 720x1280 logical space. Used both to aim the drag
 *  (at a slot's true visual center) and to assert where a chip actually ended up. */
async function readDragLayout(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const s: any = (window as any).__game.scene.getScene('MiniGame');
    const kids = s.contentLayer.list;
    const chips = kids
      .filter((o: any) => o.type === 'Image' && o.input?.draggable !== undefined)
      // `enabled` is the one that matters for picking the next chip to drag: a placed chip keeps
      // input.draggable === true (Phaser's disableInteractive only clears input.enabled), so
      // selecting on `draggable` alone re-picks an already-placed chip forever.
      .map((o: any) => ({
        x: o.x, y: o.y, w: o.displayWidth, h: o.displayHeight,
        draggable: !!o.input?.draggable, enabled: !!o.input?.enabled,
      }));
    const slots = kids
      .filter((o: any) => o.type === 'Rectangle' && o.strokeColor !== undefined && o.width === 190 && o.height === 60)
      .map((o: any) => ({ x: o.x, y: o.y, w: o.width, h: o.height, originX: o.originX, originY: o.originY }));
    return { chips, slots };
  });
}

/** A real drag: press at (fromX,fromY), move in several steps (Phaser's drag only begins after a
 *  pointer move while down — a single jump can be swallowed), release at (toX,toY). Coordinates
 *  are the game's logical 720x1280 space, translated to the canvas' real rendered box. */
async function realDrag(
  page: import('@playwright/test').Page,
  fromX: number, fromY: number, toX: number, toY: number,
): Promise<void> {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box) throw new Error('canvas not visible for realDrag');
  const toScreen = (lx: number, ly: number) => ({
    x: box.x + (lx / LOGICAL_W) * box.width,
    y: box.y + (ly / LOGICAL_H) * box.height,
  });
  const a = toScreen(fromX, fromY);
  const b = toScreen(toX, toY);
  // Three intermediate moves, no per-step sleep. Phaser only needs one move-while-down to start a
  // drag; every extra move is a full CDP round-trip (~1s on this harness), and an 8-step version
  // spent more of the round's own 22-25s timer on transport than a real player spends playing it.
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 3; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / 3, a.y + ((b.y - a.y) * i) / 3);
  }
  await page.mouse.up();
  await page.waitForTimeout(120);
}

// The game's only two drag minigames — both reported broken, and both visible in the live bug
// screenshots (Tokyo's "Pack the Van" and Lisbon's "Load-In").
const DRAG_MINIGAMES = [
  { cityId: 'tokyo', minigameId: 'tok_pack_van', title: 'Pack the Van' },
  { cityId: 'lisbon', minigameId: 'lis_load_in', title: 'Load-In' },
];

test.describe('Drag minigame — real pointer gestures (live-regression repro)', () => {
  test.beforeEach(async ({ page }) => {
    await skipFirstTimeOnboarding(page);
  });

  for (const mg of DRAG_MINIGAMES) {
  test(`${mg.title}: dropping a chip on a slot's visible center places it inside that slot`, async ({ page }) => {
    test.setTimeout(90000);
    const errors = collectConsoleErrors(page);
    await bootGame(page);
    // Boot must finish loading the real asset manifest before any scene is started by hand:
    // starting a City early makes its code-drawn fallback generate into a key the loader is
    // still about to add, producing a spurious "Texture key already in use" console error that
    // never happens in a natural boot-to-play flow (fullrun.spec.ts proves that path is clean).
    await waitForActiveScene(page, 'Title', 20000);
    // ...and stop it. startScene uses the SceneManager, which (unlike every real transition in
    // transition.ts) does NOT stop the calling scene — leaving Title alive, still rendering its
    // UI and still owning its floating seed-input DOM element on top of whatever we start next.
    await page.evaluate(() => (window as any).__game.scene.stop("Title"));

    // Enter the minigame the same way the city loop does — via the scene manager with exactly
    // the data CityScene passes.
    await startScene(page, 'MiniGame', { cityId: mg.cityId, minigameId: mg.minigameId, returnPhase: 'locations' });
    await waitForCondition(page, () => (window as any).__game.scene.getScene('MiniGame')?.scene.settings.active === true, 8000);
    // Intro card's "Start" button (W/2-130, 500, 260, 66 -> center 360, 533).
    await canvasClick(page, 360, 533);
    await page.waitForTimeout(400);

    const before = await readDragLayout(page);
    expect(before.chips.length, 'the drag minigame should render draggable chips').toBeGreaterThan(0);
    expect(before.slots.length, 'the drag minigame should render slots').toBeGreaterThan(0);

    // Aim at the FIRST slot's true visual center. With origin (0,0) rectangles that is
    // (x + w/2, y + h/2) — what a player sees and aims for.
    const slot = before.slots[0];
    const slotCenterX = slot.x + slot.w / 2;
    const slotCenterY = slot.y + slot.h / 2;
    const chip = before.chips[0];
    const chipCenterX = chip.x + chip.w / 2;
    const chipCenterY = chip.y + chip.h / 2;

    await realDrag(page, chipCenterX, chipCenterY, slotCenterX, slotCenterY);

    const after = await page.evaluate(() => {
      const s: any = (window as any).__game.scene.getScene('MiniGame');
      const kids = s.contentLayer.list;
      const chips = kids
        .filter((o: any) => o.type === 'Image' && o.input?.draggable !== undefined)
        .map((o: any) => ({ x: o.x, y: o.y, w: o.displayWidth, h: o.displayHeight, interactive: !!o.input?.enabled }));
      const slots = kids
        .filter((o: any) => o.type === 'Rectangle' && o.width === 190 && o.height === 60)
        .map((o: any) => ({ x: o.x, y: o.y, w: o.width, h: o.height }));
      return { chips, slots };
    });

    // The dragged chip's center must now sit INSIDE the slot it was dropped on. This is the
    // assertion the live bug fails twice over: the drop is rejected (chip tweens home) or, when
    // it is accepted, the chip is snapped half a chip up-and-left of the slot.
    const placed = after.chips.find((c) => !c.interactive) ?? after.chips[0];
    const placedCx = placed.x + placed.w / 2;
    const placedCy = placed.y + placed.h / 2;
    expect(
      placedCx >= slot.x && placedCx <= slot.x + slot.w && placedCy >= slot.y && placedCy <= slot.y + slot.h,
      `chip center (${placedCx}, ${placedCy}) should sit inside slot [${slot.x}..${slot.x + slot.w}] x [${slot.y}..${slot.y + slot.h}]`,
    ).toBe(true);

    // And no chip may be pushed off-screen by the snap (the reported "Cable snake" half off the
    // left edge is exactly this).
    for (const c of after.chips) {
      expect(c.x, `a chip at x=${c.x} is off the left edge`).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w, `a chip ending at x=${c.x + c.w} is off the right edge`).toBeLessThanOrEqual(LOGICAL_W);
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test(`${mg.title}: every drop onto a slot lands, for every item in the round`, async ({ page }) => {
    test.setTimeout(240000);
    await bootGame(page);
    // Boot must finish loading the real asset manifest before any scene is started by hand:
    // starting a City early makes its code-drawn fallback generate into a key the loader is
    // still about to add, producing a spurious "Texture key already in use" console error that
    // never happens in a natural boot-to-play flow (fullrun.spec.ts proves that path is clean).
    await waitForActiveScene(page, 'Title', 20000);
    // ...and stop it. startScene uses the SceneManager, which (unlike every real transition in
    // transition.ts) does NOT stop the calling scene — leaving Title alive, still rendering its
    // UI and still owning its floating seed-input DOM element on top of whatever we start next.
    await page.evaluate(() => (window as any).__game.scene.stop("Title"));
    await startScene(page, 'MiniGame', { cityId: mg.cityId, minigameId: mg.minigameId, returnPhase: 'locations' });
    await waitForCondition(page, () => (window as any).__game.scene.getScene('MiniGame')?.scene.settings.active === true, 8000);
    await canvasClick(page, 360, 533);
    await page.waitForTimeout(400);

    const layout = await readDragLayout(page);
    const n = Math.min(layout.chips.length, layout.slots.length);
    expect(n, 'expected at least 2 chips/slots to exercise a full round').toBeGreaterThan(1);

    // The round has its own 22-25s in-game timer. A real player beats it comfortably; a CDP-driven
    // drag costs a round-trip per mouse step, so the wall clock — not the mechanic — decides how
    // many items fit. So this asserts the thing actually under test: EVERY drop performed while
    // the round is still running must land. It deliberately does not require the whole round to
    // finish inside that timer, which would only be measuring this environment's input latency.
    // Kept to ONE state read per drag (the layout read already carries `enabled`, which doubles
    // as the placed-count): at ~4fps every extra page.evaluate is a real fraction of the round's
    // own 22-25s timer, and an earlier version with separate before/after reads spent so long in
    // round-trips that the test hit its own deadline instead of measuring anything.
    let attempted = 0;
    let landed = 0;
    for (let i = 0; i < n; i++) {
      const cur = await readDragLayout(page);
      const placedBefore = cur.chips.filter((c) => !c.enabled).length;
      const chip = cur.chips.find((c) => c.enabled);
      const slot = cur.slots[i];
      // Round already over (its timer fired) or nothing left to drag — stop, don't fail.
      if (!chip || !slot) break;
      await realDrag(page, chip.x + chip.w / 2, chip.y + chip.h / 2, slot.x + slot.w / 2, slot.y + slot.h / 2);
      const next = await readDragLayout(page);
      if (next.chips.filter((c) => !c.enabled).length > placedBefore) {
        attempted++;
        landed++;
        continue;
      }
      // Not placed. Distinguish a genuine rejected drop (the bug) from the round's own 22-25s
      // timer expiring mid-gesture — dragend deliberately bails once `finished` is set, so a drop
      // that raced the buzzer is correct behaviour, not a failure, and must not be counted.
      const roundOver = next.chips.every((c) => !c.enabled) || next.slots.length === 0;
      if (roundOver) break;
      attempted++;
    }

    expect(attempted, 'the round should have stayed open long enough for at least 2 drops').toBeGreaterThan(1);
    expect(landed, `${landed}/${attempted} drops onto a slot actually placed their chip`).toBe(attempted);
  });
  }
});
