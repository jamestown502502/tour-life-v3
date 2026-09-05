// Stuck-screen-hardening follow-up, Item C: "the night before the tour" — a short (~90s),
// diegetic opening beat so a new player sees all 4 bandmates' painted faces (already
// generated, never shown anywhere before this) within the first minute of a run, following VN-
// opening best practice (hook, faces, voices, stakes, no info-dump — see docs/
// ADDENDUM_STUCK_SCREENS_BEFORE_AFTER.md for the cited sources). One beat per bandmate, each
// <=40 words, in the same SceneGraph shape CityScene's own dialogue walks use — src/ui/
// OpeningScene.ts reuses DialogueBox exactly the way CityScene does, just for a smaller graph.
// Not validated by content/schema.ts's per-city validateCity() (this isn't a city), but every
// speaker/portrait pairing here uses the same BandmateId + mood keys that system already
// guarantees exist.
import type { SceneGraph } from './schema';

/** Walk order — OpeningScene starts here and follows each node's `next` until a node has none. */
export const OPENING_START = 'mira';

export const OPENING_GRAPH: SceneGraph = {
  mira: {
    id: 'mira',
    speaker: 'mira',
    portrait: 'inspired',
    text: "Every setlist we've ever fought about, we fought about for a reason. I don't need this to blow up. I just want people to actually hear it.",
    next: 'theo',
  },
  theo: {
    id: 'theo',
    speaker: 'theo',
    portrait: 'worried',
    text: "I said yes before I let myself think about it too hard. If my hands start shaking again like last time, somebody tell me to sit down.",
    next: 'jun',
  },
  jun: {
    id: 'jun',
    speaker: 'jun',
    portrait: 'inspired',
    text: "I've got four cities' worth of gear I've never once played live. If even one of those ideas actually works, this whole tour already paid for itself.",
    next: 'rowan',
  },
  rowan: {
    id: 'rowan',
    speaker: 'rowan',
    portrait: 'tense',
    text: "Nobody requests a bass solo. That's fine, that's always been fine. I just don't want to be the one nobody remembers was even in the room.",
  },
};
