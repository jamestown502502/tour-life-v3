import Phaser from 'phaser';
import { PALETTE_HEX, W } from '../const';
import { ensureTitleBackground } from '../art/sprites';
import { applyVignette, spawnFireflies, type WeatherHandle } from '../art/effects';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { audio } from '../core/audio';
import { generateSeed } from '../core/rng';
import { State, type Progress } from '../core/state';
import { hasSave, loadRun } from '../core/save';
import { createFloatingInput, type FloatingInput } from './htmlOverlay';
import { textStyle } from './textStyles';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  private currentSeed = generateSeed();
  private galleryOpen = false;
  private seedInput: FloatingInput | null = null;
  private fireflies: WeatherHandle | null = null;

  create(): void {
    this.input.once('pointerdown', () => audio.unlock());
    fadeIn(this);

    const bgKey = ensureTitleBackground(this);
    const bg = this.add.image(0, 0, bgKey).setOrigin(0, 0);
    applyVignette(bg);
    this.fireflies = spawnFireflies(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.fireflies?.stop());

    this.add.text(W / 2, 260, 'Tour Life', textStyle('title')).setOrigin(0.5);
    this.add.text(W / 2, 320, 'International Dates', textStyle('h2', { color: PALETTE_HEX.gold })).setOrigin(0.5);

    const seedLabel = this.add.text(W / 2, 420, `Today's tour: ${this.currentSeed}`, textStyle('small')).setOrigin(0.5);

    createButton(this, W / 2 - 160, 480, 320, 56, 'New Run', () => {
      State.newRun(this.currentSeed);
      goTo(this, 'BandCreator');
    }, { fillColor: 0x3e7c7b });

    createButton(this, W / 2 - 160, 550, 320, 56, 'New seed', () => {
      this.currentSeed = generateSeed();
      seedLabel.setText(`Today's tour: ${this.currentSeed}`);
    }, { fillColor: 0xc4704f, fontSize: '20px' });

    this.buildSeedEntry(seedLabel);

    hasSave().then((exists) => {
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

    this.events.on(Phaser.Scenes.Events.RESUME, () => fadeIn(this));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.seedInput?.destroy());
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
