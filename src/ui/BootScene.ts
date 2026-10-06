import Phaser from 'phaser';
import { SONGS } from '../game/content';
import { BOOT_PROCESS_GRACE_MS, BOOT_STALL_MS, PALETTE, PALETTE_HEX, W } from '../const';
import { LATER_MANIFEST_PATH, assetBaseUrl, fetchManifest, markPending, markRealAsset, markTitleThemeLoaded, settlePending } from '../core/assets';
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
    // QA round 3 #1: "stuck on the loading screen sometimes after a refresh" on iPhone and Android,
    // with the bar full and the label reading "Ready". The bar fills when every file has DOWNLOADED;
    // the hand-off waits for every file to be PROCESSED too, and the title theme's processing is an
    // audio decode, which a phone can leave hanging forever right after a reload (the audio session
    // of the page being replaced is still being torn down). Two changes, either one enough alone:
    // the theme is no longer in this gating batch (loadAudioInBackground fetches it), and a
    // wall-clock watchdog hands off if this loader ever goes quiet, so no single file can hold the
    // game hostage. A file that has not arrived by then falls back like any missing asset.
    let handedOff = false;
    let lastProgressAt = performance.now();
    const handOff = (): void => {
      if (handedOff) return;
      handedOff = true;
      window.clearInterval(watchdog);
      this.setProgress(1);
      this.loadAudioInBackground();
      void this.loadImagesInBackground();
      // The themed-transition overlay scene lives for the whole session, above everything.
      this.scene.launch('Transition');
      this.scene.start('Title');
    };
    const watchdog = window.setInterval(() => {
      const quiet = performance.now() - lastProgressAt;
      // Downloads all done but processing never finished, or nothing at all for a long time.
      if ((this.load.progress >= 1 && quiet > BOOT_PROCESS_GRACE_MS) || quiet > BOOT_STALL_MS) {
        console.warn(`[boot] loader quiet for ${Math.round(quiet)} ms at ${Math.round(this.load.progress * 100)}% — starting without the rest`);
        handOff();
      }
    }, 500);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.clearInterval(watchdog));
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => { lastProgressAt = performance.now(); this.setProgress(value); });
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, () => { lastProgressAt = performance.now(); });
    this.load.once(Phaser.Loader.Events.COMPLETE, handOff);
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
    this.load.start();
  }

  /** Queues the rhythm backing tracks AFTER the game is already playable. Nothing waits on these:
   *  RhythmScene checks the cache and uses the procedural bed for anything not yet arrived, which
   *  is the same fallback it uses when a track is missing entirely. The title theme goes first
   *  (it no longer gates boot, see create()); TitleScene switches to it if it lands after the
   *  procedural bed has already started. */
  private loadAudioInBackground(): void {
    const loader = new Phaser.Loader.LoaderPlugin(this);
    loader.audio('title_theme', `${assetBaseUrl()}audio/title_theme.mp3`);
    loader.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => { if (key === 'title_theme') markTitleThemeLoaded(); });
    for (const song of SONGS) {
      if (song.audioFile) loader.audio(`song_${song.id}`, `${assetBaseUrl()}audio/${song.audioFile}`);
    }
    loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[audio] backing track "${file.key}" failed — that song plays procedurally`);
    });
    loader.start();
  }

  /** Same idea as loadAudioInBackground, for images: return-visit scenes and newer minigame
   *  backdrops, fetched after the title screen is up. Every scene that uses one falls back to
   *  existing art until it arrives, so nothing ever waits on this. */
  private async loadImagesInBackground(): Promise<void> {
    const entries = await fetchManifest(LATER_MANIFEST_PATH);
    if (entries.length === 0) return;
    const loader = new Phaser.Loader.LoaderPlugin(this);
    loader.maxParallelDownloads = 4; // a trickle, so it never competes with play
    let queued = 0;
    for (const entry of entries) {
      if (this.textures.exists(entry.key)) continue;
      markPending(entry.key);
      loader.image(entry.key, `${assetBaseUrl()}assets/${entry.file}`);
      queued++;
    }
    if (queued === 0) return;
    // Phaser only pulls the next queued file on its OWNING scene's UPDATE event. This loader belongs
    // to Boot, which stops the moment the title opens, so without this it loaded the first batch
    // of four and then waited forever. The game-wide step event runs whatever scenes are up.
    const pump = (): void => loader.update();
    this.game.events.on(Phaser.Core.Events.STEP, pump);
    loader.once(Phaser.Loader.Events.COMPLETE, () => this.game.events.off(Phaser.Core.Events.STEP, pump));
    loader.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => { settlePending(key); markRealAsset(key); });
    loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      settlePending(file.key);
      console.warn(`[assets] background image "${file.key}" failed — existing art stays in place`);
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
