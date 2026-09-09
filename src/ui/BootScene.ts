import Phaser from 'phaser';
import { SONGS } from '../game/content';
import { PALETTE, PALETTE_HEX, W } from '../const';
import { assetBaseUrl, fetchManifest, markRealAsset, markTitleThemeLoaded } from '../core/assets';
import { textStyle } from './textStyles';

/** Loads real painted assets (if any) into the texture manager, then hands off to Title.
 *
 *  This has to be a real Scene using Phaser's own loader rather than a `preBoot`/`postBoot`
 *  game callback: `preBoot` runs before the WebGL renderer exists, so a texture added there
 *  has no GL texture behind it and the very first frame throws
 *  "Cannot read properties of null (reading 'webGLTexture')" on render. Going through
 *  scene.load means Phaser creates and uploads the texture the same way it does for any other
 *  asset, and the scene doesn't advance until that's finished.
 *
 *  TWO THINGS THIS SCENE GETS RIGHT THAT IT PREVIOUSLY DID NOT, both reported live:
 *
 *  1. IT SHOWS SOMETHING. This used to render nothing at all, on the theory that "a handful of
 *     local WebP files" takes a fraction of a second. The manifest is now 78 images and the boot
 *     payload is megabytes; on a cold cache that is a long stare at an empty navy screen, which
 *     reads as a broken game rather than a loading one. There is now a title, a progress bar and
 *     a percentage.
 *
 *  2. IT DOES NOT BLOCK THE GAME ON AUDIO. The four backing tracks are ~6.6MB — 40% of the boot
 *     payload — and none of them are needed until a rhythm scene starts, which is minutes away.
 *     Waiting on them delayed the title screen for everyone and made the opening music arrive late
 *     and out of nowhere. Images gate the handoff; audio is queued in a SECOND loader pass that
 *     runs after Title is already up, and RhythmScene falls back to procedural for any track that
 *     has not arrived yet. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  async create(): Promise<void> {
    this.buildLoadingScreen();
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
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => this.setProgress(value));
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.setProgress(1);
      this.loadAudioInBackground();
      this.scene.start('Title');
    });
    // Addendum v2, Item 7's 40 crowd sprites pushed the manifest past Phaser's default
    // maxParallelDownloads (32) for the first time — confirmed live (a debug PROGRESS/
    // FILE_COMPLETE trace): the loader silently stalled at ~50% (exactly the first 32-file
    // batch) and never dispatched the rest — no FILE_LOAD_ERROR, nothing in the console, an
    // indefinite blank-screen boot. Every one of those files loads instantly on its own
    // (verified via a raw `new Image()` probe outside Phaser), so this was the loader's own
    // queue-advance logic hitting its default cap, not a bad asset. Bumped well above the
    // current ~78-entry manifest so this doesn't silently recur the next time a pass adds
    // another batch of real assets.
    this.load.maxParallelDownloads = 200;

    for (const entry of entries) {
      this.load.image(entry.key, `${assetBaseUrl()}assets/${entry.file}`);
    }
    // The title theme is the one audio file worth waiting for: it plays on the very screen this
    // hands off to, and at ~0.7MB it is a tenth of the backing tracks. Loading it here is what
    // stops the opening music arriving several seconds late.
    this.load.audio('title_theme', `${assetBaseUrl()}audio/title_theme.mp3`);
    this.load.start();
  }

  /** Queues the rhythm backing tracks AFTER the game is already playable. Nothing waits on these:
   *  RhythmScene checks the cache and uses the procedural bed for anything not yet arrived, which
   *  is the same fallback it uses when a track is missing entirely. */
  private loadAudioInBackground(): void {
    const loader = new Phaser.Loader.LoaderPlugin(this);
    for (const song of SONGS) {
      if (song.audioFile) loader.audio(`song_${song.id}`, `${assetBaseUrl()}audio/${song.audioFile}`);
    }
    loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[audio] backing track "${file.key}" failed — that song plays procedurally`);
    });
    loader.start();
  }

  private barFill!: Phaser.GameObjects.Rectangle;
  private percentText!: Phaser.GameObjects.Text;

  /** A real loading screen: the game's own title, a bar, and a percentage. Code-drawn, because at
   *  this point in the boot no painted asset has loaded yet — this is the one screen that cannot
   *  use them. */
  private buildLoadingScreen(): void {
    const h = this.cameras.main.height;
    this.add.rectangle(0, 0, W, h, PALETTE.night, 1).setOrigin(0, 0);
    this.add.text(W / 2, h / 2 - 120, 'Tour Life', textStyle('h1', { fontSize: '46px' })).setOrigin(0.5);
    this.add.text(W / 2, h / 2 - 66, 'International Dates', textStyle('small', {
      color: PALETTE_HEX.gold,
    })).setOrigin(0.5);

    const barW = 380, barH = 12, barX = (W - barW) / 2, barY = h / 2 + 10;
    this.add.rectangle(barX, barY, barW, barH, PALETTE.cream, 0.18).setOrigin(0, 0);
    this.barFill = this.add.rectangle(barX, barY, 1, barH, PALETTE.gold, 1).setOrigin(0, 0);
    this.percentText = this.add.text(W / 2, barY + 40, 'Loading the tour…', textStyle('small', {
      color: PALETTE_HEX.cream,
    })).setOrigin(0.5);
  }

  private setProgress(value: number): void {
    if (!this.barFill) return;
    const barW = 380;
    this.barFill.width = Math.max(1, Math.round(barW * value));
    this.percentText.setText(value >= 1 ? 'Ready' : `Loading the tour… ${Math.round(value * 100)}%`);
  }
}
