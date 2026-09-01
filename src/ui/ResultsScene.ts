import Phaser from 'phaser';
import { PALETTE_HEX, W } from '../const';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { getCity } from '../game/content';
import type { PerformanceResult } from '../game/rhythm';

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

    this.add.text(W / 2, 220, city.name, { fontFamily: 'Georgia, serif', fontSize: '30px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.add.text(W / 2, 280, GRADE_LABELS[this.result.grade], {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: PALETTE_HEX.cream, wordWrap: { width: W - 140 }, align: 'center',
    }).setOrigin(0.5);
    this.add.text(W / 2, 360, `Timing score: ${this.result.timingScore}`, { fontFamily: 'Georgia, serif', fontSize: '18px', color: PALETTE_HEX.sky }).setOrigin(0.5);
    this.add.text(W / 2, 400, `Crowd connection: ${this.result.crowdConnection}`, { fontFamily: 'Georgia, serif', fontSize: '18px', color: PALETTE_HEX.sky }).setOrigin(0.5);
    if (this.result.expressionChoices.length > 0) {
      this.add.text(W / 2, 450, `Moments: ${this.result.expressionChoices.map((c) => c.replace(/_/g, ' ')).join(', ')}`, {
        fontFamily: 'Georgia, serif', fontSize: '15px', color: PALETTE_HEX.gold, wordWrap: { width: W - 140 }, align: 'center',
      }).setOrigin(0.5);
    }

    createButton(this, W / 2 - 150, 550, 300, 56, 'Continue', () => {
      goTo(this, 'City', { cityId: this.cityId, phase: 'afterShow' });
    }, { fillColor: 0x3e7c7b });
  }
}
