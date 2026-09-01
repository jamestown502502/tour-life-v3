// Small persistent "?" button, top-right on Hub/City/Rhythm/Scrapbook, toggling a one-line
// explainer panel. One shared implementation rather than four copy-pasted toggle handlers.
import Phaser from 'phaser';
import { PALETTE, W } from '../const';
import { createButton } from './Button';
import { ensureDialoguePanel } from '../art/sprites';
import { textStyle } from './textStyles';

const BTN_SIZE = 60;
const BTN_X = W - BTN_SIZE - 20;
const BTN_Y = 20;

export function addHelpButton(scene: Phaser.Scene, text: string): void {
  let panel: Phaser.GameObjects.Container | null = null;

  const toggle = (): void => {
    if (panel) {
      panel.destroy();
      panel = null;
      return;
    }
    const panelKey = ensureDialoguePanel(scene);
    const w = W - 80;
    panel = scene.add.container(0, 0).setDepth(150);
    const bg = scene.add.image(40, BTN_Y + BTN_SIZE + 10, panelKey).setOrigin(0, 0)
      .setDisplaySize(w, 120);
    const body = scene.add.text(64, BTN_Y + BTN_SIZE + 34, text, textStyle('dialogue', {
      fontSize: '18px', wordWrap: { width: w - 48 }, lineSpacing: 4,
    }));
    panel.add([bg, body]);
  };

  createButton(scene, BTN_X, BTN_Y, BTN_SIZE, BTN_SIZE, '?', toggle, {
    fillColor: PALETTE.plum, fontSize: '26px',
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => panel?.destroy());
}
