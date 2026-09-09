// Stuck-screen-hardening follow-up, Item C: "the night before the tour" — inserted between
// BandCreator's "Hit the road" and RoutePlan. BandCreatorScene.ts's own cast list used to be
// plain text; the 16 painted portraits it never showed are shown here instead, one bandmate at a
// time via the same DialogueBox every dialogue scene already uses. Always plays (the cast is the
// same 4 people every run, but each run's why-tour pick is different, and the closing beat is
// what grounds it), with a "Skip intro" button appearing after the first beat so a returning
// player isn't forced through all 4 again just to reach the why-tour line and RoutePlan.
import Phaser from 'phaser';
import { ensureSceneBackdrop } from '../art/sprites';
import { addCoverBackground } from '../art/background';
import { applyVignette } from '../art/effects';
import { PALETTE, W } from '../const';
import { DialogueBox } from './DialogueBox';
import { goTo, fadeIn } from './transition';
import { createButton } from './Button';
import { State } from '../core/state';
import { OPENING_GRAPH, OPENING_START } from '../../content/opening';
import { textStyle } from './textStyles';

export class OpeningScene extends Phaser.Scene {
  constructor() { super('Opening'); }

  private dialogueBox!: DialogueBox;
  private skipBtn: Phaser.GameObjects.Container | null = null;
  private beatsShown = 0;

  create(): void {
    fadeIn(this);
    // Painted backdrop (pre-public "no barren screens" pass). Falls back to a code-drawn
    // gradient if the asset is missing — ensureSceneBackdrop keeps that seam.
    const bgKey = ensureSceneBackdrop(this, 'opening', PALETTE.plum);
    applyVignette(addCoverBackground(this, bgKey));
    this.add.text(W / 2, 70, 'The night before', textStyle('h1')).setOrigin(0.5);
    this.dialogueBox = new DialogueBox(this);
    this.beatsShown = 0;
    this.walk(OPENING_START);
  }

  private walk(nodeId: string): void {
    const node = OPENING_GRAPH[nodeId];
    this.dialogueBox.show(node, () => {
      this.beatsShown++;
      if (this.beatsShown === 1) this.showSkipButton();
      if (node.next) this.walk(node.next); else this.finish();
    }, () => {});
  }

  private showSkipButton(): void {
    if (this.skipBtn) return;
    this.skipBtn = createButton(this, W - 190, 20, 170, 56, 'Skip intro', () => this.finish(), {
      fillColor: PALETTE.plum, fontSize: '16px',
    });
  }

  private finish(): void {
    this.skipBtn?.destroy();
    this.skipBtn = null;
    // The why-tour pick (BandCreatorScene.ts) was purely decorative outside one flag-gated
    // Lisbon branch before this pass — this is its first grounding beat, echoed again on
    // RoutePlan and in the epilogue (see RoutePlanScene.ts / ScrapbookScene.ts).
    const whyTour = State.data.band.whyTour;
    this.dialogueBox.show(
      { id: 'opening_closer', speaker: 'narrator', text: `The reason, if anyone asked: "${whyTour}"` },
      () => goTo(this, 'RoutePlan'),
      () => {},
    );
  }
}
