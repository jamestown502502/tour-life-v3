// Small persistent "?" button, top-right on Hub/City/Rhythm/Scrapbook, toggling a one-line
// explainer panel. One shared implementation rather than four copy-pasted toggle handlers.
import Phaser from 'phaser';
import { PALETTE, PALETTE_HEX, W } from '../const';
import { createButton } from './Button';
import { ensureDialoguePanel } from '../art/sprites';
import { textStyle } from './textStyles';

// 66, not 60: (60+16)*0.5417=41.2 CSS px, under the 44px touch-target floor at the measured
// 390px-width scale — caught during the Workstream E iPhone audit. 66 clears it (44.4).
const BTN_SIZE = 66;
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
    // A tap anywhere closes it (QA round 3 #4: it stayed up until the "?" was found again). The
    // catcher covers the whole screen under the panel and takes that one tap, so it never also
    // presses whatever was underneath. It stays up until then: no timer, so it can be read at any pace.
    const catcher = scene.add.zone(0, 0, W, scene.cameras.main.height).setOrigin(0, 0).setInteractive();
    catcher.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      toggle();
    });
    const body = scene.add.text(64, BTN_Y + BTN_SIZE + 34, text, textStyle('dialogue', {
      fontSize: '18px', wordWrap: { width: w - 48 }, lineSpacing: 4,
    }));
    const hint = scene.add.text(W / 2, 0, 'Tap anywhere to close', textStyle('small', { fontSize: '14px', color: PALETTE_HEX.plum })).setOrigin(0.5, 0);
    // The panel grows with its text (some minigame explainers run to four lines), with the hint under it.
    const h = Math.max(120, body.height + 74);
    hint.setY(BTN_Y + BTN_SIZE + 10 + h - 32);
    const bg = scene.add.image(40, BTN_Y + BTN_SIZE + 10, panelKey).setOrigin(0, 0)
      .setDisplaySize(w, h);
    panel.add([catcher, bg, body, hint]);
  };

  createButton(scene, BTN_X, BTN_Y, BTN_SIZE, BTN_SIZE, '?', toggle, {
    fillColor: PALETTE.plum, fontSize: '26px',
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => panel?.destroy());
}
