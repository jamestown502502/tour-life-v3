// Regression coverage for the UX/QA fix pass's contrast work (Workstream 1). Deliberately
// doesn't import src/ui/Button.ts or DialogueBox.ts — both pull in Phaser at module scope, which
// needs a DOM this project's vitest config (node environment, no jsdom) doesn't provide. Instead
// this locally re-implements the same ~15-line WCAG math those files already carry their own
// copy of (see Button.ts's own "kept in sync by eye" comment for that established pattern) and
// checks it against the real PALETTE values plus literal copies of the fixed hex constants —
// so a change to PALETTE that breaks a real button fill's contrast is still caught here even
// though the button/dialogue color-selection logic itself isn't directly exercised.
import { describe, expect, it } from 'vitest';
import { PALETTE, PALETTE_HEX } from '../const';

function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function relLuminanceNum(hex: number): number {
  const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function relLuminanceHex(hex: string): number {
  return relLuminanceNum(parseInt(hex.slice(1), 16));
}
function contrastRatio(lA: number, lB: number): number {
  const lighter = Math.max(lA, lB), darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}
// Mirrors src/ui/Button.ts's labelColorForFill.
function labelColorForFill(fill: number): string {
  const creamRatio = contrastRatio(relLuminanceNum(fill), relLuminanceNum(PALETTE.cream));
  const plumRatio = contrastRatio(relLuminanceNum(fill), relLuminanceNum(PALETTE.plum));
  return creamRatio >= plumRatio ? PALETTE_HEX.cream : PALETTE_HEX.plum;
}
const LARGE_BOLD = 3.0; // >=18.66px bold, or >=24px normal — the button/speaker-name case
const NORMAL = 4.5;

describe('contrast audit regressions (Workstream 1, see scripts/contrast-audit.mjs for the full sweep)', () => {
  it('labelColorForFill picks a passing label for every real button fill in the game', () => {
    // One-off fills used directly via createButton's fillColor across src/ui/*.ts — grepped
    // during the audit. If a fill is ever added that this doesn't cover, this test still proves
    // the ALGORITHM (auto-pick from cream/plum) rather than any specific fill list.
    const fills: Record<string, number> = {
      teal: PALETTE.teal, sky: PALETTE.sky, terracotta: PALETTE.terracotta, gold: PALETTE.gold,
      plum: PALETTE.plum, gray_disabled: 0x8a8a8a, lavender_dusk: 0x8a6fa3, forest_moss: 0x6b8a5a,
    };
    for (const [name, fill] of Object.entries(fills)) {
      const label = labelColorForFill(fill);
      const ratio = contrastRatio(relLuminanceHex(label), relLuminanceNum(fill));
      expect(ratio, `${name} (fill ${fill.toString(16)}) -> label ${label}`).toBeGreaterThanOrEqual(LARGE_BOLD);
    }
  });

  it('the button preset\'s old hardcoded cream fails on the fills labelColorForFill now corrects — proves the fix was needed, not cosmetic', () => {
    const creamL = relLuminanceNum(PALETTE.cream);
    const brokenOnCream = [PALETTE.gold, PALETTE.sky, 0x8a8a8a]; // gold/sky/gray_disabled — real fills
    for (const fill of brokenOnCream) {
      expect(contrastRatio(creamL, relLuminanceNum(fill))).toBeLessThan(LARGE_BOLD);
    }
  });

  it('DialogueBox\'s bandmate text colors pass on the sand dialogue/backlog panel at both the speaker-name (3:1) and backlog (4.5:1) thresholds', () => {
    // Literal copy of src/ui/DialogueBox.ts's BANDMATE_HEX — see that file's own comment for why
    // these replaced the raw accent colors (gold 1.57:1, sky 1.50:1, terracotta 2.53:1 on sand).
    const BANDMATE_HEX = { mira: '#7D4028', theo: '#275452', jun: '#6B4C18', rowan: '#2E5266' };
    const sandL = relLuminanceNum(PALETTE.sand);
    for (const [name, hex] of Object.entries(BANDMATE_HEX)) {
      const ratio = contrastRatio(relLuminanceHex(hex), sandL);
      expect(ratio, `${name} ${hex} on sand`).toBeGreaterThanOrEqual(NORMAL);
    }
  });

  it('the original bright bandmate accents (pre-fix) actually fail on sand — proves the fix was needed', () => {
    const sandL = relLuminanceNum(PALETTE.sand);
    const original = { mira: PALETTE.terracotta, jun: PALETTE.gold, rowan: PALETTE.sky };
    for (const fill of Object.values(original)) {
      expect(contrastRatio(relLuminanceNum(fill), sandL)).toBeLessThan(LARGE_BOLD);
    }
  });

  it('addTextScrim\'s night-at-0.72-alpha treatment makes cream pass over a representative painted background, where bare cream would fail', () => {
    const paintedLight = 0xd9c4a0; // representative mid-tone of the painted city/title art
    const night = PALETTE.night;
    const alpha = 0.72;
    const compositeChannel = (bg: number, fg: number, shift: number) =>
      Math.round(alpha * ((fg >> shift) & 0xff) + (1 - alpha) * ((bg >> shift) & 0xff));
    const composited = (compositeChannel(paintedLight, night, 16) << 16)
      | (compositeChannel(paintedLight, night, 8) << 8)
      | compositeChannel(paintedLight, night, 0);

    const bareRatio = contrastRatio(relLuminanceNum(PALETTE.cream), relLuminanceNum(paintedLight));
    expect(bareRatio).toBeLessThan(LARGE_BOLD); // the problem the scrim exists to fix

    const scrimmedRatio = contrastRatio(relLuminanceNum(PALETTE.cream), relLuminanceNum(composited));
    expect(scrimmedRatio).toBeGreaterThanOrEqual(NORMAL); // clears even the stricter normal-text floor
  });
});
