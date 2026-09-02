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

const BANDMATE_HEX: Record<BandmateId, string> = {
  mira: PALETTE_HEX.terracotta, theo: PALETTE_HEX.teal, jun: PALETTE_HEX.gold, rowan: PALETTE_HEX.sky,
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
    this.chevron = scene.add.text(PANEL_X + PANEL_W - 30, PANEL_Y + PANEL_H - 28, '▼', textStyle('button', {
      fontSize: '22px', color: PALETTE_HEX.gold,
    })).setOrigin(0.5).setVisible(false);

    this.skipZone = scene.add.zone(PANEL_X, PANEL_Y, PANEL_W, PANEL_H).setOrigin(0, 0).setInteractive();
    this.skipZone.on('pointerdown', () => this.handleTap());
    this.container.add([shadow, this.panel, ...this.nameGlow, this.nameBar, this.speakerText, this.bodyText, this.chevron, this.skipZone]);

    // Space = same as tapping the panel (skip the typewriter, or advance). Keyboard is optional
    // per the touch-first rule; this just mirrors the tap.
    this.keyHandler = () => { if (this.container.visible) this.handleTap(); };
    scene.input.keyboard?.on('keydown-SPACE', this.keyHandler);
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
    this.container.destroy();
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
