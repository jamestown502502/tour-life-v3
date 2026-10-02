// The craft minigames teach the craft (2026-10-02).
//
// The non-hosted "craft" slot is played in every city, and it was the weakest part of the set: a
// soundcheck was a needle and a gold box (four times, in three cities), a load-in accepted any item
// in any slot, and the interviews were "no wrong answer, just flavour" with nothing said about why
// one answer worked better. Each now scores and explains a real skill:
//
//   timing   (Soundcheck)    gain staging: too quiet brings up the noise floor, too hot clips
//   drag     (Load-In)       heavy cases on the floor, light and fragile gear on top
//   choice /
//   pressure (Interviews)    media coaching after every answer: specific beats generic
//   sequence (Modular)       signal flow: oscillator, filter, envelope, amp
//   sustain  (Hold the Mix)  headroom: the window under the clip light
//
// Learning lands best when it is the mechanic rather than a caption on it (Habgood & Ainsworth,
// 2011), and when every answer comes with the reason (Wouters & van Oostendorp, 2013). Pure logic
// only, so MiniGameScene draws it and Vitest checks it.
import type { BandmateId, MiniGameType } from '../../content/schema';

// ---- gain staging (timing) -------------------------------------------------------------------

export type GainVerdict = 'quiet' | 'sweet' | 'clip';

/** Where a tapped needle landed on the meter: left of the gold window, in it, or past it. */
export function gainVerdict(x: number, zoneX: number, zoneW: number): GainVerdict {
  if (x < zoneX) return 'quiet';
  if (x > zoneX + zoneW) return 'clip';
  return 'sweet';
}

export const GAIN_FEEDBACK: Record<GainVerdict, string> = {
  quiet: 'Too quiet. Turn it up later and the hiss comes up with it.',
  sweet: 'In the sweet spot: loud and clean.',
  clip: 'Clipping. Past the top, the signal distorts and cannot be fixed later.',
};

/** What is being level-checked each round, so a soundcheck reads as a soundcheck. */
export const GAIN_CHANNELS: readonly string[] = ['Kick drum', 'Snare', 'Bass DI', 'Vocal mic', 'Keys', 'Guitar amp'];

// ---- weight-aware load-in (drag) -------------------------------------------------------------

export function isHeavy(item: string, heavyItems: readonly string[] | undefined): boolean {
  return (heavyItems ?? []).includes(item);
}

/** A drop is fine unless something heavy went on the top row. */
export function packIssue(item: string, heavyItems: readonly string[] | undefined, onFloor: boolean): string | null {
  return isHeavy(item, heavyItems) && !onFloor ? `${item} up top will crush what is under it.` : null;
}

// ---- signal flow (sequence) ------------------------------------------------------------------

/** The four pads of the modular check, in signal order. */
export const SIGNAL_CHAIN: readonly string[] = ['OSC', 'FILTER', 'ENV', 'AMP'];

// ---- the takeaway each craft type ends on ----------------------------------------------------

export const CRAFT_LESSON: Partial<Record<MiniGameType, string>> = {
  timing: 'Gain staging: set every level as hot as it goes without clipping. Too quiet adds hiss; too loud distorts.',
  drag: 'Load heavy cases first and low. Light, fragile gear rides on top, where nothing can crush it.',
  choice: 'In an interview, a specific story beats a general answer. Give people something to repeat.',
  pressure: 'On live radio, a short concrete answer beats a long careful one. Silence reads as nerves.',
  sequence: 'Signal flow: the oscillator makes sound, the filter shapes it, the envelope moves it, the amp sends it out.',
  sustain: 'Headroom is the space below clipping. Ride the faders in that window and the loud parts stay clean.',
};

// ---- hosts who react and remember ------------------------------------------------------------
//
// A hosted minigame ended on the minigame's own outro, the same whoever hosted it and whatever had
// happened between you before. Now the host answers the result in their own voice, warmer when
// you are close, and remembers the last game they hosted with you this run, so a second money or
// theory game with Rowan follows on from the first. Rule-based dialogue in the Hades / Valve sense
// (Ruskin, GDC 2012): the most specific line the facts allow.

export type Tier = 1 | 2 | 3;
export interface HostedGame { host: BandmateId; title: string; tier: Tier }

const REACTION: Record<BandmateId, Record<Tier, { close: string; other: string }>> = {
  mira: {
    3: { close: 'Mira grabs your hands. "That is exactly how I would have done it. Better, maybe. Do not tell anyone."', other: 'Mira raises an eyebrow, impressed. "Okay. You can stay."' },
    2: { close: 'Mira bumps your shoulder. "Good. Not perfect. Good is what we sing on."', other: 'Mira nods once. "That works."' },
    1: { close: 'Mira laughs it off. "We have both had worse nights. Tonight is not decided yet."', other: 'Mira looks away. "Fine. Let us just get through it."' },
  },
  theo: {
    3: { close: 'Theo leans back. "Nothing for me to fix. Do you know how rare that is? I could nap."', other: 'Theo blinks. "Huh. Clean." From Theo, that is a speech.' },
    2: { close: 'Theo taps the sticks together. "Solid. Solid is the whole job."', other: 'Theo shrugs. "That will hold."' },
    1: { close: 'Theo rubs tired eyes. "Rough. We sleep, we try again. That is the tour."', other: 'Theo says nothing and starts counting the next thing.' },
  },
  jun: {
    3: { close: 'Jun pulls one headphone off. "That was the version I hear in my head. Thank you."', other: 'Jun writes something in the margin of the chart. It looks like a star.' },
    2: { close: 'Jun nods slowly. "Good. Next time, try it weirder."', other: 'Jun gives a small thumbs up without looking up.' },
    1: { close: 'Jun smiles. "Wrong notes are just information. Now we know."', other: 'Jun quietly fixes it and never mentions it.' },
  },
  rowan: {
    3: { close: 'Rowan beams. "You trusted my read and it was right. Nobody does that."', other: 'Rowan looks surprised you asked. "That went well. Really well."' },
    2: { close: 'Rowan grins. "See? We make a decent team, you and me."', other: 'Rowan nods. "Okay. Good."' },
    1: { close: 'Rowan winces, then laughs. "My fault too. I should have said more. Next one is ours."', other: 'Rowan goes quiet, like this is what always happens.' },
  },
};

/** Keyed [prior went well][this went well]. `{prior}` is the earlier game's title. */
const CALLBACK: Record<BandmateId, { gg: string; rg: string; gr: string; rr: string }> = {
  mira: {
    gg: 'Since {prior}, Mira has stopped second-guessing you. It shows.',
    rg: '"Better than {prior}," Mira says. "Much better."',
    gr: '"You were sharper at {prior}," Mira says, not unkindly.',
    rr: '"{prior}, and now this," Mira sighs. "We will laugh about it in a year."',
  },
  theo: {
    gg: '"Two for two, after {prior}," Theo says. "Keep this up and I might actually rest."',
    rg: '"Way better than {prior}," Theo says. "See? Sleep helps."',
    gr: '"You had {prior} down cold," Theo says. "Off night. It happens."',
    rr: '"{prior}, now this," Theo says. "We are both tired. That is all it is."',
  },
  jun: {
    gg: 'Jun ticks a second box on the chart: {prior}, and now this.',
    rg: '"You learned something since {prior}," Jun says. "I can hear it."',
    gr: '"{prior} was cleaner," Jun says. "Do the thing you did there."',
    rr: '"Same slip as {prior}," Jun says gently. "That makes it a habit. Habits change."',
  },
  rowan: {
    gg: '"Like {prior}," Rowan says. "We keep getting this right together."',
    rg: '"We fixed what went wrong at {prior}," Rowan says, quietly proud.',
    gr: '"Not like {prior}," Rowan says. "But I still trust your read."',
    rr: '"{prior}, and now this," Rowan says. "Next time I speak up sooner."',
  },
};

/** The host's answer to this result, and (if they hosted an earlier game this run) a line that
 *  remembers it. `close` is the rapport tier the game opened with. */
export function hostReaction(host: BandmateId, tier: Tier, close: boolean, prior?: HostedGame): { reaction: string; callback: string | null } {
  const reaction = REACTION[host][tier][close ? 'close' : 'other'];
  if (!prior) return { reaction, callback: null };
  const key = `${prior.tier >= 2 ? 'g' : 'r'}${tier >= 2 ? 'g' : 'r'}` as 'gg' | 'rg' | 'gr' | 'rr';
  return { reaction, callback: CALLBACK[host][key].replace(/\{prior\}/g, prior.title) };
}

/** The most recent game this host hosted earlier in the run, if any. */
export function priorHosted(list: readonly HostedGame[] | undefined, host: BandmateId): HostedGame | undefined {
  const mine = (list ?? []).filter((g) => g.host === host);
  return mine[mine.length - 1];
}

// ---- spaced recall on the drive (2026-10-02) ---------------------------------------------------
//
// A lesson met once fades; one met again a city later sticks (retrieval practice: recalling beats
// re-reading, and spacing beats massing). So the van between cities now quizzes ONE skill from a
// minigame played in an earlier city, never the city it is driving to, and each skill only once
// per run. The answer is always explained; a right one is worth a little inspiration. `options[0]`
// is the answer in the data; the van shuffles the display order.

export interface RecallQuestion { type: MiniGameType; asker: BandmateId; q: string; options: [string, string, string]; why: string }

export const RECALL: readonly RecallQuestion[] = [
  { type: 'timing', asker: 'theo', q: 'Quiz from soundcheck. The needle went past the gold. What did that do to the sound?', options: ['It clipped and distorted', 'It got quieter', 'Nothing, it was just loud'], why: GAIN_FEEDBACK.clip },
  { type: 'drag', asker: 'rowan', q: 'Load-in quiz. Where do the amps ride in the van?', options: ['On the floor, in first', 'On top, easy to grab', 'Wherever there is room'], why: CRAFT_LESSON.drag! },
  { type: 'choice', asker: 'mira', q: 'Interview quiz. What makes an answer stick with a listener?', options: ['A specific story', 'A careful general answer', 'Keeping it vague'], why: CRAFT_LESSON.choice! },
  { type: 'pressure', asker: 'mira', q: 'Live radio quiz. The host asks something hard. Best move?', options: ['A short, concrete answer', 'A long pause to think', 'A long, careful answer'], why: CRAFT_LESSON.pressure! },
  { type: 'sequence', asker: 'jun', q: 'Signal-flow quiz. Which module actually makes the sound?', options: ['The oscillator', 'The filter', 'The amp'], why: CRAFT_LESSON.sequence! },
  { type: 'sustain', asker: 'jun', q: 'Mix quiz. What is headroom?', options: ['The space below clipping', 'The top of the fader', 'The quiet before a song'], why: CRAFT_LESSON.sustain! },
  { type: 'interval', asker: 'jun', q: 'Ear quiz. Which interval makes a chord sound sad?', options: ['A minor third', 'A major third', 'A fifth'], why: 'The minor third is three half steps: the reason a minor chord aches.' },
  { type: 'chordquality', asker: 'jun', q: 'Chord quiz. Which kind of chord sounds sad?', options: ['Minor', 'Major', 'Major seventh'], why: 'Minor chords carry the minor third; major chords sound bright.' },
  { type: 'clave', asker: 'rowan', q: 'Clave quiz. How does the 3-2 son clave start?', options: ['Three strokes, then two', 'Two strokes, then three', 'Four even strokes'], why: 'Three strokes then two: the backbone of most of what Mexico City dances to.' },
  { type: 'transpose', asker: 'mira', q: 'Transpose quiz. Move a C chord up a whole step. What is it now?', options: ['D', 'C sharp', 'E'], why: 'A whole step is two half steps, two frets: C to D, same shape.' },
  { type: 'meter', asker: 'theo', q: 'Count-in quiz. ONE two three, ONE two three. What time signature?', options: ['3/4', '4/4', '6/8'], why: 'Three beats, the heavy one first: a waltz, a lullaby, 3/4.' },
  { type: 'tempo', asker: 'theo', q: 'Tempo quiz. You keep landing ahead of the click. Rushing or dragging?', options: ['Rushing', 'Dragging', 'Neither'], why: 'Ahead of the beat is rushing. Relax the shoulders and listen for the heavy beat.' },
  { type: 'split', asker: 'rowan', q: 'Door deal quiz. When does a share of the door beat the guarantee?', options: ['When turnout clears break-even', 'Always, it is a percentage', 'Never'], why: 'Below the break-even turnout the guarantee pays more; above it, the door does.' },
  { type: 'pricing', asker: 'mira', q: 'Merch quiz. What is margin?', options: ['Price minus cost, per sale', 'The price on the tag', 'The shirts left over'], why: 'Margin is what each sale keeps after its cost. Times how many sell, that is profit.' },
  { type: 'perdiem', asker: 'theo', q: 'Per diem quiz. Spend nothing on a bed and you save money. What does it cost you?', options: ['The band mood tomorrow', 'Nothing at all', 'Only time'], why: 'A real bed feeds harmony: nobody fights after sleeping flat. Saving on it is spending tomorrow.' },
  { type: 'gearcall', asker: 'jun', q: 'Gear quiz. Rent at $45 a show or buy at $240. When does buying win?', options: ['From the sixth show', 'From the second show', 'Never'], why: '$240 / $45 is 5.3 shows, so renting costs more from the sixth show on.' },
  { type: 'exchange', asker: 'theo', q: 'Exchange quiz. How do you compare money windows?', options: ['What you keep after the fee', 'The biggest rate', 'The shortest line'], why: 'The fee is part of the rate. Compare what you actually receive.' },
];

export function recallFlag(type: MiniGameType): string {
  return `recall_${type}`;
}

/** Skills that can be quizzed on the drive to `toCityId`: played in another city, not yet quizzed. */
export function recallCandidates(played: readonly { type: MiniGameType; cityId: string }[], toCityId: string, hasFlag: (f: string) => boolean): RecallQuestion[] {
  const types = new Set(played.filter((p) => p.cityId !== toCityId).map((p) => p.type));
  return RECALL.filter((r) => types.has(r.type) && !hasFlag(recallFlag(r.type)));
}
