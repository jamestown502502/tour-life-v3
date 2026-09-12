import Phaser from 'phaser';
import { addCoverBackground } from '../art/background';
import { PALETTE, PALETTE_HEX, W } from '../const';
import { ensureDialoguePanel, ensureScrapbookCard, ensureSceneBackdrop } from '../art/sprites';
import { spawnConfetti, applyVignette } from '../art/effects';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { State } from '../core/state';
import { getCity, getSong } from '../game/content';
import { songForVisit } from '../game/setlist';
import { generateEnding } from '../game/endings';
import { clearSave } from '../core/save';
import { textStyle } from './textStyles';
import { addHelpButton } from './HelpButton';
import { getEpilogue } from '../../content/epilogues';
import { keptPromise } from '../game/promise';

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
    // Painted backdrop (pre-public "no barren screens" pass) — the scrapbook and its "Two Months
    // Later" epilogue are the screens a player sits with longest, and they were bare navy. Falls
    // back to a code-drawn gradient if the asset is missing.
    const bgKey = ensureSceneBackdrop(this, 'scrapbook', PALETTE.plum);
    applyVignette(addCoverBackground(this, bgKey));
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

    // The songs this run ACTUALLY played, in route order — including the return leg's second
    // song, which is the whole point of the pair. Was each city's nominal songId, which listed the
    // first song twice for a revisited city and never named the one that closed the tour.
    const played: string[] = [];
    for (const stop of State.data.route) {
      const city = getCity(stop.cityId);
      const visit = played.filter((_, i) => State.data.route[i]?.cityId === stop.cityId).length;
      played.push(getSong(songForVisit(city, State.data.seed, Math.min(visit, 1))).name);
    }
    const setlist = played.join(', ');
    // QA #11: every dynamic line wraps and the lines stack from measured heights, so a long
    // setlist or souvenir list on a narrow phone can never run off the card.
    const setlistText = this.add.text(W / 2, 268, `Setlist: ${setlist}`, textStyle('dialogue', { fontSize: '15px', shadow: undefined, wordWrap: { width: W - 180 }, align: 'center' })).setOrigin(0.5, 0);

    const souvenirs = State.data.inventory.map((i) => i.name).join(' · ') || 'none collected';
    const souvenirText = this.add.text(W / 2, setlistText.y + setlistText.height + 14, `Souvenirs: ${souvenirs}`,
      textStyle('dialogue', { fontSize: '14px', shadow: undefined, wordWrap: { width: W - 180 }, align: 'center' })).setOrigin(0.5, 0);

    const rel = Object.entries(State.data.relationships).map(([id, v]) => `${id} ${Math.round(v)}`).join('  ');
    this.add.text(W / 2, Math.min(560, souvenirText.y + souvenirText.height + 16), `Where the band landed: ${rel}`,
      textStyle('dialogue', { fontSize: '14px', shadow: undefined, wordWrap: { width: W - 180 }, align: 'center' })).setOrigin(0.5, 0);

    // QA #13: all three buttons share the default label size now (one used to override to 18px).
    createButton(this, W / 2 - 150, 720, 300, 66, 'Read the epilogue', () => this.toggleEpilogue(), { fillColor: 0xd9a441 });

    createButton(this, W / 2 - 150, 810, 300, 66, 'Save tour as image', () => this.exportAsImage(), { fillColor: 0x8a6fa3 });

    createButton(this, W / 2 - 150, 900, 300, 66, 'Start a new tour', async () => {
      await clearSave();
      State.data.progress = { screen: 'title' };
      goTo(this, 'Title');
    }, { fillColor: 0x3e7c7b });
  }

  /** Close-out item 7: a written payoff ("Two months later...") matched to the exact
   *  ending+tags this run landed on (content/epilogues.ts), not just the scorecard label —
   *  toggled rather than shown inline so the existing card layout (already dense: title, tags,
   *  route, setlist, souvenirs, relationships) doesn't have to absorb another 150-200 words. */
  private toggleEpilogue(): void {
    const existing = this.children.getByName('epiloguePanel');
    if (existing) { existing.destroy(); return; }
    // The promise the band made itself at the route screen, judged once here against the run's
    // real numbers (src/game/promise.ts). Null for any run that never chose one — including every
    // save written before promises existed.
    const text = getEpilogue(this.endingId, this.tags, State.data.flags, keptPromise(State.data), State.data.relationships);
    const panelKey = ensureDialoguePanel(this);
    const x = 40, y = 100, w = W - 80;
    const panel = this.add.container(0, 0).setName('epiloguePanel').setDepth(160);
    const overlay = this.add.rectangle(0, 0, W, this.cameras.main.height, 0x000000, 0.55).setOrigin(0, 0).setInteractive();
    overlay.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: { stopPropagation: () => void }) => event.stopPropagation());
    const bg = this.add.image(x, y, panelKey).setOrigin(0, 0);
    const title = this.add.text(x + w / 2, y + 40, 'Two Months Later', textStyle('h2', { color: PALETTE_HEX.plum })).setOrigin(0.5);
    // Item D: the why-tour pick's third and last grounding echo (after OpeningScene's closing
    // line and RoutePlan's banner) — the reason the run started, next to how it ended.
    const whyTourCaption = this.add.text(x + w / 2, y + 66, `Started because: "${State.data.band.whyTour}"`,
      textStyle('small', { fontSize: '14px', color: PALETTE_HEX.terracotta, wordWrap: { width: w - 72 }, align: 'center' })).setOrigin(0.5);
    const body = this.add.text(x + 36, y + 100, text, textStyle('dialogue', {
      fontSize: '19px', color: PALETTE_HEX.plum, wordWrap: { width: w - 72 }, lineSpacing: 8,
    }));
    // QA #5: the panel is sized to the epilogue, and Close sits below the last line rather than
    // at a fixed offset that a long epilogue ran underneath. A very long one scrolls inside a mask.
    const maxBodyH = this.cameras.main.height - y - 260;
    const bodyH = Math.min(body.height, maxBodyH);
    const h = 100 + bodyH + 110;
    bg.setDisplaySize(w, h);
    if (body.height > maxBodyH) {
      const mask = this.make.graphics({}).fillRect(x, y + 96, w, bodyH + 8);
      body.setMask(mask.createGeometryMask());
      const top = y + 100, minY = top - (body.height - bodyH);
      bg.setInteractive();
      bg.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => { body.y = Phaser.Math.Clamp(body.y - dy * 0.5, minY, top); });
      let dragY: number | null = null;
      bg.on('pointerdown', (p: Phaser.Input.Pointer) => { dragY = p.y; });
      bg.on('pointermove', (p: Phaser.Input.Pointer) => { if (dragY !== null && p.isDown) { body.y = Phaser.Math.Clamp(body.y + (p.y - dragY), minY, top); dragY = p.y; } });
      bg.on('pointerup', () => { dragY = null; });
    }
    const closeBtn = createButton(this, x + w / 2 - 110, y + h - 80, 220, 60, 'Close', () => this.toggleEpilogue(), { fillColor: 0x8fb7c9 });
    panel.add([overlay, bg, title, whyTourCaption, body, closeBtn]);
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
