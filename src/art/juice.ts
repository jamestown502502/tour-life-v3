// The Tour Diary polish kit (2026-10-04): stamps, count-ups, portrait cameos, the verb splash, the
// beat pulse, haptics and the Encore set-piece. Every effect honors Reduced motion (collapses to a
// short fade or the final state) and No screen flash. The rules (which word, which mood, when to
// celebrate) live in src/game/juiceRules.ts.
import Phaser from 'phaser';
import { H, PALETTE, PALETTE_HEX, W } from '../const';
import { State } from '../core/state';
import { audio } from '../core/audio';
import { ensurePortrait } from './sprites';
import { hitstop, spawnConfetti } from './effects';
import { textStyle } from '../ui/textStyles';
import { HAPTIC, tickPitch, type HapticName } from '../game/juiceRules';
import type { BandmateId } from '../../content/schema';

const calm = (): boolean => !!State.data.accessibility.reducedMotion;

export function buzz(name: HapticName): void {
  if (!State.data.accessibility.haptics) return;
  try { navigator.vibrate?.(HAPTIC[name] as number | number[]); } catch { /* unsupported */ }
}

/** A rubber stamp that slams on with squash and stretch, an ink thud and a short hit-stop. */
export function stamp(scene: Phaser.Scene, x: number, y: number, word: string, color: number = PALETTE.terracotta, size = 30, quiet = false): Phaser.GameObjects.Container {
  const label = scene.add.text(0, 0, word, textStyle('h1', { fontSize: `${size}px`, color: Phaser.Display.Color.IntegerToColor(color).rgba })).setOrigin(0.5);
  const w = label.width + 28, h = label.height + 14;
  const border = scene.add.graphics();
  // a cream paper backing, so the ink reads on painted art as well as on the sand cards
  border.fillStyle(PALETTE.cream, 0.92).fillRoundedRect(-w / 2, -h / 2, w, h, 8);
  border.lineStyle(4, color, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
  const c = scene.add.container(x, y, [border, label]).setAngle(-7);
  if (calm()) {
    c.setAlpha(0);
    scene.tweens.add({ targets: c, alpha: 1, duration: 150 });
  } else {
    c.setScale(1.7).setAlpha(0);
    scene.tweens.add({
      targets: c, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut',
      onComplete: () => {
        if (!quiet) { hitstop(scene, 40); audio.playPitch(110, 0.12, 0, 'square'); buzz('thud'); }
        scene.tweens.add({ targets: c, scaleX: 1.04, scaleY: 0.96, duration: 70, yoyo: true });
      },
    });
  }
  return c;
}

/** Counts a number up with ticks that climb in pitch, then lands. `fmt` turns the value into text. */
export function countUp(scene: Phaser.Scene, text: Phaser.GameObjects.Text, to: number, fmt: (v: number) => string, ms = 700, from = 0): void {
  if (calm() || ms <= 0 || to === from) { text.setText(fmt(to)); return; }
  let lastTick = 0;
  text.setText(fmt(from));
  scene.tweens.addCounter({
    from, to, duration: ms, ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const v = Math.round(tw.getValue() ?? to);
      text.setText(fmt(v));
      const now = scene.time.now;
      if (now - lastTick > 55) { lastTick = now; audio.playPitch(tickPitch(tw.progress), 0.035, 0, 'sine'); }
    },
    onComplete: () => { text.setText(fmt(to)); scene.tweens.add({ targets: text, scale: 1.12, duration: 90, yoyo: true }); },
  });
}

/** A bandmate's painted portrait pops in beside what they say. */
export function cameo(scene: Phaser.Scene, host: BandmateId, mood: string, x: number, y: number, size = 84): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, ensurePortrait(scene, host, mood)).setDisplaySize(size, size);
  const sx = img.scaleX, sy = img.scaleY;
  if (calm()) { img.setAlpha(0); scene.tweens.add({ targets: img, alpha: 1, duration: 150 }); return img; }
  img.setScale(0);
  scene.tweens.add({ targets: img, scaleX: sx, scaleY: sy, duration: 260, ease: 'Back.easeOut', delay: 120 });
  return img;
}

/** The one-word verb punching in as a minigame starts, in the title bar (the one place with no
 *  other text, so it never covers what the player is about to read), then the title returns. */
export function verbSplash(scene: Phaser.Scene, word: string, title: Phaser.GameObjects.Text): void {
  if (calm()) return;
  title.setAlpha(0);
  const t = scene.add.text(title.x, title.y, word, textStyle('h1', { fontSize: '44px', color: PALETTE_HEX.gold, stroke: PALETTE_HEX.plum, strokeThickness: 6 })).setOrigin(0.5).setDepth(500).setScale(1.25).setAlpha(0);
  scene.tweens.add({
    targets: t, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut',
    onComplete: () => scene.tweens.add({
      targets: t, alpha: 0, duration: 220, delay: 420,
      onComplete: () => { t.destroy(); if (title.active) scene.tweens.add({ targets: title, alpha: 1, duration: 160 }); },
    }),
  });
  audio.playPitch(330, 0.08, 0, 'square');
  audio.playPitch(660, 0.12, 0.06, 'triangle');
}

/** Breathes a button on the beat (a 3% swell), so the screen keeps the music's time. */
export function beatPulse(scene: Phaser.Scene, target: Phaser.GameObjects.Container, beat: number): void {
  if (calm()) return;
  scene.tweens.add({ targets: target, scaleX: 1.03, scaleY: 1.03, duration: Math.max(120, beat / 2), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

/** The Encore: lights down, a spotlight sweeps on, confetti, the crowd swells, the host's victory
 *  pose. About 1.4 s, never interactive, never blocks the card underneath. Perfect runs only. */
export function encore(scene: Phaser.Scene, host?: BandmateId): void {
  const overlay = scene.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0, 0).setDepth(400);
  const parts: Phaser.GameObjects.GameObject[] = [overlay];
  // the crowd: a quick rising major chord, then a held one
  [262, 330, 392, 523].forEach((f, i) => audio.playPitch(f, 0.9, i * 0.06, 'triangle'));
  buzz('double');
  if (calm()) {
    scene.tweens.add({ targets: overlay, fillAlpha: 0.25, duration: 150, yoyo: true, hold: 600, onComplete: () => overlay.destroy() });
    return;
  }
  scene.tweens.add({ targets: overlay, fillAlpha: 0.45, duration: 180 });
  const spot = scene.add.ellipse(-160, H * 0.32, 300, 220, PALETTE.cream, State.data.accessibility.noFlash ? 0.12 : 0.22).setDepth(401);
  parts.push(spot);
  scene.tweens.add({ targets: spot, x: W / 2, duration: 420, ease: 'Cubic.easeOut' });
  spawnConfetti(scene);
  if (host) {
    const img = cameo(scene, host, 'inspired', W / 2, H * 0.32, 150).setDepth(402);
    parts.push(img);
  }
  scene.time.delayedCall(1100, () => {
    scene.tweens.add({ targets: parts, alpha: 0, duration: 300, onComplete: () => parts.forEach((p) => p.destroy()) });
  });
}
