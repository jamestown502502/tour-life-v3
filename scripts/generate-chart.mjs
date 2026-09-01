#!/usr/bin/env node
// Algorithmic rhythm-chart generator, matching the pattern already established in
// content/songs/sailor_lullaby.json and neon_rain.json (deterministic motif repeated across
// the track, lanes cycling through a fixed order, holds substituted periodically, 2-3 cues
// placed roughly a third and two-thirds through). Used once, ad hoc, to produce
// content/songs/callejon_groove.json for Mexico City — not wired into the build.
//
// Usage: node scripts/generate-chart.mjs > content/songs/callejon_groove.json

const BPM = 104;
const BEAT = 60 / BPM; // seconds per beat
const LANES = 4;
const LANE_CYCLE = [0, 2, 1, 3];
const CUE_TYPES = ['pull_back', 'build', 'invite_crowd', 'improvise', 'spotlight_bandmate'];

function round(n) { return Math.round(n * 1000) / 1000; }

/** Builds one arrangement's notes from a list of beat-offsets (in beats, not seconds).
 *  `holdEvery`: every Nth note becomes a hold instead of a tap, spanning most of the gap to
 *  the next note. `laneOffset`: rotates the lane cycle so arrangements don't all hit the same
 *  lane at t=0. */
function buildNotes(beatOffsets, holdEvery, laneOffset) {
  const notes = [];
  for (let i = 0; i < beatOffsets.length; i++) {
    const t = beatOffsets[i] * BEAT;
    const lane = LANE_CYCLE[(i + laneOffset) % LANE_CYCLE.length];
    const isHold = holdEvery > 0 && (i + 1) % holdEvery === 0 && i < beatOffsets.length - 1;
    if (isHold) {
      const nextT = beatOffsets[i + 1] * BEAT;
      notes.push({ t: round(t), l: lane, type: 'hold', dur: round((nextT - t) * 0.75) });
    } else {
      notes.push({ t: round(t), l: lane, type: 'tap' });
    }
  }
  return notes;
}

function buildCues(durationSec, count) {
  const cues = [];
  for (let i = 1; i <= count; i++) {
    const t = round((durationSec * i) / (count + 1));
    cues.push({ t, type: CUE_TYPES[(i - 1) % CUE_TYPES.length] });
  }
  return cues;
}

// --- rehearsed: half-note pulse, steady, one hold every 8 notes. ~62s. ---
const rehearsedBeats = [];
for (let b = 0; b < 108; b += 2) rehearsedBeats.push(b);
const rehearsedNotes = buildNotes(rehearsedBeats, 8, 0);
const rehearsedDur = rehearsedBeats[rehearsedBeats.length - 1] * BEAT + 1;

// --- call_and_response: alternating sparse "call" bar (on-beat) / dense "response" bar
// (syncopated eighths) every 2 bars (8 beats), evoking the crowd answering back. ~63s. ---
const callResponseBeats = [];
for (let bar = 0; bar < 14; bar++) {
  const barStart = bar * 8;
  if (bar % 2 === 0) {
    callResponseBeats.push(barStart, barStart + 4); // call: sparse
  } else {
    callResponseBeats.push(barStart, barStart + 1.5, barStart + 3, barStart + 4.5, barStart + 6); // response: denser
  }
}
const callResponseNotes = buildNotes(callResponseBeats, 6, 2);
const callResponseDur = callResponseBeats[callResponseBeats.length - 1] * BEAT + 1;

// --- duet_percussion: dense eighth-note trade-off, holds more frequent (sustained rhythms
// "traded" between the band and Ximena), 3 cues instead of 2. ~62s. ---
const duetBeats = [];
for (let b = 0; b < 106; b += 0.5) duetBeats.push(b);
const duetNotes = buildNotes(duetBeats, 5, 1);
const duetDur = duetBeats[duetBeats.length - 1] * BEAT + 1;

const song = {
  id: 'callejon_groove',
  name: 'Callejón Groove',
  bpm: BPM,
  lanes: LANES,
  chordProgression: 'Am-Dm-E7-Am',
  waveform: 'triangle',
  arrangements: [
    {
      id: 'rehearsed', label: 'Rehearsed & Tight', description: 'Every cue exactly where it should be.',
      noteDensity: 1, notes: rehearsedNotes, cues: buildCues(rehearsedDur, 2),
    },
    {
      id: 'call_and_response', label: 'Call and Response', description: 'The room answers back.',
      noteDensity: 1.6, notes: callResponseNotes, cues: buildCues(callResponseDur, 2),
    },
    {
      id: 'duet_percussion', label: 'Duet with Ximena', description: 'Trading rhythms, no rehearsal.',
      noteDensity: 2.2, notes: duetNotes, cues: buildCues(duetDur, 3),
    },
  ],
};

process.stdout.write(JSON.stringify(song, null, 2) + '\n');
