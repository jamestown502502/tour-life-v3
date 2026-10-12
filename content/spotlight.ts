// The Spotlight Bridge (publisher polish 2026-10-12): the bandmate you spent this city with offers
// to take tonight's bridge. Their offer changes with where they are in their own story (arc stage:
// setup, strain, resolution, src/game/arc.ts); taking it changes how the bridge sounds and looks,
// what they say after the show, and a line on the next drive. Declining is never wrong: the band
// plays it as rehearsed and nobody sulks.
//
// Rowan uses they/them (character sheet). Lines are short on purpose: the offer sits above the
// pre-show buttons, the after-show line in the Results panel, the echo in a van dialogue box.
import type { BandmateId } from './schema';

export type SpotlightTreatment = 'intimate' | 'drive' | 'walk' | 'shimmer';

export interface SpotlightVoice {
  treatment: SpotlightTreatment;
  /** What the bridge becomes, in one phrase, for the offer button and the caption chip. */
  take: string;
  /** Stage lighting while they have the bridge (also the caption chip edge). */
  light: number;
  /** The offer, by arc stage: setup, strain, resolution. */
  offer: [string, string, string];
  /** After the show, when you gave them the bridge. */
  after: string;
  /** On the next drive. {city} is where it happened. */
  echo: string;
}

export const SPOTLIGHT: Record<BandmateId, SpotlightVoice> = {
  mira: {
    treatment: 'intimate',
    take: 'the bridge quiet, just her voice',
    light: 0xd96aa0,
    offer: [
      'Mira catches your sleeve. "The bridge tonight. Let me sing it quiet. No drums, just me and the room."',
      'Mira, hoarse but certain: "I want the bridge. Quiet. If I can still make them lean in, I am still a singer."',
      'Mira smiles like she already knows the answer. "One more quiet bridge. For us, not for them."',
    ],
    after: 'Mira took the bridge quiet. The room leaned in to hear her.',
    echo: 'Mira is humming the {city} bridge against the window. Nobody asks her to stop.',
  },
  theo: {
    treatment: 'drive',
    take: 'the bridge as a drum break',
    light: 0xf9a421,
    offer: [
      'Theo spins a stick. "Bridge is mine tonight. Give me eight bars and I will wake up the back row."',
      'Theo, tired but grinning: "I need one moment that is fun again. Let me hit the bridge hard."',
      'Theo taps the dashboard in time. "Last time I asked for the bridge I was running on empty. Tonight I am not."',
    ],
    after: 'Theo turned the bridge into a drum break. The back row woke up.',
    echo: 'Theo keeps drumming the {city} break on his knees until Jun throws a sock at him.',
  },
  jun: {
    treatment: 'walk',
    take: 'the bridge with a new bass line',
    light: 0x4fb3b0,
    offer: [
      'Jun holds up a notebook. "I wrote a new line under the bridge. Can we try it? Tonight?"',
      'Jun, quietly: "If we play the bridge the same way every night I will stop hearing it. Let me change it."',
      'Jun does not ask so much as show you the page. "This is the version I hear in my head. Let us play it."',
    ],
    after: 'Jun walked a new line under the bridge. Two musicians in the crowd looked at each other.',
    echo: 'Jun has written the {city} bridge into the notebook in ink, which means it is staying.',
  },
  rowan: {
    treatment: 'shimmer',
    take: 'the bridge bright, their part up front',
    light: 0x8a7fd6,
    offer: [
      'Rowan hesitates, then says it anyway. "Could the bridge be mine? Just once. Up front."',
      'Rowan, steadier than you expected: "I have been the background all tour. Let me have the bridge tonight."',
      'Rowan laughs. "I used to be scared to ask for the bridge. Now I am asking. Bright, and loud."',
    ],
    after: 'Rowan took the bridge up front, and the room finally heard what they had been holding up all tour.',
    echo: 'Rowan replays a phone video of the {city} bridge, then pretends they were not.',
  },
};

/** The line in the Results panel when the band played the bridge as rehearsed. */
export const SPOTLIGHT_DECLINED = 'You kept the bridge as rehearsed. Tight, and nobody minded.';
