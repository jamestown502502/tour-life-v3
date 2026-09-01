import Phaser from 'phaser';
import { PALETTE } from '../const';
import { audio } from '../core/audio';
import { textStyle } from './textStyles';

export interface ButtonOptions {
  fillColor?: number;
  fontSize?: string;
  disabled?: boolean;
}

export function createButton(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string,
  onClick: () => void, opts: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const fill = opts.disabled ? 0x8a8a8a : (opts.fillColor ?? PALETTE.teal);
  const bg = scene.add.rectangle(0, 0, w, h, fill, 0.95).setOrigin(0, 0);
  bg.setStrokeStyle(2, PALETTE.gold, opts.disabled ? 0.2 : 0.7);
  const text = scene.add.text(w / 2, h / 2, label, textStyle('button', { fontSize: opts.fontSize ?? '22px' })).setOrigin(0.5);
  container.add([bg, text]);
  if (!opts.disabled) {
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { bg.setFillStyle(PALETTE.gold, 0.95); audio.playSfx('menuHover'); });
    bg.on('pointerout', () => bg.setFillStyle(fill, 0.95));
    bg.on('pointerdown', () => { audio.playSfx('tap'); onClick(); });
  }
  return container;
}
