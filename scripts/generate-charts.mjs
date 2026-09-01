#!/usr/bin/env node
// Regenerates every song chart in content/songs/ from src/game/chartGen.ts. Node 24 strips
// TypeScript types natively, so the .ts module is imported directly (explicit extension
// required by the type-stripping loader).
//
// Usage: node scripts/generate-charts.mjs
//
// src/tests/chartGen.test.ts asserts the committed JSON matches this output — if you change
// the generator or a song config, run this and commit the regenerated files together.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SONG_CONFIGS, buildSong } from '../src/game/chartGen.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

for (const config of SONG_CONFIGS) {
  const song = buildSong(config);
  const file = join(root, 'content', 'songs', `${song.id}.json`);
  writeFileSync(file, JSON.stringify(song, null, 2) + '\n');
  const summary = song.arrangements.map((a) => {
    const last = a.notes[a.notes.length - 1];
    const end = (last.t + (last.dur ?? 0)).toFixed(1);
    return `${a.id}: ${a.notes.length} notes, ${a.notes.filter((n) => n.type === 'hold').length} holds, ${a.cues.length} cues, ${end}s`;
  });
  console.log(`${song.id}\n  ${summary.join('\n  ')}`);
}
