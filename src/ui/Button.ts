import Phaser from 'phaser';
import { PALETTE, PALETTE_HEX, UI_RADIUS } from '../const';
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

// WCAG relative luminance / contrast (see scripts/contrast-audit.mjs for the same math applied
// project-wide — this is the smaller, runtime version, kept in sync by eye since it's ~15 lines).
function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function relLuminance(hex: number): number {
  const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
export function contrastRatio(hexA: number, hexB: number): number {
  const lA = relLuminance(hexA), lB = relLuminance(hexB);
  const lighter = Math.max(lA, lB), darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Every button used to hardcode cream label text regardless of fill color — fine on dark
 *  fills (teal/plum/night), illegible on light ones (sky ~1.8:1, gold ~1.9:1 — both well under
 *  WCAG's 3:1 floor for bold 20px+ text). Computed per fill instead of trusting each of the ~40
 *  call sites across src/ui/*.ts to have picked a working color — cream and plum are the two
 *  candidates (matching the rest of the text system's light/dark split), whichever contrasts
 *  more with the actual fill wins. */
export function labelColorForFill(fill: number): string {
  const creamRatio = contrastRatio(fill, PALETTE.cream);
  const plumRatio = contrastRatio(fill, PALETTE.plum);
  return creamRatio >= plumRatio ? PALETTE_HEX.cream : PALETTE_HEX.plum;
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
  const text = scene.add.text(w / 2, h / 2, label, textStyle('button', {
    fontSize: opts.fontSize ?? '22px',
    color: labelColorForFill(fill),
  })).setOrigin(0.5);

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
