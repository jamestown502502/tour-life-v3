// Reusable dialogue panel: typewriter text + choice buttons. Tap-to-skip-typewriter is a
// separate hit target from choice buttons (known bug class — see game-dev-deploy-pipeline notes:
// a merged hit area lets an impatient tap accidentally fire a choice).
import Phaser from 'phaser';
import type { DialogueChoice, DialogueNode } from '../../content/schema';
import { PALETTE, PALETTE_HEX, SAFE_BOTTOM_Y, TYPEWRITER_CHARS_PER_SEC, W } from '../const';
import { ensureDialoguePanel, ensurePortrait, ensurePortraitFrame, ensureRoundedRect } from '../art/sprites';
import type { BandmateId } from '../../content/schema';
import { textStyle } from './textStyles';
import { createButton } from './Button';
import { audio } from '../core/audio';
import { State } from '../core/state';

// Panel sits low on the 720x1280 canvas. PANEL_Y is chosen so that the panel plus up to 4
// choice rows stays above SAFE_BOTTOM_Y (1230) — on a phone the canvas scales to ~0.54x and
// anything below that line lands under the iOS home-indicator gesture zone. renderChoices()
// sizes rows to fit that budget rather than trusting this arithmetic blindly.
const PANEL_Y = 690;
const PANEL_X = 30;
const PANEL_W = W - PANEL_X * 2;
const PANEL_H = 300;
const AUTO_ADVANCE_MS = 4000;
// Close-out item 3a (VN QoL: r/visualnovels' most-requested feature). Session-only, not saved —
// a backlog surviving a save/reload is a "nice later," not what was asked for.
const BACKLOG_CAP = 30;
const BACKLOG_BTN_SIZE = 66; // matches HelpButton's BTN_SIZE — the same measured 44px-floor fix

// The nameplate/glow's own accent colors (BANDMATE_COLOR, unchanged below) read fine as
// low-alpha decorative glows and underline bars, but 3 of 4 measure well under WCAG on the
// dialogue/backlog panels' sand tint when used as TEXT: gold 1.57:1, sky 1.50:1, terracotta
// 2.53:1 (only teal's 3.35:1 scrapes past the loosest 3:1 bar) — see docs/contrast-audit.md.
// Darker, same-hue-family variants here keep each bandmate's color identity while clearing
// 4.5:1 on sand — high enough to cover both the bold 20px speaker nameplate (3:1 floor) and
// the normal-weight 16px backlog panel (4.5:1 floor) with one shared set.
export const BANDMATE_HEX: Record<BandmateId, string> = {
  mira: '#7D4028', theo: '#275452', jun: '#6B4C18', rowan: '#2E5266',
};
const BANDMATE_COLOR: Record<BandmateId, number> = {
  mira: PALETTE.terracotta, theo: PALETTE.teal, jun: PALETTE.gold, rowan: PALETTE.sky,
};
const BANDMATE_IDS: BandmateId[] = ['mira', 'theo', 'jun', 'rowan'];

export class DialogueBox {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Image;
  private portraitFrame: Phaser.GameObjects.Image | null = null;
  private portrait: Phaser.GameObjects.Image | null = null;
  private portraitBob: Phaser.Tweens.Tween | null = null;
  private nameGlow: Phaser.GameObjects.Arc[] = [];
  private nameBar: Phaser.GameObjects.Rectangle;
  private speakerText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private chevron: Phaser.GameObjects.Text;
  private chevronPulse: Phaser.Tweens.Tween | null = null;
  private choiceButtons: Phaser.GameObjects.Container[] = [];
  private skipZone: Phaser.GameObjects.Zone;
  private typing = false;
  private fullText = '';
  private onSkippedOrAdvance: (() => void) | null = null;
  private autoTimer: Phaser.Time.TimerEvent | null = null;
  private keyHandler: () => void;
  private backlog: { speaker: string; text: string }[] = [];
  private backlogPanel: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    audio.duckMusic(true);
    const panelKey = ensureDialoguePanel(scene);
    const shadowKey = ensureRoundedRect(scene, PANEL_W, PANEL_H, 22);
    this.container = scene.add.container(0, 0).setDepth(100);
    const shadow = scene.add.image(PANEL_X + 4, PANEL_Y + 8, shadowKey).setOrigin(0, 0)
      .setTint(PALETTE.plum).setAlpha(0.2);
    this.panel = scene.add.image(PANEL_X, PANEL_Y, panelKey).setOrigin(0, 0);

    // Soft accent glow behind the nameplate, tinted per speaker (hidden for the narrator).
    const gx = PANEL_X + 26, gy = PANEL_Y + 30;
    this.nameGlow = [
      scene.add.circle(gx + 40, gy, 78, PALETTE.gold, 0.09),
      scene.add.circle(gx + 40, gy, 46, PALETTE.gold, 0.13),
    ];
    this.speakerText = scene.add.text(gx, PANEL_Y + 18, '', textStyle('speaker'));
    this.nameBar = scene.add.rectangle(gx, PANEL_Y + 44, 40, 3, PALETTE.plum, 0.9).setOrigin(0, 0);
    // Dialogue body at 26px (not the 24px preset): ~14 CSS px at phone scale, the floor for
    // comfortable reading over a painted background.
    this.bodyText = scene.add.text(gx, PANEL_Y + 56, '', textStyle('dialogue', {
      fontSize: '26px', wordWrap: { width: W - PANEL_X * 2 - 52 }, lineSpacing: 6,
    }));
    // Advance affordance: a chevron that pulses once a line is fully typed and is waiting on a
    // tap. Hidden while typing and whenever choices are up.
    // gold measures 1.57:1 on this panel's sand tint (contrast-audit Workstream 1) — plum matches
    // the rest of this panel's text (speaker/dialogue) and is the pairing that actually passes.
    this.chevron = scene.add.text(PANEL_X + PANEL_W - 30, PANEL_Y + PANEL_H - 28, '▼', textStyle('button', {
      fontSize: '22px', color: PALETTE_HEX.plum,
    })).setOrigin(0.5).setVisible(false);

    this.skipZone = scene.add.zone(PANEL_X, PANEL_Y, PANEL_W, PANEL_H).setOrigin(0, 0).setInteractive();
    this.skipZone.on('pointerdown', () => this.handleTap());
    this.container.add([shadow, this.panel, ...this.nameGlow, this.nameBar, this.speakerText, this.bodyText, this.chevron, this.skipZone]);

    // Space = same as tapping the panel (skip the typewriter, or advance). Keyboard is optional
    // per the touch-first rule; this just mirrors the tap.
    this.keyHandler = () => { if (this.container.visible) this.handleTap(); };
    scene.input.keyboard?.on('keydown-SPACE', this.keyHandler);

    // Top-left, mirroring HelpButton's top-right placement — the one screen region every
    // dialogue-bearing scene leaves clear (title text is centered, the portrait sits top-right
    // of the panel far below this).
    const backlogBtn = createButton(scene, 20, 20, BACKLOG_BTN_SIZE, BACKLOG_BTN_SIZE, '≡', () => this.toggleBacklog(), {
      fillColor: PALETTE.plum, fontSize: '26px',
    });
    backlogBtn.setDepth(110);
  }

  private handleTap(): void {
    this.cancelAuto();
    if (this.typing) {
      this.finishTyping();
      return;
    }
    if (this.onSkippedOrAdvance) this.onSkippedOrAdvance();
  }

  private clearChoices(): void {
    for (const b of this.choiceButtons) b.destroy();
    this.choiceButtons = [];
  }

  private cancelAuto(): void {
    this.autoTimer?.destroy();
    this.autoTimer = null;
  }

  private setPortrait(speaker: string, mood: string | undefined): void {
    this.portraitBob?.stop();
    this.portraitBob = null;
    if (this.portrait) { this.portrait.destroy(); this.portrait = null; }
    if (this.portraitFrame) { this.portraitFrame.destroy(); this.portraitFrame = null; }
    if (BANDMATE_IDS.includes(speaker as BandmateId)) {
      const frameKey = ensurePortraitFrame(this.scene);
      const portraitKey = ensurePortrait(this.scene, speaker as BandmateId, mood ?? 'happy');
      const cx = PANEL_X + PANEL_W - 90;
      const cy = PANEL_Y - 70;
      this.portraitFrame = this.scene.add.image(cx, cy, frameKey).setScale(0.85);
      this.portrait = this.scene.add.image(cx, cy + 6, portraitKey).setScale(0.5);
      this.container.add([this.portraitFrame, this.portrait]);
    }
  }

  /** Portrait "breathes" while its line types out (+-3px), then settles. Static under
   *  reducedMotion. The painted portraits are single images, so this — not a mouth swap — is
   *  the life the plan asked for. */
  private startPortraitBob(): void {
    if (!this.portrait || State.data.accessibility.reducedMotion) return;
    const baseY = this.portrait.y;
    this.portraitBob = this.scene.tweens.add({
      targets: this.portrait, y: baseY - 3, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  private stopPortraitBob(): void {
    if (this.portraitBob) {
      this.portraitBob.stop();
      this.portraitBob = null;
      if (this.portrait) this.portrait.y = PANEL_Y - 70 + 6;
    }
  }

  private setChevron(visible: boolean): void {
    this.chevron.setVisible(visible);
    this.chevronPulse?.stop();
    this.chevronPulse = null;
    this.chevron.setAlpha(1);
    if (visible && !State.data.accessibility.reducedMotion) {
      this.chevronPulse = this.scene.tweens.add({ targets: this.chevron, alpha: 0.35, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** Renders a node: typewriter the text, then either show choice buttons or wait for a tap-
   *  to-advance. `onAdvance` fires for tap-to-advance (no choices); `onChoice` fires per choice. */
  show(node: DialogueNode, onAdvance: () => void, onChoice: (choice: DialogueChoice) => void): void {
    this.cancelAuto();
    this.container.setVisible(true);
    this.clearChoices();
    this.setChevron(false);
    const isBandmate = BANDMATE_IDS.includes(node.speaker as BandmateId);
    const isNarrator = node.speaker === 'narrator';
    this.speakerText.setText(isNarrator ? '' : capitalize(node.speaker));
    const hex = isBandmate ? BANDMATE_HEX[node.speaker as BandmateId] : PALETTE_HEX.plum;
    const color = isBandmate ? BANDMATE_COLOR[node.speaker as BandmateId] : PALETTE.plum;
    this.speakerText.setColor(hex);
    this.nameBar.setVisible(!isNarrator).setFillStyle(color, 0.9).setSize(Math.max(40, this.speakerText.width), 3);
    for (const g of this.nameGlow) g.setVisible(!isNarrator).setFillStyle(color, g.radius > 60 ? 0.09 : 0.14);
    this.setPortrait(node.speaker, node.portrait);
    this.fullText = node.text;
    this.bodyText.setText('');
    this.backlog.push({ speaker: node.speaker, text: node.text });
    if (this.backlog.length > BACKLOG_CAP) this.backlog.shift();
    this.onSkippedOrAdvance = null;
    const complete = () => { this.finishTyping(); this.afterTypeComplete(node, onAdvance, onChoice); };

    if (State.data.accessibility.skipReadText) {
      this.typing = false;
      complete();
      return;
    }

    this.typing = true;
    this.startPortraitBob();
    const totalMs = (node.text.length / TYPEWRITER_CHARS_PER_SEC) * 1000;
    let lastTick = 0;
    this.scene.tweens.addCounter({
      from: 0, to: node.text.length, duration: totalMs,
      onUpdate: (tw) => {
        if (!this.typing) return;
        const n = Math.floor(tw.getValue() ?? 0);
        this.bodyText.setText(this.fullText.slice(0, n));
        // One soft tick every ~3 characters (not every character — 45 cps would be a buzz),
        // and never on whitespace, so the ticks land on syllables rather than gaps.
        if (n - lastTick >= 3 && this.fullText[n - 1] && this.fullText[n - 1] !== ' ') {
          lastTick = n;
          audio.playSfx('typewriter');
        }
      },
      onComplete: () => { if (this.typing) complete(); },
    });
  }

  private finishTyping(): void {
    this.typing = false;
    this.stopPortraitBob();
    this.bodyText.setText(this.fullText);
  }

  private afterTypeComplete(node: DialogueNode, onAdvance: () => void, onChoice: (choice: DialogueChoice) => void): void {
    if (node.choices && node.choices.length > 0) {
      this.onSkippedOrAdvance = null;
      this.setChevron(false);
      this.renderChoices(node.choices, onChoice);
    } else {
      this.onSkippedOrAdvance = onAdvance;
      this.setChevron(true);
      // Auto mode advances plain lines on a timer; it never advances past a choice.
      if (State.data.accessibility.autoAdvance) {
        this.autoTimer = this.scene.time.delayedCall(AUTO_ADVANCE_MS, () => {
          this.autoTimer = null;
          if (this.container.visible && this.onSkippedOrAdvance === onAdvance) onAdvance();
        });
      }
    }
  }

  private renderChoices(choices: DialogueChoice[], onChoice: (choice: DialogueChoice) => void): void {
    const startY = this.panel.y + this.panel.height + 14;
    // Fit every row above the safe line: 62px rows (a real >=44 CSS-px target at phone scale)
    // for the usual 2-3 choices, tighter rows only if content ever ships a 4-choice node.
    const rows = choices.length;
    const budget = SAFE_BOTTOM_Y - startY;
    const btnH = rows <= 3 ? 62 : 48;
    const step = Math.min(btnH + 6, Math.floor((budget - btnH) / Math.max(1, rows - 1)));
    choices.forEach((choice, i) => {
      const btn = createButton(this.scene, PANEL_X, startY + i * step, PANEL_W, btnH, choice.label, () => {
        this.cancelAuto();
        this.clearChoices();
        onChoice(choice);
      }, { fillColor: PALETTE.terracotta, fontSize: '22px', tapSfx: 'choiceConfirm' });
      this.container.add(btn);
      this.choiceButtons.push(btn);
    });
  }

  /** The last ~30 spoken lines, speaker-colored, drag-to-scroll if they overflow the panel.
   *  Session-only (not persisted) — closes and reopens fresh each toggle rather than remembering
   *  scroll position, which is a fine tradeoff for a QoL panel nobody needs to leave mid-scroll. */
  private toggleBacklog(): void {
    if (this.backlogPanel) {
      this.backlogPanel.destroy();
      this.backlogPanel = null;
      this.container.setVisible(true);
      return;
    }
    // Hide the live panel underneath — its choice buttons sit at panel.y + panel.height + 14
    // onward, which can run past the backlog overlay's own footprint and bleed through
    // otherwise (confirmed live: a 3rd/4th choice row overlapped the Close button's zone).
    this.container.setVisible(false);
    const panelKey = ensureDialoguePanel(this.scene);
    // Panel bottom (y+h) at 1080, Close button at 1100-1166 — comfortably clear of
    // SAFE_BOTTOM_Y (1230), matching every other bottom-of-screen control in the game.
    const x = 30, y = 100, w = W - 60, h = 980;
    const root = this.scene.add.container(0, 0).setDepth(160);
    const bg = this.scene.add.image(x, y, panelKey).setOrigin(0, 0).setDisplaySize(w, h);
    root.add(bg);

    const padX = 24, padTop = 20;
    const maskShape = this.scene.make.graphics({});
    maskShape.fillRect(x + padX, y + padTop, w - padX * 2, h - padTop - 16);
    const mask = maskShape.createGeometryMask();

    const content = this.scene.add.container(x + padX, y + padTop);
    content.setMask(mask);
    root.add(content);

    let cursorY = 0;
    const entries = this.backlog.length > 0 ? this.backlog : [{ speaker: 'narrator', text: '(Nothing said yet.)' }];
    for (const line of entries) {
      const isBandmate = BANDMATE_IDS.includes(line.speaker as BandmateId);
      const label = isBandmate ? `${capitalize(line.speaker)}: ` : '';
      const color = isBandmate ? BANDMATE_HEX[line.speaker as BandmateId] : PALETTE_HEX.plum;
      const t = this.scene.add.text(0, cursorY, `${label}${line.text}`, textStyle('small', {
        fontSize: '16px', color, wordWrap: { width: w - padX * 2 }, lineSpacing: 3,
      }));
      content.add(t);
      cursorY += t.height + 16;
    }
    const contentH = cursorY;
    const viewH = h - padTop - 16;
    const minY = Math.min(0, viewH - contentH);

    // Drag-to-scroll: a transparent zone over the masked area tracks pointer delta-Y onto the
    // content container's own y, clamped so it never scrolls past either end.
    const dragZone = this.scene.add.zone(x + padX, y + padTop, w - padX * 2, viewH).setOrigin(0, 0).setInteractive();
    root.add(dragZone);
    let dragging = false, dragStartY = 0, contentStartY = 0;
    dragZone.on('pointerdown', (p: Phaser.Input.Pointer) => { dragging = true; dragStartY = p.y; contentStartY = content.y; });
    dragZone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging) return;
      content.y = Phaser.Math.Clamp(contentStartY + (p.y - dragStartY), minY, 0);
    });
    const endDrag = () => { dragging = false; };
    dragZone.on('pointerup', endDrag);
    dragZone.on('pointerout', endDrag);

    const closeBtn = createButton(this.scene, W / 2 - 130, y + h + 14, 260, 66, 'Close', () => this.toggleBacklog(), {
      fillColor: 0xc4704f,
    });
    root.add(closeBtn);
    this.backlogPanel = root;
  }

  /** Hide the panel entirely — used while a non-dialogue picker UI (locations, pre-show
   *  choices) occupies the screen, so stale text from the last node doesn't linger visible. */
  setVisible(visible: boolean): void {
    if (!visible) this.cancelAuto();
    this.container.setVisible(visible);
    audio.duckMusic(visible);
  }

  destroy(): void {
    this.cancelAuto();
    this.stopPortraitBob();
    this.chevronPulse?.stop();
    this.scene.input.keyboard?.off('keydown-SPACE', this.keyHandler);
    audio.duckMusic(false);
    this.backlogPanel?.destroy();
    this.container.destroy();
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
