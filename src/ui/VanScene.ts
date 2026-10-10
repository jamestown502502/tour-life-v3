// The van between cities — a two-beat travel scene on the way into every stop.
//
// Sits between Hub and City. It sets no progress and gates nothing, so an interruption here resumes
// at the Hub exactly as before. The one thing it applies is a past money decision coming back (the
// ledger echo), and that is marked and saved the moment it plays, so a resume never plays it twice.
// That is also why HubScene can route through it safely without touching the resume matrix.
import { spineFor, spineBeatIndex, spineFlag } from '../../content/spines';
import { describeDeltas } from '../game/wildcard';
import Phaser from 'phaser';
import { vanBackdropKey } from '../art/sprites';
import { addCoverBackground } from '../art/background';
import { applyVignette } from '../art/effects';
import { PALETTE, W } from '../const';
import { DialogueBox } from './DialogueBox';
import { goTo, fadeIn } from './transition';
import { State } from '../core/state';
import { audio } from '../core/audio';
import { makeRng } from '../core/rng';
import { textStyle } from './textStyles';
import { getCity } from '../game/content';
import { bedForCity } from '../game/ambience';
import { VAN_BEATS, VAN_CARRY, VAN_OPENERS } from '../../content/van';
import { ledgerEcho, LEDGER_TYPES, type LedgerTier, type LedgerType } from '../game/ledger';
import { saveRun } from '../core/save';
import { CITIES } from '../game/content';
import { minigamePlayedFlag } from '../game/minigame';
import { recallCandidates, recallFlag, pinnedLesson, type RecallQuestion } from '../game/craft';
import type { BandmateId, DialogueChoice } from '../../content/schema';

const BANDMATES: BandmateId[] = ['mira', 'theo', 'jun', 'rowan'];

export class VanScene extends Phaser.Scene {
  constructor() { super('Van'); }

  private cityId!: string;
  private dialogueBox!: DialogueBox;

  init(data: { cityId: string }): void {
    this.cityId = data.cityId;
  }

  /** Whoever the run has moved furthest from where they started. The van belongs to the person
   *  with something going on — which makes this beat reactive to the actual playthrough instead of
   *  a fixed rotation. Ties break by the fixed band order, so it stays deterministic. */
  private focusBandmate(): { id: BandmateId; warm: boolean } {
    let best: BandmateId = BANDMATES[0];
    let bestDelta = -1;
    for (const id of BANDMATES) {
      const delta = Math.abs((State.data.relationships[id] ?? 20) - 20);
      if (delta > bestDelta) { bestDelta = delta; best = id; }
    }
    return { id: best, warm: (State.data.relationships[best] ?? 20) >= 20 };
  }

  create(): void {
    fadeIn(this);
    // One of four painted drives, never the same one twice in a row (see src/game/vanArt.ts).
    // Falls back to the original, and that to a code-drawn gradient, if art is missing.
    const bgKey = vanBackdropKey(this, State.data.seed, State.data.currentCityIndex);
    applyVignette(addCoverBackground(this, bgKey));
    const city = getCity(this.cityId);

    // The van rolls toward a specific city, so it hums that city's song at a travelling tempo.
    // This scene set no bed at all before and simply kept looping whatever the previous screen
    // had started.
    const vanBed = bedForCity(city.id, State.data.seed, (State.data.cityMemories ?? []).filter((m) => m.firstShowRecorded).map((m) => m.cityId), 0.30);
    audio.playAmbience(vanBed.chords, vanBed.bpm, vanBed.waveform);
    this.add.text(W / 2, 70, `On the way to ${city.name}`, textStyle('h1')).setOrigin(0.5);

    this.dialogueBox = new DialogueBox(this);
    // Seeded on the destination so a replayed seed gets the same drive, like everything else.
    const rng = makeRng(`${State.data.seed}:van:${this.cityId}`);
    const focus = this.focusBandmate();
    const beat = VAN_BEATS[focus.id];

    const toCity = (): void => goTo(this, 'City', { cityId: this.cityId }, { theme: 'ticket', label: getCity(this.cityId).name });
    const playBandmateBeat = (): void => {
      this.dialogueBox.show(
        { id: 'van_beat', speaker: focus.id, text: focus.warm ? beat.warm : beat.cool },
        toCity,
        () => {},
      );
    };
    // The tour's reason (content/spines.ts, QA round 4 depth pass): its stake on the first drive,
    // then one choice about it on each drive after.
    const afterSpine = playBandmateBeat;
    const spineStep = this.spineBeat(afterSpine);
    // The carry line: what the LAST city's show actually did to this van. Without it a triumph and
    // a disaster produced the identical drive, and the tour read as a list of separate cities
    // rather than one trip. Only shown when there IS a previous stop with a real show behind it.
    const carry = this.carryBeat(rng);
    // Then a money decision from an earlier city comes back (see ledgerEchoBeat).
    const echo = this.ledgerEchoBeat(rng);
    // Then one skill from an earlier city, quizzed (spaced recall; see recallBeat).
    const recall = this.recallQuestion(rng);
    const afterEcho = recall ? (): void => this.recallBeat(recall, rng, spineStep) : spineStep;
    const afterCarry = echo
      ? (): void => this.dialogueBox.show({ id: 'van_ledger_echo', speaker: 'narrator', text: echo }, afterEcho, () => {})
      : afterEcho;
    const afterOpener = carry
      ? (): void => this.dialogueBox.show({ id: 'van_carry', speaker: 'narrator', text: carry }, afterCarry, () => {})
      : afterCarry;

    this.dialogueBox.show(
      { id: 'van_open', speaker: 'narrator', text: rng.pick(VAN_OPENERS) },
      afterOpener,
      () => {},
    );
  }

  /** The oldest money decision from an earlier city that has not come back yet: a line of story and
   *  a small stat effect (src/game/ledger.ts ledgerEcho). Applied and marked at once, and saved, so
   *  an interrupted drive that resumes at the Hub does not play it a second time. */
  private ledgerEchoBeat(rng: ReturnType<typeof makeRng>): string | null {
    const entry = (State.data.ledger ?? []).find((e) => !e.echoed && e.cityId !== this.cityId && LEDGER_TYPES.includes(e.type as LedgerType));
    if (!entry) return null;
    const tier: LedgerTier = entry.tier === 'rough' || entry.tier === 'perfect' ? entry.tier : 'good';
    const echo = ledgerEcho(entry.type as LedgerType, tier, getCity(entry.cityId).name, (lines) => rng.pick(lines));
    entry.echoed = true;
    State.applyStatDeltas(echo.effects);
    saveRun(State.data);
    const fx = Object.entries(echo.effects).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(', ');
    return `${echo.text}\n\nThe ledger remembers: ${fx}.`;
  }

  /** Which route stop this drive is heading to (0 = the first city). */
  private stopIndex(): number {
    const route = State.data.route;
    const i = State.data.currentCityIndex;
    return route[i]?.cityId === this.cityId ? i : route.findIndex((st) => st.cityId === this.cityId);
  }

  /** The spine's moment on this drive: the stake (and last tour's note to self) on the first one,
   *  a choice on the next three. Each choice is applied and saved once, so a resumed drive never
   *  asks again. Returns the step to run; it calls `then` when done. */
  private spineBeat(then: () => void): () => void {
    const spine = spineFor(State.data.band.whyTour);
    const stop = this.stopIndex();
    if (stop === 0) {
      const lines = [`Why this tour: ${spine.stake}`];
      const note = pinnedLesson(State.data.meta);
      if (note) lines.push(`Inside the cover of the tour notebook, from last time: "${note}"`);
      return () => this.dialogueBox.show({ id: 'van_spine_stake', speaker: 'narrator', text: lines.join('\n\n') }, then, () => {});
    }
    const b = spineBeatIndex(stop);
    if (b < 0 || [0, 1].some((c) => State.hasFlag(spineFlag(spine.id, b, c)))) return then;
    const beat = spine.beats[b];
    return () => {
      const choices: DialogueChoice[] = beat.choices.map((c, i) => ({ id: `spine_${i}`, label: c.label, next: String(i) }));
      this.dialogueBox.show({ id: 'van_spine', speaker: beat.speaker, text: beat.text, choices }, () => {}, (choice) => {
        const i = Number(choice.next);
        const c = beat.choices[i];
        State.addFlag(spineFlag(spine.id, b, i));
        State.applyStatDeltas(c.effects);
        State.applyRelationshipDeltas(c.relationships);
        saveRun(State.data);
        const fx = describeDeltas(c.effects);
        this.dialogueBox.show({ id: 'van_spine_after', speaker: 'narrator', text: `${c.after}${fx ? `\n\n${fx}.` : ''}` }, then, () => {});
      });
    };
  }

  /** A skill from a minigame played in another city and not yet quizzed this run, or null. */
  private recallQuestion(rng: ReturnType<typeof makeRng>): RecallQuestion | null {
    const played = CITIES.flatMap((c) => (c.minigames ?? [])
      .filter((m) => State.hasFlag(minigamePlayedFlag(m.id)))
      .map((m) => ({ type: m.type, cityId: c.id })));
    const pool = recallCandidates(played, this.cityId, (f) => State.hasFlag(f));
    return pool.length ? rng.pick(pool) : null;
  }

  /** Spaced recall (2026-10-02): a bandmate quizzes one earlier skill. Marked and saved the moment
   *  it is answered, so a resumed drive never asks it twice; a right answer is +1 inspiration. */
  private recallBeat(r: RecallQuestion, rng: ReturnType<typeof makeRng>, then: () => void): void {
    const choices: DialogueChoice[] = rng.shuffle(r.options.map((label, i) => ({ id: `recall_${i}`, label, next: i === 0 ? 'right' : 'wrong' })));
    this.dialogueBox.show({ id: 'van_recall', speaker: r.asker, text: r.q, choices }, () => {}, (choice) => {
      const right = choice.next === 'right';
      State.addFlag(recallFlag(r.type));
      if (right) State.applyStatDeltas({ inspiration: 1 });
      saveRun(State.data);
      audio.playSfx(right ? 'perfect' : 'ok');
      const text = `${right ? 'Right.' : `It is: ${r.options[0]}.`} ${r.why}${right ? '\n\nInspiration +1.' : ''}`;
      this.dialogueBox.show({ id: 'van_recall_answer', speaker: r.asker, text }, then, () => {});
    });
  }

  /** The previous stop's show, phrased for the drive. Null on the very first leg (nothing to carry
   *  yet) or if that city somehow has no recorded show. */
  private carryBeat(rng: ReturnType<typeof makeRng>): string | null {
    const route = State.data.route;
    const here = route.findIndex((s) => s.cityId === this.cityId);
    const previous = here > 0 ? route[here - 1] : undefined;
    if (!previous) return null;
    const memory = (State.data.cityMemories ?? []).find(
      (m) => m.cityId === previous.cityId && m.firstShowRecorded,
    );
    if (!memory) return null;
    const outcome = memory.secondShow ?? memory.show;
    return rng.pick(VAN_CARRY[outcome]).replace('{city}', getCity(previous.cityId).name);
  }
}
