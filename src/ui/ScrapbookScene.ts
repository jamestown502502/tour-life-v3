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
import { addHelpButton } from './HelpButton';

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
    addHelpButton(this, 'This is your Tour Scrapbook — a record of the run you just played. Start a new tour any time.');

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

    createButton(this, W / 2 - 150, 810, 300, 66, 'Save tour as image', () => this.exportAsImage(), { fillColor: 0x8a6fa3, fontSize: '18px' });

    createButton(this, W / 2 - 150, 900, 300, 66, 'Start a new tour', async () => {
      await clearSave();
      State.data.progress = { screen: 'title' };
      goTo(this, 'Title');
    }, { fillColor: 0x3e7c7b });
  }

  /** Close-out item 4b: the card content (title/tags/route/setlist/souvenirs/relationships)
   *  rendered above is already exactly what a snapshot of its screen region captures — no need
   *  to re-render anything to an offscreen canvas by hand. Phaser's own renderer.snapshotArea
   *  reads back real pixels from whichever renderer (WebGL or Canvas) actually drew this frame.
   *  The raw snapshot is only as wide as the game's own 720-unit canvas backing buffer, which on
   *  a DPR-1 display (most desktop browsers) comes back under the "shareable image" bar — so the
   *  snapshot is upscaled onto a fixed-size canvas before download rather than shipped as-is,
   *  guaranteeing >=800px wide regardless of the viewing device's pixel ratio. */
  private exportAsImage(): void {
    const x = 40, y = 90, w = W - 80, h = 560;
    const outW = 900;
    const outH = Math.round((h / w) * outW);
    this.game.renderer.snapshotArea(x, y, w, h, (image) => {
      const src = (image as HTMLImageElement).src;
      if (!src) return; // renderer/browser couldn't produce a snapshot — fail silently, not fatal
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      const el = new Image();
      el.onload = () => {
        if (!ctx) return;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(el, 0, 0, outW, outH);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `tour-life-${this.endingId}-${State.data.seed}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
      el.src = src;
    });
  }
}
