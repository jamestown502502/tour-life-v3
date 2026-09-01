import Phaser from 'phaser';
import { H, W } from '../const';
import { ensureScrimTexture } from './sprites';
import { hasRealAsset } from '../core/assets';

/** Adds a full-screen background image, scaled to COVER the 720x1280 canvas and centered.
 *
 *  Code-drawn textures are generated at exactly W x H, so the scale works out to 1 and this
 *  behaves identically to the old `add.image(0, 0, key).setOrigin(0, 0)`. Real painted assets
 *  come back from Gemini at whatever aspect the model produced (the style probe was 848x1264,
 *  wider than our 9:16 canvas), so they need a true cover-fit: scale by the LARGER of the two
 *  axis ratios and center, cropping the overflow. Note this is deliberately not
 *  `setDisplaySize(W, H)` — that stretches to fit and would visibly distort a painted scene. */
export function addCoverBackground(scene: Phaser.Scene, key: string): Phaser.GameObjects.Image {
  const img = scene.add.image(W / 2, H / 2, key).setOrigin(0.5, 0.5);
  const src = scene.textures.get(key).getSourceImage();
  const scale = Math.max(W / src.width, H / src.height);
  img.setScale(scale);

  // Only painted art needs the legibility scrim — the code-drawn backgrounds are flat enough
  // that loose text already reads cleanly on them, and darkening those would just muddy them.
  if (hasRealAsset(key)) {
    scene.add.image(W / 2, H / 2, ensureScrimTexture(scene)).setOrigin(0.5, 0.5);
  }
  return img;
}
