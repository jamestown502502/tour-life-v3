// Themed screen transitions, done the way the stabilization revert (transition.ts) said they
// would have to be done to come back:
//
//   * ONE persistent scene, launched at boot and never stopped, that OWNS every overlay. The
//     outgoing scene's shutdown can never destroy a tween target mid-update — the crash class
//     that took the first themed layer down — because nothing here belongs to any other scene.
//   * NOTHING here is ever interactive. A leaked overlay cannot capture a tap, so the screen
//     underneath can never go dead. (Input on the outgoing scene is disabled by goTo() for the
//     cover half, which is a plugin flag, not an object.)
//   * No delayedCall anywhere: completion is driven only by the tweens' own onComplete, so a
//     timer/tween race is impossible by construction. A frame-starved device just plays slower.
//   * Reduced motion collapses every theme to the plain camera fade (handled in transition.ts).
//
// Art-direction rule holds: everything here is code-drawn chrome over the painted world.
import Phaser from 'phaser';
import { H, PALETTE, PALETTE_HEX, W } from '../const';
import { textStyle } from './textStyles';

export type TransitionTheme = 'drive' | 'ticket' | 'card' | 'lights' | 'vinyl' | 'pages';
export const TRANSITION_THEMES: TransitionTheme[] = ['drive', 'ticket', 'card', 'lights', 'vinyl', 'pages'];

export class TransitionScene extends Phaser.Scene {
  constructor() { super({ key: 'Transition' }); }

  private layer!: Phaser.GameObjects.Container;
  private playing = false;
  /** Total transitions played and how many are mid-flight — read by e2e. */
  public played = 0;

  create(): void {
    this.layer = this.add.container(0, 0);
    this.scene.bringToTop();
  }

  get isPlaying(): boolean { return this.playing; }
  get childCount(): number { return this.layer ? this.layer.length : 0; }

  /** Cover the screen with `theme`, call `onCovered` at full cover (the scene switch), reveal. */
  play(theme: TransitionTheme, label: string, onCovered: () => void): void {
    if (this.playing || !this.layer) { onCovered(); return; }
    this.playing = true;
    this.played += 1;
    this.scene.bringToTop();
    const covered = (): void => { try { onCovered(); } catch (err) { console.error('[transition] onCovered threw', err); } };
    const finish = (): void => {
      this.tweens.killAll();
      this.layer.removeAll(true);
      this.playing = false;
    };
    switch (theme) {
      case 'drive': this.drive(label, covered, finish); break;
      case 'ticket': this.ticket(label, covered, finish); break;
      case 'card': this.card(label, covered, finish); break;
      case 'lights': this.themeLights(label, covered, finish); break;
      case 'vinyl': this.vinyl(label, covered, finish); break;
      default: this.pages(label, covered, finish); break;
    }
  }

  private labelText(text: string, y: number, color: string = PALETTE_HEX.cream, size = '26px'): Phaser.GameObjects.Text {
    const t = this.add.text(W / 2, y, text, textStyle('h1', { fontSize: size, color, align: 'center', wordWrap: { width: W - 120 } })).setOrigin(0.5);
    this.layer.add(t);
    return t;
  }

  // Road lines sweep, a van crosses, headlights bloom into the next scene.
  private drive(label: string, covered: () => void, finish: () => void): void {
    const slab = this.add.rectangle(W, 0, W, H, PALETTE.night, 1).setOrigin(0, 0);
    this.layer.add(slab);
    const lines: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 6; i++) {
      const l = this.add.rectangle(W + 40 + i * 150, H * 0.62, 90, 8, PALETTE.cream, 0.9).setOrigin(0, 0.5);
      this.layer.add(l); lines.push(l);
    }
    const van = this.add.container(W + 200, H * 0.55);
    const body = this.add.rectangle(0, 0, 200, 90, PALETTE.sand, 1).setOrigin(0.5);
    const cab = this.add.rectangle(70, -18, 70, 54, PALETTE.sand, 1).setOrigin(0.5);
    const win = this.add.rectangle(84, -22, 34, 26, PALETTE.night, 1).setOrigin(0.5);
    const w1 = this.add.circle(-60, 46, 20, 0x1a1a1a, 1), w2 = this.add.circle(60, 46, 20, 0x1a1a1a, 1);
    const lamp = this.add.circle(108, 8, 8, PALETTE.gold, 1);
    van.add([body, cab, win, w1, w2, lamp]);
    this.layer.add(van);
    const text = this.labelText(label, H * 0.76, PALETTE_HEX.gold).setAlpha(0);
    this.tweens.add({ targets: slab, x: 0, duration: 320, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: lines, x: '-=1400', duration: 900, ease: 'Linear' });
    this.tweens.add({ targets: text, alpha: 1, duration: 200, delay: 260 });
    this.tweens.add({
      targets: van, x: W / 2, duration: 420, ease: 'Cubic.easeOut', delay: 120,
      onComplete: () => {
        covered();
        this.tweens.add({ targets: van, x: -300, duration: 380, ease: 'Cubic.easeIn', delay: 140 });
        this.tweens.add({ targets: text, alpha: 0, duration: 160, delay: 240 });
        this.tweens.add({ targets: slab, x: -W, duration: 340, ease: 'Cubic.easeIn', delay: 300, onComplete: finish });
      },
    });
  }

  // A ticket stub rises with the city stamped on it, then tears.
  private ticket(label: string, covered: () => void, finish: () => void): void {
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0, 0);
    this.layer.add(dim);
    const stubW = 520, stubH = 220;
    const left = this.add.container(W / 2, H + 200);
    const right = this.add.container(W / 2, H + 200);
    const mk = (side: -1 | 1): Phaser.GameObjects.GameObject[] => {
      const g = this.add.graphics();
      g.fillStyle(PALETTE.cream, 1);
      g.fillRoundedRect(side < 0 ? -stubW / 2 : 0, -stubH / 2, stubW / 2, stubH, { tl: side < 0 ? 18 : 0, bl: side < 0 ? 18 : 0, tr: side > 0 ? 18 : 0, br: side > 0 ? 18 : 0 });
      g.lineStyle(3, PALETTE.terracotta, 1);
      g.strokeRoundedRect(side < 0 ? -stubW / 2 + 10 : 10, -stubH / 2 + 10, stubW / 2 - 10, stubH - 20, 8);
      return [g];
    };
    left.add(mk(-1)); right.add(mk(1));
    const notchTop = this.add.circle(0, -stubH / 2, 16, PALETTE.night, 1), notchBot = this.add.circle(0, stubH / 2, 16, PALETTE.night, 1);
    const city = this.add.text(-stubW / 2 + 30, -20, label.toUpperCase(), textStyle('h1', { fontSize: '30px', color: PALETTE_HEX.plum })).setOrigin(0, 0.5);
    const admit = this.add.text(-stubW / 2 + 30, 30, 'ADMIT ONE · TONIGHT', textStyle('small', { fontSize: '15px', color: PALETTE_HEX.terracotta })).setOrigin(0, 0.5);
    const cover = this.add.rectangle(0, 0, W, H, PALETTE.night, 0).setOrigin(0, 0);
    this.layer.add([cover, left, right]);
    left.add([city, admit]); left.add([notchTop, notchBot]);
    this.tweens.add({ targets: cover, alpha: 1, duration: 260, ease: 'Quad.easeOut' });
    this.tweens.add({
      targets: [left, right], y: H / 2, duration: 420, ease: 'Back.easeOut', delay: 80,
      onComplete: () => {
        covered();
        this.tweens.add({ targets: left, x: W / 2 - 60, angle: -8, alpha: 0, duration: 380, ease: 'Cubic.easeIn', delay: 320 });
        this.tweens.add({ targets: right, x: W / 2 + 60, angle: 8, alpha: 0, duration: 380, ease: 'Cubic.easeIn', delay: 320 });
        this.tweens.add({ targets: cover, alpha: 0, duration: 340, delay: 460, onComplete: finish });
      },
    });
  }

  // The polaroid card: handwritten label, scales in, flips away.
  private card(label: string, covered: () => void, finish: () => void): void {
    const cover = this.add.rectangle(0, 0, W, H, PALETTE.night, 0).setOrigin(0, 0);
    const cardC = this.add.container(W / 2, H / 2).setScale(0.6).setAlpha(0).setAngle(-6);
    const paper = this.add.rectangle(0, 0, 440, 520, PALETTE.cream, 1).setOrigin(0.5);
    const photo = this.add.rectangle(0, -40, 380, 360, PALETTE.plum, 1).setOrigin(0.5);
    const glow = this.add.rectangle(0, -40, 380, 360, PALETTE.gold, 0.18).setOrigin(0.5);
    const caption = this.add.text(0, 200, label, textStyle('h1', { fontSize: '28px', color: PALETTE_HEX.plum, align: 'center', wordWrap: { width: 400 } })).setOrigin(0.5);
    cardC.add([paper, photo, glow, caption]);
    this.layer.add([cover, cardC]);
    this.tweens.add({ targets: cover, alpha: 1, duration: 260 });
    this.tweens.add({
      targets: cardC, scale: 1, alpha: 1, angle: 3, duration: 380, ease: 'Back.easeOut', delay: 60,
      onComplete: () => {
        covered();
        this.tweens.add({ targets: cardC, scaleX: 0, angle: -20, alpha: 0, duration: 320, ease: 'Cubic.easeIn', delay: 340 });
        this.tweens.add({ targets: cover, alpha: 0, duration: 320, delay: 520, onComplete: finish });
      },
    });
  }

  // House lights down: an iris closes on darkness, a spotlight opens on the stage.
  private themeLights(label: string, covered: () => void, finish: () => void): void {
    const black = this.add.rectangle(0, 0, W, H, 0x050509, 1).setOrigin(0, 0);
    const maskG = this.make.graphics({});
    const mask = maskG.createGeometryMask();
    mask.invertAlpha = true;
    black.setMask(mask);
    this.layer.add(black);
    const state = { r: 900 };
    const redraw = (): void => { maskG.clear(); maskG.fillStyle(0xffffff, 1); maskG.fillCircle(W / 2, H * 0.55, Math.max(0.01, state.r)); };
    redraw();
    const text = this.labelText(label, H * 0.3, PALETTE_HEX.gold).setAlpha(0);
    this.tweens.add({
      targets: state, r: 0, duration: 420, ease: 'Cubic.easeIn', onUpdate: redraw,
      onComplete: () => {
        covered();
        this.tweens.add({ targets: text, alpha: 1, duration: 160, yoyo: true, hold: 260 });
        this.tweens.add({
          targets: state, r: 1000, duration: 520, ease: 'Cubic.easeOut', delay: 420, onUpdate: redraw,
          onComplete: () => { maskG.destroy(); finish(); },
        });
      },
    });
  }

  // A record spins up and fills the screen, the label carries the text, it spins back out.
  private vinyl(label: string, covered: () => void, finish: () => void): void {
    const cover = this.add.rectangle(0, 0, W, H, PALETTE.night, 0).setOrigin(0, 0);
    const disc = this.add.container(W / 2, H / 2).setScale(0.1).setAlpha(0);
    const g = this.add.graphics();
    g.fillStyle(0x111111, 1); g.fillCircle(0, 0, 640);
    g.lineStyle(2, 0x2a2a2a, 1);
    for (let r = 120; r < 620; r += 34) g.strokeCircle(0, 0, r);
    g.fillStyle(PALETTE.gold, 1); g.fillCircle(0, 0, 110);
    g.fillStyle(0x111111, 1); g.fillCircle(0, 0, 8);
    disc.add(g);
    const text = this.add.text(0, 0, label, textStyle('h1', { fontSize: '22px', color: PALETTE_HEX.plum, align: 'center', wordWrap: { width: 180 } })).setOrigin(0.5);
    disc.add(text);
    this.layer.add([cover, disc]);
    this.tweens.add({ targets: cover, alpha: 1, duration: 300 });
    this.tweens.add({
      targets: disc, scale: 1, alpha: 1, angle: 240, duration: 480, ease: 'Cubic.easeOut',
      onComplete: () => {
        covered();
        this.tweens.add({ targets: disc, scale: 0.05, angle: 600, alpha: 0, duration: 420, ease: 'Cubic.easeIn', delay: 300 });
        this.tweens.add({ targets: cover, alpha: 0, duration: 320, delay: 520, onComplete: finish });
      },
    });
  }

  // A page turns: a sand sheet sweeps across with a soft shadow at its leading edge.
  private pages(label: string, covered: () => void, finish: () => void): void {
    const sheet = this.add.rectangle(W, 0, W, H, PALETTE.sand, 1).setOrigin(0, 0);
    const shadow = this.add.rectangle(W, 0, 40, H, 0x000000, 0.25).setOrigin(1, 0);
    this.layer.add([sheet, shadow]);
    const text = this.labelText(label, H / 2, PALETTE_HEX.plum).setAlpha(0);
    this.tweens.add({ targets: [sheet, shadow], x: 0, duration: 380, ease: 'Cubic.easeInOut' });
    this.tweens.add({
      targets: text, alpha: 1, duration: 200, delay: 300,
      onComplete: () => {
        covered();
        this.tweens.add({ targets: text, alpha: 0, duration: 160, delay: 200 });
        this.tweens.add({ targets: [sheet, shadow], x: -W, duration: 380, ease: 'Cubic.easeInOut', delay: 280, onComplete: finish });
      },
    });
  }
}
