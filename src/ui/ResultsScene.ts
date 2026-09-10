import Phaser from 'phaser';
import { PALETTE_HEX, W } from '../const';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { getCity } from '../game/content';
import { letterGrade, type PerformanceResult } from '../game/rhythm';
import { addTextScrim, textStyle } from './textStyles';
import { State } from '../core/state';
import { audio } from '../core/audio';
import { bedForCity } from '../game/ambience';
import { hasRealAsset } from '../core/assets';
import { ensureCrowdFigure, ensureRhythmStageBackdrop } from '../art/sprites';
import { addCoverBackground } from '../art/background';

// Addendum v2, Item 7: same 5-member crowd set Rhythm uses, at the run's FINAL mood
// (crowdConnection is already the same 0-100 scale RhythmScene's own live `crowd` value uses —
// see game/rhythm.ts's buildPerformanceResult) — "the show you just played, where you played it."
const CROWD_MEMBER_COUNT = 5;

const GRADE_LABELS: Record<string, string> = {
  perfect: 'A flawless set.', good: 'A warm, solid show.', ok: 'A show with rough edges, still felt.', miss: 'Rough night — and the room stayed anyway.',
};

export class ResultsScene extends Phaser.Scene {
  constructor() { super('Results'); }

  private cityId!: string;
  private result!: PerformanceResult;

  init(data: { cityId: string; result: PerformanceResult }): void {
    this.cityId = data.cityId;
    this.result = data.result;
  }

  create(): void {
    fadeIn(this);
    const city = getCity(this.cityId);
    // Addendum v2, Item 10c: reuse the same stage backdrop Rhythm just showed (real asset with
    // its built-in legibility scrim, or the flat night-rect fallback) — "the show you just
    // played, where you played it," not a plain color card.
    const stageBgKey = ensureRhythmStageBackdrop(this, city.id);
    addCoverBackground(this, stageBgKey);

    // The room after the show still sounds like the song that was just played, a little slower.
    // This scene set no bed at all before, so it kept whatever RhythmScene left running — which,
    // when the show used a real backing track, meant the full track carried on under the results.
    const bed = bedForCity(city.id, State.data.seed, (State.data.cityMemories ?? []).filter((m) => m.firstShowRecorded).map((m) => m.cityId), 0.45);
    audio.playAmbience(bed.chords, bed.bpm, bed.waveform);

    // Letter plate: stamps in from oversized-and-transparent to settled. Presentational only —
    // like everything else on this screen, it never gates the story.
    const letter = letterGrade(this.result.ratio ?? 0);
    const plate = this.add.text(W / 2, 150, letter, textStyle('title', { fontSize: '120px', color: PALETTE_HEX.gold }))
      .setOrigin(0.5).setAlpha(0).setScale(2.2);
    if (State.data.accessibility.reducedMotion) {
      plate.setAlpha(1).setScale(1);
    } else {
      this.tweens.add({ targets: plate, alpha: 1, scale: 1, duration: 420, ease: 'Back.easeOut', delay: 150 });
    }

    // One scrim behind the whole readout. This screen draws straight onto the city's rhythm-stage
    // art — neon signage, stage wash, a lit window — and every line below was authored back when
    // a stale asset manifest meant the flat code-drawn fallback was what actually rendered. Sent
    // in live as an unreadable results screen.
    addTextScrim(this, W / 2, 400, W - 40, 300);

    this.add.text(W / 2, 290, city.name, textStyle('h1')).setOrigin(0.5);
    this.add.text(W / 2, 350, GRADE_LABELS[this.result.grade],
      textStyle('body', { fontSize: '22px', wordWrap: { width: W - 140 }, align: 'center' })).setOrigin(0.5);

    // The breakdown, not just the total. "Why always C?" is unanswerable from a ratio: hitting
    // every note slightly late and missing half the chart can land the same letter, and they need
    // opposite things from the player. Naming the counts turns the score into feedback.
    const jc = this.result.judgementCounts ?? { perfect: 0, good: 0, ok: 0, miss: 0 };
    const landed = jc.perfect + jc.good + jc.ok;
    this.add.text(W / 2, 420, `${landed} of ${landed + jc.miss} notes landed`,
      textStyle('small', { fontSize: '18px' })).setOrigin(0.5);
    this.add.text(W / 2, 452, `Perfect ${jc.perfect}  ·  Good ${jc.good}  ·  Close ${jc.ok}  ·  Missed ${jc.miss}`,
      textStyle('small', { fontSize: '15px', color: PALETTE_HEX.gold })).setOrigin(0.5);
    this.add.text(W / 2, 486, `Timing score: ${this.result.timingScore}  ·  Crowd: ${this.result.crowdConnection}`,
      textStyle('small', { fontSize: '16px' })).setOrigin(0.5);
    // Landing an entire chart without dropping a note is the one performance milestone worth
    // naming outright. The game tracked it in the combo counter and then threw it away at the end,
    // so the achievement rhythm players actually chase left no trace on the results screen.
    // THE RETURN LEG, ON THE RESULTS SCREEN. The town already remembers your first night here and
    // the social feed already uses it — but the one screen where the comparison actually lands,
    // the moment you finish the second show, said nothing about it. Tying the score to the story
    // is what stops a rhythm result being a number and starts it being the second night.
    const memory = (State.data.cityMemories ?? []).find((m) => m.cityId === this.cityId && m.firstShowRecorded);
    if (memory && memory.secondShow) {
      const RANK: Record<string, number> = { rough: 0, solid: 1, triumph: 2 };
      const before = RANK[memory.show] ?? 0, now = RANK[memory.secondShow] ?? 0;
      const line = now > before ? `Better than your first night in ${city.name}.`
        : now < before ? `Not the night you had here the first time.`
        : `About the same room you left behind here.`;
      this.add.text(W / 2, 518, line,
        textStyle('small', { fontSize: '16px', color: PALETTE_HEX.gold, wordWrap: { width: W - 140 }, align: 'center' })).setOrigin(0.5);
    }

    if (landed > 0 && jc.miss === 0) {
      const fc = this.add.text(W / 2, 552, 'FULL COMBO — not one note dropped',
        textStyle('body', { fontSize: '19px', color: PALETTE_HEX.gold })).setOrigin(0.5);
      if (!State.data.accessibility.reducedMotion) {
        this.tweens.add({ targets: fc, scale: { from: 0.86, to: 1 }, duration: 380, ease: 'Back.easeOut', delay: 500 });
      }
    }
    if (this.result.expressionChoices.length > 0) {
      this.add.text(W / 2, 520, `Moments: ${this.result.expressionChoices.map((c) => c.replace(/_/g, ' ')).join(', ')}`,
        textStyle('small', { fontSize: '15px', color: PALETTE_HEX.cream, wordWrap: { width: W - 140 }, align: 'center' })).setOrigin(0.5);
    }

    this.renderCrowdStrip(city.id);

    createButton(this, W / 2 - 150, 700, 300, 64, 'Continue', () => {
      goTo(this, 'City', { cityId: this.cityId, phase: 'afterShow' });
    }, { fillColor: 0x3e7c7b });
  }

  /** "The crowd" strip at the run's final mood — same 5 members Rhythm just showed, same
   *  good/bad art, code-drawn silhouette fallback if this city has no real crowd set. */
  private renderCrowdStrip(cityId: string): void {
    const hasReal = hasRealAsset(`crowd_${cityId}_m1_good`);
    const raisedCount = Math.round((Phaser.Math.Clamp(this.result.crowdConnection, 0, 100) / 100) * CROWD_MEMBER_COUNT);
    const y = 600;
    const span = 260;
    const downKey = ensureCrowdFigure(this, false);
    const upKey = ensureCrowdFigure(this, true);
    for (let i = 0; i < CROWD_MEMBER_COUNT; i++) {
      const x = W / 2 - span / 2 + (span / (CROWD_MEMBER_COUNT - 1)) * i;
      const good = i < raisedCount;
      const key = hasReal ? `crowd_${cityId}_m${i + 1}_${good ? 'good' : 'bad'}` : (good ? upKey : downKey);
      const fig = this.add.image(x, y, key).setOrigin(0.5, 1);
      if (hasReal) fig.setDisplaySize(44, 62); else fig.setDisplaySize(22, 29);
    }
  }
}
