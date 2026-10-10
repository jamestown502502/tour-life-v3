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

// The first-launch welcome (2026-10-07). Seven pages before the first tap was too much: the critique
// was right that a player needs four things up front and learns the rest in context (the "?" on
// every screen, the first-show practice pass, each minigame's intro card). The full guide stays one
// tap away, here and on the title screen.
const WELCOME: Page = {
  title: 'Welcome to Tour Life',
  body: 'Name your band and pick a route through four cities.\n\nIn each city, explore, talk with the band and play a couple of minigames.\n\nEvery city ends with a show: tap the notes as they reach the gold line.\n\nNothing can end your tour. Missed notes and odd choices just become your story.',
};

const CARD_W = W - 80;
const CARD_H = 620;
const CARD_X = 40;
const CARD_Y = 260;
/** The scrolling text area inside the card: under the heading, above the page dots. */
const BODY_TOP = CARD_Y + 120;
const BODY_H = CARD_H - 120 - 92;

export class HowToPlayScene extends Phaser.Scene {
  constructor() { super('HowToPlay'); }

  private returnTo = 'Title';
  private page = 0;
  private body!: Phaser.GameObjects.Text;
  private heading!: Phaser.GameObjects.Text;
  private dots: Phaser.GameObjects.Arc[] = [];
  private nextBtn!: Phaser.GameObjects.Container;
  private backBtn!: Phaser.GameObjects.Container;

  private welcome = false;
  private guideBtn: Phaser.GameObjects.Container | null = null;
  /** How far the page text is scrolled up, and the most it can be (QA round 4 #5). */
  private scrollY = 0;
  private maxScroll = 0;
  private scrollHint!: Phaser.GameObjects.Text;

  init(data: { returnTo?: string; welcome?: boolean }): void {
    this.returnTo = data.returnTo ?? 'Title';
    this.page = 0;
    this.welcome = !!data.welcome;
    this.dots = [];  // the instance is reused: last visit's dots are destroyed, not gone
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
    this.body = this.add.text(CARD_X + 44, BODY_TOP, '', textStyle('dialogue', {
      fontSize: '22px', wordWrap: { width: CARD_W - 88 }, lineSpacing: 8,
    }));
    // The page text scrolls inside the card (QA round 4 #5, "allow the users to scroll the
    // tutorial page"): drag it, or use a mouse wheel. A swipe left or right turns the page.
    const maskShape = this.make.graphics({}, false).fillRect(CARD_X + 20, BODY_TOP - 6, CARD_W - 40, BODY_H + 6);
    this.body.setMask(maskShape.createGeometryMask());
    this.scrollHint = this.add.text(W / 2, BODY_TOP + BODY_H + 6, 'Drag to read more', textStyle('small', { fontSize: '15px', color: PALETTE_HEX.plum })).setOrigin(0.5, 0);
    const area = this.add.zone(CARD_X, BODY_TOP - 10, CARD_W, BODY_H + 20).setOrigin(0, 0).setInteractive();
    let start: { x: number; y: number; scroll: number } | null = null;
    area.on('pointerdown', (p: Phaser.Input.Pointer) => { start = { x: p.x, y: p.y, scroll: this.scrollY }; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!start || !p.isDown) return;
      const dy = p.y - start.y, dx = p.x - start.x;
      if (Math.abs(dy) > Math.abs(dx)) this.setScroll(start.scroll - dy);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!start) return;
      const dx = p.x - start.x, dy = p.y - start.y;
      start = null;
      if (!this.welcome && Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.5) this.go(dx < 0 ? 1 : -1);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.setScroll(this.scrollY + dy * 0.6));

    for (let i = 0; i < PAGES.length; i++) {
      const dot = this.add.circle(W / 2 - (PAGES.length - 1) * 14 + i * 28, CARD_Y + CARD_H - 40, 7, PALETTE.gold, 0.3);
      this.dots.push(dot);
    }

    // QA #14: "Back" read as "leave"; it pages. An explicit Close leaves.
    this.backBtn = createButton(this, CARD_X, CARD_Y + CARD_H + 30, 160, 54, 'Previous', () => this.go(-1), { fillColor: 0x8fb7c9 });
    createButton(this, W - 170, 130, 130, 50, 'Close', () => this.close(), { fillColor: PALETTE.plum, fontSize: '16px' });
    this.nextBtn = createButton(this, CARD_X + CARD_W - 220, CARD_Y + CARD_H + 30, 220, 54, 'Next', () => this.go(1), { fillColor: 0x3e7c7b });
    this.guideBtn = createButton(this, CARD_X, CARD_Y + CARD_H + 30, 260, 54, 'Read the full guide', () => { this.welcome = false; this.renderPage(); }, { fillColor: 0x8fb7c9, fontSize: '17px' });

    this.renderPage();
  }

  private go(delta: number): void {
    if (this.welcome || (delta > 0 && this.page === PAGES.length - 1)) {
      this.close();
      return;
    }
    this.page = Phaser.Math.Clamp(this.page + delta, 0, PAGES.length - 1);
    this.renderPage();
  }

  private setScroll(y: number): void {
    this.scrollY = Phaser.Math.Clamp(y, 0, this.maxScroll);
    this.body.setY(BODY_TOP - this.scrollY);
    this.scrollHint.setText(this.scrollY >= this.maxScroll - 2 ? 'Drag up to read from the top' : 'Drag to read more');
  }

  private renderPage(): void {
    const p = this.welcome ? WELCOME : PAGES[this.page];
    this.heading.setText(p.title);
    this.body.setText(p.body);
    this.maxScroll = Math.max(0, this.body.height - BODY_H);
    this.scrollHint.setVisible(this.maxScroll > 0);
    this.setScroll(0);
    this.dots.forEach((d, i) => d.setFillStyle(PALETTE.gold, i === this.page ? 1 : 0.3).setVisible(!this.welcome));
    this.backBtn.setVisible(!this.welcome && this.page > 0);
    this.guideBtn?.setVisible(this.welcome);
    getButtonText(this.nextBtn)?.setText(this.welcome ? "Let's go" : this.page === PAGES.length - 1 ? 'Got it' : 'Next');
  }

  close(): void {
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }
}
