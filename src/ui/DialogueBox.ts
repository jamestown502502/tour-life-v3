// Reusable dialogue panel: typewriter text + choice buttons. Tap-to-skip-typewriter is a
// separate hit target from choice buttons (known bug class — see game-dev-deploy-pipeline notes:
// a merged hit area lets an impatient tap accidentally fire a choice).
import Phaser from 'phaser';
import type { DialogueChoice, DialogueNode } from '../../content/schema';
import { PALETTE, TYPEWRITER_CHARS_PER_SEC, W } from '../const';
import { ensureDialoguePanel, ensurePortrait } from '../art/sprites';
import type { BandmateId } from '../../content/schema';
import { audio } from '../core/audio';
import { textStyle } from './textStyles';

// Panel sits low on the 720x1280 canvas but leaves room below for up to 4 choice buttons
// (54px each) before running off the bottom edge.
const PANEL_Y = 740;
const PANEL_X = 30;

export class DialogueBox {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Image;
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
    this.container = scene.add.container(0, 0).setDepth(100);
    this.panel = scene.add.image(PANEL_X, PANEL_Y, panelKey).setOrigin(0, 0);
    this.speakerText = scene.add.text(PANEL_X + 26, PANEL_Y + 18, '', textStyle('speaker'));
    this.bodyText = scene.add.text(PANEL_X + 26, PANEL_Y + 54, '', textStyle('dialogue', {
      wordWrap: { width: W - PANEL_X * 2 - 52 }, lineSpacing: 6,
    }));
    this.skipZone = scene.add.zone(PANEL_X, PANEL_Y, W - PANEL_X * 2, 300).setOrigin(0, 0).setInteractive();
    this.skipZone.on('pointerdown', () => this.handleTap());
    this.container.add([this.panel, this.speakerText, this.bodyText, this.skipZone]);
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
    const bandmateIds: BandmateId[] = ['mira', 'theo', 'jun', 'rowan'];
    if (bandmateIds.includes(speaker as BandmateId)) {
      const key = ensurePortrait(this.scene, speaker as BandmateId, mood ?? 'happy');
      this.portrait = this.scene.add.image(PANEL_X + (W - PANEL_X * 2) - 90, PANEL_Y - 70, key).setScale(0.7);
      this.container.add(this.portrait);
    }
  }

  /** Renders a node: typewriter the text, then either show choice buttons or wait for a tap-
   *  to-advance. `onAdvance` fires for tap-to-advance (no choices); `onChoice` fires per choice. */
  show(node: DialogueNode, onAdvance: () => void, onChoice: (choice: DialogueChoice) => void): void {
    this.container.setVisible(true);
    this.clearChoices();
    this.speakerText.setText(node.speaker === 'narrator' ? '' : capitalize(node.speaker));
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
    const startY = this.panel.y + this.panel.height + 10;
    choices.forEach((choice, i) => {
      const y = startY + i * 54;
      const btn = this.scene.add.container(PANEL_X, y);
      const bg = this.scene.add.rectangle(0, 0, W - PANEL_X * 2, 46, PALETTE.terracotta, 0.92).setOrigin(0, 0);
      bg.setStrokeStyle(2, PALETTE.gold, 0.6);
      const label = this.scene.add.text(16, 11, choice.label, textStyle('button', { fontSize: '20px' }));
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { bg.setFillStyle(PALETTE.gold, 0.95); audio.playSfx('menuHover'); });
      bg.on('pointerout', () => bg.setFillStyle(PALETTE.terracotta, 0.92));
      bg.on('pointerdown', () => {
        audio.playSfx('choiceConfirm');
        this.clearChoices();
        onChoice(choice);
      });
      btn.add([bg, label]);
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
