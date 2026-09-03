import Phaser from 'phaser';
import { assetBaseUrl, fetchManifest, markRealAsset, markTitleThemeLoaded } from '../core/assets';

/** Loads real painted assets (if any) into the texture manager, then hands off to Title.
 *
 *  This has to be a real Scene using Phaser's own loader rather than a `preBoot`/`postBoot`
 *  game callback: `preBoot` runs before the WebGL renderer exists, so a texture added there
 *  has no GL texture behind it and the very first frame throws
 *  "Cannot read properties of null (reading 'webGLTexture')" on render. Going through
 *  scene.load means Phaser creates and uploads the texture the same way it does for any other
 *  asset, and the scene doesn't advance until that's finished.
 *
 *  Renders nothing — the canvas background color shows for the fraction of a second this takes
 *  with a handful of local WebP files. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  async create(): Promise<void> {
    const entries = await fetchManifest();

    // A missing/corrupt file must never block boot — log it and let that key fall back to
    // code-drawn (images) or the procedural title ambience (title_theme), which is exactly what
    // happens if it never enters the texture/audio cache.
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
      if (key === 'title_theme') markTitleThemeLoaded();
      else markRealAsset(key);
    });
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      const fallback = file.key === 'title_theme' ? 'the procedural title ambience' : 'code-drawn';
      console.warn(`[assets] could not load "${file.src}" for key "${file.key}" — falling back to ${fallback}`);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.scene.start('Title'));

    for (const entry of entries) {
      this.load.image(entry.key, `${assetBaseUrl()}assets/${entry.file}`);
    }
    // Audio isn't part of the image manifest (assets.ts's header comment) — queued
    // unconditionally alongside it, same graceful-fallback pattern as the loop above. This also
    // means the loader always has at least this one file queued, so the old
    // "entries.length === 0 -> skip straight to Title" early-return is gone: there's always
    // something for load.start() to do now.
    this.load.audio('title_theme', `${assetBaseUrl()}audio/title_theme.mp3`);
    this.load.start();
  }
}
