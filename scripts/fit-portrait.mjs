#!/usr/bin/env node
// Trim the transparent margin off a keyed portrait and re-fit it to the game's portrait canvas.
//
// Why: Gemini composes a head-and-shoulders portrait with a lot of empty space around it. After
// chroma-keying, the subject occupied only ~12% of the 280x280 canvas on the first real
// generation — displayed at DialogueBox's 0.5 scale inside a ~143px circular frame, that reads
// as a tiny figure floating in a big ring. Rather than change the display scale (which would
// then be wrong for the code-drawn fallback portraits, which DO fill their canvas), normalize
// the asset so both kinds of portrait have the same subject-to-canvas ratio and the scene code
// stays identical for both.
//
// Finds the alpha bounding box, crops to it, then scales to fill TARGET while preserving aspect
// and pads back out to a square with transparency.
//
// Usage: node scripts/fit-portrait.mjs <file.png> [targetSize=280] [fillRatio=0.94]

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const file = process.argv[2];
const target = Number(process.argv[3] ?? 280);
const fill = Number(process.argv[4] ?? 0.94);
if (!file) { console.error('usage: fit-portrait.mjs <file.png> [target] [fillRatio]'); process.exit(1); }

const dims = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).stdout.toString().trim().split(',').map(Number);
const [w, h] = dims;

const alpha = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'alphaextract',
  '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1024 * 1024 * 64 }).stdout;

// Bounding box of the actual subject. Two thresholds, both load-bearing:
//   - alpha > 16 per pixel, so anti-aliasing dust left by the key isn't treated as content.
//   - at least MIN_RUN opaque pixels in a row/column for that line to count at all. Without
//     this, a single stray artifact the generator painted near an edge (a pale bar, a speck of
//     un-keyed background) drags the box out to nearly the full canvas, the subject then gets
//     scaled to fit that inflated box, and the portrait renders far smaller than its siblings.
//     That is exactly what happened to all four text-to-image base portraits on the first run,
//     while the image-to-image derived ones — which had no such artifacts — came out correct.
const MIN_RUN = 3;
const rowCount = new Array(h).fill(0);
const colCount = new Array(w).fill(0);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (alpha[y * w + x] > 16) { rowCount[y]++; colCount[x]++; }
  }
}
let minX = w, minY = h, maxX = -1, maxY = -1;
for (let y = 0; y < h; y++) if (rowCount[y] >= MIN_RUN) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
for (let x = 0; x < w; x++) if (colCount[x] >= MIN_RUN) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
if (maxX < 0 || maxY < 0) { console.error(`${file}: fully transparent, nothing to fit`); process.exit(1); }

const cw = maxX - minX + 1;
const ch = maxY - minY + 1;
const inner = Math.round(target * fill);
const tmp = file.replace(/\.png$/, '.fit.png');

// Despill: clamp green to at most the larger of red/blue. Keying against a pure-green screen
// leaves a green rim on soft painted edges (clearly visible on hair and shoulders), and this is
// the standard cheap fix. Safe for this cast — nothing they wear is actually green; the closest
// is Theo's teal, where green already sits within a hair's breadth of blue, so it's untouched.
const despill = "geq=r='r(X,Y)':g='min(g(X,Y),max(r(X,Y),b(X,Y)))':b='b(X,Y)':a='alpha(X,Y)'";

const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-vf',
  `crop=${cw}:${ch}:${minX}:${minY},${despill},scale=${inner}:${inner}:force_original_aspect_ratio=decrease,` +
  `pad=${target}:${target}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`,
  tmp], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);

fs.renameSync(tmp, file);
const pct = ((cw * ch) / (w * h) * 100).toFixed(1);
console.log(`${file}: subject was ${cw}x${ch} (${pct}% of canvas) -> refit to ${target}x${target}`);
