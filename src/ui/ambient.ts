// Desktop presentation: what fills the screen around the portrait game column.
//
// 2026-10-11 to 10-12 this was a blurred live copy of the canvas, re-encoded as a data URL five times
// a second and swapped into a full-screen element blurred 48 px by CSS. Every swap was a hard cut and
// a full-viewport re-blur, so the bands popped and flickered on every scene change and modal and
// hitched on weaker machines (reported with screenshots, 2026-10-12). It also switched itself off
// below an 80 px band, so some window widths flipped between glow and flat navy.
//
// Now (publisher polish, 2026-10-12): index.html paints a still backdrop baked from the key art at
// build time (public/brand/backdrop.webp, blur included, nothing blurs at runtime) and, above it, a
// tint layer. This module only tells the tint which mood the current screen is in; CSS fades it over
// a second (instantly under reduced motion). Nothing runs per frame. Overlays (Settings, How to
// Play, the Transition curtain) have no mood, so opening one never changes the bands.
import Phaser from 'phaser';
import { BRAND } from '../const';

/** Scene key -> tint. Scenes not listed (overlays, Boot) leave the current tint alone. */
export const SCENE_MOOD: Record<string, string> = {
  Title: BRAND.plum,
  BandCreator: BRAND.plum,
  Opening: BRAND.plum,
  RoutePlan: BRAND.slate,
  Hub: BRAND.slate,
  Van: BRAND.slate,
  City: BRAND.orange,
  MiniGame: BRAND.orange,
  Rhythm: BRAND.plum,
  Results: BRAND.orange,
  Scrapbook: BRAND.slate,
};

export function startAmbient(game: Phaser.Game): void {
  const tint = document.getElementById('ambient-tint');
  if (!tint) return;
  const setMood = (key: string): void => {
    const color = SCENE_MOOD[key];
    if (color) tint.style.backgroundColor = color;
  };
  const hook = (): void => {
    for (const scene of game.scene.scenes) {
      const key = scene.sys.settings.key;
      if (!SCENE_MOOD[key]) continue;
      scene.sys.events.on(Phaser.Scenes.Events.START, () => setMood(key));
      scene.sys.events.on(Phaser.Scenes.Events.WAKE, () => setMood(key));
    }
  };
  // Not `game.isBooted`: that turns true before the scene manager creates the scenes (it does that
  // on READY, after the default textures load), so hooking then found an empty list.
  if (game.scene.scenes.length) hook(); else game.events.once(Phaser.Core.Events.READY, hook);
}
