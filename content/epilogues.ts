// Close-out item 7: a written payoff for the ending scorecard, without touching the deferred
// Part 3 reality layer. Keyed by "<endingId>::<tags sorted, joined by ,>" so a run's exact
// ending+tag-set gets bespoke prose; GENERIC_EPILOGUES is the per-ending fallback for any tag
// combination not written here (today that's only the route.length>=6 "Ambitious" bonus tag,
// which HANDOFF.md §7.3 already notes is unreachable until a 5th+ city ships — so every
// currently-reachable combination has real prose, and the fallback exists for when it isn't).

function key(endingId: string, tags: string[]): string {
  return `${endingId}::${[...tags].sort().join(',')}`;
}

const EPILOGUES: Record<string, string> = {
  [key('found_family_tour', ['Tender', 'Community-Minded'])]:
    "Two months later, the band's group chat is somehow busier than it ever was on tour — a running joke about a döner stand, a photo of Rowan's new bass strap, Theo asleep on someone's couch mid-afternoon. Nobody's talked about breaking up, not once. If anything, the opposite: a shared spreadsheet has appeared, unprompted, titled \"next one?\" Mira jokes that touring together was basically an elaborate, expensive way of becoming family, and nobody laughs it off. The venues get remembered less clearly than the 3am conversations in parking lots did. That, it turns out, was always the actual tour.",

  [key('beloved_small_tour', ['Tender', 'Community-Minded'])]:
    "Two months later, a stranger recognizes Mira in a coffee shop three cities from anywhere the band actually played — someone had sent a friend a phone-shaky video from a fado house, and it had traveled further than the band themselves ever did. The numbers never got big. A regional write-up called them \"a band worth driving two hours for,\" and the band printed it out and taped it inside the van, which still runs, barely. Nobody's rich. Rowan's still doing merch math on a napkin most nights. But every venue that had them once has already asked when they're coming back, and that, more than any chart position, is what they actually wanted.",

  [key('breakout_circuit', ['Electric', 'Ambitious'])]:
    "Two months later, an agent who never once returned an email now calls on a Tuesday afternoon, casual, like this was always going to happen. The band says yes to almost everything — a festival slot, a sync-licensing offer, a bigger van with a working AC unit for the first time in the group's collective memory. Jun is already sketching what the next record sounds like at a scale none of them have tried before. It's fast, and a little disorienting, and exactly what they came for. Somewhere in the scramble, somebody remembers to actually celebrate — briefly, before the next email comes in.",

  [key('breakout_circuit', ['Electric', 'Ambitious', 'Community-Minded'])]:
    "Two months later, the offers start coming in faster than the band can answer them, and the surprise isn't the momentum — it's how many of the people extending a hand are ones they met on the road: a soundcheck stranger now booking a real festival, a bartender who turned out to run a label's regional scouting. The break, when it finally arrives, doesn't feel like it came from nowhere. It feels earned by every green room and every stranger's couch along the way. The band takes the bigger stage and still remembers everyone's name from the smaller ones.",

  [key('live_album', ['Electric', 'Ambitious'])]:
    "Two months later, the recordings from that one electric night finally get mixed, and everyone in the room agrees: you can hear it, whatever it was — the room, the risk, the version of the song none of them had ever played quite that way before or since. It becomes the record the band is proudest of, not because it's polished, but because it isn't. Jun refuses to fix a single mistake in the mix. \"That's the take,\" they keep saying. \"That's the actual take.\" It ships with the room noise still in it, on purpose.",

  [key('live_album', ['Electric', 'Ambitious', 'Community-Minded'])]:
    "Two months later, the live recording ships with the crowd noise left all the way up — you can hear someone off-mic singing a lyric wrong and meaning it completely. That, everyone agrees afterward, is the whole record in one moment: not the band alone, but the band and every room that showed up for them, captured accidentally and kept on purpose. Jun mixes it that way over an engineer's mild objections. Nobody regrets it. The liner notes end up longer than the actual song list, thanking people by name.",

  [key('next_chapter', ['Restless', 'Ambitious'])]:
    "Two months later, the band is already somewhere else, and nobody's surprised. The tour didn't end so much as tip forward into whatever comes next — a new city, a new set of songs half-written on a bus that still smells like the last one. Theo, of everyone, is the one pushing hardest to keep moving; the version of him that needed nine flat minutes of sleep in Lisbon feels like a different person now. Nobody's tired yet. Ask again in six months.",

  [key('next_chapter', ['Restless', 'Ambitious', 'Community-Minded'])]:
    "Two months later, the band is on the road again already, and this time half the crew are people they picked up along the way — a drummer's friend who wouldn't stop showing up to soundcheck, a driver who used to just be a fan. The restlessness never really left. It just found more people willing to be restless alongside them. Somebody jokes the band is basically a small, slow-moving city now. Nobody argues with it.",

  [key('quiet_ending', ['Weathered', 'Tender'])]:
    "Two months later, the band takes a while to answer texts, and that's alright. The tour asked more of everyone than any of them said out loud at the time, and the quiet afterward isn't sad, exactly — just necessary, the kind of rest that has to be earned first. Mira writes in a notebook nobody else reads yet. Theo actually sleeps. Nothing about this ending gets triumphant, and the band seems, gently, at peace with that. Some tours are for finding out what you're made of. This one mostly just found out what was left.",

  [key('quiet_ending', ['Weathered', 'Tender', 'Community-Minded'])]:
    "Two months later, the band is quiet, but not alone in it — a few of the people they met along the way check in more than family does, unprompted, just to ask how everyone's actually doing. The tour cost something real, and everyone knows it, but it didn't cost the closeness. If anything that's the only thing that came through fully intact. Nobody's rushing back into anything. There's no version of \"next tour\" discussed yet, and for once, that's completely fine.",
};

/** Shorter, honest fallback per ending — used for any tag combination not written above (today
 *  that's only the currently-unreachable route.length>=6 "Ambitious" bonus). Never blank. */
const GENERIC_EPILOGUES: Record<string, string> = {
  found_family_tour: "Two months later, the band is still in touch daily — not out of obligation, just habit now. Whatever this tour was, it left them closer than it found them.",
  beloved_small_tour: "Two months later, word is still spreading slowly, city by city, the way it always has for this band. Nobody's famous. Everyone who saw them remembers exactly why.",
  breakout_circuit: "Two months later, the phone hasn't stopped ringing since the tour ended. Whatever door this opened, the band is walking through it fast, still slightly stunned it opened at all.",
  live_album: "Two months later, that one electric night is still getting mixed into something permanent — proof, if anyone needed it, that the risk was worth taking.",
  next_chapter: "Two months later, the band is already somewhere new, chasing whatever comes after this. The tour didn't feel like an ending. It felt like a running start.",
  quiet_ending: "Two months later, the band is still catching their breath. This one cost something real. They're only starting to understand what.",
};

const UNIVERSAL_FALLBACK = 'Two months later, the tour is over, and the band is somewhere new — carrying it with them, one way or another.';

export function getEpilogue(endingId: string, tags: string[]): string {
  return EPILOGUES[key(endingId, tags)] ?? GENERIC_EPILOGUES[endingId] ?? UNIVERSAL_FALLBACK;
}
