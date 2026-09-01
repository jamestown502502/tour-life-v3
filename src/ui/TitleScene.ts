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
import { hasSave, loadRun } from '../core/save';
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

    createButton(this, W / 2 - 160, 480, 320, 56, 'New Run', () => {
      if (this.saveExists) {
        this.showOverwriteConfirm();
      } else {
        this.startNewRun();
      }
    }, { fillColor: 0x3e7c7b });

    createButton(this, W / 2 - 160, 550, 320, 56, 'New seed', () => {
      this.currentSeed = generateSeed();
      seedLabel.setText(`Today's tour: ${this.currentSeed}`);
    }, { fillColor: 0xc4704f, fontSize: '20px' });

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

    hasSave().then((exists) => {
      this.saveExists = exists;
      if (exists) {
        createButton(this, W / 2 - 160, 690, 320, 56, 'Continue', async () => {
          const saved = await loadRun();
          if (saved) {
            State.data = saved;
            const { key, data } = resumeTarget(saved.progress);
            goTo(this, key, data);
          }
        }, { fillColor: 0xd9a441 });
      }
    });

    createButton(this, W / 2 - 160, 760, 320, 56, 'Settings', () => {
      this.scene.launch('Settings', { returnTo: 'Title' });
      this.scene.pause();
    }, { fillColor: 0x8fb7c9 });

    createButton(this, W / 2 - 160, 830, 320, 56, 'Tour Gallery', () => this.toggleGallery(), { fillColor: 0x4a2c40 });

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
