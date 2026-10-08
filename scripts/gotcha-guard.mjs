#!/usr/bin/env node
// Gotcha guard: bugs this studio has ACTUALLY shipped, turned into checks that run on every PR.
//
// Each rule names the incident it comes from. A memory note only helps if someone remembers to
// read it; this runs whether anyone remembers or not (2026-10-08 dev/test/deploy review).
//
// Exempt one line on purpose with a trailing comment:  // gotcha-ok: <why this is safe>
// Run: node scripts/gotcha-guard.mjs        (exit 1 = a known bug pattern is back)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'tests' ? [] : walk(p);
    return /\.(ts|js|mjs)$/.test(name) ? [p] : [];
  });
}

/** Source with comments blanked out (line numbers preserved), so prose about a bug never trips it. */
function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');
}

/** Body of the first `name(` method in a class file, by brace matching. */
function methodBody(src, name) {
  const m = new RegExp(`\\n\\s+(?:async\\s+)?${name}\\s*\\([^)]*\\)[^{]*\\{`).exec(src);
  if (!m) return '';
  let depth = 1, i = m.index + m[0].length;
  const start = i;
  while (i < src.length && depth > 0) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
  return src.slice(start, i);
}

const files = walk(SRC).map((p) => {
  const raw = readFileSync(p, 'utf8');
  return { path: relative(ROOT, p).replace(/\\/g, '/'), raw, lines: raw.split('\n'), src: code(raw) };
});
const problems = [];
const report = (f, idx, rule, why) => {
  if (idx >= 0 && /gotcha-ok:/.test(f.lines[idx] ?? '')) return;
  problems.push(`${f.path}${idx >= 0 ? `:${idx + 1}` : ''}  [${rule}]  ${why}`);
};
const eachLine = (f, re, fn) => f.src.split('\n').forEach((l, i) => { if (re.test(l)) fn(i, l); });

for (const f of files) {
  // 1. Sky gradients baked fully transparent (TL, 2026-09-01; memory gotchas_phaser_code_drawn #1).
  eachLine(f, /\.fillGradientStyle\s*\(/, (i) => report(f, i, 'no-fill-gradient-style',
    'fillGradientStyle bakes as fully transparent through generateTexture; use banded solid fills (src/art/sprites.ts)'));

  // 2. Hit-stop restored on the clock it slowed: minigames stuck at 5% speed (TL #11, 2026-10-05).
  f.src.split('\n').forEach((l, i, all) => {
    if (/\.delayedCall\s*\(/.test(l) && all.slice(i, i + 4).some((x) => /timeScale\s*=(?!=)/.test(x))) {
      report(f, i, 'timescale-restore-real-timer',
        'restoring timeScale from scene.time.delayedCall runs on the slowed clock and nests badly; restore from a remembered base on window.setTimeout (src/art/effects.ts hitstop)');
    }
  });

  // 3. Meters that grew downward (TL Fix the Mix, 2026-10-07; memory gotcha_phaser_rectangle_resize).
  eachLine(f, /\.height\s*=(?!=)/, (i, l) => {
    if (/\.style\.height|canvas\.height|\bcanvas\w*\.height|\bel\.height/.test(l)) return;
    report(f, i, 'rect-resize-setsize', 'assigning .height on a Phaser shape does not re-anchor it; use setSize(w, h) + setPosition');
  });

  // 4. A test hook leaking into production: window.__* must be gated on DEV / the e2e build mode.
  eachLine(f, /\(window as any\)\.__\w+\s*=(?!=)|window\.__\w+\s*=(?!=)/, (i, l) => {
    if (/import\.meta\.env\.(DEV|MODE)/.test(l)) return;
    report(f, i, 'test-hook-gated', 'window.__* test hooks must sit behind import.meta.env.DEV || MODE === "e2e"');
  });

  // 5. iOS puts the AudioContext in "interrupted", not "suspended" (QA round 3, 2026-10-06).
  eachLine(f, /state\s*===?\s*['"]suspended['"]/, (i) => report(f, i, 'audio-resume-any-state',
    "check state !== 'running' so iOS's 'interrupted' state is resumed too"));
}

// 6. Overlays drawn UNDER the scene that opened them (TL QA round 3 #2; memory gotcha-phaser-overlay-scene-order).
const sceneFile = (key) => files.find((f) => new RegExp(`super\\(\\s*(\\{\\s*key:\\s*)?['"]${key}['"]`).test(f.src));
const launched = new Set(files.flatMap((f) => [...f.src.matchAll(/scene\.launch\(\s*['"](\w+)['"]/g)].map((m) => m[1])));
for (const key of launched) {
  const f = sceneFile(key);
  if (f && !/\.(moveAbove|bringToTop)\s*\(/.test(f.src)) {
    report(f, -1, 'overlay-draw-order', `scene '${key}' is launched as an overlay but never moves itself above its opener (scene.moveAbove / bringToTop)`);
  }
}

// 7. Reused scene instances keep last visit's collections: crash on the second visit (memory gotchas_phaser_code_drawn #3).
for (const f of files.filter((x) => /extends Phaser\.Scene/.test(x.src))) {
  const reset = methodBody(f.src, 'init') + methodBody(f.src, 'create');
  const fieldRe = /^\s*(?:private|protected|public)?\s*(?:readonly\s+)?(\w+)\s*(?::[^=;\n]+)?=\s*(?:\[\]|new (?:Map|Set)\b)/gm;
  for (const m of f.src.matchAll(fieldRe)) {
    const name = m[1];
    const isReset = new RegExp(`this\\.${name}\\s*=(?!=)|this\\.${name}\\.clear\\(\\)|this\\.${name}\\.length\\s*=\\s*0`).test(reset);
    if (!isReset) {
      const line = f.src.slice(0, m.index).split('\n').length - 1 + (m[0].startsWith('\n') ? 1 : 0);
      report(f, line, 'scene-collection-reset', `'${name}' is created once per game, not per visit; reset it in init() or create()`);
    }
  }
}

// 8. Phaser's loader stalls silently past 32 queued files (TL boot hang, 2026-09-05; memory gotcha-phaser-max-parallel-downloads).
for (const f of files.filter((x) => /\.load\.(image|audio|spritesheet|json|start)\s*\(/.test(x.src))) {
  if (!/maxParallelDownloads\s*=/.test(f.src)) {
    report(f, -1, 'loader-parallel-limit', 'this file queues loader files but never raises maxParallelDownloads (default 32 stalls silently)');
  }
}

// 9. A second finger silently ignored (rhythm chords; memory gotchas_phaser_code_drawn #4).
for (const f of files.filter((x) => /new Phaser\.Game\s*\(/.test(x.src))) {
  if (!/activePointers\s*:/.test(f.src)) {
    report(f, -1, 'multi-touch', 'Phaser tracks one touch unless input.activePointers is set in the game config');
  }
}

// 10. Every spec must use the shared fixture, or it silently skips the JavaScript-error check.
for (const p of walk(join(ROOT, 'e2e')).filter((x) => x.endsWith('.spec.ts'))) {
  const raw = readFileSync(p, 'utf8');
  const f = { path: relative(ROOT, p).replace(/\\/g, '/'), lines: raw.split('\n'), src: code(raw) };
  eachLine(f, /from\s+['"]@playwright\/test['"]/, (i) => report(f, i, 'use-error-fixture',
    "import { test, expect } from './fixtures' so the test fails on JavaScript errors"));
}

// 11. Retries turn a flaky test into a silent pass (2026-10-08 review).
for (const name of ['playwright.config.ts', 'playwright.gate.config.ts']) {
  const raw = readFileSync(join(ROOT, name), 'utf8');
  const f = { path: name, lines: raw.split('\n'), src: code(raw) };
  eachLine(f, /retries\s*:\s*[^0\s]/, (i) => report(f, i, 'no-retries', 'retries must be 0; fix or test.fixme a flaky test'));
}

if (problems.length) {
  console.error(`gotcha-guard: ${problems.length} known bug pattern(s) found\n\n${problems.join('\n')}\n`);
  console.error('Fix the pattern, or mark a deliberate exception on that line with:  // gotcha-ok: <why>');
  process.exit(1);
}
console.log(`gotcha-guard: ${files.length} files clean (11 rules)`);
