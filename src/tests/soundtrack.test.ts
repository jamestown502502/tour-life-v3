// Every show should have real music behind it.
//
// Part B generated four tracks and attached them to each city's SECOND song. The four originals --
// the ones a first visit is most likely to open with -- were never given any and fell back to the
// procedural oscillator bed, so half of every playthrough's shows had no recorded music and two
// cities running could sound like the same synth pad at different pitches.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const songs = readdirSync('content/songs')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`content/songs/${f}`, 'utf8')));

describe('soundtrack coverage', () => {
  it('every song has a real backing track, not just a chord progression', () => {
    const silent = songs.filter((s) => !s.audioFile).map((s) => s.id);
    expect(silent, `songs with no recorded audio: ${silent.join(', ')}`).toEqual([]);
  });

  it('every referenced audio file actually exists on disk', () => {
    for (const song of songs) {
      expect(() => statSync(`public/audio/${song.audioFile}`), `${song.id} -> ${song.audioFile}`).not.toThrow();
    }
  });

  it('no two songs share a backing track', () => {
    const files = songs.map((s) => s.audioFile);
    expect(new Set(files).size, `duplicate tracks in ${files.join(', ')}`).toBe(files.length);
  });

  // 192kbps stereo for nine tracks is over 12MB of background download on a phone. These are
  // ambient backing beds played under gameplay, not a listening record.
  it('keeps the whole soundtrack under 8MB so a phone can afford it', () => {
    const bytes = songs.reduce((n, s) => n + statSync(`public/audio/${s.audioFile}`).size, 0)
      + statSync('public/audio/title_theme.mp3').size;
    expect(bytes / 1048576).toBeLessThan(8);
  });
});
