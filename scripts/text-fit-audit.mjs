#!/usr/bin/env node
// Final Polish Addendum v2, Item 6 — "make garbled text impossible." Button.ts (the class-level
// fix) now wraps + auto-shrinks every button label at runtime, so a too-long label degrades to
// smaller/multi-line text instead of overflowing into whatever sits next to it (the reported bug:
// Berlin's location-picker buttons overlapping each other's text). This script is the CI gate
// that keeps a future content edit from writing a label so long it blows past even that fix's
// floor (12px) — i.e. a label that would render illegibly tiny or still overflow its button.
//
// No real canvas/DOM is available in a plain Node CI step, so this simulates Button.ts's actual
// wrap+shrink algorithm (mirrored below, not reimplemented independently) using a calibrated
// average-glyph-width heuristic for Baloo 2 Bold (the 'button' text style) — conservative (wider
// than the font typically renders) so it errs toward catching real regressions, not missing them.
// Run: node scripts/text-fit-audit.mjs (exits 1 and lists every overrun on failure).

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CITIES_DIR = path.join(__dirname, '..', 'content', 'cities');

// Calibrated against Baloo 2 Bold's actual measured advance widths (a rounded, fairly wide
// display font) — deliberately generous (wider than real) so the estimate over-predicts overflow
// risk rather than under-predicting it.
const AVG_CHAR_WIDTH_EM = 0.62;
const LINE_HEIGHT_MULT = 1.25;
const MIN_FONT_SIZE = 12;
const PAD_X = 20, PAD_Y = 10; // must match Button.ts's own padX/padY

function estimateWrappedLines(text, fontSizePx, wrapWidthPx) {
  const charsPerLine = Math.max(1, Math.floor(wrapWidthPx / (fontSizePx * AVG_CHAR_WIDTH_EM)));
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  let lines = 1, lineLen = 0;
  for (const w of words) {
    const addLen = w.length + (lineLen > 0 ? 1 : 0);
    if (lineLen + addLen > charsPerLine && lineLen > 0) { lines++; lineLen = w.length; }
    else lineLen += addLen;
  }
  return lines;
}

/** Mirrors src/ui/Button.ts's wordWrap + auto-shrink loop exactly (wrap at w-2*padX, shrink
 *  fontSize by 1px steps while the estimated wrapped height still exceeds h-2*padY, down to a
 *  12px floor) — a label FAILS this audit only if it would still overflow even at that floor,
 *  meaning Button.ts's own runtime fallback can't save it either. */
function simulateButtonFit(label, w, h, initialFontSizePx) {
  const wrapWidth = Math.max(20, w - PAD_X * 2);
  const maxHeight = h - PAD_Y * 2;
  let fontSize = initialFontSizePx;
  let lines = estimateWrappedLines(label, fontSize, wrapWidth);
  let textHeight = lines * fontSize * LINE_HEIGHT_MULT;
  while (textHeight > maxHeight && fontSize > MIN_FONT_SIZE) {
    fontSize -= 1;
    lines = estimateWrappedLines(label, fontSize, wrapWidth);
    textHeight = lines * fontSize * LINE_HEIGHT_MULT;
  }
  return { fits: textHeight <= maxHeight, finalFontSize: fontSize, lines, estimatedHeight: Math.round(textHeight) };
}

const findings = [];
function check(city, screen, field, label, w, h, fontSize) {
  const result = simulateButtonFit(label, w, h, fontSize);
  findings.push({ city, screen, field, label, w, h, fontSize, ...result });
}

for (const file of readdirSync(CITIES_DIR).filter((f) => f.endsWith('.json'))) {
  const city = JSON.parse(readFileSync(path.join(CITIES_DIR, file), 'utf-8'));
  const cityId = city.id ?? file.replace('.json', '');

  // Location-picker buttons: src/ui/CityScene.ts's renderLocationButtons — 290x70, fontSize 16.
  for (const loc of city.locations ?? []) {
    check(cityId, 'location picker', `locations[${loc.id}].name`, loc.name, 290, 70, 16);
  }

  // Preshow choice buttons: src/ui/CityScene.ts's preshow rendering — 600x66, default 22px.
  for (const opt of city.preShowChoices ?? []) {
    check(cityId, 'preshow choice', `preShowChoices[${opt.id}].label`, opt.label, 600, 66, 22);
  }

  // Minigame "choice" type option buttons: src/ui/MiniGameScene.ts — 600x66, fontSize 19.
  for (const mg of city.minigames ?? []) {
    if (mg.type !== 'choice') continue;
    for (const q of mg.questions ?? []) {
      check(cityId, `minigame "${mg.id}"`, `questions[${q.id}].optionA`, q.optionA, 600, 66, 19);
      check(cityId, `minigame "${mg.id}"`, `questions[${q.id}].optionB`, q.optionB, 600, 66, 19);
    }
  }

  // Dialogue choice buttons: src/ui/DialogueBox.ts — PANEL_W=660, height 62 (<=3 choices) or 48
  // (4 choices), default 22px. Walks every node in the city's whole scene graph (arrival,
  // location, relationship-pool, afterShow, journal — RelationshipScenePoolEntry just points a
  // sceneId into this same graph, no separate structure to walk).
  for (const [nodeId, node] of Object.entries(city.scenes ?? {})) {
    const choices = node.choices ?? [];
    if (choices.length === 0) continue;
    const btnH = choices.length <= 3 ? 62 : 48;
    for (const choice of choices) {
      check(cityId, `dialogue node "${nodeId}"`, `choices[${choice.id}].label`, choice.label, 660, btnH, 22);
    }
  }
}

const failures = findings.filter((f) => !f.fits);

console.log(`Text-fit audit: ${findings.length} button-eligible strings checked across ${readdirSync(CITIES_DIR).filter((f) => f.endsWith('.json')).length} cities.`);
if (failures.length === 0) {
  console.log(`PASS — 0 overruns (every label fits within its container, even accounting for Button.ts's 12px shrink floor).`);
} else {
  console.log(`FAIL — ${failures.length} label(s) would still overflow their button even at the 12px shrink floor:\n`);
  for (const f of failures) {
    console.log(`  [${f.city}] ${f.screen} — ${f.field}`);
    console.log(`    "${f.label}"`);
    console.log(`    container ${f.w}x${f.h}px, starts at ${f.fontSize}px -> shrunk to ${f.finalFontSize}px, still ~${f.estimatedHeight}px tall (limit ${f.h - PAD_Y * 2}px)\n`);
  }
}

const md = [
  '# Text-Fit Audit — Tour Life v3',
  '',
  'Generated by `scripts/text-fit-audit.mjs` (Final Polish Addendum v2, Item 6). Simulates',
  '`src/ui/Button.ts`\'s wordWrap + auto-shrink logic against every content-authored string that',
  'lands in a size-constrained button, using a calibrated heuristic (no real canvas in a plain',
  'Node CI step) — conservative on purpose, so it flags real risk rather than missing it.',
  '',
  `**${findings.length} strings checked, ${failures.length} would overflow even at Button.ts's 12px floor.**`,
  '',
  '| City | Screen | Field | Label | Container | Fits |',
  '|---|---|---|---|---|---|',
  ...findings.map((f) => `| ${f.city} | ${f.screen} | ${f.field} | ${f.label.length > 40 ? f.label.slice(0, 37) + '...' : f.label} | ${f.w}x${f.h} @ ${f.fontSize}px | ${f.fits ? '✅' : '❌ ' + f.finalFontSize + 'px/' + f.lines + 'L/~' + f.estimatedHeight + 'px'} |`),
  '',
].join('\n');
writeFileSync(path.join(__dirname, '..', 'docs', 'text-fit-audit.md'), md, 'utf-8');
console.log(`\nWrote docs/text-fit-audit.md`);

process.exitCode = failures.length > 0 ? 1 : 0;
