// What happened to each of them.
//
// The epilogue said what became of the BAND — the offers, the record, the quiet afterwards — and
// never once said what became of Mira, Theo, Jun or Rowan. Every one of them is introduced with a
// stated want ("wants recognition", "wants rest", "wants sonic experimentation", "wants to be
// seen"), the whole run tracks a standing with each, and then the ending resolved none of it. Four
// people you spent a tour managing walked off the last page unaccounted for.
//
// Reported as the bandmate stories feeling dry, and that is the structural reason: a want with no
// answer is a setup with no payoff, however good the individual scenes are.
//
// Each coda has three variants keyed to where that person actually landed. They are appended to
// whichever epilogue paragraph the run earned, so the same ending reads differently depending on
// who you looked after — four independent axes on top of the six endings, which is where the real
// combinatorial variety in an ending comes from.
import type { BandmateId } from './schema';

export interface Coda {
  /** Their want was met. High standing, and the tour gave them the thing they came for. */
  fulfilled: string;
  /** Partly. The tour neither delivered nor took it away. */
  unresolved: string;
  /** It did not happen, and they know it. Never cruel — this game has no fail states, and a coda
   *  that punishes is just a fail state with better prose. */
  denied: string;
}

export const BANDMATE_CODAS: Record<BandmateId, Coda> = {
  mira: {
    fulfilled:
      'Mira gets asked to guest on somebody else’s record, by name, by someone who heard her and went looking. She says yes before negotiating anything, then spends a week pretending she is not thrilled about it. She is thrilled about it.',
    unresolved:
      'Mira keeps writing. Nobody has come looking yet, and she has stopped refreshing the page where they would appear if they did. The songs are better than they were in Berlin. She knows that much on her own now.',
    denied:
      'Mira does not bring up recognition again, which is its own kind of answer. She writes anyway, most nights, and does not play any of it to anyone for a long while. The wanting has not gone; it has just gone quiet.',
  },
  theo: {
    fulfilled:
      'Theo sleeps. Properly, for weeks, in an actual bed, and comes back to the kit in his own time rather than a promoter’s. His hands are steady when he does. Nobody had to talk him into stopping, which is the part that matters.',
    unresolved:
      'Theo rests some and worries the rest. He is fine, he says, and mostly is. The shaking turns up sometimes before a show and less often after. He has started saying so out loud, which he never did before this tour.',
    denied:
      'Theo does not get his rest. He goes straight into someone else’s sessions because the money is there and the band is not saying no for him. He is good at it. He is also very tired, and getting better at hiding that.',
  },
  jun: {
    fulfilled:
      'Jun finally builds the thing they had been describing for a year, and it sounds like nothing else. Two of the ideas from those four cities of unplayed gear end up load-bearing on the next record. Nobody calls it self-indulgent any more.',
    unresolved:
      'Jun keeps the rig, keeps patching, keeps not quite finishing. Some of it worked. Enough of it worked that they have stopped apologising for the parts that did not, which is new.',
    denied:
      'Jun packs the modular away and does not unpack it for months. The tour wanted songs, not experiments, and they gave it songs. They were good songs. That is not the same thing as the argument being settled.',
  },
  rowan: {
    fulfilled:
      'Somebody writes about Rowan specifically — one line, in one review, about the bass — and Rowan pretends not to have read it while being able to quote it exactly. Nobody in that band forgets they were in the room again.',
    unresolved:
      'Rowan is still the one nobody asks about, and minds it slightly less than before. Two people did ask, on this tour, and Rowan remembers both. It is not nothing. It is not everything either.',
    denied:
      'Rowan goes unmentioned in every write-up of the tour, including the good ones. They say it does not matter. They keep the one photo where they are clearly, unmistakably in the frame.',
  },
};

/** Standing at or above this and the tour delivered what they came for. */
export const CODA_FULFILLED_AT = 55;
/** Below this and it did not happen for them. */
export const CODA_DENIED_BELOW = 30;

export function codaVariantFor(standing: number): keyof Coda {
  if (standing >= CODA_FULFILLED_AT) return 'fulfilled';
  if (standing < CODA_DENIED_BELOW) return 'denied';
  return 'unresolved';
}

/** The four personal codas for a finished run, in a stable order so the paragraph reads the same
 *  way every time rather than shuffling. */
export function codasFor(relationships: Record<string, number>): string[] {
  const order: BandmateId[] = ['mira', 'theo', 'jun', 'rowan'];
  return order.map((id) => BANDMATE_CODAS[id][codaVariantFor(relationships[id] ?? 0)]);
}
