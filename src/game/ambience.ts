// One place that answers "what does this city sound like right now?"
//
// Reported live: "the audio is the same every city and every scenario." Two causes, and only one
// of them was about the notes.
//
// 1. SIX SCENES NEVER SET A BED AT ALL. Only City, Hub, MiniGame, Rhythm and Title ever called
//    playAmbience. Van, Results, Scrapbook, RoutePlan, BandCreator and Opening simply inherited
//    whatever was already playing and let it loop on — so long stretches of a run were literally
//    still playing the previous screen's music, and the Hub played one fixed default no matter
//    which city the bus was heading to. A player crossing four cities heard far fewer than four
//    beds.
// 2. CityScene already derived its bed from the night's actual song. That logic was worth sharing
//    rather than duplicating, so the city's musical identity can follow the player through the
//    whole loop — the bus toward it, the show, the results, the scrapbook that remembers it.
//
// Pure and seeded, like songForVisit itself: a replayed seed reproduces the whole soundtrack.
import { getCity, getSong } from './content';
import { songForVisit, visitIndexFor } from './setlist';
import { parseChordProgression } from '../core/musicTheory';

export interface AmbienceBed {
  chords: number[][];
  bpm: number;
  waveform: OscillatorType;
}

/** The bed for a city, derived from the song that city is actually playing on this visit.
 *  `tempoScale` lets a screen sit at a different energy than the show itself — the city street
 *  hums at half speed, the bus rolls slower still, the results screen sits close to the song. */
export function bedForCity(
  cityId: string,
  seed: string,
  playedCityIds: readonly string[],
  tempoScale = 0.5,
): AmbienceBed {
  const city = getCity(cityId);
  const song = getSong(songForVisit(city, seed, visitIndexFor(cityId, playedCityIds)));
  return {
    chords: parseChordProgression(song.chordProgression),
    bpm: Math.max(40, Math.round(song.bpm * tempoScale)),
    waveform: song.waveform as OscillatorType,
  };
}
