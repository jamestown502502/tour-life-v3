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

// QA round 3 #9: three pages were not enough for a game this size. One idea per page, in the order
// a first tour meets them (goal, the loop, a city, the show, minigames, the band, where help is),
// each short enough to read in a few seconds, with the controls named exactly as they appear.
const PAGES: Page[] = [
  {
    title: 'Your tour',
    body: 'You run an indie band\'s first international tour: Mira, Theo, Jun and Rowan, four cities, one route you choose.\n\nThere is no game over. Every choice writes a different tour, and at the end it all becomes your Scrapbook.',
  },
  {
    title: 'The road',
    body: 'First, plan the route and pick the promise this tour is for.\n\nBetween cities, the bus is home base: check on the band, then tap Travel. The drive is where the band talks, and where a skill from an earlier city comes back as a quick question.',
  },
  {
    title: 'In each city',
    body: 'Pick where to go. Each place is a scene with the band and the locals, and some are minigames.\n\nYour choices move the band\'s stats and how close you are to each bandmate. When you are ready, it is showtime.',
  },
  {
    title: 'The show',
    body: 'Tap notes as they reach the gold line. Hold notes: press until they end. Choice cues: tap the banner.\n\nA low score never blocks the story. Relaxed rhythm mode, autoplay, wiggle room and audio sync are in Settings.',
  },
  {
    title: 'Minigames',
    body: 'Load-ins, soundchecks, deals, setlists and more, each teaching a real music or money skill. When a bandmate hosts one, the closer you are, the more they help.\n\nNone can be failed. Replay any of them from the bus with Practice a minigame.',
  },
  {
    title: 'Your band',
    body: 'Four stats: Energy, Harmony, Inspiration and Funds. The bus screen shows where each one stands.\n\nEach bandmate wants something different. Time spent with them moves their story on, and how you treat them shapes the ending.',
  },
  {
    title: 'Help is always here',
    body: 'Tap ? on any screen for a quick tip, and the gear for Settings: volumes, accessibility and rhythm options.\n\nThe game saves as you go. Continue picks up where you left off, Saves holds three extra slots, and this guide is on the title screen.',
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
    // Above whatever opened it, whatever the registration order (see SettingsScene.create).
    if (this.scene.get(this.returnTo)) this.scene.moveAbove(this.returnTo);
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

    // QA #14: "Back" read as "leave"; it pages. An explicit Close leaves.
    this.backBtn = createButton(this, CARD_X, CARD_Y + CARD_H + 30, 160, 54, 'Previous', () => this.go(-1), { fillColor: 0x8fb7c9 });
    createButton(this, W - 170, 130, 130, 50, 'Close', () => this.close(), { fillColor: PALETTE.plum, fontSize: '16px' });
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
