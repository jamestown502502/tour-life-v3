// Promise moments (publisher polish 2026-10-12): the tour promise used to be chosen at the route
// screen and then judged once, silently, at the end. Now it is TESTED: on arrival in the 2nd, 3rd
// and 4th city the band hits a moment where keeping the promise costs something, and you choose.
// Each option nudges exactly the numbers keptPromise() measures (src/game/promise.ts), by a few
// points, so the choice matters without deciding the ending on its own. The epilogue then cites
// the moments that decided it (citeFor in src/game/promise.ts).
//
// Neither option is the "right" one. The second option always protects something real (sleep,
// money, a friendship, a song) that the promise would cost.
import type { BandmateId, StatKey } from './schema';

export interface PromiseOption {
  label: string;
  /** Shown after choosing. */
  after: string;
  stats?: Partial<Record<StatKey, number>>;
  relationships?: Partial<Record<BandmateId, number>>;
  /** Local love in the city where it happened. */
  localLove?: number;
  /** For the epilogue: "In {city}, <cite>." */
  cite: string;
}

export interface PromiseMoment {
  id: string;
  speaker: BandmateId;
  text: string;
  /** [keeps the promise, protects something else] */
  options: [PromiseOption, PromiseOption];
}

/** By promise flag, the moments for the 2nd, 3rd and 4th stop of the route. */
export const PROMISE_MOMENTS: Record<string, [PromiseMoment, PromiseMoment, PromiseMoment]> = {
  promise_together: [
    {
      id: 'together_soundcheck', speaker: 'jun',
      text: 'Theo wants to skip soundcheck and sleep. Jun is furious: "We said we would do this properly. Together."',
      options: [
        { label: 'Wake Theo. We soundcheck as four.', after: 'Theo drags himself in, grumbling, and plays better than anyone expected. Jun says nothing, which is a thank you.', stats: { harmony: 4, energy: -4 }, relationships: { jun: 4, theo: -1 }, cite: 'you woke Theo for soundcheck and the four of you did it together' },
        { label: 'Let Theo sleep. Cover for him.', after: 'Jun soundchecks the drums with a pencil. Theo wakes up rested and never quite hears about it.', stats: { energy: 4, harmony: -3 }, relationships: { theo: 3, jun: -3 }, cite: 'you let Theo sleep through soundcheck and Jun carried it alone' },
      ],
    },
    {
      id: 'together_offer', speaker: 'mira',
      text: 'A producer wants Mira for a session tomorrow, alone, the same night as your show. "It is one night," she says, not quite looking at anyone.',
      options: [
        { label: 'Ask her to stay. The band plays as four.', after: 'Mira turns it down. She is quiet at dinner, then laughs at something Rowan says, and it is fine.', stats: { harmony: 3 }, relationships: { mira: -2, rowan: 2, jun: 2 }, cite: 'Mira turned down a solo session to play the show with you' },
        { label: 'Tell her to go. You will manage.', after: 'Mira goes. The show is thinner without her, and she comes back glowing. Some of the band is happy for her.', stats: { harmony: -3, inspiration: 3 }, relationships: { mira: 5, jun: -2 }, cite: 'you told Mira to take the solo session, and the band played a night without her' },
      ],
    },
    {
      id: 'together_fight', speaker: 'rowan',
      text: 'Rowan and Theo have not spoken since lunch. Rowan finds you first: "I need you to say who is right."',
      options: [
        { label: 'Refuse. Sit them both down instead.', after: 'It takes an hour and most of a pizza. Nobody wins. Everybody is still in the band.', stats: { harmony: 5, energy: -3 }, relationships: { rowan: 1, theo: 1 }, cite: 'you sat Rowan and Theo down and made them talk instead of picking a side' },
        { label: 'Back Rowan. They were right.', after: 'Rowan was right, mostly. Theo hears about it from the hallway and drums very hard that night.', stats: { harmony: -4 }, relationships: { rowan: 5, theo: -4 }, cite: 'you took Rowan\'s side against Theo, and the van was quiet for a day' },
      ],
    },
  ],
  promise_rooms: [
    {
      id: 'rooms_tiny', speaker: 'theo',
      text: 'The venue sold eleven tickets. Theo, flatly: "Eleven. We could cut the set short and get a real night of sleep."',
      options: [
        { label: 'Play the full set for the eleven.', after: 'You play every song. Eleven people sing the chorus of the last one, badly, and loudly.', localLove: 4, stats: { energy: -4 }, cite: 'you played the whole set for eleven people and they sang the last chorus back' },
        { label: 'Cut it short. Save the energy.', after: 'A tidy forty minutes. The eleven clap politely. The band sleeps well.', localLove: -1, stats: { energy: 5 }, cite: 'you cut the set short for a room of eleven and slept instead' },
      ],
    },
    {
      id: 'rooms_kid', speaker: 'mira',
      text: 'A teenager at the merch table cannot afford a shirt and keeps not leaving. Mira watches you to see what you do.',
      options: [
        { label: 'Give the kid a shirt. Sign it.', after: 'The kid wears it out of the venue, and probably to school for a month.', localLove: 3, stats: { funds: -15 }, relationships: { mira: 2 }, cite: 'you gave a teenager at the merch table a signed shirt' },
        { label: 'Smile, and keep the stock for sale.', after: 'The kid leaves with a sticker. The float stays healthy. Mira does not say anything.', stats: { funds: 10 }, cite: 'you kept the merch for the paying customers' },
      ],
    },
    {
      id: 'rooms_request', speaker: 'jun',
      text: 'Someone keeps shouting for a song you have not rehearsed since the first week. Jun: "We could. It would be rough."',
      options: [
        { label: 'Play it, rough edges and all.', after: 'It falls apart in the middle and the room loves it more for that.', localLove: 3, stats: { harmony: -1 }, cite: 'you played an unrehearsed request and the room loved it more for falling apart' },
        { label: 'Stick to the set you can play well.', after: 'The set is tight. The person shouting goes home slightly disappointed and fully entertained.', stats: { harmony: 2 }, cite: 'you kept to the rehearsed set even when someone kept shouting for more' },
      ],
    },
  ],
  promise_something_new: [
    {
      id: 'new_morning', speaker: 'jun',
      text: 'Jun is awake at six with a riff and a borrowed keyboard. "Come and hear this before everyone wakes up."',
      options: [
        { label: 'Get up. Write with Jun.', after: 'By eight there are sixteen bars and a title nobody likes. By nine, everyone likes it.', stats: { inspiration: 5, energy: -4 }, relationships: { jun: 3 }, cite: 'you got up at six to write with Jun and came back with sixteen bars' },
        { label: 'Sleep. It will still be there later.', after: 'You sleep. Jun records it on a phone. It is still there later, a little smaller.', stats: { energy: 5, inspiration: -2 }, cite: 'you slept through Jun\'s six a.m. riff' },
      ],
    },
    {
      id: 'new_sound', speaker: 'rowan',
      text: 'Rowan found a broken old effects pedal at a flea market. "It makes the bass sound like a ship. Can we use it tonight?"',
      options: [
        { label: 'Use it tonight. Find out live.', after: 'It sounds like a ship. A good ship. Someone in the crowd asks what it was.', stats: { inspiration: 5, harmony: -1 }, relationships: { rowan: 3 }, cite: 'you let Rowan play the flea-market pedal live and found a new sound' },
        { label: 'Not live. Try it at soundcheck first.', after: 'Sensible. It sounds like a ship at soundcheck too, but the moment is a little smaller.', stats: { inspiration: 1, harmony: 2 }, cite: 'you saved Rowan\'s pedal for a safer soundcheck' },
      ],
    },
    {
      id: 'new_cover', speaker: 'theo',
      text: 'The promoter wants the cover song that always works. Theo shrugs: "Or we play the new one. Nobody knows it yet."',
      options: [
        { label: 'Play the new one.', after: 'Half the room has no idea what is happening. The other half films it.', stats: { inspiration: 6 }, localLove: -1, cite: 'you played the new song instead of the cover the promoter wanted' },
        { label: 'Play the cover. Keep the promoter happy.', after: 'The cover works, like it always does. The promoter books you again.', stats: { funds: 20, inspiration: -2 }, localLove: 2, cite: 'you played the safe cover for the promoter' },
      ],
    },
  ],
};
