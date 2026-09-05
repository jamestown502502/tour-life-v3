#!/usr/bin/env node
// Regenerates public/assets/manifest.json from the files actually present in
// public/assets/img/ — every manifest key has always equaled its file's basename without
// extension (checked against every existing entry before writing this), so this is a safe,
// mechanical rebuild rather than a new convention. Written because Final Polish Addendum v2
// adds ~48 new real assets (40 crowd sprites, new minigame backdrops, rhythm stage backgrounds)
// across several passes — hand-editing manifest.json that many times invites a typo'd key that
// silently never loads. Run: node scripts/rebuild-manifest.mjs
import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG_DIR = path.join(__dirname, '..', 'public', 'assets', 'img');
const MANIFEST_PATH = path.join(__dirname, '..', 'public', 'assets', 'manifest.json');

const files = readdirSync(IMG_DIR)
  .filter((f) => /\.(png|webp|jpg|jpeg)$/i.test(f) && !f.endsWith('.raw.png'))
  .sort();

const entries = files.map((f) => ({ key: path.parse(f).name, file: `img/${f}` }));
writeFileSync(MANIFEST_PATH, JSON.stringify(entries, null, 2) + '\n', 'utf-8');
console.log(`Wrote ${entries.length} entries to public/assets/manifest.json`);
