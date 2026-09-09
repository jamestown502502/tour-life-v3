// Turns what the tour remembers about a city into what that city posted about it.
//
// Everything here is pure and seeded: the same CityMemory and the same seed always produce the
// same feed, so a replayed seed reproduces its reputation exactly like every other system in this
// game. The randomness only chooses WHICH true thing gets said, never WHETHER the town liked you.
import type { CityMemory } from '../core/state';
import type { RNG } from '../core/rng';
import {
  handlesFor, LOVE_POSTS, MINIGAME_POSTS, RETURN_POSTS, SHOW_POSTS, type SocialPost,
} from '../../content/social';

export type { SocialPost };

/** Bands a performance grade into the three reputations a town can hold. */
export function showBandFor(grade: 'perfect' | 'good' | 'ok' | 'miss'): CityMemory['show'] {
  if (grade === 'perfect') return 'triumph';
  if (grade === 'good') return 'solid';
  return 'rough';
}

/** localLove above this reads as "the town took to them"; below the low mark, as indifference. */
const LOVE_HIGH = 12;
const LOVE_LOW = 4;

/** Builds the return-leg feed for a city the band has played once already.
 *
 *  Shape of a feed (4 posts, in this order) — chosen so it reads as a timeline rather than a
 *  scorecard, and so the player's own best and worst moments both get airtime:
 *    1. the loudest opinion about the show, positive or negative depending on how it went
 *    2. the opposing view — a rough night still has a defender, a triumph still has a cynic
 *    3. something specific: the minigame, or the town's affection if there was no minigame
 *    4. a line about tonight, so the feed points forward instead of just relitigating
 *
 *  A triumph leads with a fan and a rough night leads with a hater, but BOTH always appear. The
 *  no-fail rule applies to reputation too: the worst show in the game still produces someone who
 *  is glad they went. */
export function buildFeed(memory: CityMemory, cityName: string, rng: RNG): SocialPost[] {
  const handles = handlesFor(memory.cityId);
  const show = SHOW_POSTS[memory.show];
  const sub = (t: string): string => t.replace(/\{city\}/g, cityName);

  const fanPost: SocialPost = {
    handle: rng.pick(handles.fans),
    text: sub(rng.pick(show.fan)),
    tone: 'fan',
  };
  const haterPost: SocialPost = {
    handle: rng.pick(handles.haters),
    text: sub(rng.pick(show.hater)),
    tone: 'hater',
  };

  // Third slot: the specific callback. The minigame is the more concrete memory, so it wins when
  // there is one; otherwise the town's affection carries the slot.
  let specific: SocialPost;
  if (memory.minigameGood !== undefined) {
    const pool = memory.minigameGood ? MINIGAME_POSTS.good : MINIGAME_POSTS.rough;
    specific = {
      handle: rng.pick(memory.minigameGood ? handles.fans : handles.haters),
      text: sub(rng.pick(pool)),
      tone: memory.minigameGood ? 'fan' : 'hater',
    };
  } else if (memory.love >= LOVE_HIGH) {
    specific = { handle: rng.pick(handles.fans), text: sub(rng.pick(LOVE_POSTS.high)), tone: 'fan' };
  } else if (memory.love <= LOVE_LOW) {
    specific = { handle: rng.pick(handles.haters), text: sub(rng.pick(LOVE_POSTS.low)), tone: 'hater' };
  } else {
    specific = { handle: rng.pick(handles.neutrals), text: sub(rng.pick(show.fan)), tone: 'neutral' };
  }

  const tonight: SocialPost = {
    handle: rng.pick(handles.neutrals),
    text: sub(rng.pick(RETURN_POSTS[memory.show])),
    tone: 'neutral',
  };

  // Lead with whichever opinion the night actually earned.
  const opinionOrder = memory.show === 'rough' ? [haterPost, fanPost] : [fanPost, haterPost];
  return [...opinionOrder, specific, tonight];
}
