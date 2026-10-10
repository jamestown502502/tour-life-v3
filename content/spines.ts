// Story spines (QA round 4 depth pass, 2026-10-10). "Why this tour?" was the first choice a player
// makes and, apart from one journal line in Lisbon, it changed nothing. Each answer is now a spine
// for the whole tour: a stake named up front, three drives (to stops 2, 3 and 4) where the band
// argues about it and you choose, and an ending line that says whether the tour kept its reason.
// Four spines, on top of the seeded route, wildcard and tour goal: two tours with the same cities
// now tell different stories.
//
// Every choice carries `after`: the real-world point, said by the band, in the voice of the craft
// lessons. Effects are small (the spine colours a tour, it never decides one).
import type { BandmateId, StatDeltas } from './schema';
import type { RunState } from '../src/core/state';

export interface SpineChoice {
  label: string;
  effects: StatDeltas;
  relationships?: Partial<Record<BandmateId, number>>;
  after: string;
}
export interface SpineBeat { speaker: BandmateId; text: string; choices: [SpineChoice, SpineChoice] }
export interface Spine {
  id: string;
  why: string;              // the WHY_TOUR_BEATS line it belongs to
  stake: string;            // what this tour has to prove, said once at the start
  check: (run: RunState) => boolean;
  checkText: string;        // how the stake is judged, for the Scrapbook
  beats: [SpineBeat, SpineBeat, SpineBeat];
  kept: string;
  broken: string;
}

export const SPINES: Spine[] = [
  {
    id: 'lastTry',
    why: 'One last try before day jobs win.',
    stake: 'This tour has to pay its own way. If the van fund comes home healthy, nobody has to go back to the day job yet.',
    check: (r) => r.stats.funds >= 400,
    checkText: 'Bring $400 or more home in the van fund.',
    beats: [
      { speaker: 'theo', text: '"My manager at the warehouse texted," Theo says. "They\'ll hold my shift two more weeks. After that, they won\'t." Nobody says anything for a mile.',
        choices: [
          { label: '"Then we make these two weeks count."', effects: { inspiration: 3, energy: -2 }, relationships: { theo: 4 },
            after: 'A deadline is a budget for effort. Spend it on purpose and it stops feeling like a countdown.' },
          { label: '"Keep the shift. We plan around it."', effects: { harmony: 3, funds: 10 }, relationships: { theo: 2 },
            after: 'Most working musicians keep a day job. A safety net is not a lack of faith in the band.' },
        ] },
      { speaker: 'rowan', text: 'Rowan has the van fund spreadsheet open. "We are making money," they say. "We are also spending it faster. Merch or sleep: pick one to cut."',
        choices: [
          { label: 'Cut the hotel nights: sleep in the van', effects: { funds: 30, energy: -6 }, relationships: { rowan: 3 },
            after: 'Cutting a cost is only a saving if it does not cost you more later. Tired bands play worse shows.' },
          { label: 'Cut the merch order: sell what we have', effects: { funds: 15, inspiration: -2 }, relationships: { rowan: 2 },
            after: 'Inventory is cash you cannot spend. Order merch in amounts you can actually sell.' },
        ] },
      { speaker: 'mira', text: '"If this is the last one," Mira says, "I want to remember it as ours. Not as the one where we counted coins." She is not entirely joking.',
        choices: [
          { label: '"It can be both. Count the coins, play like it\'s ours."', effects: { harmony: 4, inspiration: 2 }, relationships: { mira: 4 },
            after: 'Keeping score of money and caring about the music are not opposites. The bands that last do both.' },
          { label: '"It isn\'t the last one. That\'s the point of counting."', effects: { funds: 10, harmony: 2 }, relationships: { mira: 2 },
            after: 'Knowing your numbers is what lets you say yes to the next tour.' },
        ] },
    ],
    kept: 'The van fund came home in the black. At the warehouse, Theo hands in two weeks\' notice instead of a sick note. One last try turned into a next one.',
    broken: 'The tour did not pay for itself, not this time. Theo keeps the shift. But the band has numbers now, and numbers can be planned around: the next try starts better informed.',
  },
  {
    id: 'label',
    why: 'A label finally said yes.',
    stake: 'The label wants new songs by the end of the tour. Come home with real inspiration, and the deal turns into an album.',
    check: (r) => r.stats.inspiration >= 70,
    checkText: 'Finish with Inspiration at 70 or more.',
    beats: [
      { speaker: 'jun', text: 'Jun reads the contract on his phone for the fourth time. "Clause nine. They own the masters for seven years." He looks up. "Is that normal?"',
        choices: [
          { label: '"Ask for it in plain words. Then ask a lawyer."', effects: { harmony: 3, funds: -10 }, relationships: { jun: 4 },
            after: 'Who owns the masters (the original recordings) decides who earns from them for years. Always know before you sign.' },
          { label: '"It\'s a yes. Don\'t poke it."', effects: { inspiration: 2, harmony: -2 }, relationships: { jun: -2 },
            after: 'Excitement is a bad time to skim a contract. A good deal survives questions.' },
        ] },
      { speaker: 'mira', text: 'Mira has three half-songs and a deadline. "Do I finish one properly, or sketch all three so the label can choose?"',
        choices: [
          { label: '"Finish one. Make it undeniable."', effects: { inspiration: 5, energy: -3 }, relationships: { mira: 4 },
            after: 'A finished song can be judged; a sketch gets imagined differently by everyone who hears it.' },
          { label: '"Sketch all three. Let them hear the range."', effects: { inspiration: 3 }, relationships: { mira: 2 },
            after: 'Demos sell direction. Pick the format your listener needs, not the one you prefer.' },
        ] },
      { speaker: 'theo', text: 'The label rep asks the band to play the single faster, "for radio". Theo already hates it.',
        choices: [
          { label: 'Try it their way for one show', effects: { harmony: -2, funds: 15 }, relationships: { theo: -2 },
            after: 'Testing a note from a partner costs one show. Refusing on principle can cost the relationship.' },
          { label: 'Keep the tempo; send them a live recording', effects: { inspiration: 3, harmony: 2 }, relationships: { theo: 4 },
            after: 'Answer feedback with evidence. A recording of a room singing along argues better than you can.' },
        ] },
    ],
    kept: 'You came home with more songs than the label asked for. The meeting is short: they want the album, and they want it to sound like this tour.',
    broken: 'The label liked the shows but heard no new songs. The deal stays a maybe. Mira keeps writing on the train home; maybes can be turned around.',
  },
  {
    id: 'promise',
    why: 'A promise made at a funeral.',
    stake: 'You promised to play her songs, together, in the cities she never got to see. The tour keeps the promise if the band is still a band at the end.',
    check: (r) => r.stats.harmony >= 65,
    checkText: 'Finish with Harmony at 65 or more.',
    beats: [
      { speaker: 'mira', text: '"She wrote the bridge in a different key," Mira says. "We changed it because it was hard to sing. Should we change it back?"',
        choices: [
          { label: '"Change it back. Play it the way she wrote it."', effects: { inspiration: 3, energy: -2 }, relationships: { mira: 4 },
            after: 'Changing key changes a song\'s colour as well as its range. Sometimes the hard version is the true one.' },
          { label: '"Keep our version. She\'d want it sung well."', effects: { harmony: 3 }, relationships: { mira: 2 },
            after: 'Honouring a song and freezing it are different things. Songs are meant to be played by whoever loves them now.' },
        ] },
      { speaker: 'rowan', text: 'Rowan finds a box of her old setlists under the van seat. Half the band wants to read them now. The other half is not ready.',
        choices: [
          { label: 'Read them together, at the next stop', effects: { harmony: 5, energy: -3 }, relationships: { rowan: 4 },
            after: 'Grief shared at the right moment pulls a group together. "Not now" can mean "together, later".' },
          { label: 'Leave the box closed for now', effects: { energy: 3 }, relationships: { rowan: 1 },
            after: 'Not everyone grieves on the same schedule. Waiting is also a way of caring.' },
        ] },
      { speaker: 'jun', text: '"Last city," Jun says. "Do we tell the crowd why we\'re here? Or just play?"',
        choices: [
          { label: 'Tell them, in one sentence', effects: { harmony: 3, inspiration: 3 }, relationships: { jun: 3 },
            after: 'A short, true sentence from the stage connects more than a long speech. Say it once and play.' },
          { label: 'Just play. The songs say it.', effects: { inspiration: 4 }, relationships: { jun: 2 },
            after: 'Music can carry what words cannot. Trust the set to tell the story.' },
        ] },
    ],
    kept: 'Four cities, her songs every night, and the four of you still a band at the end. Promise kept. Somebody leaves the box of setlists on her mother\'s doorstep with a note: "We played them all."',
    broken: 'The songs got played, but the band is frayed by the end of it. The promise is half kept. Mira says the other half is staying a band, and that it can still be done at home.',
  },
  {
    id: 'nothingLeft',
    why: 'Nothing left to lose at home.',
    stake: 'Nobody is waiting at home, so the band has to become the home. The tour is a success if every one of you comes out of it closer.',
    check: (r) => Object.values(r.relationships).every((v) => v >= 40),
    checkText: 'Every bandmate at 40 or more with you.',
    beats: [
      { speaker: 'rowan', text: 'Rowan\'s phone buzzes. A landlord, a last notice, a flat that is not theirs anymore. They put it face down. "So that\'s that."',
        choices: [
          { label: '"Then the van is your address for now. We\'ve got you."', effects: { harmony: 4 }, relationships: { rowan: 5 },
            after: 'Saying "we\'ve got you" out loud matters. People rarely ask for the help they need.' },
          { label: '"Want to talk about it, or not yet?"', effects: { harmony: 2, energy: 2 }, relationships: { rowan: 3 },
            after: 'Asking what kind of support someone wants beats guessing. Listening can be the help.' },
        ] },
      { speaker: 'theo', text: 'Theo forgot to call his sister on her birthday. He is pretending it doesn\'t matter, loudly.',
        choices: [
          { label: 'Hand him your phone at the next rest stop', effects: { harmony: 3 }, relationships: { theo: 4 },
            after: 'A late call still counts. Repairing a small miss early keeps it small.' },
          { label: 'Let him be; buy him a coffee', effects: { energy: 3 }, relationships: { theo: 2 },
            after: 'Sometimes the kind thing is not to push. Stay close enough to be there when they are ready.' },
        ] },
      { speaker: 'jun', text: '"After the tour," Jun says carefully, "do we... live somewhere? Together? I\'m asking for a friend. The friend is all of us."',
        choices: [
          { label: '"Let\'s find a place. Split it four ways."', effects: { harmony: 5, funds: -10 }, relationships: { jun: 3, mira: 2, rowan: 2, theo: 2 },
            after: 'Shared rent is cheaper, and shared rules keep it friendly: agree on money and chores before you move in.' },
          { label: '"Let\'s get through the tour first."', effects: { energy: 2 }, relationships: { jun: 1 },
            after: 'Big decisions made on a tour high are worth sleeping on. Saying "later" is fine if you mean it.' },
        ] },
    ],
    kept: 'Nobody was waiting at home, so you built one on the road: four people who know each other\'s worst mornings and still split the last coffee. Nothing left to lose became everything in the van.',
    broken: 'The tour ends and the four of you scatter a little. Nothing left to lose turned out to be true for some of you more than others. But the group chat is still going, and that is how homes start.',
  },
];

export function spineFor(whyTour: string | undefined): Spine {
  return SPINES.find((s) => s.why === whyTour) ?? SPINES[0];
}

/** Which spine beat a drive to the route stop at `stopIndex` plays (stops 2-4), or -1. */
export function spineBeatIndex(stopIndex: number): number {
  return stopIndex >= 1 && stopIndex <= 3 ? stopIndex - 1 : -1;
}

export const spineFlag = (id: string, beat: number, choice: number): string => `spine_${id}_${beat}_${choice}`;
