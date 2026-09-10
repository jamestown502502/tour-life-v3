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

/** WCAG AA for normal-weight text is 4.5:1, and picking the better of two text colours cannot
 *  reach it on a mid-tone fill: measured against the palette, terracotta tops out at 3.35:1, teal
 *  at 4.07 and softRed at 3.78 no matter which label colour is used. Reported live as text being
 *  hard to read on certain screens — those three fills carry most of the game's buttons.
 *
 *  So the FILL moves, not just the label. Darkened by the smallest step that clears 4.5:1 against
 *  cream, which preserves the hue (teal needs 93%, softRed 90%, terracotta 79%) rather than
 *  swapping in different colours. Computed rather than hand-tuned, so a fill added later is held
 *  to the same floor automatically instead of quietly failing. */
export function legibleFill(fill: number): number {
  // Targets 5.0, not the 4.5 floor itself. A button is not a flat rectangle: its baked texture
  // carries a bevel highlight along the top edge, and the contrast sweep measures the WORST pixel
  // behind the label, which is that highlight. Aiming exactly at 4.5 on the flat colour left every
  // button landing at 4.2-4.4 once rendered. The half-point of headroom is what the bevel costs.
  const TARGET = 5.0;
  const best = Math.max(contrastRatio(fill, PALETTE.cream), contrastRatio(fill, PALETTE.plum));
  if (best >= TARGET) return fill;
  const r = (fill >> 16) & 255, g = (fill >> 8) & 255, b = fill & 255;
  for (let k = 0.99; k >= 0.3; k -= 0.01) {
    const dim = (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k);
    if (contrastRatio(dim, PALETTE.cream) >= TARGET) return dim;
  }
  return fill;
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
  const fill = legibleFill(opts.disabled ? 0x8a8a8a : (opts.fillColor ?? PALETTE.teal));
  const radius = opts.radius ?? UI_RADIUS.button;

  // Every call site used to hand this a single-line label with no wordWrap — fine for short
  // labels ("New Run"), silently overflowing for long sentence-style ones (a location name like
  // "A converted power-plant venue mid-soundcheck" on a 290px button, or an Interview minigame
  // option on a 600px one) — the overflow bled into whatever sat next to it (confirmed live: a
  // 2-column location grid's overflowing labels visually garbled into the neighboring column).
  // wordWrap turns that into a normal multi-line label; the shrink loop below is the second half
  // — a wrapped label can still be TALLER than its button (e.g. a 3-line wrap in a 54px-tall
  // button), so font size steps down until it actually fits rather than clipping/overlapping
  // the button above or below it. Text is measured and (if needed) grown into BEFORE the
  // background textures are baked, since a grown button needs its bg/shadow/glow/ring baked at
  // the new height, not the caller's original one — see the stuck-screen-hardening follow-up's
  // Item A note below.
  const padX = 20, padY = 10;
  const wrapWidth = Math.max(20, w - padX * 2);
  let fontSize = parseInt((opts.fontSize ?? '22px').replace('px', ''), 10) || 22;
  const minFontSize = 12;
  const text = scene.add.text(0, 0, label, textStyle('button', {
    fontSize: `${fontSize}px`,
    color: labelColorForFill(fill),
    align: 'center',
    wordWrap: { width: wrapWidth, useAdvancedWrap: true },
  })).setOrigin(0.5);
  // updateText() is called internally by both the constructor and setFontSize(), so text.height
  // already reflects a fresh measurement at every step below — forced here too as cheap
  // insurance against relying on that internal behavior implicitly. A live audit of every
  // current button label (stuck-screen-hardening follow-up, Item A) found no case where this
  // measurement disagreed with what actually rendered (checked at both desktop and 390x844
  // viewports, including the specific reported screen) — the buffer and grow-fallback below are
  // defense-in-depth for future content, not a fix for an observed live discrepancy.
  text.updateText();
  const measureBuffer = 4; // headroom against any font-metric rounding, not a correction for a measured gap
  while (text.height + measureBuffer > h - padY * 2 && fontSize > minFontSize) {
    fontSize -= 1;
    text.setFontSize(fontSize);
    text.updateText();
  }
  // If even the 12px floor is still taller than the requested button, GROW the button rather than
  // let the label clip — no label can ever render outside its own background this way.
  const finalH = Math.max(h, Math.ceil(text.height + measureBuffer + padY * 2));
  text.setPosition(w / 2, finalH / 2);

  const shapeKey = ensureRoundedRect(scene, w, finalH, radius);
  const btnKey = ensureButtonTexture(scene, w, finalH, fill, !!opts.disabled, radius);

  const shadow = scene.add.image(4, 8, shapeKey).setOrigin(0, 0).setTint(PALETTE.plum).setAlpha(0.18);
  const hoverGlow = scene.add.image(w / 2, finalH / 2, shapeKey).setOrigin(0.5)
    .setDisplaySize(w + 10, finalH + 10).setTint(PALETTE.gold).setAlpha(0);
  const bg = scene.add.image(0, 0, btnKey).setOrigin(0, 0);
  const selectedRing = scene.add.image(w / 2, finalH / 2, shapeKey).setOrigin(0.5)
    .setDisplaySize(w + 6, finalH + 6).setTint(PALETTE.gold).setAlpha(0.9).setVisible(false);

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
    bg.setInteractive(new Phaser.Geom.Rectangle(-padX, -padY, w + padX * 2, finalH + padY * 2), Phaser.Geom.Rectangle.Contains);
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
