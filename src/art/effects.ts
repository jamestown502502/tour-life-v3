// Game-feel/juice helpers. Exact values per DESIGN.md §15.8. All respect reducedMotion/noFlash.
import Phaser from 'phaser';
import { PALETTE, H, W } from '../const';
import { ensurePixelTexture } from './sprites';
import { State } from '../core/state';

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

export interface WeatherHandle {
  stop(): void;
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
