// One shared scene for every minigame `type`. Content-driven (MiniGameDef in content JSON),
// touch-first, and — like the rhythm minigame — structurally NO-FAIL: every path (a clean run,
// a total whiff, or simply not touching anything until a safety timer fires) reaches an outro
// and a reward. Nothing here can leave the player stuck or produce a worse outcome than "rough
// but fine, still counts."
import Phaser from 'phaser';
import { H, PALETTE, PALETTE_HEX, SAFE_BOTTOM_Y, W } from '../const';
import { ensureMiniGameBackdrop, ensureRoundedRect } from '../art/sprites';
import { addCoverBackground } from '../art/background';
import { applyVignette } from '../art/effects';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { State } from '../core/state';
import { audio } from '../core/audio';
import { parseChordProgression } from '../core/musicTheory';
import { saveRun } from '../core/save';
import { getCity } from '../game/content';
import { addTextScrim, textStyle } from './textStyles';
import { addHelpButton } from './HelpButton';
import { addMenuButton } from './MenuButton';
import type { MiniGameDef, MiniGameQuestion, MiniGameReward } from '../../content/schema';
import { minigamePlayedFlag, timingRoundsForHarmony } from '../game/minigame';
import { makeRng } from '../core/rng';

const HELP_TEXT: Record<MiniGameDef['type'], string> = {
  timing: 'Tap the button when the needle is inside the gold zone. A few rounds, no penalty for missing.',
  drag: 'Drag each item into any open slot before the timer runs out.',
  choice: 'Pick whichever answer feels right — there\'s no wrong one, just different flavor.',
};

export class MiniGameScene extends Phaser.Scene {
  constructor() { super('MiniGame'); }

  private cityId!: string;
  private mg!: MiniGameDef;
  private returnPhase!: string;
  private outcomeGood = false;
  private contentLayer!: Phaser.GameObjects.Container;
  // timing
  private timingRound = 0;
  private timingHits = 0;
  private needle: Phaser.GameObjects.Arc | null = null;
  private needleTween: Phaser.Tweens.Tween | null = null;
  // choice
  private questionIndex = 0;
  private warmerCount = 0;
  // Item 5c (close-out "unique playthroughs" pass): per-run variance seeded off State.data.seed
  // rather than Phaser's own unseeded Math.random, so a replayed seed reproduces the same
  // round count / item order / question order every time, same as everything else the run
  // generator seeds. Computed once in init(), consumed by the run* methods below instead of
  // reading this.mg.dragItems/questions/timingRoundsSec directly.
  private timingRoundsSec: number[] = [];
  private dragItemsOrder: string[] = [];
  private questionsOrder: MiniGameQuestion[] = [];

  init(data: { cityId: string; minigameId: string; returnPhase: string }): void {
    this.cityId = data.cityId;
    this.returnPhase = data.returnPhase;
    const city = getCity(this.cityId);
    const found = (city.minigames ?? []).find((m) => m.id === data.minigameId);
    if (!found) throw new Error(`[minigame] "${data.minigameId}" not found on city "${this.cityId}"`);
    this.mg = found;
    this.outcomeGood = false;
    this.timingRound = 0;
    this.timingHits = 0;
    this.needle = null;
    this.needleTween = null;
    this.questionIndex = 0;
    this.warmerCount = 0;

    const rng = makeRng(`${State.data.seed}:minigame:${this.mg.id}`);
    this.timingRoundsSec = timingRoundsForHarmony(this.mg.timingRoundsSec ?? [2.2, 1.7, 1.3], State.data.stats.harmony);
    this.dragItemsOrder = rng.shuffle(this.mg.dragItems ?? ['Amps', 'Cables', 'Merch box', 'Pedalboard', 'Suitcase', 'Snacks']);
    this.questionsOrder = rng.shuffle(this.mg.questions ?? []);
  }

  create(): void {
    fadeIn(this);
    const tint = PALETTE.terracotta;
    const bgKey = ensureMiniGameBackdrop(this, this.mg.id, tint);
    const bg = addCoverBackground(this, bgKey);
    applyVignette(bg, 0.35);

    addTextScrim(this, W / 2, 60, 420, 66);
    // h1's default gold measures 2.77:1 on this scrim (just under the 3:1 large-text floor) —
    // cream reliably clears it (5.28:1), see docs/contrast-audit.md.
    this.add.text(W / 2, 60, this.mg.title, textStyle('h1', { color: PALETTE_HEX.cream })).setOrigin(0.5);
    addHelpButton(this, HELP_TEXT[this.mg.type]);
    addMenuButton(this, 'MiniGame');

    this.contentLayer = this.add.container(0, 0);
    this.showIntro();
  }

  private clearContent(): void {
    this.contentLayer.removeAll(true);
  }

  private card(y: number, h: number): Phaser.GameObjects.Image {
    const w = W - 80;
    const key = ensureRoundedRect(this, w, h, 22);
    const img = this.add.image(40, y, key).setOrigin(0, 0).setTint(PALETTE.sand).setAlpha(0.97);
    this.contentLayer.add(img);
    return img;
  }

  private showIntro(): void {
    this.clearContent();
    this.card(300, 260);
    this.contentLayer.add(this.add.text(W / 2, 330, this.mg.introText, textStyle('dialogue', {
      fontSize: '24px', wordWrap: { width: W - 140 }, align: 'center', lineSpacing: 6,
    })).setOrigin(0.5, 0));
    this.contentLayer.add(createButton(this, W / 2 - 130, 500, 260, 66, 'Start', () => this.beginGame(), { fillColor: 0x3e7c7b }));
  }

  private beginGame(): void {
    this.clearContent();
    // Each minigame can carry its own music bed (content/schema.ts MiniGameDef). Without one a
    // minigame just keeps playing the city's ambience — which is what every minigame did before,
    // and is still the fallback for any entry that omits these fields. Started here rather than
    // in create() so the intro card stays under the city's bed and the switch lands with the
    // first round. The city's own ambience is restored on the way out by CityScene.create(),
    // which calls playAmbience unconditionally when the return transition lands.
    if (this.mg.chordProgression && this.mg.bpm) {
      audio.playAmbience(parseChordProgression(this.mg.chordProgression), this.mg.bpm, this.mg.waveform ?? 'triangle');
    }
    if (this.mg.type === 'timing') this.runTimingRound();
    else if (this.mg.type === 'drag') this.runDrag();
    else this.runChoiceQuestion();
  }

  // ---- timing: a needle sweeps a gauge; tap while it's in the gold zone. ----
  private runTimingRound(): void {
    const rounds = this.timingRoundsSec;
    if (this.timingRound >= rounds.length) { this.finish(this.timingHits >= Math.ceil(rounds.length / 2)); return; }
    this.clearContent();

    const barX = 90, barW = W - 180, barY = 420, barH = 28;
    const zoneW = 140;
    const zoneX = barX + (barW - zoneW) / 2;
    this.contentLayer.add(this.add.rectangle(barX, barY, barW, barH, 0x000000, 0.3).setOrigin(0, 0));
    this.contentLayer.add(this.add.rectangle(zoneX, barY, zoneW, barH, PALETTE.gold, 0.55).setOrigin(0, 0));
    this.contentLayer.add(addTextScrim(this, W / 2, barY - 40, 320, 48));
    // h2's default sky measures 2.90:1 on this scrim (just under the 3:1 large-text floor).
    this.contentLayer.add(this.add.text(W / 2, barY - 40, `Round ${this.timingRound + 1} of ${rounds.length}`,
      textStyle('h2', { color: PALETTE_HEX.cream })).setOrigin(0.5));

    this.needle = this.add.circle(barX, barY + barH / 2, 14, PALETTE.cream, 1);
    this.contentLayer.add(this.needle);
    const sweepMs = rounds[this.timingRound] * 1000;
    this.needleTween = this.tweens.add({
      targets: this.needle, x: barX + barW, duration: sweepMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    let resolved = false;
    const resolve = (hit: boolean) => {
      if (resolved) return;
      resolved = true;
      this.needleTween?.stop();
      audio.playSfx(hit ? 'perfect' : 'ok');
      if (hit) this.timingHits++;
      this.timingRound++;
      this.time.delayedCall(400, () => this.runTimingRound());
    };
    // Safety timeout: a player who never taps still advances — no-fail is structural, not just a design intent.
    this.time.delayedCall(sweepMs * 3, () => resolve(false));

    const btn = createButton(this, W / 2 - 130, 560, 260, 70, 'Tap!', () => {
      const x = this.needle!.x;
      resolve(x >= zoneX && x <= zoneX + zoneW);
    }, { fillColor: PALETTE.terracotta, fontSize: '22px' });
    this.contentLayer.add(btn);
  }

  // ---- drag: place every item into an open slot before the timer runs out. ----
  private runDrag(): void {
    this.clearContent();
    const items = this.dragItemsOrder;
    const timeSec = this.mg.dragTimeSec ?? 30;
    const cols = 3;
    const chipW = 190, chipH = 60, slotW = 190, slotH = 60;
    const startX = (W - (cols * (chipW + 14) - 14)) / 2;

    const slots: { rect: Phaser.GameObjects.Rectangle; filled: boolean }[] = [];
    items.forEach((_, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = startX + col * (slotW + 14), y = 700 + row * (slotH + 16);
      const slot = this.add.rectangle(x, y, slotW, slotH, 0x000000, 0.25).setOrigin(0, 0);
      slot.setStrokeStyle(2, PALETTE.gold, 0.6);
      this.contentLayer.add(slot);
      slots.push({ rect: slot, filled: false });
    });

    let placedCount = 0;
    this.contentLayer.add(addTextScrim(this, W / 2, 500, 340, 90));
    // Both default to gold/sky, which measure 2.77:1 / 2.90:1 on this scrim (just under 3:1) —
    // cream reliably clears it, see docs/contrast-audit.md.
    const timerText = this.add.text(W / 2, 480, `${timeSec}s`, textStyle('h1', { fontSize: '26px', color: PALETTE_HEX.cream })).setOrigin(0.5);
    this.contentLayer.add(timerText);
    this.contentLayer.add(this.add.text(W / 2, 520, 'Drag each item into an open slot', textStyle('small', { fontSize: '15px', color: PALETTE_HEX.cream })).setOrigin(0.5));

    let secondsLeft = timeSec;
    let finished = false;
    const finishOnce = () => {
      if (finished) return;
      finished = true;
      timerEvent.destroy();
      this.finish(placedCount >= items.length);
    };
    const timerEvent = this.time.addEvent({
      delay: 1000, loop: true,
      callback: () => {
        secondsLeft--;
        timerText.setText(`${Math.max(0, secondsLeft)}s`);
        if (secondsLeft <= 0) this.time.delayedCall(300, finishOnce);
      },
    });

    items.forEach((label, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const startPosX = startX + col * (chipW + 14), startPosY = 570 + row * (chipH + 10);
      const key = ensureRoundedRect(this, chipW, chipH, 12);
      const chip = this.add.image(startPosX, startPosY, key).setOrigin(0, 0).setTint(PALETTE.terracotta).setInteractive({ draggable: true, useHandCursor: true });
      const label_ = this.add.text(startPosX + chipW / 2, startPosY + chipH / 2, label, textStyle('button', { fontSize: '15px' })).setOrigin(0.5);
      this.contentLayer.add([chip, label_]);
      let homeX = startPosX, homeY = startPosY, placed = false;

      chip.on('drag', (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        chip.setPosition(dragX, dragY);
        label_.setPosition(dragX + chipW / 2, dragY + chipH / 2);
      });
      chip.on('dragend', () => {
        if (placed || finished) return;
        // Both the slot rects and the chips are origin (0,0) — `rect.x/y` is a TOP-LEFT corner,
        // not a center. This used to test the chip's center against `rect.x +/- slotW/2`, i.e. a
        // box centered on the slot's own top-left corner: it overlapped the visible slot only in
        // its top-left quarter and extended 95px left / 30px above into empty space. Dropping on
        // the middle of a slot — what a player actually aims at — was silently rejected and the
        // chip tweened home, and the matching snap below placed a *successful* drop half a chip
        // up-and-left of its slot (the leftmost column landed at x=-34, off-screen). Confirmed
        // live on both drag minigames and reproduced by e2e/drag.spec.ts's real pointer drags.
        const cx = chip.x + chipW / 2, cy = chip.y + chipH / 2;
        const target = slots.find((s) => !s.filled &&
          cx >= s.rect.x && cx <= s.rect.x + slotW && cy >= s.rect.y && cy <= s.rect.y + slotH);
        if (target) {
          target.filled = true;
          placed = true;
          placedCount++;
          audio.playSfx('pickup');
          // Chip and slot are the same size, so aligning their top-left corners seats the chip
          // exactly over the slot it was dropped on.
          chip.setPosition(target.rect.x, target.rect.y);
          label_.setPosition(target.rect.x + chipW / 2, target.rect.y + chipH / 2);
          chip.disableInteractive();
          if (placedCount >= items.length) this.time.delayedCall(300, finishOnce);
        } else {
          this.tweens.add({
            targets: [chip], x: homeX, y: homeY, duration: 200,
            onUpdate: () => label_.setPosition(chip.x + chipW / 2, chip.y + chipH / 2),
          });
        }
      });
    });
  }

  // ---- choice: 3 quick two-option questions, a soft per-question timer, no wrong answer. ----
  private runChoiceQuestion(): void {
    const questions = this.questionsOrder;
    if (this.questionIndex >= questions.length) { this.finish(this.warmerCount >= Math.ceil(questions.length / 2)); return; }
    this.clearContent();
    const q = questions[this.questionIndex];
    this.card(300, 460);
    this.contentLayer.add(this.add.text(W / 2, 60 + 280, `Question ${this.questionIndex + 1} of ${questions.length}`,
      textStyle('small', { color: PALETTE_HEX.plum })).setOrigin(0.5));
    this.contentLayer.add(this.add.text(W / 2, 350, q.prompt, textStyle('dialogue', {
      fontSize: '24px', wordWrap: { width: W - 140 }, align: 'center', lineSpacing: 6,
    })).setOrigin(0.5, 0));

    let answered = false;
    const advance = (picked: 'A' | 'B' | null) => {
      if (answered) return;
      answered = true;
      if (picked === q.warmerOption) this.warmerCount++;
      audio.playSfx('choiceConfirm');
      this.questionIndex++;
      this.time.delayedCall(250, () => this.runChoiceQuestion());
    };
    this.time.delayedCall(6500, () => advance(null)); // soft timer — silence still advances, never blocks

    this.contentLayer.add(createButton(this, W / 2 - 300, 540, 600, 66, q.optionA, () => advance('A'), { fillColor: PALETTE.terracotta, fontSize: '19px' }));
    this.contentLayer.add(createButton(this, W / 2 - 300, 622, 600, 66, q.optionB, () => advance('B'), { fillColor: PALETTE.teal, fontSize: '19px' }));
  }

  private finish(good: boolean): void {
    this.outcomeGood = good;
    this.clearContent();
    this.card(300, 260);
    const text = good ? this.mg.outroText : this.mg.outroTextRough;
    this.contentLayer.add(this.add.text(W / 2, 330, text, textStyle('dialogue', {
      fontSize: '24px', wordWrap: { width: W - 140 }, align: 'center', lineSpacing: 6,
    })).setOrigin(0.5, 0));
    const btnY = Math.min(560, SAFE_BOTTOM_Y - 66);
    this.contentLayer.add(createButton(this, W / 2 - 130, btnY, 260, 66, 'Continue', () => this.applyRewardAndReturn(), { fillColor: 0xd9a441 }));
  }

  private applyRewardAndReturn(): void {
    const reward: MiniGameReward | undefined = this.outcomeGood ? this.mg.reward : (this.mg.roughReward ?? this.mg.reward);
    if (reward) {
      State.applyStatDeltas(reward.effects);
      State.applyRelationshipDeltas(reward.relationshipEffects);
      for (const flag of reward.flags ?? []) State.addFlag(flag);
    }
    State.addFlag(minigamePlayedFlag(this.mg.id));
    saveRun(State.data);
    goTo(this, 'City', { cityId: this.cityId, phase: this.returnPhase });
  }
}
