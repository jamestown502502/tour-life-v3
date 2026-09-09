// Diegetic-adjacent "How to Play": launched (not started) over Title or over the very first
// Hub visit, same launch/pause/stop/resume pattern as SettingsScene. Reuses only existing UI
// chrome (rounded-rect texture cache, textStyle, createButton) — no new art.
import Phaser from 'phaser';
import { PALETTE, PALETTE_HEX, W } from '../const';
import { createButton, getButtonText } from './Button';
import { ensureRoundedRect } from '../art/sprites';
import { textStyle } from './textStyles';
import { markHowToPlaySeen } from '../core/onboarding';

interface Page { title: string; body: string; }

const PAGES: Page[] = [
  {
    title: 'The Tour',
    body: 'Pick a route through cities, and live on the bus between shows. Every choice along the way shapes the story — there\'s no wrong answer, just a different tour.',
  },
  {
    title: 'The Show',
    body: 'Tap notes as they reach the gold line. Hold notes: press and hold until they end. Choice cues: tap the banner when it appears. Prefer it chill? Relaxed mode and autoplay are in Settings — score never blocks the story.',
  },
  {
    title: 'The Band',
    body: 'Watch your stats, grow relationships with your bandmates, and collect souvenirs along the way. At the end of the tour, it all becomes your Scrapbook — a one-of-a-kind ending.',
  },
];

const CARD_W = W - 80;
const CARD_H = 620;
const CARD_X = 40;
const CARD_Y = 260;

export class HowToPlayScene extends Phaser.Scene {
  constructor() { super('HowToPlay'); }

  private returnTo = 'Title';
  private page = 0;
  private body!: Phaser.GameObjects.Text;
  private heading!: Phaser.GameObjects.Text;
  private dots: Phaser.GameObjects.Arc[] = [];
  private nextBtn!: Phaser.GameObjects.Container;
  private backBtn!: Phaser.GameObjects.Container;

  init(data: { returnTo?: string }): void {
    this.returnTo = data.returnTo ?? 'Title';
    this.page = 0;
  }

  create(): void {
    markHowToPlaySeen();
    // Same overlay reasoning as SettingsScene: dim the scene behind rather than hide it, so the
    // how-to-play card sits over the painted Title art instead of flat navy.
    this.add.rectangle(0, 0, W, this.cameras.main.height, PALETTE.night, 0.78).setOrigin(0, 0);

    const shadowKey = ensureRoundedRect(this, CARD_W, CARD_H, 26);
    this.add.image(CARD_X + 5, CARD_Y + 10, shadowKey).setOrigin(0, 0).setTint(PALETTE.plum).setAlpha(0.25);
    this.add.image(CARD_X, CARD_Y, shadowKey).setOrigin(0, 0).setTint(PALETTE.sand).setAlpha(0.98);
    this.add.graphics().lineStyle(2, PALETTE.gold, 0.5).strokeRoundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 26);

    this.add.text(W / 2, 160, 'How to Play', textStyle('title', { fontSize: '40px' })).setOrigin(0.5);

    // h1's default gold is tuned for dark surfaces (1.57:1 on this card's sand tint — fails WCAG);
    // this heading sits on the sand card below, so it needs the same plum the card's dialogue
    // body already uses.
    this.heading = this.add.text(W / 2, CARD_Y + 60, '', textStyle('h1', { fontSize: '28px', color: PALETTE_HEX.plum })).setOrigin(0.5);
    this.body = this.add.text(CARD_X + 44, CARD_Y + 120, '', textStyle('dialogue', {
      fontSize: '22px', wordWrap: { width: CARD_W - 88 }, lineSpacing: 8,
    }));

    for (let i = 0; i < PAGES.length; i++) {
      const dot = this.add.circle(W / 2 - (PAGES.length - 1) * 14 + i * 28, CARD_Y + CARD_H - 40, 7, PALETTE.gold, 0.3);
      this.dots.push(dot);
    }

    this.backBtn = createButton(this, CARD_X, CARD_Y + CARD_H + 30, 160, 54, 'Back', () => this.go(-1), { fillColor: 0x8fb7c9 });
    this.nextBtn = createButton(this, CARD_X + CARD_W - 220, CARD_Y + CARD_H + 30, 220, 54, 'Next', () => this.go(1), { fillColor: 0x3e7c7b });

    this.renderPage();
  }

  private go(delta: number): void {
    if (delta > 0 && this.page === PAGES.length - 1) {
      this.close();
      return;
    }
    this.page = Phaser.Math.Clamp(this.page + delta, 0, PAGES.length - 1);
    this.renderPage();
  }

  private renderPage(): void {
    const p = PAGES[this.page];
    this.heading.setText(p.title);
    this.body.setText(p.body);
    this.dots.forEach((d, i) => d.setFillStyle(PALETTE.gold, i === this.page ? 1 : 0.3));
    this.backBtn.setVisible(this.page > 0);
    getButtonText(this.nextBtn)?.setText(this.page === PAGES.length - 1 ? 'Got it' : 'Next');
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }
}
