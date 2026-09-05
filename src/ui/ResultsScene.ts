import Phaser from 'phaser';
import { PALETTE_HEX, W } from '../const';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { getCity } from '../game/content';
import { letterGrade, type PerformanceResult } from '../game/rhythm';
import { textStyle } from './textStyles';
import { State } from '../core/state';
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

    this.add.text(W / 2, 290, city.name, textStyle('h1')).setOrigin(0.5);
    this.add.text(W / 2, 350, GRADE_LABELS[this.result.grade],
      textStyle('body', { fontSize: '22px', wordWrap: { width: W - 140 }, align: 'center' })).setOrigin(0.5);
    this.add.text(W / 2, 430, `Timing score: ${this.result.timingScore}`, textStyle('small', { fontSize: '18px' })).setOrigin(0.5);
    this.add.text(W / 2, 470, `Crowd connection: ${this.result.crowdConnection}`, textStyle('small', { fontSize: '18px' })).setOrigin(0.5);
    if (this.result.expressionChoices.length > 0) {
      this.add.text(W / 2, 520, `Moments: ${this.result.expressionChoices.map((c) => c.replace(/_/g, ' ')).join(', ')}`,
        textStyle('small', { fontSize: '15px', color: PALETTE_HEX.gold, wordWrap: { width: W - 140 }, align: 'center' })).setOrigin(0.5);
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
