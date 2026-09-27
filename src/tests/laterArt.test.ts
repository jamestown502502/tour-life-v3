// Background-loaded art (public/assets/img/later, indexed by manifest-later.json).
//
// Every scene that uses this art falls back to something else when it is missing, so a missing
// file never shows as an error — only as a return visit that looks exactly like the first one, or
// a minigame on a flat gradient. These checks make that a test failure instead.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import boot from '../../public/assets/manifest.json';
import later from '../../public/assets/manifest-later.json';
import lisbon from '../../content/cities/lisbon.json';
import tokyo from '../../content/cities/tokyo.json';
import mexico from '../../content/cities/mexico_city.json';
import berlin from '../../content/cities/berlin.json';
import type { CityDef } from '../../content/schema';

const CITIES = [lisbon, tokyo, mexico, berlin] as unknown as CityDef[];
const BOOT_KEYS = new Set((boot as { key: string }[]).map((e) => e.key));
const LATER = later as { key: string; file: string }[];
const LATER_KEYS = new Set(LATER.map((e) => e.key));

describe('background-loaded art', () => {
  it('every city has a return-visit city scene and stage', () => {
    for (const c of CITIES) {
      expect(LATER_KEYS.has(`bg_city_${c.id}_return`), `${c.id} city`).toBe(true);
      expect(LATER_KEYS.has(`bg_rhythm_${c.id}_return`), `${c.id} stage`).toBe(true);
    }
  });

  it('every minigame has painted backdrop art somewhere', () => {
    const missing = CITIES.flatMap((c) => c.minigames ?? []).map((m) => `bg_mini_${m.id}`)
      .filter((k) => !BOOT_KEYS.has(k) && !LATER_KEYS.has(k));
    expect(missing, missing.join(', ')).toEqual([]);
  });

  it('no key is in both manifests (boot would win and the later copy would be dead weight)', () => {
    const both = [...LATER_KEYS].filter((k) => BOOT_KEYS.has(k));
    expect(both).toEqual([]);
  });

  it('every indexed file exists on disk', () => {
    const root = path.join(__dirname, '..', '..', 'public', 'assets');
    const absent = LATER.filter((e) => !existsSync(path.join(root, e.file))).map((e) => e.file);
    expect(absent).toEqual([]);
  });
});

/** Width and height from a PNG or WebP header, without decoding the image. */
function imageSize(file: string): [number, number] {
  const b = readFileSync(file);
  if (b.toString('ascii', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (chunk === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  throw new Error(`unrecognised image header: ${file}`);
}

describe('GPU memory budget', () => {
  // Every loaded texture stays decoded at width*height*4 bytes for the whole session. At 1440x2560
  // the backgrounds alone came to ~760 MB and the iPhone profile crashed ("Target crashed").
  const dir = path.join(__dirname, '..', '..', 'public', 'assets', 'img');
  const files = [...readdirSync(dir).map((f) => path.join(dir, f)), ...readdirSync(path.join(dir, 'later')).map((f) => path.join(dir, 'later', f))]
    .filter((f) => /\.(png|webp)$/i.test(f) && !f.endsWith('.raw.png'));

  it('no image is larger than the 720x1280 canvas it is drawn into', () => {
    const over = files.map((f) => ({ f: path.basename(f), s: imageSize(f) })).filter(({ s }) => s[0] > 720 || s[1] > 1280);
    expect(over.map(({ f, s }) => `${f} ${s.join('x')}`)).toEqual([]);
  });

  it('all painted art together decodes to under 256 MB', () => {
    const bytes = files.reduce((sum, f) => { const [w, h] = imageSize(f); return sum + w * h * 4; }, 0);
    expect(bytes / 1048576).toBeLessThan(256);
  });
});
