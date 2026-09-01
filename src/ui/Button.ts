import Phaser from 'phaser';
import { PALETTE, UI_RADIUS } from '../const';
import { audio, type SfxName } from '../core/audio';
import { textStyle } from './textStyles';
import { ensureButtonTexture, ensureRoundedRect } from '../art/sprites';

export interface ButtonOptions {
  fillColor?: number;
  fontSize?: string;
  disabled?: boolean;
  radius?: number;
  /** SFX played on press. Defaults to 'tap' — pass 'choiceConfirm' for dialogue choices, etc. */
  tapSfx?: SfxName;
}

/** Toggle a persistent gold selection ring on a button created by createButton — used by
 *  screens with a mutually-exclusive picker (genre, "why this tour") that used to reach into
 *  the button's raw shape; that shape is now a baked texture, so this is the supported way. */
export function setButtonSelected(container: Phaser.GameObjects.Container, selected: boolean): void {
  const ring = container.getData('selectedRing') as Phaser.GameObjects.Image | undefined;
  ring?.setVisible(selected);
}

/** The label Text object, for callers that need to update it after creation (e.g. a Settings
 *  toggle's On/Off text) — the button's internal child order isn't part of the public API. */
export function getButtonText(container: Phaser.GameObjects.Container): Phaser.GameObjects.Text | undefined {
  return container.getData('labelText') as Phaser.GameObjects.Text | undefined;
}

export function createButton(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string,
  onClick: () => void, opts: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const fill = opts.disabled ? 0x8a8a8a : (opts.fillColor ?? PALETTE.teal);
  const radius = opts.radius ?? UI_RADIUS.button;
  const shapeKey = ensureRoundedRect(scene, w, h, radius);
  const btnKey = ensureButtonTexture(scene, w, h, fill, !!opts.disabled, radius);

  const shadow = scene.add.image(4, 8, shapeKey).setOrigin(0, 0).setTint(PALETTE.plum).setAlpha(0.18);
  const hoverGlow = scene.add.image(w / 2, h / 2, shapeKey).setOrigin(0.5)
    .setDisplaySize(w + 10, h + 10).setTint(PALETTE.gold).setAlpha(0);
  const bg = scene.add.image(0, 0, btnKey).setOrigin(0, 0);
  const selectedRing = scene.add.image(w / 2, h / 2, shapeKey).setOrigin(0.5)
    .setDisplaySize(w + 6, h + 6).setTint(PALETTE.gold).setAlpha(0.9).setVisible(false);
  const text = scene.add.text(w / 2, h / 2, label, textStyle('button', { fontSize: opts.fontSize ?? '22px' })).setOrigin(0.5);

  container.add([shadow, hoverGlow, bg, selectedRing, text]);
  container.setData('selectedRing', selectedRing);
  container.setData('labelText', text);

  if (!opts.disabled) {
    // Pad the TAPPABLE area beyond the drawn button — mobile-viewport measurement (390px wide,
    // the Scale.FIT canvas renders at ~0.54x) showed most buttons draw at only ~27-33 CSS px
    // tall, well under the ~44px touch-target guideline. A blanket pad large enough to fully
    // guarantee 44px everywhere would overlap neighbors in the tightest layouts (e.g. the
    // Settings volume +/- pair, 10px apart) — this is a conservative, collision-safe pad
    // (checked against every current layout's tightest spacing) that meaningfully improves
    // comfort without risking a hit-area overlap. Closing that last gap on the smallest phones
    // needs a real spacing pass across the affected screens, not just a bigger pad here.
    const padX = 8, padY = 8;
    bg.setInteractive(new Phaser.Geom.Rectangle(-padX, -padY, w + padX * 2, h + padY * 2), Phaser.Geom.Rectangle.Contains);
    bg.input!.cursor = 'pointer';
    bg.on('pointerover', () => {
      scene.tweens.add({ targets: hoverGlow, alpha: 0.25, duration: 120 });
      audio.playSfx('menuHover');
    });
    bg.on('pointerout', () => {
      scene.tweens.add({ targets: hoverGlow, alpha: 0, duration: 120 });
      container.setScale(1);
    });
    bg.on('pointerdown', () => {
      audio.playSfx(opts.tapSfx ?? 'tap');
      container.setScale(0.96);
      onClick();
    });
    bg.on('pointerup', () => container.setScale(1));
  }

  // Entrance pop — a light random stagger so a screen's buttons don't all snap in at once.
  container.setScale(0.9).setAlpha(0);
  scene.tweens.add({
    targets: container, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut',
    delay: Phaser.Math.Between(0, 140),
  });

  return container;
}
