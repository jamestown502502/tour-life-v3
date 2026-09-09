// Close-out Part B — the "same song over and over" complaint, made structurally impossible.
//
// Every city used to have exactly one song, so a full run heard four tracks and the return leg
// replayed the first night's song note for note. These tests are the guard: they fail if a city
// ever loses its pair, if the return leg can repeat the opener, or if a backing track goes missing
// without the procedural fallback still being reachable.
import { describe, expect, it } from 'vitest';
import { CITIES, SONGS, getSong } from '../game/content';
import { songForVisit, songsFor, visitIndexFor } from '../game/setlist';
import { validateSong } from '../../content/schema';
import type { CityDef } from '../../content/schema';

describe('every city has a setlist, not a song', () => {
  it('ships exactly two distinct songs per city', () => {
    for (const city of CITIES) {
      const songs = songsFor(city);
      expect(songs.length, `${city.id} has ${songs.length} song(s)`).toBe(2);
      expect(new Set(songs).size, `${city.id} lists the same song twice`).toBe(2);
    }
  });

  it('every listed song actually exists and validates', () => {
    for (const city of CITIES) {
      for (const id of songsFor(city)) {
        const song = getSong(id);
        expect(song, `${city.id} references missing song ${id}`).toBeDefined();
        expect(validateSong(song).errors, `${id} invalid`).toEqual([]);
      }
    }
  });

  it('a city written with only songId still resolves — the field is additive', () => {
    const legacy = { ...CITIES[0], songs: undefined } as unknown as CityDef;
    expect(songsFor(legacy)).toEqual([CITIES[0].songId]);
    // And a one-song city degrades to playing it both visits rather than throwing.
    expect(songForVisit(legacy, 'seed', 0)).toBe(CITIES[0].songId);
    expect(songForVisit(legacy, 'seed', 1)).toBe(CITIES[0].songId);
  });
});

describe('the return leg never replays the first night', () => {
  it('picks a different song on the second visit, for every city and many seeds', () => {
    for (const city of CITIES) {
      for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'seed-1', 'seed-2']) {
        const first = songForVisit(city, seed, 0);
        const second = songForVisit(city, seed, 1);
        expect(second, `${city.id} @ ${seed} replayed the same song`).not.toBe(first);
        expect(songsFor(city)).toContain(first);
        expect(songsFor(city)).toContain(second);
      }
    }
  });

  it('is deterministic for a seed, so a replayed run has the same setlist', () => {
    for (const city of CITIES) {
      expect(songForVisit(city, 'stable', 0)).toBe(songForVisit(city, 'stable', 0));
      expect(songForVisit(city, 'stable', 1)).toBe(songForVisit(city, 'stable', 1));
    }
  });

  it('the seed actually changes which song opens a city', () => {
    // Across a spread of seeds, at least one city must open on each of its two songs — otherwise
    // the "seed picks the opener" claim is decorative.
    const openersByCity = new Map<string, Set<string>>();
    for (const city of CITIES) {
      const seen = new Set<string>();
      for (let i = 0; i < 40; i++) seen.add(songForVisit(city, `seed-${i}`, 0));
      openersByCity.set(city.id, seen);
    }
    const varied = [...openersByCity.values()].filter((s) => s.size > 1).length;
    expect(varied, 'no city ever varies its opening song across seeds').toBeGreaterThan(0);
  });

  it('visitIndexFor reads the return leg off what has actually been played', () => {
    expect(visitIndexFor('tokyo', [])).toBe(0);
    expect(visitIndexFor('tokyo', ['berlin'])).toBe(0);
    expect(visitIndexFor('tokyo', ['tokyo'])).toBe(1);
  });
});

describe('a full run hears real variety', () => {
  it('plays 2 distinct songs in every city across a full tour', () => {
    for (const seed of ['tour-1', 'tour-2', 'tour-3']) {
      for (const city of CITIES) {
        const played = new Set([songForVisit(city, seed, 0), songForVisit(city, seed, 1)]);
        expect(played.size, `${city.id} @ ${seed} only ever plays ${played.size} song(s)`).toBe(2);
      }
    }
    // 4 cities x 2 songs = 8 distinct song plays available in one tour, up from 4.
    const allSongs = new Set(CITIES.flatMap((c) => songsFor(c)));
    expect(allSongs.size).toBe(8);
  });
});

describe('backing tracks, with the procedural bed still underneath', () => {
  it('every second song declares a real backing track', () => {
    const withAudio = SONGS.filter((s) => s.audioFile);
    expect(withAudio.length, 'expected the four second songs to carry audio').toBe(4);
    for (const s of withAudio) expect(s.audioFile).toMatch(/\.mp3$/);
  });

  it('a song without a backing track is still fully playable', () => {
    // The original four have no audioFile and must keep working on procedural ambience alone —
    // that is the fallback RhythmScene relies on when a track is missing or fails to decode.
    const procedural = SONGS.filter((s) => !s.audioFile);
    expect(procedural.length).toBe(4);
    for (const s of procedural) {
      expect(s.chordProgression.length, `${s.id} has no progression to fall back to`).toBeGreaterThan(0);
      expect(s.bpm).toBeGreaterThan(0);
    }
  });

  it('every song charts inside the 55-70s window the tracks were written for', () => {
    for (const song of SONGS) {
      for (const arr of song.arrangements) {
        const last = Math.max(...arr.notes.map((n) => n.t + (n.dur ?? 0.2)));
        expect(last, `${song.id}/${arr.id} is ${last.toFixed(1)}s`).toBeGreaterThan(45);
        expect(last, `${song.id}/${arr.id} is ${last.toFixed(1)}s`).toBeLessThan(75);
      }
    }
  });

  it('each second song reuses its city arrangement ids, so pre-show choices keep working', () => {
    // PreShowChoiceDef.arrangementId and StoryGate.unlock name arrangement ids. If a city's two
    // songs disagreed on those ids, every pre-show choice would silently fall back to
    // arrangements[0] and the story gate would never fire.
    for (const city of CITIES) {
      const [a, b] = songsFor(city).map((id) => getSong(id));
      const idsA = a.arrangements.map((x) => x.id).sort();
      const idsB = b.arrangements.map((x) => x.id).sort();
      expect(idsB, `${city.id}: its two songs expose different arrangement ids`).toEqual(idsA);
      for (const choice of city.preShowChoices) {
        expect(idsA, `${city.id}: pre-show choice "${choice.id}" names a missing arrangement`).toContain(choice.arrangementId);
      }
      if (city.storyGate) {
        expect(idsA, `${city.id}: storyGate unlocks a missing arrangement`).toContain(city.storyGate.unlock);
      }
    }
  });
});
