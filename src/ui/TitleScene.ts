import Phaser from 'phaser';
import { H, PALETTE, PALETTE_HEX, W } from '../const';
import { ensureTitleBackground, ensureRoundedRect } from '../art/sprites';
import { applyVignette, spawnFireflies, type WeatherHandle } from '../art/effects';
import { addCoverBackground } from '../art/background';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { audio } from '../core/audio';
import { hasTitleTheme } from '../core/assets';
import { DEFAULT_AMBIENCE_BPM, DEFAULT_AMBIENCE_CHORDS } from '../core/musicTheory';
import { dailySeed, generateSeed } from '../core/rng';
import { State } from '../core/state';
import { hasSave, loadRun, loadFromSlot, saveToSlot, SAVE_SLOTS, type SaveSlot } from '../core/save';
import type { RunState } from '../core/state';
import { hasSeenHowToPlay } from '../core/onboarding';
import { createFloatingInput, type FloatingInput } from './htmlOverlay';
import { addTextScrim, textStyle } from './textStyles';
import { resumeTarget } from '../game/resume';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  private currentSeed = generateSeed();
  private galleryOpen = false;
  private seedInput: FloatingInput | null = null;
  private fireflies: WeatherHandle | null = null;
  private saveExists = false;
  /** Which seed New Run should actually start once any overwrite-confirm is cleared — set right
   *  before requesting the confirm, since "New Run" and "Today's Tour" both fun through the
   *  same confirm dialog but start different seeds. */
  private pendingSeed = '';

  create(): void {
    this.input.once('pointerdown', () => {
      audio.unlock();
      // The real title theme (DESIGN.md §15.17's one allowed real-audio asset) replaces the
      // procedural bed here only — Rhythm/City/Hub's own playAmbience calls are untouched. Falls
      // back to the same procedural ambience Title always had if BootScene's load failed (the
      // hasTitleTheme() flag only flips true on a successful FILE_COMPLETE) or if Phaser's own
      // sound manager isn't Web Audio-backed for some reason (no decoded buffer in the cache).
      const themeBuffer = hasTitleTheme() ? (this.cache.audio.get('title_theme') as AudioBuffer | undefined) : undefined;
      // A long fade in. Autoplay policy means the theme cannot start until the player's first
      // tap, and that tap is often the one that also presses a button — reported live as the music
      // "coming out of nowhere". 0.8s (the default, tuned for crossfading between rhythm tracks)
      // is abrupt when it is the first sound the game has made. 2.6s reads as the room arriving.
      if (themeBuffer instanceof AudioBuffer) audio.playMusicTrack(themeBuffer, 0, true, 2.6);
      else audio.playAmbience(DEFAULT_AMBIENCE_CHORDS, DEFAULT_AMBIENCE_BPM);
    });
    fadeIn(this);

    const bgKey = ensureTitleBackground(this);
    const bg = addCoverBackground(this, bgKey);
    applyVignette(bg);
    this.fireflies = spawnFireflies(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.fireflies?.stop());

    // applyVignette above only darkens the frame's far corners, not this central title band —
    // see addTextScrim's own doc comment for why a scrim is needed here at all.
    addTextScrim(this, W / 2, 335, 640, 220);
    this.add.text(W / 2, 260, 'Tour Life', textStyle('title')).setOrigin(0.5);
    // gold measures 2.77:1 on this scrim (just under the 3:1 large-text floor) — cream is the
    // one preset color that reliably clears it here (5.28:1), see docs/contrast-audit.md.
    this.add.text(W / 2, 320, 'International Dates', textStyle('h2', { color: PALETTE_HEX.cream })).setOrigin(0.5);

    const seedLabel = this.add.text(W / 2, 420, `Custom seed: ${this.currentSeed}`, textStyle('small', { color: PALETTE_HEX.cream })).setOrigin(0.5);

    // 66, not the original 56 — (56+16)*0.5417=39 CSS px, under the 44px floor the Workstream E
    // audit fixed everywhere else it looked. Title itself wasn't in that audit's scope and was
    // missed; caught and fixed here while this section's Y layout was already being touched to
    // fit the new Today's Tour / Saves buttons in. BTN_ROW/BTN_GAP match the established 66/76
    // pattern; the touch-target arithmetic in the comment above HelpButton.ts's BTN_SIZE applies
    // identically to every button on this screen.
    const BTN_ROW = 66;
    const BTN_GAP = 76;
    let btnY = 480;

    // Close-out item 4a: one shared seed all day (UTC), featured above the "roll your own"
    // path — the game already had a "Today's tour: <seed>" line, but it pointed at a fresh
    // random seed each visit, not a real daily hook players could compare notes on.
    const todaysSeed = dailySeed();
    createButton(this, W / 2 - 160, btnY, 320, BTN_ROW, `Today's Tour — ${todaysSeed}`, () => {
      this.requestNewRun(todaysSeed);
    }, { fillColor: PALETTE.gold, fontSize: '16px' });
    btnY += BTN_GAP;

    // New Run / reroll side by side — freed a full row for Today's Tour above without adding
    // one, same total column height as before this pass.
    createButton(this, W / 2 - 160, btnY, 200, BTN_ROW, 'New Run', () => {
      this.requestNewRun(this.currentSeed);
    }, { fillColor: 0x3e7c7b });
    createButton(this, W / 2 + 50, btnY, 110, BTN_ROW, 'Reroll', () => {
      this.currentSeed = generateSeed();
      seedLabel.setText(`Custom seed: ${this.currentSeed}`);
    }, { fillColor: 0xc4704f, fontSize: '16px' });
    btnY += BTN_GAP;

    this.buildSeedEntry(seedLabel);
    // The seed input is a real DOM <input> (position:fixed, z-index:1000 — see htmlOverlay.ts),
    // entirely outside Phaser's canvas/scene stacking. scene.pause() only halts Title's own
    // update/input loop; it does nothing to a DOM element sitting above the whole canvas, so
    // without this it floats visibly on top of Settings and How to Play alike whenever either
    // is launched over Title. Hide/show it in lockstep with Title's own pause/resume instead of
    // trying to out-position it — the fragile version of that fix is a magic Y offset that
    // breaks again the next time anything is added near this row. Registered immediately after
    // the input exists, before any button that could pause this scene (including the auto-open
    // below), so the very first pause is covered too.
    this.events.on(Phaser.Scenes.Events.PAUSE, () => { if (this.seedInput) this.seedInput.el.style.visibility = 'hidden'; });

    const continueY = btnY;
    btnY += BTN_GAP;
    hasSave().then((exists) => {
      this.saveExists = exists;
      if (exists) {
        createButton(this, W / 2 - 160, continueY, 320, BTN_ROW, 'Continue', async () => {
          const saved = await loadRun();
          if (saved) {
            State.data = saved;
            const { key, data } = resumeTarget(saved.progress);
            goTo(this, key, data);
          }
        }, { fillColor: 0xd9a441 });
      }
    });

    createButton(this, W / 2 - 160, btnY, 320, BTN_ROW, 'Settings', () => {
      this.scene.launch('Settings', { returnTo: 'Title' });
      this.scene.pause();
    }, { fillColor: 0x8fb7c9 });
    btnY += BTN_GAP;

    createButton(this, W / 2 - 160, btnY, 320, BTN_ROW, 'Tour Gallery', () => this.toggleGallery(), { fillColor: 0x4a2c40 });
    btnY += BTN_GAP;

    createButton(this, W / 2 - 160, btnY, 320, BTN_ROW, 'Saves', () => this.openSavesPicker(), { fillColor: 0x6b8a5a });

    // Small, non-primary — sits below the seed-entry UI, not competing with New Run/Continue.
    createButton(this, W / 2 - 120, 1060, 240, 44, 'How to Play', () => this.openHowToPlay(), { fillColor: 0x8a6fa3, fontSize: '17px' });

    if (!hasSeenHowToPlay()) this.openHowToPlay();

    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      fadeIn(this);
      if (this.seedInput) this.seedInput.el.style.visibility = 'visible';
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.seedInput?.destroy());
  }

  private openHowToPlay(): void {
    this.scene.launch('HowToPlay', { returnTo: 'Title' });
    this.scene.pause();
  }

  /** New Run and Today's Tour both fun through the same overwrite-confirm when a save exists —
   *  this is the one entry point for "start a fresh run with this seed", threading the chosen
   *  seed through pendingSeed so the confirm dialog (or the direct start, if there's nothing to
   *  overwrite) starts the RIGHT seed rather than always the custom one. */
  private requestNewRun(seed: string): void {
    this.pendingSeed = seed;
    if (this.saveExists) {
      this.showOverwriteConfirm();
    } else {
      this.startNewRun(seed);
    }
  }

  private startNewRun(seed: string): void {
    State.newRun(seed);
    goTo(this, 'BandCreator');
  }

  private showOverwriteConfirm(): void {
    const w = 560, h = 260;
    const x = W / 2 - w / 2, y = H / 2 - h / 2;
    const container = this.add.container(0, 0).setDepth(200);
    const overlay = this.add.rectangle(0, 0, W, this.cameras.main.height, 0x000000, 0.6).setOrigin(0, 0).setInteractive();
    // Swallow taps on the backdrop so they can't fall through to a button underneath the modal.
    overlay.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: { stopPropagation: () => void }) => event.stopPropagation());
    const cardKey = ensureRoundedRect(this, w, h, 22);
    const card = this.add.image(x, y, cardKey).setOrigin(0, 0).setTint(PALETTE.sand);
    const border = this.add.graphics().lineStyle(2, PALETTE.gold, 0.6).strokeRoundedRect(x, y, w, h, 22);
    const message = this.add.text(x + w / 2, y + 60, 'Start a new tour?\nYour current tour will be overwritten.',
      textStyle('dialogue', { fontSize: '20px', align: 'center', lineSpacing: 6 })).setOrigin(0.5);
    container.add([overlay, card, border, message]);
    const close = () => container.destroy();
    const cancelBtn = createButton(this, x + 40, y + h - 80, 220, 54, 'Cancel', close, { fillColor: 0x8fb7c9 });
    const confirmBtn = createButton(this, x + w - 260, y + h - 80, 220, 54, 'Start new tour', () => {
      close();
      this.startNewRun(this.pendingSeed);
    }, { fillColor: 0xc4704f });
    container.add([cancelBtn, confirmBtn]);
  }

  /** 3 manual save slots (separate from the auto-save Continue uses) — close-out item 3b.
   *  Loads all 3 slots' summaries fresh every open rather than caching, so a Save in this same
   *  session immediately reflects in the row without extra bookkeeping. */
  private async openSavesPicker(): Promise<void> {
    const existing = this.children.getByName('savesPanel');
    if (existing) { existing.destroy(); return; }
    await this.buildSavesPanel();
  }

  /** Destroys and rebuilds the panel unconditionally (unlike openSavesPicker, which toggles) —
   *  used after a save completes, so the row's summary reflects what was just written. */
  private async refreshSavesPanel(): Promise<void> {
    this.children.getByName('savesPanel')?.destroy();
    await this.buildSavesPanel();
  }

  private async buildSavesPanel(): Promise<void> {
    const summaries = await Promise.all(SAVE_SLOTS.map((slot) => loadFromSlot(slot)));

    const w = 620, h = 560;
    const x = W / 2 - w / 2, y = H / 2 - h / 2;
    const panel = this.add.container(0, 0).setName('savesPanel').setDepth(200);
    const overlay = this.add.rectangle(0, 0, W, this.cameras.main.height, 0x000000, 0.6).setOrigin(0, 0).setInteractive();
    overlay.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: { stopPropagation: () => void }) => event.stopPropagation());
    const cardKey = ensureRoundedRect(this, w, h, 22);
    const card = this.add.image(x, y, cardKey).setOrigin(0, 0).setTint(PALETTE.sand);
    const border = this.add.graphics().lineStyle(2, PALETTE.gold, 0.6).strokeRoundedRect(x, y, w, h, 22);
    const title = this.add.text(x + w / 2, y + 36, 'Saves', textStyle('h2', { color: PALETTE_HEX.plum })).setOrigin(0.5);
    panel.add([overlay, card, border, title]);

    SAVE_SLOTS.forEach((slot, i) => {
      const rowY = y + 90 + i * 130;
      const saved = summaries[i];
      const summary = summarizeSave(saved);
      panel.add(this.add.text(x + 30, rowY, `Slot ${slot}`, textStyle('h2', { fontSize: '20px', color: PALETTE_HEX.plum })));
      panel.add(this.add.text(x + 30, rowY + 32, summary, textStyle('body', {
        fontSize: '16px', color: PALETTE_HEX.plum, wordWrap: { width: w - 60 },
      })));
      const saveBtn = createButton(this, x + w - 470, rowY + 62, 210, 56, 'Save here', async () => {
        if (saved) {
          this.showSlotOverwriteConfirm(slot);
        } else {
          await saveToSlot(slot, State.data);
          await this.refreshSavesPanel();
        }
      }, { fillColor: 0x3e7c7b, fontSize: '15px' });
      const loadBtn = createButton(this, x + w - 240, rowY + 62, 210, 56, saved ? 'Load' : 'Empty', async () => {
        if (!saved) return;
        State.data = saved;
        const { key, data } = resumeTarget(saved.progress);
        panel.destroy();
        goTo(this, key, data);
      }, { fillColor: saved ? 0xd9a441 : 0x8a8a8a, fontSize: '15px' });
      panel.add([saveBtn, loadBtn]);
    });

    const closeBtn = createButton(this, x + w / 2 - 110, y + h - 66, 220, 54, 'Close', () => panel.destroy(), { fillColor: 0x8fb7c9 });
    panel.add(closeBtn);
  }

  private showSlotOverwriteConfirm(slot: SaveSlot): void {
    const w = 560, h = 240;
    const x = W / 2 - w / 2, y = H / 2 - h / 2;
    const container = this.add.container(0, 0).setDepth(220);
    const overlay = this.add.rectangle(0, 0, W, this.cameras.main.height, 0x000000, 0.7).setOrigin(0, 0).setInteractive();
    overlay.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: { stopPropagation: () => void }) => event.stopPropagation());
    const cardKey = ensureRoundedRect(this, w, h, 22);
    const card = this.add.image(x, y, cardKey).setOrigin(0, 0).setTint(PALETTE.sand);
    const message = this.add.text(x + w / 2, y + 60, `Overwrite Slot ${slot}?\nThat save will be replaced.`,
      textStyle('dialogue', { fontSize: '20px', align: 'center', lineSpacing: 6 })).setOrigin(0.5);
    container.add([overlay, card, message]);
    const close = () => container.destroy();
    const cancelBtn = createButton(this, x + 40, y + h - 80, 220, 54, 'Cancel', close, { fillColor: 0x8fb7c9 });
    const confirmBtn = createButton(this, x + w - 260, y + h - 80, 220, 54, 'Overwrite', async () => {
      close();
      await saveToSlot(slot, State.data);
      await this.refreshSavesPanel();
    }, { fillColor: 0xc4704f });
    container.add([cancelBtn, confirmBtn]);
  }

  private buildSeedEntry(seedLabel: Phaser.GameObjects.Text): void {
    this.seedInput = createFloatingInput(W / 2, 950, 320, 'Or type a seed to replay a run');
    createButton(this, W / 2 - 100, 1000, 200, 44, 'Use this seed', () => {
      const val = this.seedInput?.el.value.trim();
      if (val) {
        this.currentSeed = val;
        seedLabel.setText(`Today's tour: ${this.currentSeed}`);
      }
    }, { fillColor: 0x3e7c7b, fontSize: '18px' });
  }

  private toggleGallery(): void {
    this.galleryOpen = !this.galleryOpen;
    const existing = this.children.getByName('galleryPanel');
    if (existing) { existing.destroy(); return; }
    if (!this.galleryOpen) return;
    const panel = this.add.container(0, 0).setName('galleryPanel').setDepth(200);
    const bg = this.add.rectangle(60, 200, W - 120, 700, 0x2b3a55, 0.96).setOrigin(0, 0);
    panel.add(bg);
    const history = State.data.meta.runHistory;
    const title = this.add.text(W / 2, 230, `${State.data.meta.completedRuns} tours completed`, textStyle('h2', { color: PALETTE_HEX.gold })).setOrigin(0.5);
    panel.add(title);
    if (history.length === 0) {
      panel.add(this.add.text(W / 2, 300, 'No completed tours yet.', textStyle('body')).setOrigin(0.5));
    } else {
      history.slice(-8).reverse().forEach((entry, i) => {
        const t = this.add.text(90, 280 + i * 60, `${entry.bandName} — ${entry.endingId.replace(/_/g, ' ')}\n${entry.tags.join(', ')}`,
          textStyle('body', { fontSize: '16px', lineSpacing: 4 }));
        panel.add(t);
      });
    }
  }
}

function summarizeSave(saved: RunState | null): string {
  if (!saved) return 'Empty';
  const band = saved.band.name || 'Unnamed band';
  const stop = saved.route[saved.currentCityIndex];
  const where = saved.progress.screen === 'scrapbook' ? 'Tour complete' : stop ? `en route (${stop.cityId})` : 'just starting';
  return `${band} — ${where}`;
}

