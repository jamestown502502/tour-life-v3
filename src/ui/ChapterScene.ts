// Tour chapters (2026-10-16): the end of the first tour ("The Credits Roll") and of the second
// ("Own the Room"), played between wrapping the tour and the Scrapbook. Same shape as
// OpeningScene: one DialogueBox walking a list of beats, painted backdrop behind. The beats and
// every word of them live in content/chapters.ts; this scene only walks them and records the
// answers that the next tour and the Scrapbook's Two Tours page read back.
//
// Resume: progress stays on 'scrapbook' while a chapter plays, and the Scrapbook sends an unseen
// chapter back here, so a reload mid-chapter replays it rather than skipping it.
import Phaser from 'phaser';
import { ensureSceneBackdrop } from '../art/sprites';
import { addCoverBackground } from '../art/background';
import { applyVignette } from '../art/effects';
import { PALETTE, W } from '../const';
import { DialogueBox } from './DialogueBox';
import { goTo, fadeIn } from './transition';
import { State } from '../core/state';
import { saveRun } from '../core/save';
import { addTextScrim, textStyle } from './textStyles';
import type { DialogueChoice, DialogueNode } from '../../content/schema';
import {
  CHAPTER_TITLES, DEAL_AFTER, LICENSE_AFTER, SETTLE_AFTER, chapterOneBeats, chapterTwoBeats, saleResultText, tourOneSnapshot,
} from '../../content/chapters';

export interface ChapterData { chapter: 1 | 2; endingId: string; tags: string[] }

export class ChapterScene extends Phaser.Scene {
  constructor() { super('Chapter'); }

  private dialogueBox!: DialogueBox;
  private info!: ChapterData;
  private beats: DialogueNode[] = [];

  init(data: ChapterData): void {
    this.info = data;
  }

  create(): void {
    fadeIn(this);
    const bgKey = ensureSceneBackdrop(this, 'scrapbook', PALETTE.plum);
    applyVignette(addCoverBackground(this, bgKey));
    addTextScrim(this, W / 2, 70, 520, 66);
    this.add.text(W / 2, 70, CHAPTER_TITLES[this.info.chapter], textStyle('h1')).setOrigin(0.5);
    this.dialogueBox = new DialogueBox(this);
    const meta = State.data.meta;
    if (this.info.chapter === 1) {
      // A tour finished before chapters existed has no snapshot yet; take it now.
      meta.tourOne ??= tourOneSnapshot(State.data, this.info.endingId);
      this.beats = chapterOneBeats(State.data);
    } else {
      this.beats = chapterTwoBeats(State.data, meta);
    }
    this.step(0);
  }

  private step(i: number): void {
    const node = this.beats[i];
    if (!node) { this.finish(); return; }
    this.dialogueBox.show(node, () => this.step(i + 1), (choice) => {
      const after = this.record(choice);
      this.dialogueBox.show({ id: `${node.id}_after`, speaker: 'narrator', text: after }, () => this.step(i + 1), () => {});
    });
  }

  /** Saves what a choice decided and returns the line that explains it. */
  private record(choice: DialogueChoice): string {
    const meta = State.data.meta;
    const [kind, value] = choice.id.split('_');
    if (kind === 'settle' && meta.tourOne) meta.tourOne.split = value as 'equal' | 'writers';
    if (kind === 'license' && meta.tourOne) meta.tourOne.license = value as 'fits' | 'yes' | 'never';
    if (kind === 'deal') meta.dealChoice = value as 'sign' | 'license' | 'indie';
    saveRun(State.data);
    if (kind === 'settle') return SETTLE_AFTER[choice.id];
    if (kind === 'license') return LICENSE_AFTER[choice.id];
    if (kind === 'deal') return DEAL_AFTER[choice.id];
    return saleResultText(Number(value), State.data);
  }

  private finish(): void {
    const meta = State.data.meta;
    meta.chaptersSeen = [...new Set([...(meta.chaptersSeen ?? []), this.info.chapter])];
    saveRun(State.data);
    goTo(this, 'Scrapbook', { endingId: this.info.endingId, tags: this.info.tags }, { theme: 'pages', label: 'The tour, in pictures' });
  }
}
