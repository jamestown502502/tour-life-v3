// The return leg's social feed: what a town posted after the band's first night there.
//
// Design note (researched against how Spider-Man, Ni No Kuni's Leafbook and Persona 5 use their
// in-game feeds): a feed like this earns its place when it reports the quality of what the player
// actually did, organically, without reading as a tooltip. So every line here is selected by a
// CityMemory — the show's grade, the town's affection, the minigame outcome — and never by a
// random roll alone. The randomness only picks WHICH of several true things gets said.
//
// The second design rule is the "everyone remembers" one: callbacks are mechanically just flags,
// but aesthetically they buy trust. A hater who is specifically wrong, or a fan who noticed the
// one thing you actually did well, both land harder than generic praise.
//
// Tone: this is a cozy game with no fail state. Haters are dismissive, petty or bored — never
// cruel, never about the player's worth. The worst night still produces someone who liked it.

export interface SocialPost {
  handle: string;
  text: string;
  tone: 'fan' | 'hater' | 'neutral';
}

/** Handles are city-flavoured so a feed reads as THAT town talking, not a generic internet. */
export const CITY_HANDLES: Record<string, { fans: string[]; haters: string[]; neutrals: string[] }> = {
  lisbon: {
    fans: ['@tejo_nights', '@bairro_bootlegs', '@fado_and_feedback'],
    haters: ['@alfama_acoustics', '@setlist_snob_pt'],
    neutrals: ['@lisboa_listings', '@whats_on_lx'],
  },
  tokyo: {
    fans: ['@shimokita_live', '@basement_bassline', '@tokyo_smallrooms'],
    haters: ['@precision_only', '@livehouse_ledger'],
    neutrals: ['@setsuya_gigs', '@tokyo_listings'],
  },
  berlin: {
    fans: ['@kreuzberg_kassette', '@spree_static', '@nachtstrom'],
    haters: ['@bpm_polizei', '@berghain_adjacent'],
    neutrals: ['@berlin_gigguide', '@stadt_sounds'],
  },
  mexico_city: {
    fans: ['@callejon_sonoro', '@roma_norte_ruido', '@cdmx_enviva'],
    haters: ['@afinacion_exacta', '@critico_del_foro'],
    neutrals: ['@cartelera_cdmx', '@df_conciertos'],
  },
};

const FALLBACK_HANDLES = {
  fans: ['@front_row_always', '@small_rooms_only'],
  haters: ['@notes_were_flat'],
  neutrals: ['@local_listings'],
};

export function handlesFor(cityId: string) {
  return CITY_HANDLES[cityId] ?? FALLBACK_HANDLES;
}

/** Posts about the SHOW, keyed by how it actually went. `{city}` is substituted at build time. */
export const SHOW_POSTS: Record<'triumph' | 'solid' | 'rough', { fan: string[]; hater: string[] }> = {
  triumph: {
    fan: [
      'still thinking about that show in {city}. the whole room was singing by the end and none of us knew the words an hour earlier.',
      'saw them in {city} on a whim. left having bought everything on the merch table. no notes.',
      'that {city} set had the thing you cannot rehearse. they are coming back and I am going again.',
      'my friend dragged me to {city} to see a band I had never heard of and now I have opinions about their bass tone.',
    ],
    hater: [
      'everyone in {city} is being very dramatic about a band that played a competent forty minutes.',
      'not to be that person but the {city} crowd would have cheered a soundcheck that night.',
    ],
  },
  solid: {
    fan: [
      'solid set in {city}. tight, unpretentious, ended before it outstayed itself. more of this please.',
      'they played {city} like a band that has been in a van together for a while. I mean that nicely.',
      'good night in {city}. the drummer is the whole engine and nobody talks about it.',
    ],
    hater: [
      'the {city} show was fine. that is the review. fine.',
      'watched them in {city}. they will be genuinely good in about a year.',
    ],
  },
  rough: {
    fan: [
      'yes the {city} show fell apart in the middle. yes I would go again. those are unrelated facts.',
      'the mix was a disaster in {city} and they kept going anyway, which is honestly the more interesting story.',
      'saw them have a rough one in {city}. you learn more about a band from that than from a clean night.',
    ],
    hater: [
      'whoever booked {city} owes that room an apology.',
      'the {city} set had four separate moments where I think they lost each other. counted.',
      'in {city} they were loud, which I suppose is a choice.',
    ],
  },
};

/** Posts about the town's affection (localLove) — the slower-burning half of a reputation. */
export const LOVE_POSTS: { high: string[]; low: string[] } = {
  high: [
    'they stayed after the {city} show and talked to everyone who waited. that is the whole thing. that is why people come back.',
    '{city} has adopted them. I do not make the rules.',
  ],
  low: [
    'they loaded out of {city} about nine minutes after the last note. noted.',
    'nice enough set but nobody in {city} could tell you the band\'s name the next morning.',
  ],
};

/** Posts about the city's minigame, so the callback is specific rather than atmospheric. */
export const MINIGAME_POSTS: { good: string[]; rough: string[] } = {
  good: [
    'the {city} load-in was the most organised thing I have seen a touring band do. genuinely impressive. genuinely boring to watch.',
    "their soundcheck in {city} was tighter than most headliners' actual sets.",
    'they handled the {city} press thing better than bands twice their size. someone has media training or very good instincts.',
  ],
  rough: [
    'watched them lose a fight with their own gear in {city} for twenty minutes. compelling television.',
    'the {city} soundcheck went long enough that I got a coffee and came back to the same problem.',
    'the {city} interview was a car crash and I mean that affectionately.',
  ],
};

/** Posts that name the minigame the player ACTUALLY played.
 *
 *  MINIGAME_POSTS above is keyed only on the outcome, so a player who aced Berlin's modular patch
 *  recall could be told the internet was impressed by their load-in. With twelve minigames across
 *  eight types and three generic lines per outcome, the specific thing you did well was the one
 *  thing the feed could not mention. Keyed on the minigame's own title, which CityMemory already
 *  stores (`minigameTitle`) and nothing was reading. Falls back to the generic pool for any title
 *  without bespoke lines, so adding a minigame never leaves a hole. */
export const MINIGAME_POSTS_BY_TITLE: Record<string, { good: string; rough: string }> = {
  'Modular Check': {
    good: 'someone in {city} played an entire modular patch back to their guitarist in order, from memory, and the guitarist made a noise about it. we all heard.',
    rough: 'the modular thing in {city} did not go to plan and honestly that is the most relatable a band has been all year.',
  },
  'Hold the Mix': {
    good: 'whoever rode the desk in {city} did not let it drift once. you can hear that kind of thing even when you cannot name it.',
    rough: 'the mix wandered a bit in {city}. it happens. the songs held it together.',
  },
  'Live on Air': {
    good: 'the {city} radio spot was quick, funny and did not have one dead second in it. put them on again.',
    rough: 'dead air on {city} radio for about four seconds. I have thought about it every day since.',
  },
  'Tune by Ear': {
    good: 'no tuner in {city} and they did it by ear. I checked against my phone afterwards. they were right.',
    rough: 'something was very slightly off in {city} and I could not tell you which string but my teeth knew.',
  },
  'Find the Clave': {
    good: 'somebody taught them clave on a doorframe in {city} and they got it. properly got it. you can hear it in the second half.',
    rough: 'they were counting the clave wrong in {city}, bless them. the percussionist next door was very patient.',
  },
  'Soundcheck': {
    good: 'the {city} level check took one pass. the engineer looked personally offended by how easy it was.',
    rough: 'the {city} soundcheck took three goes and the room heard every one of them.',
  },
  'Pack the Van': {
    good: 'the {city} load-out was a masterclass. everything in, nothing rattling, door shut first time.',
    rough: 'the {city} load-out involved repacking the van twice. I watched all of it.',
  },
  'Load-In': {
    good: 'two flights of stairs in {city} and every cab went up clean. respect where it is due.',
    rough: 'the {city} stairs won. the stairs usually win.',
  },
  'Synth Soundcheck': {
    good: 'the synth check in {city} was done before I had finished queueing at the bar. show-offs.',
    rough: 'they were still chasing a level on the synth in {city} well past doors. we waited. it was fine.',
  },
  'Interview': {
    good: 'the {city} interview was actually good, which for a band this size is genuinely rare. they answered the questions.',
    rough: 'the {city} interview was a car crash and I mean that affectionately.',
  },
  'Radio Call-In': {
    good: 'the {city} call-in segment ran long because it was working. the host let it. good sign.',
    rough: 'the {city} call-in had a couple of long silences. radio is harder than it looks.',
  },
};

/** The closing line of a return-leg feed — anticipation for tonight, coloured by last time. */
export const RETURN_POSTS: Record<'triumph' | 'solid' | 'rough', string[]> = {
  triumph: [
    'they are back in {city} tonight. this one will sell out and I am smug about having gone last time.',
    'round two in {city}. the bar is somewhere near the ceiling.',
  ],
  solid: [
    'back in {city} tonight. curious whether they have grown into it.',
    'second {city} show tonight. last one was good. good is a floor, not a ceiling.',
  ],
  rough: [
    'they are playing {city} again tonight, which takes a certain amount of nerve. respect.',
    'giving them another go in {city} tonight. everyone gets a bad night.',
  ],
};
