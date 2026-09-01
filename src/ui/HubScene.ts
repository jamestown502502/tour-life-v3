import Phaser from 'phaser';
import { PALETTE, PALETTE_HEX, W } from '../const';
import { ensureBusHubBackground, ensureHubWindowPane } from '../art/sprites';
import { applyVignette, spawnFireflies, type WeatherHandle } from '../art/effects';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { State } from '../core/state';
import { getCity } from '../game/content';
import { saveRun } from '../core/save';
import { audio } from '../core/audio';
import { DEFAULT_AMBIENCE_BPM, DEFAULT_AMBIENCE_CHORDS } from '../core/musicTheory';
import { generateEnding } from '../game/endings';
import { completeRun } from '../game/meta';
import type { StatKey } from '../../content/schema';
import { textStyle } from './textStyles';

const STAT_LABELS: Record<StatKey, string> = { energy: 'Energy', harmony: 'Harmony', inspiration: 'Inspiration', funds: 'Funds' };
const STAT_COLORS: Record<StatKey, number> = { energy: PALETTE.gold, harmony: PALETTE.teal, inspiration: PALETTE.terracotta, funds: PALETTE.sky };
const CORKBOARD_X = W - 190;
const CORKBOARD_Y = 860;

export class HubScene extends Phaser.Scene {
  constructor() { super('Hub'); }

  private fireflies: WeatherHandle | null = null;

  create(): void {
    fadeIn(this);
    audio.playAmbience(DEFAULT_AMBIENCE_CHORDS, DEFAULT_AMBIENCE_BPM);
    const bgKey = ensureBusHubBackground(this);
    const bg = this.add.image(0, 0, bgKey).setOrigin(0, 0);
    applyVignette(bg);
    this.fireflies = spawnFireflies(this, PALETTE.gold, 10);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.fireflies?.stop());

    const stop = State.data.route[State.data.currentCityIndex];
    const windowTint = stop ? getCity(stop.cityId).tint : 'midnight_indigo';
    const windowKey = ensureHubWindowPane(this, windowTint);
    this.add.image(90, 170, windowKey).setOrigin(0, 0);

    this.add.text(W / 2, 60, State.data.band.name, textStyle('h1')).setOrigin(0.5);

    this.renderStats();
    this.renderCorkboard();

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
      const targetW = Math.max(4, barW * Math.min(1, value / displayMax));

      this.add.text(60, y, STAT_LABELS[key], textStyle('stat', { fontSize: '16px' }));
      this.add.rectangle(220, y + 8, barW, 16, 0x000000, 0.25).setOrigin(0, 0);
      const fill = this.add.rectangle(220, y + 8, 0, 16, STAT_COLORS[key], 1).setOrigin(0, 0);
      this.tweens.add({
        targets: fill, width: targetW, duration: 550, delay: i * 90, ease: 'Cubic.easeOut',
      });
      this.add.text(220 + barW + 12, y, key === 'funds' ? `$${value}` : `${Math.round(value)}`, textStyle('stat'));
    });
  }

  /** Small pinned chips inside the corkboard frame drawn in ensureBusHubBackground — ties the
   *  hub's decoration to actual run state rather than being purely decorative. */
  private renderCorkboard(): void {
    this.add.text(CORKBOARD_X + 75, CORKBOARD_Y + 14, 'Souvenirs', textStyle('stat', { fontSize: '13px', color: '#F5EBDD' })).setOrigin(0.5);
    const items = State.data.inventory.slice(0, 4);
    if (items.length === 0) {
      this.add.text(CORKBOARD_X + 75, CORKBOARD_Y + 60, 'Nothing yet', textStyle('small', { fontSize: '12px' })).setOrigin(0.5);
      return;
    }
    items.forEach((item, i) => {
      const y = CORKBOARD_Y + 40 + i * 34;
      const angle = (i % 2 === 0 ? -1 : 1) * 3;
      const chip = this.add.rectangle(CORKBOARD_X + 75, y, 128, 26, PALETTE.cream, 0.95).setAngle(angle);
      chip.setStrokeStyle(1, PALETTE.plum, 0.3);
      this.add.text(CORKBOARD_X + 75, y, item.name.length > 20 ? `${item.name.slice(0, 18)}…` : item.name,
        textStyle('small', { fontSize: '11px', color: PALETTE_HEX.plum })).setOrigin(0.5).setAngle(angle);
      // pin
      this.add.circle(CORKBOARD_X + 20, y - 10, 3, PALETTE.terracotta, 1);
    });
    if (State.data.inventory.length > 4) {
      this.add.text(CORKBOARD_X + 75, CORKBOARD_Y + 40 + 4 * 34, `+${State.data.inventory.length - 4} more`,
        textStyle('small', { fontSize: '11px' })).setOrigin(0.5);
    }
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
