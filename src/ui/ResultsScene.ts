import Phaser from 'phaser';
import { PALETTE_HEX, W } from '../const';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { getCity } from '../game/content';
import { letterGrade, type PerformanceResult } from '../game/rhythm';
import { textStyle } from './textStyles';
import { State } from '../core/state';

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
    this.add.rectangle(0, 0, W, this.cameras.main.height, 0x2b3a55, 1).setOrigin(0, 0);
    const city = getCity(this.cityId);

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

    createButton(this, W / 2 - 150, 620, 300, 64, 'Continue', () => {
      goTo(this, 'City', { cityId: this.cityId, phase: 'afterShow' });
    }, { fillColor: 0x3e7c7b });
  }
}
