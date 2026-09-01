import { describe, expect, it } from 'vitest';
import { SONG_CONFIGS, buildSong } from '../game/chartGen';
import { validateSong } from '../../content/schema';
import sailorJson from '../../content/songs/sailor_lullaby.json';
import neonJson from '../../content/songs/neon_rain.json';
import callejonJson from '../../content/songs/callejon_groove.json';

const COMMITTED: Record<string, unknown> = {
  sailor_lullaby: sailorJson, neon_rain: neonJson, callejon_groove: callejonJson,
};

describe('chart generator', () => {
  it('is deterministic — two builds of the same config are identical', () => {
    for (const config of SONG_CONFIGS) {
      expect(buildSong(config)).toEqual(buildSong(config));
    }
  });

  it('every generated song passes content validation', () => {
    for (const config of SONG_CONFIGS) {
      const result = validateSong(buildSong(config));
      expect(result.errors).toEqual([]);
    }
  });

  it('every arrangement lands in the 55-70s window and has at least one rest gap >= 0.5s', () => {
    for (const config of SONG_CONFIGS) {
      const beatSec = 60 / config.bpm;
      for (const arr of buildSong(config).arrangements) {
        const last = arr.notes[arr.notes.length - 1];
        const end = last.t + (last.dur ?? 0);
        expect(end, `${config.id}/${arr.id} end`).toBeGreaterThanOrEqual(55);
        expect(end, `${config.id}/${arr.id} end`).toBeLessThanOrEqual(70);
        let maxGap = 0;
        for (let i = 1; i < arr.notes.length; i++) maxGap = Math.max(maxGap, arr.notes[i].t - arr.notes[i - 1].t);
        expect(maxGap, `${config.id}/${arr.id} rest`).toBeGreaterThanOrEqual(Math.max(0.5, beatSec));
      }
    }
  });

  it('never stacks two notes in one lane, and no hold runs into the next note in its lane', () => {
    for (const config of SONG_CONFIGS) {
      for (const arr of buildSong(config).arrangements) {
        for (let i = 0; i < arr.notes.length; i++) {
          const n = arr.notes[i];
          expect(n.l).toBeGreaterThanOrEqual(0);
          expect(n.l).toBeLessThan(config.lanes);
          const next = arr.notes.slice(i + 1).find((p) => p.l === n.l);
          if (!next) continue;
          expect(next.t - n.t, `${config.id}/${arr.id} lane ${n.l} @${n.t}`).toBeGreaterThanOrEqual(0.12);
          if (n.type === 'hold') expect(n.t + (n.dur ?? 0)).toBeLessThan(next.t);
        }
      }
    }
  });

  it('the committed song JSON matches the generator (drift guard — rerun scripts/generate-charts.mjs)', () => {
    for (const config of SONG_CONFIGS) {
      expect(COMMITTED[config.id], config.id).toEqual(buildSong(config));
    }
  });

  it('arrangement ids referenced by city content still exist', () => {
    const ids = new Set(SONG_CONFIGS.flatMap((c) => c.arrangements.map((a) => `${c.id}:${a.id}`)));
    for (const ref of [
      'sailor_lullaby:acoustic', 'sailor_lullaby:full_band', 'sailor_lullaby:duet',
      'neon_rain:tight', 'neon_rain:loose', 'neon_rain:bass_forward',
      'callejon_groove:rehearsed', 'callejon_groove:call_and_response', 'callejon_groove:duet_percussion',
    ]) expect(ids.has(ref), ref).toBe(true);
  });
});
