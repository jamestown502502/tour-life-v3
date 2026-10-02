// Google Play / IARC: a game rated for younger players may not show or mention alcohol, and a
// gambling machine played for money is "simulated gambling". Every alcohol reference and the
// pachinko beat were rewritten out on 2026-10-02 (beer garden -> courtyard café, toasts ->
// sing-along, "buy a round" -> dinner, pachinko -> taiko drum arcade). This guard reads every
// shipped text file so neither can come back unnoticed.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Lookarounds rather than \b: '_' is a word character, so \b missed ids like "tok_loc_pachinko".
const BANNED = /(?<![a-z])(beers?|wines?|wine glass|vodka|whisk(e)?y|tequila|mezcal|rum|gin and|cocktails?|booze|drunk|drinking|hangover|hungover|bartenders?|liquor|alcohol(ic)?|champagne|cerveza|brewer(y|ies)|tipsy|pints?|lager|sake|biergarten|beer garden|toasts?|buys? (the band|the house)? ?a round|a round of drinks|pachinko|casino|slot machines?|betting|bet on)(?![a-z])/i;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(json|ts)$/.test(name) && !name.endsWith('schema.ts') ? [p] : [];
  });
}

describe('content policy: no alcohol or gambling in shipped text', () => {
  const all = files(join(__dirname, '../../content'));
  it('scans the whole content folder', () => {
    expect(all.length).toBeGreaterThan(10);
  });
  for (const file of all) {
    it(file.split(/[\\/]content[\\/]/)[1], () => {
      const hits = readFileSync(file, 'utf8').split('\n')
        .map((line, i) => ({ line: i + 1, text: line }))
        .filter((l) => BANNED.test(l.text))
        .map((l) => `${l.line}: ${l.text.trim().slice(0, 140)}`);
      expect(hits).toEqual([]);
    });
  }
});
