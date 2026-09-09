// Travel beats — the van between cities.
//
// The tour used to cut straight from the Hub map to the next city's arrival. That skipped the
// place a touring band actually spends most of its time: sitting in a vehicle with the same three
// people, saying very little. These are short (2 beats), always additive, and never gate anything.
//
// The speaker is chosen from whichever bandmate the run has moved MOST since the last stop, so the
// van scene is reactive rather than filler — the person with something going on is the person who
// talks. See VanScene for that selection.
import type { BandmateId } from './schema';

export interface VanBeat {
  speaker: BandmateId | 'narrator';
  text: string;
}

/** Opening line of a travel beat — always the narrator setting the vehicle and the hour. */
export const VAN_OPENERS: string[] = [
  'The motorway does that thing where it stops being scenery and becomes a colour. Nobody has spoken in forty minutes.',
  'Somebody has been navigating by vibes for an hour. The bags in the back have redistributed themselves into a single mass.',
  'The heater works only on maximum. The windows are down in protest. Everyone is both too hot and too cold.',
  'Three hours of flat road, one playlist, and a growing argument about whether the second song counts as a ballad.',
  'Rain starts somewhere around the halfway mark and does not stop being background noise for the rest of the drive.',
];

/** The bandmate beat, keyed by who has changed most since the last city — so the van reflects
 *  where the run has actually gone, not a random rotation. Each is <=40 words. */
export const VAN_BEATS: Record<BandmateId, { warm: string; cool: string }> = {
  mira: {
    warm: '"I wrote something at the last place," Mira says, not offering to play it. "It\'s not finished. I just wanted somebody to know it exists."',
    cool: 'Mira has been looking out the same window for an hour. "I\'m fine," she says, before anyone asks, which is how everyone knows to ask later.',
  },
  theo: {
    warm: '"I slept," Theo announces, genuinely pleased with himself. "Four hours. In a row. Consecutively." Somebody applauds. He takes the applause.',
    cool: 'Theo counts something under his breath — beats, or hours, or money. He notices you noticing and stops. "Old habit," he says.',
  },
  jun: {
    warm: '"Okay, so." Jun turns around in the passenger seat entirely. "What if the second song started with nothing? Just nothing, for four bars."',
    cool: 'Jun\'s notebook stays shut the whole drive, which for Jun is the loudest possible statement about how the last night went.',
  },
  rowan: {
    warm: 'Rowan has taken over the aux and is not defending any of it. Track four is a children\'s song. Nobody skips it.',
    cool: '"Do you think anyone would notice," Rowan says, half asleep, "if I just played the same note the whole set." Nobody answers. Rowan smiles anyway.',
  },
};
