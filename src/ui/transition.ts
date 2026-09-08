import Phaser from 'phaser';
import { SCREEN_FADE_MS } from '../const';

/** 250ms fade-to-night-navy, then start the target scene, passing data through.
 *
 *  STABILIZATION REVERT (2026-09-06): this is the original pre-Addendum-v2 implementation,
 *  restored verbatim. The themed-transition layer that replaced it (a 'card'/'lights'/'drive'
 *  overlay container at depth 500, a full-screen interactive input blocker at depth 1000, a
 *  WeakSet single-flight guard, a 5x watchdog delayedCall, and a SHUTDOWN cleanup path) was the
 *  origin or immediate neighbour of every gameplay regression reported since it landed:
 *  a TweenManager crash from the overlay's destroy racing its own tweens, "rhythm skips
 *  gameplay", stuck screens, "the interface immediately disappears", and finally every minigame
 *  and rhythm song "loading in, disappearing, then dying". Each was patched with another guard
 *  on top of the previous guard; the reports kept coming.
 *
 *  This simple path shipped every rhythm song and every minigame for many passes with zero
 *  reported problems in those systems. Polish that cannot be made reliable is not worth the
 *  systems it breaks, so the themed layer is OFF rather than patched again — see
 *  docs/TESTING_PROCEDURES.md for what bringing it back safely would require. */
export function goTo(scene: Phaser.Scene, key: string, data?: object): void {
  scene.cameras.main.fadeOut(SCREEN_FADE_MS, 43, 58, 85);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data);
  });
}

export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(SCREEN_FADE_MS, 43, 58, 85);
}
