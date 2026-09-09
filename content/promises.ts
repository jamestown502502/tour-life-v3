// Tour promises — one thing the band decides this tour is FOR, chosen before the first city.
//
// A run used to be a sequence of stops with no stated intent, which meant the ending summarised
// what happened without ever answering what you were trying to do. A promise gives the run a
// spine: it is chosen at the route screen, carried as a flag, judged once at the end against
// something the player actually influenced, and answered in the epilogue.
//
// Deliberately three, deliberately soft. None of them can be failed in a way that punishes —
// the epilogue simply tells the truth about how it went, which is the same contract as the
// rhythm score.

export interface TourPromise {
  id: string;
  /** Button label on the route screen. */
  label: string;
  /** The line shown once it is chosen, and echoed in the journal. */
  line: string;
  /** Flag carried on the run. */
  flag: string;
}

export const TOUR_PROMISES: TourPromise[] = [
  {
    id: 'together',
    label: 'We finish this still speaking to each other',
    line: 'Whatever else happens, the four of you come home as four people who still like each other.',
    flag: 'promise_together',
  },
  {
    id: 'rooms',
    label: 'We win over every room, however small',
    line: 'It does not matter how many are in front of you. It matters that they are glad they came.',
    flag: 'promise_rooms',
  },
  {
    id: 'something_new',
    label: 'We come back with something we did not have',
    line: 'A song, an idea, a way of playing — something that did not exist before you left.',
    flag: 'promise_something_new',
  },
];

/** How each promise reads in the epilogue, kept or not. Judged against the run's real numbers —
 *  see keptPromise() — so neither line can be earned by anything except playing. */
export const PROMISE_EPILOGUE: Record<string, { kept: string; missed: string }> = {
  promise_together: {
    kept: ' They said at the start that the only thing that mattered was coming home as four people who still liked each other. They managed it, which is rarer than any of them will admit.',
    missed: ' They said at the start that the only thing that mattered was coming home still speaking to each other. It got closer than anyone wanted. It held, mostly. That counts too.',
  },
  promise_rooms: {
    kept: ' They promised themselves they would win over every room, however small — and the small ones, it turns out, were the ones that stayed won.',
    missed: ' They promised themselves they would win over every room. Some rooms had other plans. The ones they got, they got completely.',
  },
  promise_something_new: {
    kept: ' They left saying they wanted to come back with something they did not have. They did. It is about ninety seconds long and nobody outside the van has heard it yet.',
    missed: ' They left saying they wanted to come back with something new. What they came back with was mostly each other, slightly worn, which was not the plan but is not nothing.',
  },
};
