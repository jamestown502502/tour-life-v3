import Phaser from 'phaser';
import { assetBaseUrl, fetchManifest, markRealAsset } from '../core/assets';

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
    if (entries.length === 0) {
      this.scene.start('Title');
      return;
    }

    // A missing/corrupt file must never block boot — log it and let that key fall back to
    // code-drawn, which is exactly what happens if it never enters the texture manager.
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => markRealAsset(key));
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[assets] could not load "${file.src}" for key "${file.key}" — falling back to code-drawn`);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.scene.start('Title'));

    for (const entry of entries) {
      this.load.image(entry.key, `${assetBaseUrl()}assets/${entry.file}`);
    }
    this.load.start();
  }
}
