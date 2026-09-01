// Reusable dialogue panel: typewriter text + choice buttons. Tap-to-skip-typewriter is a
// separate hit target from choice buttons (known bug class — see game-dev-deploy-pipeline notes:
// a merged hit area lets an impatient tap accidentally fire a choice).
import Phaser from 'phaser';
import type { DialogueChoice, DialogueNode } from '../../content/schema';
import { PALETTE, PALETTE_HEX, TYPEWRITER_CHARS_PER_SEC, W } from '../const';
import { BANDMATE_BASE, ensureDialoguePanel, ensurePortrait, ensurePortraitFrame, ensureRoundedRect } from '../art/sprites';
import type { BandmateId } from '../../content/schema';
import { textStyle } from './textStyles';
import { createButton } from './Button';

// Panel sits low on the 720x1280 canvas but leaves room below for up to 4 choice buttons
// (58px each) before running off the bottom edge.
const PANEL_Y = 740;
const PANEL_X = 30;
const PANEL_W = W - PANEL_X * 2;
const PANEL_H = 300;

const BANDMATE_HEX: Record<BandmateId, string> = {
  mira: PALETTE_HEX.terracotta, theo: PALETTE_HEX.teal, jun: PALETTE_HEX.gold, rowan: PALETTE_HEX.sky,
};

export class DialogueBox {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Image;
  private portraitFrame: Phaser.GameObjects.Image | null = null;
  private portrait: Phaser.GameObjects.Image | null = null;
  private speakerText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private choiceButtons: Phaser.GameObjects.Container[] = [];
  private skipZone: Phaser.GameObjects.Zone;
  private typing = false;
  private fullText = '';
  private onSkippedOrAdvance: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const panelKey = ensureDialoguePanel(scene);
    const shadowKey = ensureRoundedRect(scene, PANEL_W, PANEL_H, 22);
    this.container = scene.add.container(0, 0).setDepth(100);
    const shadow = scene.add.image(PANEL_X + 4, PANEL_Y + 8, shadowKey).setOrigin(0, 0)
      .setTint(PALETTE.plum).setAlpha(0.2);
    this.panel = scene.add.image(PANEL_X, PANEL_Y, panelKey).setOrigin(0, 0);
    this.speakerText = scene.add.text(PANEL_X + 26, PANEL_Y + 18, '', textStyle('speaker'));
    this.bodyText = scene.add.text(PANEL_X + 26, PANEL_Y + 54, '', textStyle('dialogue', {
      wordWrap: { width: W - PANEL_X * 2 - 52 }, lineSpacing: 6,
    }));
    this.skipZone = scene.add.zone(PANEL_X, PANEL_Y, PANEL_W, PANEL_H).setOrigin(0, 0).setInteractive();
    this.skipZone.on('pointerdown', () => this.handleTap());
    this.container.add([shadow, this.panel, this.speakerText, this.bodyText, this.skipZone]);
  }

  private handleTap(): void {
    if (this.typing) {
      this.bodyText.setText(this.fullText);
      this.typing = false;
      return;
    }
    if (this.onSkippedOrAdvance) this.onSkippedOrAdvance();
  }

  private clearChoices(): void {
    for (const b of this.choiceButtons) b.destroy();
    this.choiceButtons = [];
  }

  private setPortrait(speaker: string, mood: string | undefined): void {
    if (this.portrait) { this.portrait.destroy(); this.portrait = null; }
    if (this.portraitFrame) { this.portraitFrame.destroy(); this.portraitFrame = null; }
    const bandmateIds: BandmateId[] = ['mira', 'theo', 'jun', 'rowan'];
    if (bandmateIds.includes(speaker as BandmateId)) {
      const frameKey = ensurePortraitFrame(this.scene);
      const portraitKey = ensurePortrait(this.scene, speaker as BandmateId, mood ?? 'happy');
      const cx = PANEL_X + PANEL_W - 90;
      const cy = PANEL_Y - 70;
      this.portraitFrame = this.scene.add.image(cx, cy, frameKey).setScale(0.85);
      this.portrait = this.scene.add.image(cx, cy, portraitKey).setScale(0.6);
      this.container.add([this.portraitFrame, this.portrait]);
    }
  }

  /** Renders a node: typewriter the text, then either show choice buttons or wait for a tap-
   *  to-advance. `onAdvance` fires for tap-to-advance (no choices); `onChoice` fires per choice. */
  show(node: DialogueNode, onAdvance: () => void, onChoice: (choice: DialogueChoice) => void): void {
    this.container.setVisible(true);
    this.clearChoices();
    const bandmateIds: BandmateId[] = ['mira', 'theo', 'jun', 'rowan'];
    const isBandmate = bandmateIds.includes(node.speaker as BandmateId);
    this.speakerText.setText(node.speaker === 'narrator' ? '' : capitalize(node.speaker));
    this.speakerText.setColor(isBandmate ? BANDMATE_HEX[node.speaker as BandmateId] : PALETTE_HEX.plum);
    this.setPortrait(node.speaker, node.portrait);
    this.fullText = node.text;
    this.bodyText.setText('');
    this.typing = true;
    const totalMs = (node.text.length / TYPEWRITER_CHARS_PER_SEC) * 1000;
    this.scene.tweens.addCounter({
      from: 0, to: node.text.length, duration: totalMs,
      onUpdate: (tw) => {
        if (!this.typing) return;
        const n = Math.floor(tw.getValue() ?? 0);
        this.bodyText.setText(this.fullText.slice(0, n));
      },
      onComplete: () => { this.typing = false; this.bodyText.setText(this.fullText); this.afterTypeComplete(node, onAdvance, onChoice); },
    });
  }

  private afterTypeComplete(node: DialogueNode, onAdvance: () => void, onChoice: (choice: DialogueChoice) => void): void {
    if (node.choices && node.choices.length > 0) {
      this.onSkippedOrAdvance = null;
      this.renderChoices(node.choices, onChoice);
    } else {
      this.onSkippedOrAdvance = onAdvance;
    }
  }

  private renderChoices(choices: DialogueChoice[], onChoice: (choice: DialogueChoice) => void): void {
    const startY = this.panel.y + this.panel.height + 14;
    choices.forEach((choice, i) => {
      const btn = createButton(this.scene, PANEL_X, startY + i * 58, PANEL_W, 48, choice.label, () => {
        this.clearChoices();
        onChoice(choice);
      }, { fillColor: PALETTE.terracotta, fontSize: '20px', tapSfx: 'choiceConfirm' });
      this.container.add(btn);
      this.choiceButtons.push(btn);
    });
  }

  /** Hide the panel entirely — used while a non-dialogue picker UI (locations, pre-show
   *  choices) occupies the screen, so stale text from the last node doesn't linger visible. */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.container.destroy();
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
