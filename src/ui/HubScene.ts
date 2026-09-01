import Phaser from 'phaser';
import { PALETTE, W } from '../const';
import { ensureBusHubBackground } from '../art/sprites';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { State } from '../core/state';
import { getCity } from '../game/content';
import { saveRun } from '../core/save';
import { generateEnding } from '../game/endings';
import { completeRun } from '../game/meta';
import type { StatKey } from '../../content/schema';
import { textStyle } from './textStyles';

const STAT_LABELS: Record<StatKey, string> = { energy: 'Energy', harmony: 'Harmony', inspiration: 'Inspiration', funds: 'Funds' };
const STAT_COLORS: Record<StatKey, number> = { energy: PALETTE.gold, harmony: PALETTE.teal, inspiration: PALETTE.terracotta, funds: PALETTE.sky };

export class HubScene extends Phaser.Scene {
  constructor() { super('Hub'); }

  create(): void {
    fadeIn(this);
    const bgKey = ensureBusHubBackground(this);
    this.add.image(0, 0, bgKey).setOrigin(0, 0);

    this.add.text(W / 2, 60, State.data.band.name, textStyle('h1')).setOrigin(0.5);

    this.renderStats();

    const stop = State.data.route[State.data.currentCityIndex];
    if (stop) {
      const city = getCity(stop.cityId);
      this.add.text(W / 2, 780, `Next stop: ${city.name}`, textStyle('body', { fontSize: '22px' })).setOrigin(0.5);
      createButton(this, W / 2 - 160, 820, 320, 60, `Travel to ${city.name}`, () => {
        State.setProgress({ screen: 'city', cityId: city.id });
        saveRun(State.data);
        goTo(this, 'City', { cityId: city.id });
      }, { fillColor: 0x3e7c7b });
    } else {
      this.add.text(W / 2, 780, 'The last show is behind you.', textStyle('body', { fontSize: '22px' })).setOrigin(0.5);
      createButton(this, W / 2 - 160, 820, 320, 60, 'Wrap the tour', () => this.wrapTour(), { fillColor: 0xd9a441 });
    }

    if (State.data.meta.unlockedDecor.length > 0) {
      this.add.text(W / 2, 920, `Décor: ${State.data.meta.unlockedDecor.map((d) => d.replace(/_/g, ' ')).join(', ')}`,
        textStyle('small', { wordWrap: { width: W - 100 }, align: 'center' })).setOrigin(0.5);
    }

    createButton(this, W / 2 - 100, 1140, 200, 50, 'Settings', () => {
      this.scene.launch('Settings', { returnTo: 'Hub' });
      this.scene.pause();
    }, { fillColor: 0x8fb7c9, fontSize: '18px' });

    this.events.on(Phaser.Scenes.Events.RESUME, () => fadeIn(this));
  }

  private renderStats(): void {
    const keys = Object.keys(STAT_LABELS) as StatKey[];
    keys.forEach((key, i) => {
      const y = 130 + i * 44;
      const value = State.data.stats[key];
      const displayMax = key === 'funds' ? Math.max(500, value) : 100;
      const barW = 280;
      this.add.text(60, y, STAT_LABELS[key], textStyle('stat', { fontSize: '16px' }));
      this.add.rectangle(220, y + 8, barW, 16, 0x000000, 0.25).setOrigin(0, 0);
      this.add.rectangle(220, y + 8, Math.max(4, barW * Math.min(1, value / displayMax)), 16, STAT_COLORS[key], 1).setOrigin(0, 0);
      this.add.text(220 + barW + 12, y, key === 'funds' ? `$${value}` : `${Math.round(value)}`, textStyle('stat'));
    });
  }

  private wrapTour(): void {
    const ending = generateEnding(State.data);
    State.data.meta = completeRun(State.data.meta, {
      seed: State.data.seed, bandName: State.data.band.name, endingId: ending.id, tags: ending.tags, completedAt: Date.now(),
    });
    State.setProgress({ screen: 'scrapbook' });
    saveRun(State.data);
    goTo(this, 'Scrapbook', { endingId: ending.id, tags: ending.tags });
  }
}
