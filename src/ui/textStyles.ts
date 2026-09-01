// One text-style system. Every Phaser Text object in the game should go through textStyle()
// rather than writing its own fontFamily/fontSize inline — this is what makes the game read
// as designed rather than default-Phaser. Fonts are self-hosted woff2 (public/fonts/), loaded
// via the CSS Font Loading API in main.ts before the game boots (see boot() there) — Phaser
// text drawn before a font finishes loading silently falls back and never re-renders, so the
// load-then-boot ordering matters more than this file does.
import type Phaser from 'phaser';
import { PALETTE_HEX } from '../const';

export const DISPLAY_FONT = '"Baloo 2", Georgia, serif';
export const BODY_FONT = '"Nunito", Georgia, serif';

const softShadow = { offsetX: 0, offsetY: 2, color: '#2B3A5555', blur: 3, fill: true } as const;
const dialogueShadow = { offsetX: 0, offsetY: 1, color: '#00000022', blur: 0, fill: true } as const;

export const TEXT_STYLES = {
  // Big display title (Title screen logo, Scrapbook ending label).
  title: {
    fontFamily: DISPLAY_FONT, fontSize: '56px', color: PALETTE_HEX.cream, fontStyle: '800',
    shadow: softShadow,
  },
  // Section heading (screen titles: "Settings", city name banner, "The band").
  h1: {
    fontFamily: DISPLAY_FONT, fontSize: '30px', color: PALETTE_HEX.gold, fontStyle: '700',
    shadow: softShadow,
  },
  // Sub-heading (subtitle under a title, "Genre" / "Volumes" labels).
  h2: {
    fontFamily: DISPLAY_FONT, fontSize: '22px', color: PALETTE_HEX.sky, fontStyle: '700',
  },
  // Speaker nameplate above dialogue text.
  speaker: {
    fontFamily: DISPLAY_FONT, fontSize: '20px', color: PALETTE_HEX.plum, fontStyle: '700',
  },
  // Dialogue body text inside the panel — high contrast, slight shadow for readability.
  dialogue: {
    fontFamily: BODY_FONT, fontSize: '24px', color: PALETTE_HEX.plum, fontStyle: '600',
    shadow: dialogueShadow,
  },
  // General UI/body copy (descriptions, flavor text, location names).
  body: {
    fontFamily: BODY_FONT, fontSize: '18px', color: PALETTE_HEX.cream, fontStyle: '400',
  },
  // Button labels.
  button: {
    fontFamily: DISPLAY_FONT, fontSize: '20px', color: PALETTE_HEX.cream, fontStyle: '700',
  },
  // Stat bar labels/values, HUD numbers.
  stat: {
    fontFamily: BODY_FONT, fontSize: '15px', color: PALETTE_HEX.cream, fontStyle: '700',
  },
  // Small captions, hints, seed text, footnotes.
  small: {
    fontFamily: BODY_FONT, fontSize: '14px', color: PALETTE_HEX.sky, fontStyle: '400',
  },
} as const;

export type TextStyleName = keyof typeof TEXT_STYLES;

export function textStyle(
  name: TextStyleName,
  overrides?: Partial<Phaser.Types.GameObjects.Text.TextStyle>,
): Phaser.Types.GameObjects.Text.TextStyle {
  return { ...TEXT_STYLES[name], ...overrides } as Phaser.Types.GameObjects.Text.TextStyle;
}
