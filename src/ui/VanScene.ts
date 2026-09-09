// The van between cities — a two-beat travel scene on the way into every stop.
//
// Sits between Hub and City. Deliberately weightless: it sets no progress, applies no effects and
// gates nothing, so an interruption here resumes at the Hub exactly as before and the only cost of
// skipping it is missing a small moment. That is also why HubScene can route through it safely
// without touching the resume matrix.
import Phaser from 'phaser';
import { ensureSceneBackdrop } from '../art/sprites';
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
import { VAN_BEATS, VAN_OPENERS } from '../../content/van';
import type { BandmateId } from '../../content/schema';

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
    // Painted backdrop (pre-public "no barren screens" pass). Falls back to a code-drawn
    // gradient if the asset is missing — ensureSceneBackdrop keeps that seam.
    const bgKey = ensureSceneBackdrop(this, 'van', PALETTE.sky);
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

    const toCity = (): void => goTo(this, 'City', { cityId: this.cityId });
    this.dialogueBox.show(
      { id: 'van_open', speaker: 'narrator', text: rng.pick(VAN_OPENERS) },
      () => this.dialogueBox.show(
        { id: 'van_beat', speaker: focus.id, text: focus.warm ? beat.warm : beat.cool },
        toCity,
        () => {},
      ),
      () => {},
    );
  }
}
