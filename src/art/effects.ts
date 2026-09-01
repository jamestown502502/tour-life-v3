// Game-feel/juice helpers. Exact values per DESIGN.md §15.8. All respect reducedMotion/noFlash.
import Phaser from 'phaser';
import { PALETTE, H, W } from '../const';
import { ensurePixelTexture } from './sprites';
import { State } from '../core/state';

export function spawnRingPulse(scene: Phaser.Scene, x: number, y: number, color: number = PALETTE.gold): void {
  if (State.data.accessibility.reducedMotion) return;
  const ring = scene.add.circle(x, y, 10, color, 0).setStrokeStyle(3, color, 1);
  scene.tweens.add({
    targets: ring, radius: 34, alpha: 0, duration: 320, ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });
}

export function spawnPerfectSpark(scene: Phaser.Scene, x: number, y: number): void {
  if (State.data.accessibility.reducedMotion) return;
  const key = ensurePixelTexture(scene, 'fx_spark', PALETTE.gold);
  const emitter = scene.add.particles(x, y, key, {
    speed: { min: 90, max: 120 },
    lifespan: 350,
    scale: { start: 0.5, end: 0 },
    quantity: 8,
    blendMode: 'ADD',
    emitting: false,
  });
  emitter.explode(8, x, y);
  scene.time.delayedCall(400, () => emitter.destroy());
}

export function comboPop(scene: Phaser.Scene, target: Phaser.GameObjects.Text): void {
  target.setScale(1);
  scene.tweens.add({ targets: target, scale: 1.15, duration: 80, ease: 'Cubic.easeOut', yoyo: true });
}

/** Brief timescale dip on a perfect hit. Skipped under reducedMotion. */
export function hitstop(scene: Phaser.Scene, ms = 30): void {
  if (State.data.accessibility.reducedMotion) return;
  const original = scene.time.timeScale;
  scene.time.timeScale = 0.05;
  scene.time.delayedCall(ms, () => { scene.time.timeScale = original; }, [], scene);
}

export function shake(scene: Phaser.Scene, px = 4): void {
  if (State.data.accessibility.reducedMotion) return;
  scene.cameras.main.shake(120, px / 1000);
}

export function flash(scene: Phaser.Scene, color = 0xffffff): void {
  if (State.data.accessibility.noFlash || State.data.accessibility.reducedMotion) return;
  scene.cameras.main.flash(150, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
}

/** Soft radial darkening at the screen edges via Phaser's built-in Post FX pipeline (WebGL
 *  only — no-ops harmlessly under the Canvas renderer, which this game doesn't target but
 *  shouldn't crash under either). Apply once per full-screen background image. */
export function applyVignette(image: Phaser.GameObjects.Image, strength = 0.35): void {
  try {
    (image as unknown as { postFX?: { addVignette: (x: number, y: number, radius: number, strength: number) => void } })
      .postFX?.addVignette(0.5, 0.5, 0.6, strength);
  } catch {
    // Canvas renderer or an unsupported context — the vignette is purely decorative, skip it
  }
}

export interface WeatherHandle {
  stop(): void;
}

/** Slow, glowing ambient motes (fireflies at night, dust in a warm room) — low count, gentle
 *  upward drift. Reused across the bus hub and city scenes for a "the room is alive" feel. */
export function spawnFireflies(scene: Phaser.Scene, color: number = PALETTE.gold, count: number = 16): WeatherHandle {
  if (State.data.accessibility.reducedMotion) return { stop() {} };
  const key = ensurePixelTexture(scene, `fx_firefly_${color}`, color);
  const emitter = scene.add.particles(0, 0, key, {
    x: { min: 0, max: W },
    y: { min: H * 0.3, max: H },
    speedY: { min: -14, max: -4 },
    speedX: { min: -6, max: 6 },
    scale: { start: 0.9, end: 0.2 },
    alpha: { start: 0, end: 0.7, ease: 'Sine.easeInOut' },
    lifespan: { min: 3500, max: 6000 },
    frequency: 400,
    quantity: 1,
    blendMode: 'ADD',
    maxParticles: count,
  });
  return { stop: () => emitter.destroy() };
}

export function spawnRain(scene: Phaser.Scene, opacity = 0.3): WeatherHandle {
  if (State.data.accessibility.reducedMotion) return { stop() {} };
  const key = ensurePixelTexture(scene, 'fx_drop', PALETTE.sky);
  const emitter = scene.add.particles(0, -10, key, {
    x: { min: 0, max: W },
    y: -10,
    speedY: 140,
    scaleX: 0.25,
    scaleY: 1.5,
    alpha: opacity,
    lifespan: (H + 20) / 140 * 1000,
    frequency: 40,
    quantity: 1,
  });
  return { stop: () => emitter.destroy() };
}

export function spawnConfetti(scene: Phaser.Scene): void {
  if (State.data.accessibility.reducedMotion) return;
  const colors = [PALETTE.gold, PALETTE.terracotta, PALETTE.teal, PALETTE.sky];
  for (const color of colors) {
    const key = ensurePixelTexture(scene, `fx_confetti_${color}`, color);
    const emitter = scene.add.particles(W / 2, -20, key, {
      x: { min: 0, max: W },
      y: -20,
      speedY: 90,
      rotate: { min: 0, max: 360 },
      scale: { min: 0.6, max: 1.2 },
      lifespan: 3000,
      quantity: 15,
      emitting: false,
    });
    emitter.explode(15, undefined, undefined);
    scene.time.delayedCall(3200, () => emitter.destroy());
  }
}
