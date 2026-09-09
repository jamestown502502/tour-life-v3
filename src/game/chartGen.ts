// Deterministic rhythm-chart generator. Pure — no Phaser, no randomness — so it's unit-tested
// and the committed song JSON can be asserted to match it exactly (drift guard).
//
// Design rule (Exceed7 notecharting): readability over density. Charts are built from named
// BAR PATTERNS on a kick/snare grid rather than a flat "note every N beats" pulse — kicks on
// the left-hand lanes, snares on the right-hand lanes (two-thumb play on a phone), offbeats as
// holds, and real REST bars every section so the player can breathe and re-read the chart.
// Each song's storyGate-unlocked "hero" arrangement uses hand-designed patterns unique to it.
//
// Regenerate the JSON with: node scripts/generate-charts.mjs

import type { ChartCue, ChartNote, ChoiceCueType, SongArrangement, SongDef } from '../../content/schema';

type HitKind = 'kick' | 'snare' | 'off' | 'chord';
interface Hit { beat: number; kind: HitKind; }
/** One 4/4 bar: hits at beat offsets 0..4 (fractions allowed). An empty array is a rest bar. */
type BarPattern = Hit[];

export interface SectionConfig { pattern: string; bars: number; }
export interface CueConfig { bar: number; type: ChoiceCueType; }
export interface ArrangementConfig {
  id: string;
  label: string;
  description: string;
  noteDensity: number;
  sections: SectionConfig[];
  cues: CueConfig[];
}
export interface SongConfig {
  id: string;
  name: string;
  bpm: number;
  lanes: number;
  chordProgression: string;
  waveform: SongDef['waveform'];
  arrangements: ArrangementConfig[];
  /** Song-specific hand-designed patterns, merged over the shared library. */
  patterns?: Record<string, BarPattern>;
  /** Optional real backing track under public/audio/. Procedural ambience remains the fallback. */
  audioFile?: string;
}

const k = (beat: number): Hit => ({ beat, kind: 'kick' });
const s = (beat: number): Hit => ({ beat, kind: 'snare' });
const o = (beat: number): Hit => ({ beat, kind: 'off' });
const c = (beat: number): Hit => ({ beat, kind: 'chord' });

/** Shared pattern library. Names are what SectionConfig.pattern refers to. */
export const PATTERNS: Record<string, BarPattern> = {
  rest: [],
  sparse: [k(0)],
  intro: [k(0), k(2)],
  verse: [k(0), s(1), k(2), s(3)],
  verse_off: [k(0), s(1), k(2), o(2.5), s(3)],
  chorus: [k(0), s(1), k(1.5), k(2), s(3), o(3.5)],
  chorus_nohold: [k(0), s(1), k(1.5), k(2), s(3), s(3.5)],
  chorus_chord: [c(0), s(1), k(2), o(2.5), s(3)],
  fill: [k(0), s(1), k(2), s(3), s(3.5)],
  eighths: [k(0), s(0.5), k(1), s(1.5), k(2), s(2.5), k(3), s(3.5)],
  swing: [k(0), s(1), k(2), s(3.5)],
  break_hold: [o(0)],
};

const KICK_LANES = [0, 1];
const SNARE_LANES = [3, 2];
const OFF_LANES = [1, 2, 0, 3];
const CHORD_PAIRS: [number, number][] = [[0, 3], [1, 2]];
const HOLD_CAP_SEC = 1.5;
const MIN_SAME_LANE_GAP_SEC = 0.12;

function round3(n: number): number { return Math.round(n * 1000) / 1000; }

interface RawNote { t: number; l: number; type: ChartNote['type']; }

function buildArrangement(song: SongConfig, arr: ArrangementConfig, patterns: Record<string, BarPattern>): SongArrangement {
  const beatSec = 60 / song.bpm;
  const barSec = beatSec * 4;
  const raw: RawNote[] = [];
  let kickI = 0, snareI = 0, offI = 0, chordI = 0;
  let bar = 0;

  for (const section of arr.sections) {
    const pattern = patterns[section.pattern];
    if (!pattern) throw new Error(`[chartGen] ${song.id}/${arr.id}: unknown pattern "${section.pattern}"`);
    for (let b = 0; b < section.bars; b++, bar++) {
      const barStart = bar * barSec;
      for (const hit of pattern) {
        const t = round3(barStart + hit.beat * beatSec);
        if (hit.kind === 'kick') raw.push({ t, l: KICK_LANES[kickI++ % KICK_LANES.length], type: 'tap' });
        else if (hit.kind === 'snare') raw.push({ t, l: SNARE_LANES[snareI++ % SNARE_LANES.length], type: 'tap' });
        else if (hit.kind === 'off') raw.push({ t, l: OFF_LANES[offI++ % OFF_LANES.length], type: 'hold' });
        else {
          const [a, bLane] = CHORD_PAIRS[chordI++ % CHORD_PAIRS.length];
          raw.push({ t, l: a, type: 'tap' }, { t, l: bLane, type: 'tap' });
        }
      }
    }
  }
  const totalBars = bar;

  // Same-lane collision guard: a hit that lands within MIN_SAME_LANE_GAP of another in its
  // lane moves to the nearest free lane, or is dropped — never two notes stacked in one lane.
  raw.sort((x, y) => x.t - y.t || x.l - y.l);
  const placed: RawNote[] = [];
  for (const n of raw) {
    const laneFree = (lane: number) => !placed.some((p) => p.l === lane && Math.abs(p.t - n.t) < MIN_SAME_LANE_GAP_SEC);
    let lane = n.l;
    if (!laneFree(lane)) {
      const alt = [0, 1, 2, 3].find((l) => l < song.lanes && laneFree(l));
      if (alt === undefined) continue;
      lane = alt;
    }
    placed.push({ ...n, l: lane });
  }

  // Holds: sustain 75% of the gap to the next note in the same lane (capped), so a rail can
  // never run into the note after it.
  const notes: ChartNote[] = placed.map((n, i) => {
    if (n.type !== 'hold') return { t: n.t, l: n.l, type: 'tap' };
    const next = placed.slice(i + 1).find((p) => p.l === n.l);
    const gap = next ? next.t - n.t : beatSec;
    const dur = round3(Math.min(HOLD_CAP_SEC, Math.max(0.2, gap * 0.75)));
    return { t: n.t, l: n.l, type: 'hold', dur };
  });

  const cues: ChartCue[] = arr.cues.map((cue) => {
    if (cue.bar >= totalBars) throw new Error(`[chartGen] ${song.id}/${arr.id}: cue bar ${cue.bar} past end (${totalBars} bars)`);
    return { t: round3(cue.bar * barSec), type: cue.type };
  });

  return { id: arr.id, label: arr.label, description: arr.description, noteDensity: arr.noteDensity, notes, cues };
}

export function buildSong(config: SongConfig): SongDef {
  const patterns = { ...PATTERNS, ...(config.patterns ?? {}) };
  return {
    id: config.id,
    name: config.name,
    bpm: config.bpm,
    lanes: config.lanes,
    chordProgression: config.chordProgression,
    waveform: config.waveform,
    // Only present on songs that have a real backing track; omitted entirely otherwise so the
    // generated JSON for the original four songs is unchanged.
    ...(config.audioFile ? { audioFile: config.audioFile } : {}),
    arrangements: config.arrangements.map((arr) => buildArrangement(config, arr, patterns)),
  };
}

// ---------------------------------------------------------------------------------------------
// The three shipped songs. Section bar counts are chosen so every arrangement lands in the
// 55-70s window at its bpm (24 bars @ 92, 28 @ 118, 27 @ 104). Arrangement ids/labels/
// descriptions are load-bearing — city JSON preShowChoices and storyGates reference the ids.
// ---------------------------------------------------------------------------------------------

export const SAILOR_LULLABY: SongConfig = {
  id: 'sailor_lullaby', name: 'Sailor Lullaby', bpm: 92, lanes: 4, chordProgression: 'Am7-Fmaj7-Cmaj7-G6', waveform: 'triangle', audioFile: 'lisbon_first.mp3',
  patterns: {
    // Hero (duet): a sung phrase ("call") answered by the second voice ("response").
    call: [k(0), s(2)],
    response: [o(1), s(3), k(3.5)],
    duet_finale: [c(0), s(2), o(3)],
  },
  arrangements: [
    {
      id: 'acoustic', label: 'Acoustic', description: 'Stripped back, just voice and guitar.', noteDensity: 1,
      sections: [
        { pattern: 'intro', bars: 4 }, { pattern: 'verse', bars: 8 }, { pattern: 'rest', bars: 1 },
        { pattern: 'verse_off', bars: 7 }, { pattern: 'sparse', bars: 4 },
      ],
      cues: [{ bar: 8, type: 'pull_back' }, { bar: 16, type: 'invite_crowd' }],
    },
    {
      id: 'full_band', label: 'Full Band', description: 'Everyone in, warm and loud.', noteDensity: 1.8,
      sections: [
        { pattern: 'intro', bars: 2 }, { pattern: 'verse', bars: 6 }, { pattern: 'chorus', bars: 6 },
        { pattern: 'rest', bars: 1 }, { pattern: 'fill', bars: 1 }, { pattern: 'chorus_chord', bars: 6 },
        { pattern: 'verse', bars: 2 },
      ],
      cues: [{ bar: 8, type: 'build' }, { bar: 14, type: 'invite_crowd' }, { bar: 20, type: 'spotlight_bandmate' }],
    },
    {
      id: 'duet', label: 'Duet with Inês', description: 'Call and response between two voices.', noteDensity: 1.3,
      sections: [
        { pattern: 'intro', bars: 2 },
        { pattern: 'call', bars: 2 }, { pattern: 'response', bars: 2 },
        { pattern: 'call', bars: 2 }, { pattern: 'response', bars: 2 },
        { pattern: 'call', bars: 2 }, { pattern: 'response', bars: 2 },
        { pattern: 'call', bars: 2 }, { pattern: 'response', bars: 2 },
        { pattern: 'rest', bars: 1 }, { pattern: 'duet_finale', bars: 3 }, { pattern: 'call', bars: 2 },
      ],
      cues: [{ bar: 6, type: 'pull_back' }, { bar: 14, type: 'invite_crowd' }],
    },
  ],
};

export const NEON_RAIN: SongConfig = {
  id: 'neon_rain', name: 'Neon Rain', bpm: 118, lanes: 4, chordProgression: 'Am-F-C-G', waveform: 'square', audioFile: 'tokyo_first.mp3',
  patterns: {
    // Hero (bass_forward): Rowan's bassline — long sustained roots, then a walking line.
    bassline: [o(0), k(2), s(3)],
    bass_walk: [o(0), o(1), o(2), o(3)],
  },
  arrangements: [
    {
      id: 'tight', label: 'Tight & Precise', description: 'Locked to the grid, no give.', noteDensity: 2,
      sections: [
        { pattern: 'intro', bars: 2 }, { pattern: 'verse', bars: 8 }, { pattern: 'eighths', bars: 4 },
        { pattern: 'rest', bars: 1 }, { pattern: 'fill', bars: 1 }, { pattern: 'chorus_nohold', bars: 8 },
        { pattern: 'verse', bars: 4 },
      ],
      cues: [{ bar: 8, type: 'build' }, { bar: 16, type: 'improvise' }, { bar: 24, type: 'invite_crowd' }],
    },
    {
      id: 'loose', label: 'Loose & Improvised', description: 'Swung, breathing, unpredictable.', noteDensity: 1,
      sections: [
        { pattern: 'intro', bars: 4 }, { pattern: 'swing', bars: 8 }, { pattern: 'rest', bars: 1 },
        { pattern: 'sparse', bars: 4 }, { pattern: 'swing', bars: 7 }, { pattern: 'sparse', bars: 5 },
      ],
      cues: [{ bar: 10, type: 'improvise' }, { bar: 20, type: 'pull_back' }],
    },
    {
      id: 'bass_forward', label: 'Bass Forward', description: 'Rowan carries the whole song.', noteDensity: 1.2,
      sections: [
        { pattern: 'intro', bars: 2 }, { pattern: 'bassline', bars: 8 }, { pattern: 'rest', bars: 1 },
        { pattern: 'bass_walk', bars: 4 }, { pattern: 'chorus', bars: 8 }, { pattern: 'bassline', bars: 4 },
        { pattern: 'sparse', bars: 2 },
      ],
      cues: [{ bar: 8, type: 'spotlight_bandmate' }, { bar: 20, type: 'invite_crowd' }],
    },
  ],
};

export const CALLEJON_GROOVE: SongConfig = {
  id: 'callejon_groove', name: 'Callejón Groove', bpm: 104, lanes: 4, chordProgression: 'Am-Dm-E7-Am', waveform: 'triangle', audioFile: 'mexico_first.mp3',
  patterns: {
    // 3-2 son-clave feel, and the hero (duet_percussion) trading chords with Ximena's hands.
    clave: [k(0), s(1.5), k(2), s(3), o(3.5)],
    call: [k(0), s(2)],
    chord_trade: [c(0), k(1), s(2), c(3)],
  },
  arrangements: [
    {
      id: 'rehearsed', label: 'Rehearsed & Tight', description: 'Every cue exactly where it should be.', noteDensity: 1,
      sections: [
        { pattern: 'intro', bars: 4 }, { pattern: 'verse', bars: 8 }, { pattern: 'rest', bars: 1 },
        { pattern: 'verse_off', bars: 8 }, { pattern: 'verse', bars: 4 }, { pattern: 'sparse', bars: 2 },
      ],
      cues: [{ bar: 9, type: 'build' }, { bar: 18, type: 'pull_back' }],
    },
    {
      id: 'call_and_response', label: 'Call and Response', description: 'The room answers back.', noteDensity: 1.6,
      sections: [
        { pattern: 'intro', bars: 2 },
        { pattern: 'call', bars: 2 }, { pattern: 'clave', bars: 2 },
        { pattern: 'call', bars: 2 }, { pattern: 'clave', bars: 2 },
        { pattern: 'call', bars: 2 }, { pattern: 'clave', bars: 2 },
        { pattern: 'call', bars: 2 }, { pattern: 'clave', bars: 2 },
        { pattern: 'call', bars: 2 }, { pattern: 'clave', bars: 2 },
        { pattern: 'rest', bars: 1 }, { pattern: 'chorus_chord', bars: 4 },
      ],
      cues: [{ bar: 9, type: 'invite_crowd' }, { bar: 18, type: 'build' }],
    },
    {
      id: 'duet_percussion', label: 'Duet with Ximena', description: 'Trading rhythms, no rehearsal.', noteDensity: 2.2,
      sections: [
        { pattern: 'intro', bars: 1 }, { pattern: 'eighths', bars: 4 }, { pattern: 'clave', bars: 4 },
        { pattern: 'chord_trade', bars: 4 }, { pattern: 'rest', bars: 1 }, { pattern: 'fill', bars: 2 },
        { pattern: 'eighths', bars: 4 }, { pattern: 'clave', bars: 4 }, { pattern: 'chord_trade', bars: 2 },
        { pattern: 'sparse', bars: 1 },
      ],
      cues: [{ bar: 8, type: 'build' }, { bar: 16, type: 'spotlight_bandmate' }, { bar: 22, type: 'invite_crowd' }],
    },
  ],
};

export const KREUZBERG_STATIC: SongConfig = {
  id: 'kreuzberg_static', name: 'Kreuzberg Static', bpm: 126, lanes: 4, chordProgression: 'Dm-Bb-F-C', waveform: 'square', audioFile: 'berlin_first.mp3',
  patterns: {
    // Driving four-on-the-floor pulse. Hero (modular_trade): the "machine" answers with an
    // erratic, syncopated pattern that never quite repeats — Lene's rig, not the band.
    pulse: [k(0), k(1), k(2), k(3)],
    pulse_off: [k(0), o(0.5), k(1), o(1.5), k(2), o(2.5), k(3), o(3.5)],
    machine_call: [c(0), s(1.5)],
    machine_answer: [o(0), k(0.75), s(1.25), o(2), k(2.75), s(3.25)],
  },
  arrangements: [
    {
      id: 'loose_wire', label: 'Loose Wire', description: "No click track — the room sets the tempo.", noteDensity: 1,
      sections: [
        { pattern: 'intro', bars: 4 }, { pattern: 'swing', bars: 8 }, { pattern: 'rest', bars: 1 },
        { pattern: 'sparse', bars: 6 }, { pattern: 'swing', bars: 8 }, { pattern: 'sparse', bars: 6 },
      ],
      cues: [{ bar: 8, type: 'improvise' }, { bar: 20, type: 'pull_back' }],
    },
    {
      id: 'overdrive', label: 'Overdrive', description: 'The PA pushed to the edge, loud enough to feel it.', noteDensity: 2,
      sections: [
        { pattern: 'intro', bars: 2 }, { pattern: 'pulse', bars: 8 }, { pattern: 'eighths', bars: 4 },
        { pattern: 'rest', bars: 1 }, { pattern: 'fill', bars: 1 }, { pattern: 'chorus_nohold', bars: 8 },
        { pattern: 'pulse', bars: 8 },
      ],
      cues: [{ bar: 8, type: 'build' }, { bar: 16, type: 'invite_crowd' }, { bar: 26, type: 'improvise' }],
    },
    {
      id: 'modular_trade', label: 'Trading Bars with Lene', description: "Four bars handed to a machine that's never the same twice.", noteDensity: 1.8,
      sections: [
        { pattern: 'intro', bars: 2 },
        { pattern: 'machine_call', bars: 2 }, { pattern: 'machine_answer', bars: 2 },
        { pattern: 'machine_call', bars: 2 }, { pattern: 'machine_answer', bars: 2 },
        { pattern: 'machine_call', bars: 2 }, { pattern: 'machine_answer', bars: 2 },
        { pattern: 'machine_call', bars: 2 }, { pattern: 'machine_answer', bars: 2 },
        { pattern: 'rest', bars: 1 }, { pattern: 'pulse_off', bars: 10 }, { pattern: 'machine_call', bars: 2 },
      ],
      cues: [{ bar: 6, type: 'spotlight_bandmate' }, { bar: 18, type: 'build' }],
    },
  ],
};


// ---------------------------------------------------------------------------------------------
// SECOND SONGS (pre-public close-out, Part B).
//
// Every city had exactly one song, so a full run heard four tracks and the return leg replayed the
// first night's song note for note. Each city now has a pair, and src/game/setlist.ts guarantees
// the return leg plays the OTHER one.
//
// Each second song deliberately REUSES its city's arrangement IDs. PreShowChoiceDef.arrangementId
// and StoryGate.unlock name those IDs, so a different set would make every pre-show choice a no-op
// (pickArrangement would fall back to arrangements[0]) and the story gate would never fire. Same
// three choices, same gate, different music.
//
// Bar counts target ~60s so the chart lands in the same 55-70s window as the first songs and
// matches the generated backing track: bars = 60 / (4 * 60 / bpm).
// ---------------------------------------------------------------------------------------------

/** Lisbon's other side: the first song is a slow acoustic lullaby, this is the room after
 *  midnight — faster, fuller, still nylon-stringed. 108bpm, 27 bars ~= 60s. */
export const TEJO_AFTER_MIDNIGHT: SongConfig = {
  id: 'tejo_after_midnight', name: 'Tejo After Midnight', bpm: 108, lanes: 4,
  chordProgression: 'Em-C-G-D', waveform: 'triangle', audioFile: 'lisbon_second.mp3',
  arrangements: [
    {
      id: 'acoustic', label: 'Acoustic', description: 'Just the guitar and whoever is still awake.', noteDensity: 1,
      sections: [
        { pattern: 'intro', bars: 3 }, { pattern: 'verse', bars: 8 }, { pattern: 'rest', bars: 1 },
        { pattern: 'verse_off', bars: 8 }, { pattern: 'sparse', bars: 7 },
      ],
      cues: [{ bar: 8, type: 'pull_back' }, { bar: 18, type: 'invite_crowd' }],
    },
    {
      id: 'full_band', label: 'Full Band', description: 'Everyone in, and louder than the hour deserves.', noteDensity: 1.8,
      sections: [
        { pattern: 'intro', bars: 2 }, { pattern: 'verse', bars: 6 }, { pattern: 'chorus', bars: 7 },
        { pattern: 'fill', bars: 1 }, { pattern: 'chorus_chord', bars: 7 }, { pattern: 'verse', bars: 4 },
      ],
      cues: [{ bar: 8, type: 'build' }, { bar: 15, type: 'invite_crowd' }, { bar: 22, type: 'spotlight_bandmate' }],
    },
    {
      id: 'duet', label: 'Duet', description: 'Two voices, trading the last verse.', noteDensity: 1.3,
      sections: [
        { pattern: 'intro', bars: 3 }, { pattern: 'verse', bars: 6 }, { pattern: 'chorus', bars: 6 },
        { pattern: 'rest', bars: 1 }, { pattern: 'verse_off', bars: 6 }, { pattern: 'chorus', bars: 5 },
      ],
      cues: [{ bar: 7, type: 'pull_back' }, { bar: 16, type: 'invite_crowd' }],
    },
  ],
};

/** Tokyo's other side: the first song is 118bpm neon pop, this is the quiet after the room
 *  empties. 84bpm, 21 bars ~= 60s. */
export const LAST_TRAIN_HOME: SongConfig = {
  id: 'last_train_home', name: 'Last Train Home', bpm: 84, lanes: 4,
  chordProgression: 'Fmaj7-Cmaj7-Dm7-Bb', waveform: 'sine', audioFile: 'tokyo_second.mp3',
  arrangements: [
    {
      id: 'tight', label: 'Tight & Precise', description: 'Clean, deliberate, nothing wasted.', noteDensity: 1.4,
      sections: [
        { pattern: 'intro', bars: 2 }, { pattern: 'verse', bars: 6 }, { pattern: 'chorus', bars: 6 },
        { pattern: 'fill', bars: 1 }, { pattern: 'verse', bars: 6 },
      ],
      cues: [{ bar: 6, type: 'pull_back' }, { bar: 14, type: 'build' }],
    },
    {
      id: 'loose', label: 'Loose & Late', description: 'Let it breathe. Nobody is counting.', noteDensity: 1,
      sections: [
        { pattern: 'intro', bars: 3 }, { pattern: 'sparse', bars: 6 }, { pattern: 'verse_off', bars: 6 },
        { pattern: 'rest', bars: 1 }, { pattern: 'sparse', bars: 5 },
      ],
      cues: [{ bar: 8, type: 'pull_back' }, { bar: 16, type: 'improvise' }],
    },
    {
      id: 'bass_forward', label: 'Bass Forward', description: 'Rowan out front for once.', noteDensity: 1.2,
      sections: [
        { pattern: 'intro', bars: 2 }, { pattern: 'verse', bars: 7 }, { pattern: 'chorus_chord', bars: 6 },
        { pattern: 'verse_off', bars: 6 },
      ],
      cues: [{ bar: 9, type: 'spotlight_bandmate' }, { bar: 15, type: 'invite_crowd' }],
    },
  ],
};

/** Mexico City's other side: the first song is a 104bpm street groove, this one leans all the way
 *  into the rhythm. 122bpm, 30 bars ~= 59s. */
export const MERCADO_ELECTRICO: SongConfig = {
  id: 'mercado_electrico', name: 'Mercado Eléctrico', bpm: 122, lanes: 4,
  chordProgression: 'Am-Dm-E7-Am', waveform: 'square', audioFile: 'mexico_second.mp3',
  arrangements: [
    {
      id: 'rehearsed', label: 'Rehearsed & Tight', description: 'The version you practised. It shows.', noteDensity: 1.5,
      sections: [
        { pattern: 'intro', bars: 3 }, { pattern: 'verse', bars: 8 }, { pattern: 'chorus', bars: 8 },
        { pattern: 'fill', bars: 1 }, { pattern: 'chorus_chord', bars: 6 }, { pattern: 'verse', bars: 4 },
      ],
      cues: [{ bar: 9, type: 'build' }, { bar: 19, type: 'invite_crowd' }],
    },
    {
      id: 'call_and_response', label: 'Call & Response', description: 'Let the market answer back.', noteDensity: 1.3,
      sections: [
        { pattern: 'intro', bars: 2 }, { pattern: 'verse', bars: 7 }, { pattern: 'verse_off', bars: 7 },
        { pattern: 'rest', bars: 1 }, { pattern: 'chorus', bars: 7 }, { pattern: 'sparse', bars: 6 },
      ],
      cues: [{ bar: 8, type: 'invite_crowd' }, { bar: 20, type: 'improvise' }],
    },
    {
      id: 'duet_percussion', label: 'Duet Percussion', description: 'Two players, one groove, no map.', noteDensity: 1.9,
      sections: [
        { pattern: 'intro', bars: 2 }, { pattern: 'chorus', bars: 9 }, { pattern: 'fill', bars: 1 },
        { pattern: 'chorus_chord', bars: 9 }, { pattern: 'verse', bars: 9 },
      ],
      cues: [{ bar: 10, type: 'build' }, { bar: 22, type: 'spotlight_bandmate' }],
    },
  ],
};

/** Berlin's other side: the first song is 126bpm cold static, this is colder and slower.
 *  96bpm, 24 bars ~= 60s. */
export const HALLENBAD: SongConfig = {
  id: 'hallenbad', name: 'Hallenbad', bpm: 96, lanes: 4,
  chordProgression: 'Cm-Ab-Eb-Bb', waveform: 'square', audioFile: 'berlin_second.mp3',
  arrangements: [
    {
      id: 'loose_wire', label: 'Loose Wire', description: 'Something in the rig is not quite right. Keep going.', noteDensity: 1,
      sections: [
        { pattern: 'intro', bars: 3 }, { pattern: 'sparse', bars: 7 }, { pattern: 'verse', bars: 7 },
        { pattern: 'rest', bars: 1 }, { pattern: 'verse_off', bars: 6 },
      ],
      cues: [{ bar: 8, type: 'pull_back' }, { bar: 17, type: 'improvise' }],
    },
    {
      id: 'overdrive', label: 'Overdrive', description: 'Push it until the room gives in.', noteDensity: 1.8,
      sections: [
        { pattern: 'intro', bars: 2 }, { pattern: 'chorus', bars: 8 }, { pattern: 'fill', bars: 1 },
        { pattern: 'chorus_chord', bars: 8 }, { pattern: 'verse', bars: 5 },
      ],
      cues: [{ bar: 9, type: 'build' }, { bar: 18, type: 'invite_crowd' }],
    },
    {
      id: 'modular_trade', label: 'Modular Trade', description: 'Hand the patch over and see what comes back.', noteDensity: 1.6,
      sections: [
        { pattern: 'intro', bars: 2 }, { pattern: 'verse', bars: 7 }, { pattern: 'verse_off', bars: 7 },
        { pattern: 'chorus', bars: 8 },
      ],
      cues: [{ bar: 8, type: 'spotlight_bandmate' }, { bar: 17, type: 'improvise' }],
    },
  ],
};

export const SONG_CONFIGS: SongConfig[] = [
  SAILOR_LULLABY, NEON_RAIN, CALLEJON_GROOVE, KREUZBERG_STATIC,
  TEJO_AFTER_MIDNIGHT, LAST_TRAIN_HOME, MERCADO_ELECTRICO, HALLENBAD,
];
