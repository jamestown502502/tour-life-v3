// Tour chapters (2026-10-16): narrative depth at the three points a player remembers — the night
// before the first tour, the end of the first tour, and the end of the second.
//
// Before this, every tour opened and closed the same way. meta.completedRuns was counted and shown
// on the title screen, and the story never once reacted to it. Run-based games that keep players
// returning carry the story ACROSS runs instead of resetting it (Hades: a persistent narrative
// that moves on with every return), so the two finishes now each earn a chapter, and the second
// tour remembers what the first one decided.
//
// The learning thread follows an indie artist's real path — learn and finish, release cleanly,
// test revenue, professionalize — and its one idea players most often miss: a song and its
// recording are two different copyrights, paid through different routes. The royalty numbers are
// the U.S. statutory split for digital radio (17 U.S.C. 114(g)): 50% to the recording's owner,
// 45% to featured artists, 5% to the AFM & SAG-AFTRA fund for non-featured performers, with the
// artist share paid directly to registered artists (SoundExchange, "Digital performance
// royalties: the basics"). Organisations stay generic in the game ("the royalty office", "a
// label") — no real company is named in play.
//
// House rules, same as content/opening.ts: one beat per line, 40 words or fewer for anything a
// bandmate says at the start or end of a tour, no fail states (every choice changes the story,
// never a score), and Jun and Rowan are "they".
import type { BandmateId, DialogueChoice, DialogueNode } from './schema';
import { BANDMATE_IDS } from './schema';
import type { CodaTier, MetaProgress, RunState, TourOneRecord } from '../src/core/state';
import { codaVariantFor } from './codas';

const label = (endingId: string) => endingId.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

/** Which chapter finishing a tour earns, given the completed count AFTER this finish. */
export function chapterFor(completedRuns: number): 1 | 2 | null {
  if (completedRuns === 1) return 1;
  if (completedRuns === 2) return 2;
  return null;
}

/** The chapter this player is owed right now, if they have not played it yet. */
export function pendingChapter(meta: MetaProgress): 1 | 2 | null {
  const c = chapterFor(meta.completedRuns);
  return c && !(meta.chaptersSeen ?? []).includes(c) ? c : null;
}

export const CHAPTER_TITLES: Record<1 | 2, string> = { 1: 'The Credits Roll', 2: 'Own the Room' };

// ------------------------------------------------------------------ the night before

/** The first line of the intro: a flash-forward on a first tour, last tour's ending after that. */
export function openingHook(meta: MetaProgress): string {
  const last = meta.runHistory[meta.runHistory.length - 1];
  if (meta.completedRuns > 0 && last) {
    const envelope = meta.completedRuns === 1 && meta.tourOne ? ' The label\'s envelope is still in the glovebox.' : '';
    return `Last tour ended as a ${label(last.endingId)}.${envelope} The van remembers. Tonight is the night before the next one.`;
  }
  return 'Four weeks from now: the last show of the tour. A full room, the lights already warm, somebody counting in.\n\nBut first, the night before.';
}

/** Theo's split sheet: the first choice of every tour, and the first lesson. */
export function splitSheetNode(returning: boolean): DialogueNode {
  return {
    id: 'opening_split',
    speaker: 'theo',
    portrait: 'worried',
    text: returning
      ? "Same page as last tour, new songs. Who wrote what this time? I'm not starting a tour on 'we'll sort it out later'."
      : "Before we drive anywhere: who wrote what? My last band split everything 'fair' and nobody wrote down what fair meant. One page. Then we go.",
    choices: [
      { id: 'split_equal', label: 'Four ways, equal. We wrote it in one room.', next: '', flags: ['split_equal'], relationshipEffects: { theo: 3, rowan: 2 } },
      { id: 'split_writers', label: 'Mira and Jun wrote it. Write that down.', next: '', flags: ['split_writers'], relationshipEffects: { mira: 3, jun: 2, rowan: -2 } },
      { id: 'split_skipped', label: "We're friends. Let's just go.", next: '', flags: ['split_skipped'], relationshipEffects: { theo: -3 } },
    ],
  };
}

/** What the page means, said once the choice is made. Keyed by the flag the choice sets. */
export const SPLIT_AFTER: Record<string, string> = {
  split_equal: 'Theo signs first. A song and its recording are two different things, and the page says who owns a share of each. Friendships last longer with paper.',
  split_writers: 'Mira and Jun sign; Rowan reads it twice. Writers own the song. Who played on the recording is a separate question, and the page can say that too.',
  split_skipped: 'Theo folds the blank page into the glovebox anyway. Nothing is broken yet. It just is not written down.',
};

export function shotgunNode(): DialogueNode {
  return {
    id: 'opening_shotgun',
    speaker: 'narrator',
    text: 'The van has one good seat. Who rides shotgun on the first drive?',
    choices: BANDMATE_IDS.map((id): DialogueChoice => ({
      id: `shotgun_${id}`, label: id[0].toUpperCase() + id.slice(1), next: '', flags: [`shotgun_${id}`], relationshipEffects: { [id]: 3 },
    })),
  };
}

/** Said on the first drive, for whoever got the seat. */
export const SHOTGUN_LINES: Record<BandmateId, string> = {
  mira: 'Mira rides shotgun with the setlist on her knee, crossing things out in pen.',
  theo: 'Theo rides shotgun and is asleep before the first toll booth. Nobody wakes him.',
  jun: 'Jun rides shotgun and plays everyone a field recording of the van engine. They are very proud of it.',
  rowan: 'Rowan rides shotgun and picks the music. For once, everybody hears the bass.',
};

export function splitFromFlags(flags: string[]): TourOneRecord['split'] {
  if (flags.includes('split_equal')) return 'equal';
  if (flags.includes('split_writers')) return 'writers';
  if (flags.includes('split_skipped')) return 'skipped';
  return null;
}

export function shotgunFromFlags(flags: string[]): BandmateId | null {
  return BANDMATE_IDS.find((id) => flags.includes(`shotgun_${id}`)) ?? null;
}

// ------------------------------------------------------------------ end of Tour 1

/** Settling the split, when the night before skipped it. */
export const SETTLE_AFTER: Record<string, string> = {
  settle_equal: 'It takes an hour instead of ninety seconds, and Theo is right about why. Written down late still beats never written down.',
  settle_writers: 'Rowan goes quiet, then nods. Writing a song and playing on its recording are different credits, and both of them are real.',
};

export const LICENSE_AFTER: Record<string, string> = {
  license_fits: 'Mira asks to see the ad first. Licensing means you set the terms: where the song goes, for how long, and what it sits next to.',
  license_yes: "The money is real, and so is Mira's quiet afternoon. A license decides the song's company, not just its price.",
  license_never: "Mira writes 'no' and underlines it. Saying no is part of licensing too. The song stays exactly where she wanted it.",
};

/** The end of the first tour: the liner notes, Rowan's royalty statement, Mira's ad, and the
 *  envelope that opens Tour 2. A beat with choices is answered by the scene (src/ui/ChapterScene).
 *  Chapter choices carry no stat or relationship effects: the tour is over and its ending already
 *  decided. They change what the next tour and the Two Tours page remember. */
export function chapterOneBeats(run: RunState): DialogueNode[] {
  const split = splitFromFlags(run.flags);
  const beats: DialogueNode[] = [
    { id: 'c1_open', speaker: 'narrator', text: 'The live record from this tour is going out. Before it does, somebody has to write the liner notes: who wrote it, who played it, who gets credited.' },
  ];
  if (split === 'equal') {
    beats.push({ id: 'c1_split', speaker: 'theo', portrait: 'happy', text: 'Easy. Four names, four equal shares, signed the night before we left. Took us ninety seconds.' });
  } else if (split === 'writers') {
    beats.push({ id: 'c1_split', speaker: 'theo', portrait: 'happy', text: 'Writers: Mira and Jun, signed the night before we left. Players: all four of us. Two lists, both true.' });
  } else {
    beats.push({
      id: 'c1_settle', speaker: 'theo', portrait: 'tense',
      text: 'So. Nobody wrote anything down, and now the liner notes need names.',
      choices: [
        { id: 'settle_equal', label: 'Four equal shares. Write it now.', next: '' },
        { id: 'settle_writers', label: "Writers own the song. Everyone's credited as a player.", next: '' },
      ],
    });
  }
  beats.push(
    { id: 'c1_two_owners', speaker: 'narrator', text: 'A record has two sets of owners: whoever owns the song, and whoever owns the recording. Credits are how anyone finds out which is which.' },
    { id: 'c1_rowan', speaker: 'rowan', portrait: 'inspired', text: 'The royalty statement came. Digital radio played the live record, and it names the band as the featured artist. All four of us. Me included. On paper.' },
    { id: 'c1_royalty_rule', speaker: 'narrator', text: 'U.S. digital radio pays recordings through its own channel: half to whoever owns the recording, 45% to the featured artists, 5% to a fund for session players. The artist share only arrives if you register.' },
  );
  if (run.route.some((s) => s.cityId === 'lisbon')) {
    beats.push({ id: 'c1_ines', speaker: 'rowan', portrait: 'happy', text: 'Inês sang one verse with us in Lisbon. She gets paid too, from the fund for session singers and players. One verse still counts.' });
  }
  beats.push(
    {
      id: 'c1_license', speaker: 'mira', portrait: 'tense',
      text: 'A car company wants our song in an ad. Real money. They need a yes for the song and a yes for the recording. So I need one from you.',
      choices: [
        { id: 'license_fits', label: 'Only if the ad fits the song.', next: '' },
        { id: 'license_yes', label: 'Take it. The van needs tires.', next: '' },
        { id: 'license_never', label: 'Not for ads. Not this song.', next: '' },
      ],
    },
    { id: 'c1_envelope', speaker: 'narrator', text: 'One more thing in the mail: an envelope from a record label. Mira reads the first page, folds it into the glovebox, and says it can wait for the next tour.' },
  );
  return beats;
}

/** What Tour 2 needs from Tour 1, taken when the first tour is wrapped. */
export function tourOneSnapshot(run: RunState, endingId: string): TourOneRecord {
  const tiers = {} as Record<BandmateId, CodaTier>;
  for (const id of BANDMATE_IDS) tiers[id] = codaVariantFor(run.relationships[id] ?? 0);
  return { split: splitFromFlags(run.flags), tiers, endingId };
}

// ------------------------------------------------------------------ end of Tour 2

export const SALE_PRICES = [7, 12, 20] as const;
const SALE_DEMAND: Record<number, number> = { 7: 1, 12: 0.8, 20: 0.45 };
/** The shop's cut plus card fees, rounded to "about a fifth" for the player. */
const SALE_FEE = 0.2;

/** The direct-to-fan night: how many people buy the live record at `price`, given how warmly the
 *  tour's cities took to the band (average local love, 0-100). Shows its working on screen. */
export function directSale(price: number, avgLove: number): { price: number; buyers: number; gross: number; fees: number; net: number } {
  const base = 40 + Math.round(Math.max(0, Math.min(100, avgLove)) / 2);
  const buyers = Math.round(base * (SALE_DEMAND[price] ?? 0.5));
  const gross = buyers * price;
  const fees = Math.round(gross * SALE_FEE);
  return { price, buyers, gross, fees, net: gross - fees };
}

export function avgLoveOf(run: RunState): number {
  const v = Object.values(run.localLove);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 40;
}

export function saleResultText(price: number, run: RunState): string {
  const s = directSale(price, avgLoveOf(run));
  return `${s.buyers} people bought it at $${price}: $${s.gross} in sales. The shop and card fees took about $${s.fees}, so $${s.net} reached the band.\n\nSelling direct keeps most of the money, never all of it, and the price changes how many people say yes.`;
}

export const DEAL_AFTER: Record<string, string> = {
  deal_sign: 'The band signs. The label pays for the studio and owns the recordings it paid for. The songs are still theirs; the masters are not.',
  deal_license: 'The label takes five years instead of forever. When the license ends, the recordings come home. Slower money, longer ownership.',
  deal_indie: 'No advance, and no owner but them. Every sale is theirs to keep, after costs, and every cost is theirs too.',
};

export type Trajectory = 'rose' | 'fell' | 'heldHigh' | 'heldLow';
const RANK: Record<CodaTier, number> = { denied: 0, unresolved: 1, fulfilled: 2 };

export function twoTourTrajectory(first: CodaTier, second: CodaTier): Trajectory {
  if (RANK[second] > RANK[first]) return 'rose';
  if (RANK[second] < RANK[first]) return 'fell';
  return second === 'fulfilled' ? 'heldHigh' : 'heldLow';
}

/** Each of them, looking back over both tours. Jun always finishes the album: finishing is the
 *  first thing an artist has to learn, and the thing they spent two tours not quite doing. */
export const TWO_TOUR_CODAS: Record<BandmateId, Record<Trajectory, string>> = {
  mira: {
    rose: 'Last tour I wanted to be heard. This tour, people came looking for me by name. I did not have to ask. Not once.',
    fell: 'Last tour felt like the start of something for me. This one felt like I gave it away. I will take it back. Watch.',
    heldHigh: 'Two tours, and both times they heard me. I stopped checking whether anyone was listening. That was the real prize.',
    heldLow: 'Two tours, same quiet. But I wrote every night of both of them. Somebody will find that notebook. Maybe me.',
  },
  theo: {
    rose: 'The first tour wrecked me. This one I slept, I said no twice, and my hands were steady every night. Every night.',
    fell: 'I was fine last tour. This one I pushed too hard. I am telling you now, before the shaking starts telling you for me.',
    heldHigh: 'Two tours, rested. I did not know that was allowed in this job. Turns out you just write it into the plan.',
    heldLow: 'Two tours, tired. I am not quitting. I am asking for a week off in writing, so nobody can forget I asked.',
  },
  jun: {
    rose: 'We finished one. A whole album, start to end, and the strange ideas made it on. Do you know how rare finishing is? I have started forty.',
    fell: 'Last tour the strange ideas worked. This tour I played it safe. But we finished the album, and finished counts. The next one gets strange.',
    heldHigh: 'Two tours of new sounds that actually worked live. The album is finished, and it does not sound like anyone else.',
    heldLow: 'Two tours and the rig mostly stayed in its case. But we finished an album. Finishing was always the hard part.',
  },
  rowan: {
    rose: 'First tour, nobody knew my name. This tour a kid at the merch table asked me to sign the bass line. The bass line.',
    fell: 'Last tour I felt seen. This one I disappeared again. I am putting my own name in the next credits, first line.',
    heldHigh: 'Two tours, and my name is on both records. On the statement, in the credits, in the review. I was in the room.',
    heldLow: 'Two tours, still the quiet one. But the royalty statement had my name on it both times. Paper remembers.',
  },
};

const TRAJECTORY_MOOD: Record<Trajectory, string> = { rose: 'inspired', fell: 'worried', heldHigh: 'happy', heldLow: 'tense' };

/** The end of the second tour: the direct-to-fan night, the envelope answered, and each of them
 *  looking back over both tours. The sale's numbers are shown by the scene after the choice. */
export function chapterTwoBeats(run: RunState, meta: MetaProgress): DialogueNode[] {
  const t1 = meta.tourOne;
  const beats: DialogueNode[] = [
    {
      id: 'c2_open', speaker: 'narrator',
      text: t1
        ? 'Second tour done. Before the envelope comes out of the glovebox, there is one more night of selling to do.'
        : 'Second tour done. A label envelope has ridden in the glovebox since the first one. Before it comes out, one more night of selling.',
    },
    {
      id: 'c2_sale', speaker: 'narrator',
      text: 'The last night of the tour: the band sells the live record straight to fans online. What does the download cost?',
      choices: SALE_PRICES.map((p): DialogueChoice => ({ id: `sale_${p}`, label: p === 7 ? '$7: an easy yes' : p === 12 ? "$12: what it's worth" : '$20: for the real fans', next: '' })),
    },
    { id: 'c2_mira_page', speaker: 'mira', portrait: 'tense', text: 'Page four of the envelope: they fund the record, and they own the recordings. Forever. That is the line I circled.' },
    { id: 'c2_theo_page', speaker: 'theo', portrait: 'worried', text: 'Page two: an advance. Money now, paid back out of our share later. I circled it twice.' },
    {
      id: 'c2_deal', speaker: 'narrator', text: 'What does the band do with the envelope?',
      choices: [
        { id: 'deal_sign', label: 'Sign it. A funded record is a real record.', next: '' },
        { id: 'deal_license', label: 'Counter: a five-year license. We keep the recordings.', next: '' },
        { id: 'deal_indie', label: "Hand it back. We'll sell it ourselves.", next: '' },
      ],
    },
  ];
  for (const id of BANDMATE_IDS) {
    const now = codaVariantFor(run.relationships[id] ?? 0);
    const traj = twoTourTrajectory(t1?.tiers[id] ?? now, now);
    beats.push({ id: `coda_${id}`, speaker: id, portrait: TRAJECTORY_MOOD[traj], text: TWO_TOUR_CODAS[id][traj] });
  }
  beats.push({ id: 'c2_close', speaker: 'narrator', text: 'Two tours, one band, all four of them still talking to each other. The van needs new tires. Again.' });
  return beats;
}

/** The "Two Tours" page in the scrapbook: both tours side by side, with the choices that carried. */
export function twoToursSummary(meta: MetaProgress, cityName: (id: string) => string): string {
  const [first, second] = meta.runHistory;
  const line = (n: number, e?: MetaProgress['runHistory'][number]) => e
    ? `Tour ${n}: ${e.bandName || 'The band'}, ${label(e.endingId)}${e.route?.length ? `\n${e.route.map(cityName).join(' → ')}` : ''}`
    : `Tour ${n}: not on record`;
  const t1 = meta.tourOne;
  const split = { equal: 'four equal shares', writers: 'the writers own the song', skipped: 'nothing written down at first' } as const;
  const license = { fits: 'only if the ad fit the song', yes: 'took the ad money', never: 'no ads' } as const;
  const deal = { sign: 'signed with the label', license: 'licensed it for five years', indie: 'stayed independent' } as const;
  const choices = [
    t1?.split ? `The split sheet: ${split[t1.split]}.` : null,
    t1?.license ? `The ad: ${license[t1.license]}.` : null,
    meta.dealChoice ? `The envelope: ${deal[meta.dealChoice]}.` : null,
  ].filter(Boolean);
  return [line(1, first), '', line(2, second), '', ...(choices.length ? ['What carried between them:', ...choices] : [])].join('\n');
}
