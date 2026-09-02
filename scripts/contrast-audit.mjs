#!/usr/bin/env node
// WCAG 2.1 contrast audit for every text preset (src/ui/textStyles.ts) against every surface
// color it can realistically appear on (src/const.ts's PALETTE plus the handful of one-off
// button fills used directly in src/ui/*.ts, and an approximate "painted background" luminance
// band since those are photographic, not a flat color). Prints PASS/FAIL against WCAG AA
// (4.5:1 normal text, 3:1 for large text: >=24px, or >=18.66px bold) and writes the same tables
// to docs/contrast-audit.md. Run: node scripts/contrast-audit.mjs
//
// Two passes:
//   1. BEFORE — the default preset colors (src/ui/textStyles.ts) against every surface, which
//      is what exposed the systemic problem (a preset's ONE fixed color can't be right on every
//      surface it's used on).
//   2. AFTER — every concrete per-usage fix actually applied to the source during this pass,
//      re-derived here from the same source values (not hand-typed numbers) so this script stays
//      the living proof of the fix rather than a snapshot of it.

import { writeFileSync } from 'node:fs';

// ---- WCAG relative luminance / contrast ratio ----
function srgbToLinear(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function relLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrastRatio(hexA, hexB) {
  const lA = relLuminance(hexA), lB = relLuminance(hexB);
  const lighter = Math.max(lA, lB), darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}
// Alpha-composite hexB (foreground, e.g. a scrim) over hexA (background) at the given alpha,
// in the same (non-linear sRGB) space Phaser's Rectangle alpha blending actually happens in.
function composite(bgHex, fgHex, alpha) {
  const c = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16));
  const [br, bg, bb] = c(bgHex), [fr, fg, fb] = c(fgHex);
  const mix = (b, f) => Math.round(alpha * f + (1 - alpha) * b);
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(br, fr))}${toHex(mix(bg, fg))}${toHex(mix(bb, fb))}`;
}

// ---- surfaces (src/const.ts PALETTE_HEX + one-off button fills used directly in src/ui/*.ts) ----
const SURFACES = {
  cream: '#F5EBDD',
  sand: '#E8D5B7',
  terracotta: '#C4704F',
  teal: '#3E7C7B',
  plum: '#4A2C40',
  gold: '#D9A441',
  night: '#2B3A55',
  sky: '#8FB7C9',
  softRed: '#C94F4F',
  lavender_dusk: '#8A6FA3', // one-off button fill (Re-calibrate, minigame variance buttons)
  gray_disabled: '#8A8A8A', // one-off button fill (disabled/empty-slot buttons)
  forest_moss: '#6B8A5A', // one-off button fill (Alley jam / weather-flavored buttons)
  painted_light: '#D9C4A0', // approximate mid-tone of the warm gouache painted backgrounds
  //(Lisbon/Tokyo/Mexico/Berlin/Title/Hub) — photographic, not flat; this is a representative
  //sample, not exact, since a real painted image has both lighter and darker regions.
  corkboard_brown: '#8A6A4A', // Hub scene's code-drawn corkboard panel
};

// ---- text presets (src/ui/textStyles.ts) — color BEFORE this pass's fixes, for the audit ----
const PRESETS_BEFORE = {
  title: { hex: '#F5EBDD', sizePx: 56, bold: true },
  h1: { hex: '#D9A441', sizePx: 30, bold: true },
  h2: { hex: '#8FB7C9', sizePx: 22, bold: true },
  speaker: { hex: '#4A2C40', sizePx: 20, bold: true },
  dialogue: { hex: '#4A2C40', sizePx: 24, bold: true },
  body: { hex: '#F5EBDD', sizePx: 18, bold: false },
  button: { hex: '#F5EBDD', sizePx: 20, bold: true },
  stat: { hex: '#F5EBDD', sizePx: 15, bold: true },
  small: { hex: '#8FB7C9', sizePx: 14, bold: false },
};

function isLargeText(preset) {
  // WCAG large-text threshold: >=24px normal, or >=18.66px (~14pt) bold.
  return preset.bold ? preset.sizePx >= 18.66 : preset.sizePx >= 24;
}
function threshold(preset) {
  return isLargeText(preset) ? 3.0 : 4.5;
}

function auditTable(presets) {
  const rows = [];
  for (const [presetName, preset] of Object.entries(presets)) {
    for (const [surfaceName, surfaceHex] of Object.entries(SURFACES)) {
      const ratio = contrastRatio(preset.hex, surfaceHex);
      const need = threshold(preset);
      rows.push({ presetName, surfaceName, ratio, need, pass: ratio >= need });
    }
  }
  return rows;
}

function printAndSave(rows, title, mdLines) {
  console.log(`\n=== ${title} ===`);
  let failCount = 0;
  for (const r of rows) {
    const status = r.pass ? 'PASS' : 'FAIL';
    if (!r.pass) failCount++;
    console.log(`${status}  ${r.presetName.padEnd(9)} on ${r.surfaceName.padEnd(15)} ${r.ratio.toFixed(2)}:1 (need ${r.need}:1)`);
  }
  console.log(`${title}: ${rows.length - failCount}/${rows.length} pass, ${failCount} fail`);

  mdLines.push(`### ${title}`, '', '| Preset | Surface | Ratio | Needed | Result |', '|---|---|---|---|---|');
  for (const r of rows) {
    mdLines.push(`| ${r.presetName} | ${r.surfaceName} | ${r.ratio.toFixed(2)}:1 | ${r.need}:1 | ${r.pass ? '✅ PASS' : '❌ FAIL'} |`);
  }
  mdLines.push('', `**${rows.length - failCount}/${rows.length} pass.**`, '');
  return failCount;
}

// ---- AFTER: button label auto-contrast (src/ui/Button.ts's labelColorForFill) ----
// Every button fill actually used across src/ui/*.ts (grepped), auto-picking cream or plum —
// same algorithm as the real function, re-implemented here so this script has no import
// dependency on a .ts file.
const BUTTON_FILLS = {
  teal: '#3E7C7B', sky: '#8FB7C9', terracotta: '#C4704F', gold: '#D9A441',
  lavender_dusk: '#8A6FA3', gray_disabled: '#8A8A8A', forest_moss: '#6B8A5A', plum: '#4A2C40',
};
function labelColorForFill(fillHex) {
  const creamRatio = contrastRatio(fillHex, '#F5EBDD');
  const plumRatio = contrastRatio(fillHex, '#4A2C40');
  return creamRatio >= plumRatio ? '#F5EBDD' : '#4A2C40';
}
const BUTTON_PRESET = { sizePx: 20, bold: true }; // textStyles.ts 'button': 20px, fontStyle 700

function auditButtonFills(mdLines) {
  const rows = Object.entries(BUTTON_FILLS).map(([name, fillHex]) => {
    const label = labelColorForFill(fillHex);
    const ratio = contrastRatio(label, fillHex);
    return { name, fillHex, label, ratio, pass: ratio >= threshold(BUTTON_PRESET) };
  });
  console.log(`\n=== AFTER: Button.ts auto-contrast label, real fills ===`);
  let fails = 0;
  for (const r of rows) {
    if (!r.pass) fails++;
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  fill ${r.name.padEnd(14)} -> label ${r.label}  ${r.ratio.toFixed(2)}:1`);
  }
  mdLines.push(
    '### AFTER: Button.ts auto-contrast label, every real fill in the game', '',
    'Button.ts used to hardcode a cream label regardless of fill (see BEFORE table above — the',
    '`button` preset fails on cream/sand/gold/sky/gray_disabled/painted_light). It now computes',
    'the label from the fill itself (`labelColorForFill`): whichever of cream/plum contrasts more',
    'with that fill wins. Every fill actually used by a button in the game, re-checked:', '',
    '| Fill | Auto label | Ratio | Result |', '|---|---|---|---|',
  );
  for (const r of rows) {
    mdLines.push(`| ${r.name} (${r.fillHex}) | ${r.label} | ${r.ratio.toFixed(2)}:1 | ${r.pass ? '✅ PASS' : '❌ FAIL'} |`);
  }
  mdLines.push('', `**${rows.length - fails}/${rows.length} pass.**`, '');
  return fails;
}

// ---- AFTER: bandmate speaker/backlog text colors (src/ui/DialogueBox.ts's BANDMATE_HEX) ----
const BANDMATE_HEX_AFTER = { mira: '#7D4028', theo: '#275452', jun: '#6B4C18', rowan: '#2E5266' };
const SPEAKER_PRESET = { sizePx: 20, bold: true }; // 'speaker': 20px bold — the nameplate
const BACKLOG_PRESET = { sizePx: 16, bold: false }; // backlog panel override: 16px, 'small' base weight 400

function auditBandmateColors(mdLines) {
  const panelSurface = SURFACES.sand; // ensureDialoguePanel's fill, used by both the live panel and the backlog overlay
  const rows = Object.entries(BANDMATE_HEX_AFTER).map(([name, hex]) => {
    const speakerRatio = contrastRatio(hex, panelSurface);
    const backlogRatio = speakerRatio; // same color, same surface — only the size/weight threshold differs
    return {
      name, hex,
      speakerPass: speakerRatio >= threshold(SPEAKER_PRESET),
      backlogPass: backlogRatio >= threshold(BACKLOG_PRESET),
      ratio: speakerRatio,
    };
  });
  console.log(`\n=== AFTER: DialogueBox bandmate text colors, on sand panel ===`);
  let fails = 0;
  for (const r of rows) {
    const pass = r.speakerPass && r.backlogPass;
    if (!pass) fails++;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${r.name.padEnd(6)} ${r.hex}  ${r.ratio.toFixed(2)}:1  (speaker 3:1 floor: ${r.speakerPass}, backlog 4.5:1 floor: ${r.backlogPass})`);
  }
  mdLines.push(
    '### AFTER: DialogueBox bandmate speaker-name / backlog text colors, on the sand panel', '',
    'The speaker nameplate (bold 20px, 3:1 floor) and backlog panel (normal 16px, 4.5:1 floor)',
    'both used each bandmate\'s bright accent color as TEXT on the sand dialogue panel — the same',
    'colors that work fine as low-alpha decorative glows fail badly as text (gold 1.57:1, sky',
    '1.50:1, terracotta 2.53:1; only teal scraped by at 3.35:1). Darker same-hue variants keep',
    'each character\'s color identity while clearing 4.5:1 (so one set covers both contexts):', '',
    '| Bandmate | Color | Ratio on sand | Speaker (3:1) | Backlog (4.5:1) |', '|---|---|---|---|---|',
  );
  for (const r of rows) {
    mdLines.push(`| ${r.name} | ${r.hex} | ${r.ratio.toFixed(2)}:1 | ${r.speakerPass ? '✅' : '❌'} | ${r.backlogPass ? '✅' : '❌'} |`);
  }
  mdLines.push('', `**${rows.length - fails}/${rows.length} bandmates pass both contexts.**`, '');
  return fails;
}

// ---- AFTER: addTextScrim (src/ui/textStyles.ts) over painted art ----
function auditScrim(mdLines) {
  const composited = composite(SURFACES.painted_light, SURFACES.night, 0.72);
  const cases = [
    { text: 'cream, large/bold (title/h1/h2) — ADOPTED', hex: '#F5EBDD', preset: { sizePx: 56, bold: true }, adopted: true },
    { text: 'cream, normal (body/small) — ADOPTED', hex: '#F5EBDD', preset: { sizePx: 16, bold: false }, adopted: true },
    { text: 'gold — rejected in favor of cream', hex: '#D9A441', preset: { sizePx: 22, bold: true }, adopted: false },
    { text: 'sky — rejected in favor of cream', hex: '#8FB7C9', preset: { sizePx: 22, bold: true }, adopted: false },
  ];
  const rows = cases.map((c) => {
    const ratio = contrastRatio(c.hex, composited);
    return { ...c, ratio, pass: ratio >= threshold(c.preset) };
  });
  console.log(`\n=== AFTER: addTextScrim (night @ 0.72 over painted_light = ${composited}) ===`);
  let fails = 0;
  for (const r of rows) {
    if (!r.pass && r.adopted) fails++;
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.text.padEnd(42)} ${r.ratio.toFixed(2)}:1${r.adopted ? '' : '  (reference only, not used)'}`);
  }
  mdLines.push(
    '### AFTER: addTextScrim over painted backgrounds', '',
    'Title\'s logo/tagline/seed label, City\'s name banner + location-picker header + preshow',
    'choice descriptions, and MiniGame\'s title + in-round labels all sat directly on painted art',
    'with only the frame\'s edge vignette behind them. `addTextScrim` (src/ui/textStyles.ts) now',
    `draws night at 0.72 alpha behind each — composited over a representative painted tone that's`,
    `${SURFACES.painted_light}, this comes out to ${composited}. gold and sky (the presets' own`,
    'defaults for h1/h2) both measure just under the 3:1 large-text floor there, so every text',
    'placed on a scrim in this pass was standardized to cream instead of darkening the scrim',
    'further (which would read as a much heavier bar over the art than intended):', '',
    '| Text | Ratio on scrim | Result |', '|---|---|---|',
  );
  for (const r of rows) {
    mdLines.push(`| ${r.text} | ${r.ratio.toFixed(2)}:1 | ${r.pass ? '✅ PASS' : '❌ FAIL'} |`);
  }
  const adoptedCount = rows.filter((r) => r.adopted).length;
  mdLines.push('', `**${adoptedCount - fails}/${adoptedCount} adopted cases pass** (the 2 rejected rows are why cream was chosen, not a live failure). Real painted regions vary; this uses one representative mid-tone — see the live screenshots for the actual rendered check.`, '');
  return fails;
}

const md = [
  '# Contrast Audit — Tour Life v3',
  '',
  `Generated by \`scripts/contrast-audit.mjs\`. WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for`,
  'large text (>=24px normal weight, or >=18.66px / ~14pt bold).',
  '',
];

let totalFails = 0;
const beforeRows = auditTable(PRESETS_BEFORE);
totalFails += printAndSave(beforeRows, 'BEFORE this pass (default preset color vs. every surface it appears on)', md);
totalFails += auditButtonFills(md);
totalFails += auditBandmateColors(md);
totalFails += auditScrim(md);

writeFileSync(new URL('../docs/contrast-audit.md', import.meta.url), md.join('\n'), 'utf-8');
console.log(`\nWrote docs/contrast-audit.md`);
console.log(`\nGRAND TOTAL: ${totalFails} failing pairs across all tables (BEFORE table's failures are expected — that's the problem this pass fixed; AFTER tables should be 0).`);
