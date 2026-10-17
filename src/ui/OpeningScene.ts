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
import { addTextScrim, textStyle } from './textStyles';
import { saveRun } from '../core/save';
import { openingHook, shotgunFromFlags, shotgunNode, splitFromFlags, splitSheetNode, SPLIT_AFTER } from '../../content/chapters';
import type { DialogueChoice } from '../../content/schema';

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
    // Measured 1.84:1 against the painted backdrop's lit upper third — see
    // e2e/text-legibility.spec.ts. Cream on the flat code-drawn fallback was fine, which is
    // exactly why this survived until the real art started loading.
    addTextScrim(this, W / 2, 70, 440, 66);
    this.add.text(W / 2, 70, 'The night before', textStyle('h1')).setOrigin(0.5);
    this.dialogueBox = new DialogueBox(this);
    this.beatsShown = 0;
    // Narrative upgrades (2026-10-16): a flash-forward on a first tour, last tour's ending after
    // that (content/chapters.ts openingHook), before the four faces.
    this.dialogueBox.show({ id: 'opening_hook', speaker: 'narrator', text: openingHook(State.data.meta) }, () => {
      this.beatsShown++;
      this.showSkipButton();
      this.walk(OPENING_START);
    }, () => {});
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

  /** The intro's two choices: Theo's split sheet (paid off at the end of the first tour) and who
   *  rides shotgun (the first drive opens with them). Skip intro skips the lines, never these.
   *  Each is applied and saved once, so a resumed intro never asks twice. */
  private finish(): void {
    this.skipBtn?.destroy();
    this.skipBtn = null;
    if (!splitFromFlags(State.data.flags)) {
      const node = splitSheetNode(State.data.meta.completedRuns > 0);
      this.dialogueBox.show(node, () => {}, (choice) => {
        this.applyChoice(choice);
        this.dialogueBox.show({ id: 'opening_split_after', speaker: 'narrator', text: SPLIT_AFTER[choice.flags![0]] }, () => this.finish(), () => {});
      });
      return;
    }
    if (!shotgunFromFlags(State.data.flags)) {
      this.dialogueBox.show(shotgunNode(), () => {}, (choice) => { this.applyChoice(choice); this.finish(); });
      return;
    }
    this.closer();
  }

  private applyChoice(choice: DialogueChoice): void {
    for (const f of choice.flags ?? []) State.addFlag(f);
    State.applyRelationshipDeltas(choice.relationshipEffects);
    saveRun(State.data);
  }

  private closer(): void {
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
