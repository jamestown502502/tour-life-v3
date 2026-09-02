import Phaser from 'phaser';
import { H, PALETTE, PALETTE_HEX, W } from '../const';
import { ensureTitleBackground, ensureRoundedRect } from '../art/sprites';
import { applyVignette, spawnFireflies, type WeatherHandle } from '../art/effects';
import { addCoverBackground } from '../art/background';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { audio } from '../core/audio';
import { DEFAULT_AMBIENCE_BPM, DEFAULT_AMBIENCE_CHORDS } from '../core/musicTheory';
import { generateSeed } from '../core/rng';
import { State, type Progress } from '../core/state';
import { hasSave, loadRun, loadFromSlot, saveToSlot, SAVE_SLOTS, type SaveSlot } from '../core/save';
import type { RunState } from '../core/state';
import { hasSeenHowToPlay } from '../core/onboarding';
import { createFloatingInput, type FloatingInput } from './htmlOverlay';
import { textStyle } from './textStyles';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  private currentSeed = generateSeed();
  private galleryOpen = false;
  private seedInput: FloatingInput | null = null;
  private fireflies: WeatherHandle | null = null;
  private saveExists = false;

  create(): void {
    this.input.once('pointerdown', () => {
      audio.unlock();
      audio.playAmbience(DEFAULT_AMBIENCE_CHORDS, DEFAULT_AMBIENCE_BPM);
    });
    fadeIn(this);

    const bgKey = ensureTitleBackground(this);
    const bg = addCoverBackground(this, bgKey);
    applyVignette(bg);
    this.fireflies = spawnFireflies(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.fireflies?.stop());

    this.add.text(W / 2, 260, 'Tour Life', textStyle('title')).setOrigin(0.5);
    this.add.text(W / 2, 320, 'International Dates', textStyle('h2', { color: PALETTE_HEX.gold })).setOrigin(0.5);

    const seedLabel = this.add.text(W / 2, 420, `Today's tour: ${this.currentSeed}`, textStyle('small')).setOrigin(0.5);

    // 66, not the original 56 — (56+16)*0.5417=39 CSS px, under the 44px floor the Workstream E
    // audit fixed everywhere else it looked. Title itself wasn't in that audit's scope and was
    // missed; caught and fixed here while this section's Y layout was already being touched to
    // fit the new Saves button in. BTN_ROW/BTN_GAP match the established 66/76 pattern.
    const BTN_ROW = 66;
    const BTN_GAP = 76;
    let btnY = 480;

    createButton(this, W / 2 - 160, btnY, 320, BTN_ROW, 'New Run', () => {
      if (this.saveExists) {
        this.showOverwriteConfirm();
      } else {
        this.startNewRun();
      }
    }, { fillColor: 0x3e7c7b });
    btnY += BTN_GAP;

    createButton(this, W / 2 - 160, btnY, 320, BTN_ROW, 'New seed', () => {
      this.currentSeed = generateSeed();
      seedLabel.setText(`Today's tour: ${this.currentSeed}`);
    }, { fillColor: 0xc4704f, fontSize: '20px' });
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

  private startNewRun(): void {
    State.newRun(this.currentSeed);
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
      this.startNewRun();
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

function resumeTarget(progress: Progress): { key: string; data?: object } {
  switch (progress.screen) {
    case 'title': return { key: 'Title' };
    case 'bandCreator': return { key: 'BandCreator' };
    case 'routePlan': return { key: 'RoutePlan' };
    case 'city':
      return progress.cityId
        ? { key: 'City', data: { cityId: progress.cityId, phase: progress.nodeId } }
        : { key: 'Hub' };
    // Rhythm/Results need live in-flight data we don't persist — safest resume is the Hub.
    case 'hub': case 'rhythm': case 'results': case 'settings': default:
      return { key: 'Hub' };
    case 'scrapbook': return { key: 'Scrapbook' };
  }
}
