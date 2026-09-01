import Phaser from 'phaser';
import { PALETTE_HEX, W } from '../const';
import { ensureScrapbookCard } from '../art/sprites';
import { spawnConfetti } from '../art/effects';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { State } from '../core/state';
import { getCity } from '../game/content';
import { generateEnding } from '../game/endings';
import { clearSave } from '../core/save';
import { textStyle } from './textStyles';

export class ScrapbookScene extends Phaser.Scene {
  constructor() { super('Scrapbook'); }

  private endingId!: string;
  private tags!: string[];

  init(data: { endingId?: string; tags?: string[] }): void {
    if (data.endingId && data.tags) {
      this.endingId = data.endingId;
      this.tags = data.tags;
    } else {
      const ending = generateEnding(State.data);
      this.endingId = ending.id;
      this.tags = ending.tags;
    }
  }

  create(): void {
    fadeIn(this);
    this.add.rectangle(0, 0, W, this.cameras.main.height, 0x2b3a55, 1).setOrigin(0, 0);
    spawnConfetti(this);

    const cardKey = ensureScrapbookCard(this);
    this.add.image(40, 90, cardKey).setOrigin(0, 0);

    this.add.text(W / 2, 130, this.endingId.replace(/_/g, ' '),
      textStyle('title', { fontSize: '30px', color: PALETTE_HEX.terracotta, shadow: undefined })).setOrigin(0.5);
    this.add.text(W / 2, 175, this.tags.join(' · '), textStyle('dialogue', { fontSize: '18px', shadow: undefined })).setOrigin(0.5);

    const route = State.data.route.map((s) => getCity(s.cityId).name).join(' → ');
    this.add.text(W / 2, 240, `Route: ${route}`,
      textStyle('dialogue', { fontSize: '16px', shadow: undefined, wordWrap: { width: W - 180 }, align: 'center' })).setOrigin(0.5);

    const setlist = Array.from(new Set(State.data.route.map((s) => getCity(s.cityId).songId))).join(', ');
    this.add.text(W / 2, 290, `Setlist: ${setlist}`, textStyle('dialogue', { fontSize: '15px', shadow: undefined })).setOrigin(0.5);

    const souvenirs = State.data.inventory.map((i) => i.name).join(' · ') || 'none collected';
    this.add.text(W / 2, 340, `Souvenirs: ${souvenirs}`,
      textStyle('dialogue', { fontSize: '14px', shadow: undefined, wordWrap: { width: W - 180 }, align: 'center' })).setOrigin(0.5);

    const rel = Object.entries(State.data.relationships).map(([id, v]) => `${id} ${Math.round(v)}`).join('  ');
    this.add.text(W / 2, 420, `Where the band landed: ${rel}`, textStyle('dialogue', { fontSize: '14px', shadow: undefined })).setOrigin(0.5);

    createButton(this, W / 2 - 150, 900, 300, 56, 'Start a new tour', async () => {
      await clearSave();
      State.data.progress = { screen: 'title' };
      goTo(this, 'Title');
    }, { fillColor: 0x3e7c7b });
  }
}
