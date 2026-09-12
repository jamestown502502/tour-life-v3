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
import { recordMinigame } from '../game/memory';
import { getCity } from '../game/content';
import { addTextScrim, textStyle } from './textStyles';
// The same feedback vocabulary RhythmScene has always had. Minigames shipped with NONE of it:
// no spark on a correct answer, no shake on a wrong one, no hitstop on the moment that matters.
// Half the game's interactions confirmed themselves with a text label changing, which is why they
// read as flat next to the rhythm sections. Every one of these no-ops under reduced motion.
import { spawnPerfectSpark, spawnRingPulse, hitstop, shake } from '../art/effects';
import { addHelpButton } from './HelpButton';
import { addMenuButton } from './MenuButton';
import type { MiniGameDef, MiniGameQuestion, MiniGameReward } from '../../content/schema';
import { minigamePlayedFlag, timingRoundsForHarmony } from '../game/minigame';
import { DEFAULT_LEDGER, resolveSplit, resolvePricing, resolvePerDiem, resolveGearCall, resolveExchange, doorTake, breakEvenTurnout, demandAt, perDiemForecast, type LedgerOutcome } from '../game/ledger';
import { chordFrequencies, splitChord, transposeChord, QUALITY_LABELS, QUALITY_HINTS } from '../core/musicTheory';
import { getSong } from '../game/content';
import { makeRng } from '../core/rng';

const HELP_TEXT: Record<MiniGameDef['type'], string> = {
  timing: 'Tap the button when the needle is inside the gold zone. A few rounds, no penalty for missing.',
  drag: 'Drag each item into any open slot before the timer runs out.',
  choice: 'Pick whichever answer feels right — there\'s no wrong one, just different flavor.',
  sequence: 'Watch the pads light up, then tap them back in the same order. Each round is one longer.',
  sustain: 'Hold BOTH faders inside the moving gold zone. Drag them up and down to keep them there.',
  pressure: 'Answer fast. Stay quiet long enough and the silence answers for you — which is also an answer.',
  interval: 'Two notes play. Pick the interval between them. You can replay it as often as you like, and every answer tells you what it actually was — getting it wrong still teaches you the sound.',
  clave: 'A rhythm plays. Pick the row of dots that matches it — filled dots are strokes. Replay it as often as you like; each answer names the pattern either way.',
  split: 'Two deals: a flat guarantee, or a share of the door. Set how full you think the room will be, then choose. The break-even point is the number worth knowing.',
  pricing: 'Set a price for the shirts. Cheaper sells more, dearer earns more each — the table shows how many will buy. Profit is what is left after the box was paid for.',
  perdiem: 'Split tomorrow\'s per diem across food, a bed, and a rest stop. The forecast updates as you go. Spending nothing on something has a cost too.',
  gearcall: 'Buy the synth, rent it per show, or pass. Compare the price to renting for every show that is left — that is the whole decision.',
  exchange: 'Three places to change money. Each shows a rate and a fee. Work out which one actually hands you the most — the fee is part of the rate.',
  chordquality: 'A chord plays. Say whether it is major, minor, or one of the sevenths. Replay it as often as you like; every answer names what it was.',
  transpose: 'A chord from tonight\'s set has to move by the interval named. Pick the chord it becomes. Every answer plays both so you hear the move.',
  meter: 'A count-in plays. Pick its time signature from the feel of the accents — three, four, or six. Replay as often as you like.',
  tempo: 'A click plays at the crowd\'s tempo. Tap along at least five times and the game reads your BPM. Close counts.',
};

export class MiniGameScene extends Phaser.Scene {
  constructor() { super('MiniGame'); }

  private cityId!: string;
  private mg!: MiniGameDef;
  private returnPhase!: string;
  /** QA #9 / decision D6: launched from the Hub's Practice picker. No reward, no relationship
   *  change, no played-flag, no memory entry; returns to the Hub instead of the city. */
  private practice = false;
  private outcomeGood = false;
  /** True only when the player aced it outright, not merely passed. Gates outroTextPerfect. */
  private outcomePerfect = false;
  private theoryRound = 0;
  private theoryHits = 0;
  private theoryRng!: ReturnType<typeof makeRng>;
  private contentLayer!: Phaser.GameObjects.Container;
  // timing
  private timingRound = 0;
  private timingHits = 0;
  private needle: Phaser.GameObjects.Arc | null = null;
  private needleTween: Phaser.Tweens.Tween | null = null;
  /** Ledger types: applied on top of the reward in applyRewardAndReturn (never in practice). */
  private ledgerOutcome: LedgerOutcome | null = null;
  private tempoTaps: number[] = [];
  // sequence
  private sequenceRound = 0;
  private sequenceHits = 0;
  private sequenceRng = makeRng('placeholder');
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

  init(data: { cityId: string; minigameId: string; returnPhase: string; practice?: boolean }): void {
    this.cityId = data.cityId;
    this.returnPhase = data.returnPhase;
    this.practice = !!data.practice;
    const city = getCity(this.cityId);
    const found = (city.minigames ?? []).find((m) => m.id === data.minigameId);
    if (!found) throw new Error(`[minigame] "${data.minigameId}" not found on city "${this.cityId}"`);
    this.mg = found;
    this.outcomeGood = false;
    this.outcomePerfect = false;
    this.theoryRound = 0;
    this.theoryHits = 0;
    this.timingRound = 0;
    this.timingHits = 0;
    this.needle = null;
    this.needleTween = null;
    this.questionIndex = 0;
    this.warmerCount = 0;
    this.sequenceRound = 0;
    this.sequenceHits = 0;
    this.ledgerOutcome = null;
    this.tempoTaps = [];
    // Seeded per minigame like every other per-run variance, so a replayed seed drills the same
    // pattern instead of a fresh random one.
    this.sequenceRng = makeRng(State.data.seed + ':sequence:' + data.minigameId);
    // Seeded like everything else: a replayed seed asks the same theory questions in the same
    // order, so a run is reproducible and a player can compare two attempts at the same exercise.
    this.theoryRng = makeRng(State.data.seed + ':theory:' + data.minigameId);

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

  /** QA #16: how long this will take, derived from the def, so the intro can say so. */
  private estimate(): { seconds: number; rounds: number } {
    const mg = this.mg;
    switch (mg.type) {
      case 'timing': { const r = this.timingRoundsSec; return { seconds: r.reduce((a, b) => a + b, 0) * 1.6 + r.length * 0.6, rounds: r.length }; }
      case 'drag': return { seconds: mg.dragTimeSec ?? 30, rounds: (mg.dragItems ?? []).length || 6 };
      case 'choice': return { seconds: (mg.questions ?? []).length * 5, rounds: (mg.questions ?? []).length };
      case 'pressure': return { seconds: (mg.questions ?? []).length * (mg.pressureSeconds ?? 4), rounds: (mg.questions ?? []).length };
      case 'sequence': { const r = mg.sequenceRounds ?? [3, 4, 5]; return { seconds: r.reduce((a, b) => a + b * 0.34 * 2 + 2.2, 0), rounds: r.length }; }
      case 'sustain': return { seconds: (mg.sustainSeconds ?? 12) * 1.4, rounds: 1 };
      case 'interval': case 'clave': case 'chordquality': case 'transpose': case 'meter': return { seconds: (mg.theoryRounds ?? 4) * 8, rounds: mg.theoryRounds ?? 4 };
      case 'tempo': return { seconds: (mg.theoryRounds ?? 2) * 14, rounds: mg.theoryRounds ?? 2 };
      case 'split': case 'pricing': case 'perdiem': case 'gearcall': case 'exchange': return { seconds: 35, rounds: 1 };
      default: return { seconds: 30, rounds: 3 };
    }
  }

  private showIntro(): void {
    this.clearContent();
    this.card(300, 300);
    this.contentLayer.add(this.add.text(W / 2, 330, this.mg.introText, textStyle('dialogue', {
      fontSize: '24px', wordWrap: { width: W - 140 }, align: 'center', lineSpacing: 6,
    })).setOrigin(0.5, 0));
    const est = this.estimate();
    const secs = Math.max(10, Math.round(est.seconds / 10) * 10);
    const roundsLabel = est.rounds > 1 ? `${est.rounds} rounds` : 'one round';
    this.contentLayer.add(this.add.text(W / 2, 486, `About ${secs} seconds · ${roundsLabel}${this.practice ? ' · practice, nothing at stake' : ' · no way to fail'}`,
      textStyle('small', { fontSize: '14px', color: PALETTE_HEX.plum, align: 'center', wordWrap: { width: W - 160 } })).setOrigin(0.5));
    this.contentLayer.add(createButton(this, W / 2 - 130, 520, 260, 66, 'Start', () => this.beginGame(), { fillColor: 0x3e7c7b }));
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
    else if (this.mg.type === 'sequence') this.runSequenceRound();
    else if (this.mg.type === 'sustain') this.runSustain();
    else if (this.mg.type === 'interval') this.runIntervalRound();
    else if (this.mg.type === 'clave') this.runClaveRound();
    else if (this.mg.type === 'split') this.runSplit();
    else if (this.mg.type === 'pricing') this.runPricing();
    else if (this.mg.type === 'perdiem') this.runPerDiem();
    else if (this.mg.type === 'gearcall') this.runGearCall();
    else if (this.mg.type === 'exchange') this.runExchange();
    else if (this.mg.type === 'chordquality') this.runChordQualityRound();
    else if (this.mg.type === 'transpose') this.runTransposeRound();
    else if (this.mg.type === 'meter') this.runMeterRound();
    else if (this.mg.type === 'tempo') this.runTempoRound();
    else this.runChoiceQuestion();
  }

  // ---- timing: a needle sweeps a gauge; tap while it's in the gold zone. ----
  private runTimingRound(): void {
    const rounds = this.timingRoundsSec;
    if (this.timingRound >= rounds.length) {
      this.finish(this.timingHits >= Math.ceil(rounds.length / 2), this.timingHits === rounds.length);
      return;
    }
    this.clearContent();

    const barX = 90, barW = W - 180, barY = 420, barH = 28;
    const zoneW = this.mg.timingZoneW ?? 140;
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
          spawnRingPulse(this, target.rect.x + slotW / 2, target.rect.y + slotH / 2);
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
    // 'choice' stays forgiving (6.5s, no visible clock). 'pressure' is the same interview with
    // the clock turned up AND shown, because knowing it is running is most of the difficulty.
    // Both still advance on silence — a no-fail game does not get to punish hesitation.
    const limitMs = this.mg.type === 'pressure' ? (this.mg.pressureSeconds ?? 4) * 1000 : 6500;
    if (this.mg.type === 'pressure') {
      const clock = this.add.text(W / 2, 508, '', textStyle('h2', { color: PALETTE_HEX.gold })).setOrigin(0.5);
      this.contentLayer.add(clock);
      const startedAt = this.time.now;
      const tick = this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          const left = Math.max(0, limitMs - (this.time.now - startedAt));
          clock.setText(left > 0 ? (left / 1000).toFixed(1) : '');
          if (left <= 0 || answered) tick.remove();
        },
      });
    }
    this.time.delayedCall(limitMs, () => advance(null)); // silence still advances, never blocks

    this.contentLayer.add(createButton(this, W / 2 - 300, 540, 600, 66, q.optionA, () => advance('A'), { fillColor: PALETTE.terracotta, fontSize: '19px' }));
    this.contentLayer.add(createButton(this, W / 2 - 300, 622, 600, 66, q.optionB, () => advance('B'), { fillColor: PALETTE.teal, fontSize: '19px' }));
  }

  // ---- sequence: pads light in a pattern; play it back. Each round is one step longer. ----
  //
  // Deliberately the hardest of the set: it tests MEMORY, and call-and-response is how bands check
  // a room. Still structurally no-fail. QA reported "the round starts before I've tapped the full
  // sequence" and "the cubes didn't change": the no-fail safety timer was a TOTAL cap (8s for a
  // 3-pad pattern) that cut a slow first-timer off mid-entry, and the only feedback per tap was the
  // same 240ms flash the demo used. Now: an idle timer that resets on every tap, a bright ring and
  // pop on every correct tap, and a wrong tap replays the pattern once before the round is called.
  private runSequenceRound(): void {
    const rounds = this.mg.sequenceRounds ?? [3, 4, 5];
    if (this.sequenceRound >= rounds.length) {
      this.finish(this.sequenceHits >= Math.ceil(rounds.length / 2), this.sequenceHits === rounds.length);
      return;
    }
    this.clearContent();
    const pattern = Array.from({ length: rounds[this.sequenceRound] }, () => this.sequenceRng.int(0, 4));

    this.contentLayer.add(addTextScrim(this, W / 2, 300, 520, 96));
    const label = this.add.text(W / 2, 284, 'Watch the pattern...', textStyle('h2', { color: PALETTE_HEX.cream })).setOrigin(0.5);
    this.contentLayer.add(label);
    const hint = this.add.text(W / 2, 320, `Round ${this.sequenceRound + 1} of ${rounds.length} — don't tap yet`,
      textStyle('small', { color: PALETTE_HEX.gold })).setOrigin(0.5);
    this.contentLayer.add(hint);

    const padW = 150, padH = 150, gap = 18, padY = 430;
    const startX = (W - (padW * 4 + gap * 3)) / 2;
    const colors = [PALETTE.terracotta, PALETTE.teal, PALETTE.plum, PALETTE.gold];
    const pads: Phaser.GameObjects.Rectangle[] = [];
    const dots: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 4; i++) {
      const pad = this.add.rectangle(startX + i * (padW + gap), padY, padW, padH, colors[i], 0.92)
        .setOrigin(0, 0).setStrokeStyle(3, PALETTE.cream, 0.9);
      this.contentLayer.add(pad);
      pads.push(pad);
    }
    // Progress dots: one per step, filled as the player enters them — the "did that count?"
    // question answered on screen.
    for (let i = 0; i < pattern.length; i++) {
      const d = this.add.circle(W / 2 - (pattern.length - 1) * 16 + i * 32, padY + padH + 40, 8, PALETTE.cream, 0.3);
      this.contentLayer.add(d);
      dots.push(d);
    }

    const flash = (i: number, strong = false): void => {
      const pad = pads[i];
      pad.setAlpha(1).setStrokeStyle(strong ? 6 : 4, PALETTE.cream, 1);
      this.tweens.add({ targets: pad, scaleX: 1.08, scaleY: 1.08, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
      spawnRingPulse(this, pad.x + padW / 2, pad.y + padH / 2, PALETTE.cream);
      audio.playSfx(i % 2 === 0 ? 'perfect' : 'ok');
      this.time.delayedCall(240, () => pad.setAlpha(0.92).setStrokeStyle(3, PALETTE.cream, 0.9));
    };
    const nextRound = (): void => { this.sequenceRound++; this.runSequenceRound(); };

    const STEP = 340;
    let retried = false;
    const playDemo = (then: () => void): void => {
      for (const pad of pads) pad.disableInteractive();
      dots.forEach((d) => d.setFillStyle(PALETTE.cream, 0.3));
      pattern.forEach((pad, i) => this.time.delayedCall(400 + i * STEP, () => flash(pad)));
      this.time.delayedCall(400 + pattern.length * STEP + 220, then);
    };

    const yourTurn = (): void => {
      label.setText('Your turn');
      hint.setText('Tap them back in the same order');
      let expected = 0;
      let settled = false;
      let idle: Phaser.Time.TimerEvent | null = null;
      // No-fail safety net: the round only ends on its own after the player has been idle — a
      // slow player is never cut off mid-pattern.
      const armIdle = (): void => {
        idle?.remove();
        idle = this.time.delayedCall(9000, () => { if (!settled) { settled = true; hint.setText('Moving on — no penalty'); this.time.delayedCall(500, nextRound); } });
      };
      armIdle();
      for (let i = 0; i < 4; i++) {
        pads[i].setInteractive({ useHandCursor: true });
        pads[i].removeAllListeners('pointerdown');
        pads[i].on('pointerdown', () => {
          if (settled || expected >= pattern.length) return;
          armIdle();
          if (i !== pattern[expected]) {
            flash(i);
            shake(this, 3);
            if (!retried) {
              retried = true;
              settled = true;
              idle?.remove();
              label.setText('Not that one');
              hint.setText('Watch it once more...');
              this.time.delayedCall(700, () => playDemo(yourTurn));
              return;
            }
            settled = true;
            idle?.remove();
            label.setText('Not quite');
            hint.setText('No penalty — next round coming up');
            this.time.delayedCall(700, nextRound);
            return;
          }
          flash(i, true);
          dots[expected].setFillStyle(PALETTE.gold, 1);
          expected++;
          if (expected === pattern.length) {
            settled = true;
            idle?.remove();
            this.sequenceHits++;
            label.setText('Got it');
            spawnPerfectSpark(this, W / 2, 430);
            hitstop(this, 40);
            hint.setText('Nice — one longer next time');
            this.time.delayedCall(700, nextRound);
          }
        });
      }
    };

    playDemo(yourTurn);
  }

  // ---- sustain: hold two drifting faders inside a moving gold zone. ----
  //
  // The only minigame that asks for sustained attention rather than one correct action, and the
  // only one needing two pointers at once — activePointers is already 4 (set for rhythm chords),
  // so this needs no input config of its own.
  private runSustain(): void {
    this.clearContent();
    const seconds = this.mg.sustainSeconds ?? 12;
    const trackY = 300, trackH = 420, trackW = 90, zoneH = 150;
    const xs = [W / 2 - 150, W / 2 + 60];

    this.contentLayer.add(addTextScrim(this, W / 2, 240, 560, 96));
    this.contentLayer.add(this.add.text(W / 2, 224, 'Hold the mix', textStyle('h2', { color: PALETTE_HEX.cream })).setOrigin(0.5));
    // Reported live as needing clearer instruction: the mechanic is not guessable from two
    // rectangles, so the screen says it outright while you play.
    this.contentLayer.add(this.add.text(W / 2, 262, 'Drag BOTH bars into the gold zone and keep them there',
      textStyle('small', { color: PALETTE_HEX.gold, wordWrap: { width: W - 120 }, align: 'center' })).setOrigin(0.5));

    const zone = this.add.rectangle(W / 2 - 210, trackY + 110, 420, zoneH, PALETTE.gold, 0.25).setOrigin(0, 0);
    this.contentLayer.add(zone);
    this.tweens.add({
      targets: zone, y: trackY + trackH - zoneH - 30, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    const faders: Phaser.GameObjects.Rectangle[] = [];
    for (const x of xs) {
      this.contentLayer.add(this.add.rectangle(x, trackY, trackW, trackH, PALETTE.night, 0.35).setOrigin(0, 0));
      // 72px tall (was 48) with a hit area padded well beyond the visual: a drifting target that
      // must be held is far more frustrating to grab than a one-shot drag, and this was reported
      // as needing better input before anything else about it.
      // The track itself follows a held finger: tap-and-hold anywhere on it and the fader comes to
      // you. Reported as "tap and holding has no response" when only the fader body was draggable.
      const track = this.add.rectangle(x, trackY, trackW, trackH, 0x000000, 0.001).setOrigin(0, 0).setInteractive();
      this.contentLayer.add(track);
      const fader = this.add.rectangle(x, trackY + trackH / 2 - 36, trackW, 72, PALETTE.cream, 0.95).setOrigin(0, 0);
      const follow = (p: Phaser.Input.Pointer): void => { fader.y = Phaser.Math.Clamp(p.y - 36, trackY, trackY + trackH - 72); };
      track.on('pointerdown', follow);
      track.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.isDown) follow(p); });
      fader.setInteractive(new Phaser.Geom.Rectangle(-30, -30, trackW + 60, 72 + 60), Phaser.Geom.Rectangle.Contains);
      fader.input!.draggable = true;
      this.input.setDraggable(fader);
      fader.on('drag', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => {
        fader.y = Phaser.Math.Clamp(dy - 36, trackY, trackY + trackH - 72);
      });
      this.contentLayer.add(fader);
      faders.push(fader);
    }

    const totalMs = seconds * 1000;
    let held = 0;
    let done = false;
    const meter = this.add.text(W / 2, trackY + trackH + 44, '', textStyle('h2', { color: PALETTE_HEX.gold })).setOrigin(0.5);
    this.contentLayer.add(meter);

    const end = (good: boolean): void => { if (!done) { done = true; this.finish(good); } };
    const timer = this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (done) { timer.remove(); return; }
        const inZone = faders.every((f) => f.y + 36 >= zone.y && f.y + 36 <= zone.y + zoneH);
        if (inZone) held += 100;
        meter.setText(`${(held / 1000).toFixed(1)}s / ${seconds}s`);
        for (const f of faders) f.setFillStyle(inZone ? PALETTE.gold : PALETTE.cream, 0.95);
        if (held >= totalMs) { timer.remove(); end(true); }
      },
    });
    // No-fail ceiling: however the mix went, the round always resolves. Half the target still
    // counts as a good outcome — this is a cozy game, not a mixing exam.
    this.time.delayedCall(totalMs * 2.4, () => { timer.remove(); end(held >= totalMs * 0.5); });
  }

  private finish(good: boolean, perfect = false): void {
    // Remembered for the return leg's social feed — the concrete callback ("they still talk about
    // that load-out") rather than a generic one about the show.
    if (!this.practice) recordMinigame(this.cityId, good, this.mg.title);
    this.outcomeGood = good;
    this.outcomePerfect = perfect && good;
    this.clearContent();
    this.card(300, 260);
    const text = !good ? this.mg.outroTextRough
      : (this.outcomePerfect && this.mg.outroTextPerfect) ? this.mg.outroTextPerfect
      : this.mg.outroText;
    this.contentLayer.add(this.add.text(W / 2, 330, text, textStyle('dialogue', {
      fontSize: '24px', wordWrap: { width: W - 140 }, align: 'center', lineSpacing: 6,
    })).setOrigin(0.5, 0));
    const btnY = Math.min(560, SAFE_BOTTOM_Y - 66);
    this.contentLayer.add(createButton(this, W / 2 - 130, btnY, 260, 66, 'Continue', () => this.applyRewardAndReturn(), { fillColor: 0xd9a441 }));
  }

  private applyRewardAndReturn(): void {
    if (this.practice) { goTo(this, 'Hub'); return; }
    // Ledger money lands on top of the authored reward, and the decision is remembered for the Hub card.
    if (this.ledgerOutcome) {
      State.applyStatDeltas({ funds: this.ledgerOutcome.funds });
      State.recordLedger({ cityId: this.cityId, label: this.ledgerOutcome.label, funds: this.ledgerOutcome.funds });
    }
    // A hosted minigame is time spent with that bandmate: it moves their arc like a scene does.
    if (this.mg.hostBandmate) State.recordArcScene(this.mg.hostBandmate);
    const reward: MiniGameReward | undefined = !this.outcomeGood
      ? (this.mg.roughReward ?? this.mg.reward)
      : (this.outcomePerfect ? (this.mg.perfectReward ?? this.mg.reward) : this.mg.reward);
    if (reward) {
      State.applyStatDeltas(reward.effects);
      State.applyRelationshipDeltas(reward.relationshipEffects);
      for (const flag of reward.flags ?? []) State.addFlag(flag);
    }
    State.addFlag(minigamePlayedFlag(this.mg.id));
    saveRun(State.data);
    goTo(this, 'City', { cityId: this.cityId, phase: this.returnPhase });
  }

  // ---- interval: hear two notes, name the distance. Relative-pitch ear training. ----
  //
  // Pedagogy, not decoration. Music-education research is consistent that ear training works when
  // it is multimodal and immediate: play the real thing, let the learner answer, then NAME what
  // they just heard whether they got it or not. So every round ends with the interval identified
  // and anchored to something physical they already know - the gap between two guitar strings, the
  // first two notes of a song they can hum. A wrong answer still teaches; it just does not score.
  private runIntervalRound(): void {
    const rounds = this.mg.theoryRounds ?? 4;
    if (this.theoryRound >= rounds) {
      this.finish(this.theoryHits >= Math.ceil(rounds / 2), this.theoryHits === rounds);
      return;
    }
    this.clearContent();

    // Ordered easiest-first: an octave and a unison are unmistakable, a fifth is the next most
    // distinct, and thirds (the major/minor pair that decides whether music sounds bright or sad)
    // come last, because telling those two apart is the actual skill.
    const LADDER: { semitones: number; name: string; anchor: string }[][] = [
      [{ semitones: 12, name: 'Octave', anchor: 'the same note higher up' },
       { semitones: 7, name: 'Fifth', anchor: 'the gap between two open guitar strings' },
       { semitones: 0, name: 'Unison', anchor: 'the same note twice, which is what being in tune sounds like' }],
      [{ semitones: 7, name: 'Fifth', anchor: 'the opening leap of Twinkle, Twinkle' },
       { semitones: 5, name: 'Fourth', anchor: 'the first two notes of Here Comes the Bride' },
       { semitones: 12, name: 'Octave', anchor: 'the same note an octave up' }],
      [{ semitones: 4, name: 'Major third', anchor: 'the bright one, and the reason a major chord sounds happy' },
       { semitones: 3, name: 'Minor third', anchor: 'the sad one, and the reason a minor chord aches' },
       { semitones: 7, name: 'Fifth', anchor: 'wide and open, neither bright nor sad' }],
      [{ semitones: 3, name: 'Minor third', anchor: 'the interval that makes a chord sound sad' },
       { semitones: 4, name: 'Major third', anchor: 'the interval that makes a chord sound bright' },
       { semitones: 2, name: 'Major second', anchor: 'one step, the smallest gap on offer here' }],
    ];
    const set = LADDER[Math.min(this.theoryRound, LADDER.length - 1)];
    const answer = set[this.theoryRng.int(0, set.length)];
    const root = 220 * Math.pow(2, this.theoryRng.int(0, 5) / 12); // vary the starting pitch

    this.contentLayer.add(addTextScrim(this, W / 2, 250, W - 60, 116));
    this.contentLayer.add(this.add.text(W / 2, 226, 'Which interval was that?',
      textStyle('h2', { color: PALETTE_HEX.cream })).setOrigin(0.5));
    const hint = this.add.text(W / 2, 268, `Question ${this.theoryRound + 1} of ${rounds} - listen, then choose`,
      textStyle('small', { color: PALETTE_HEX.gold, wordWrap: { width: W - 120 }, align: 'center' })).setOrigin(0.5);
    this.contentLayer.add(hint);

    const playPair = (): void => {
      audio.playPitch(root, 0.7, 0, 'triangle');
      audio.playPitch(root * Math.pow(2, answer.semitones / 12), 0.7, 0.85, 'triangle');
    };
    playPair();
    this.contentLayer.add(createButton(this, W / 2 - 110, 320, 220, 58, 'Hear it again',
      () => playPair(), { fillColor: PALETTE.plum, fontSize: '17px' }));

    let answered = false;
    set.forEach((option, i) => {
      const btn = createButton(this, W / 2 - 260, 410 + i * 84, 520, 70, option.name, () => {
        if (answered) return;
        answered = true;
        const right = option.semitones === answer.semitones;
        if (right) { this.theoryHits++; spawnPerfectSpark(this, W / 2, 400); hitstop(this, 40); }
        else shake(this, 3);
        // Name it either way. This is the teaching moment, and skipping it on a wrong answer is
        // exactly how a quiz fails to be a lesson.
        hint.setText(right
          ? `Yes - a ${answer.name.toLowerCase()}: ${answer.anchor}.`
          : `That was a ${answer.name.toLowerCase()} - ${answer.anchor}.`);
        this.theoryRound++;
        this.time.delayedCall(2100, () => this.runIntervalRound());
      }, { fillColor: PALETTE.teal, fontSize: '19px' });
      this.contentLayer.add(btn);
    });
  }

  // ---- clave: hear a rhythm, pick the pattern that matches it. ----
  //
  // The son clave is the backbone of most Latin popular music and is genuinely worth knowing, so
  // Mexico City teaches it rather than testing reflexes. The player hears a real pattern and picks
  // its notation out of three, which is rhythm-reading in its most reduced honest form: does the
  // shape on the screen match the shape in the air.
  private runClaveRound(): void {
    const rounds = this.mg.theoryRounds ?? 4;
    if (this.theoryRound >= rounds) {
      this.finish(this.theoryHits >= Math.ceil(rounds / 2), this.theoryHits === rounds);
      return;
    }
    this.clearContent();

    // Sixteen slots = two bars of four. 'x' is a stroke.
    const P = (g: string): boolean[] => g.split('').map((c) => c === 'x');
    const PATTERNS: { name: string; grid: string; note: string }[] = [
      { name: '3-2 son clave', grid: 'x..x..x...x.x...', note: 'three strokes then two, and the backbone of most of what this city dances to' },
      { name: '2-3 son clave', grid: '..x.x...x..x..x.', note: 'the same pattern turned around, two strokes first and then three' },
      { name: 'Straight four', grid: 'x...x...x...x...', note: 'one stroke per beat, steady, and the thing clave is deliberately not' },
      { name: 'Rumba clave', grid: 'x..x...x..x.x...', note: 'like the 3-2 son, except the third stroke lands one step later' },
    ];
    const pool = this.theoryRng.shuffle(PATTERNS).slice(0, 3);
    const answer = pool[this.theoryRng.int(0, pool.length)];

    this.contentLayer.add(addTextScrim(this, W / 2, 236, W - 60, 108));
    this.contentLayer.add(this.add.text(W / 2, 214, 'Which pattern did you hear?',
      textStyle('h2', { color: PALETTE_HEX.cream })).setOrigin(0.5));
    const hint = this.add.text(W / 2, 254, `Question ${this.theoryRound + 1} of ${rounds} - filled dots are strokes`,
      textStyle('small', { color: PALETTE_HEX.gold, wordWrap: { width: W - 120 }, align: 'center' })).setOrigin(0.5);
    this.contentLayer.add(hint);

    const STEP = 0.19; // seconds per sixteenth slot -- was 0.24, which read as slower than any
                       // clave is actually played and made the pattern easier to count than hear.
    const playPattern = (grid: string): void => {
      const offsets = P(grid).map((on, i) => (on ? i * STEP : -1)).filter((t) => t >= 0);
      audio.playRhythm(offsets);
    };
    playPattern(answer.grid);
    this.contentLayer.add(createButton(this, W / 2 - 110, 306, 220, 58, 'Hear it again',
      () => playPattern(answer.grid), { fillColor: PALETTE.plum, fontSize: '17px' }));

    let answered = false;
    pool.forEach((option, i) => {
      const rowY = 400 + i * 96;
      // The notation itself: sixteen dots, filled where a stroke lands. Reading it IS the lesson,
      // so it is drawn rather than described in words.
      const dotW = (W - 140) / 16;
      const row = this.add.container(0, 0);
      P(option.grid).forEach((on, j) => {
        const cx = 70 + j * dotW + dotW / 2;
        row.add(this.add.circle(cx, rowY, on ? 9 : 5, on ? PALETTE.gold : PALETTE.cream, on ? 1 : 0.35));
      });
      this.contentLayer.add(row);
      const btn = createButton(this, W / 2 - 150, rowY + 22, 300, 52, 'This one', () => {
        if (answered) return;
        answered = true;
        const right = option.name === answer.name;
        if (right) { this.theoryHits++; spawnPerfectSpark(this, W / 2, rowY); hitstop(this, 40); }
        else shake(this, 3);
        hint.setText(right
          ? `Yes - the ${answer.name}: ${answer.note}.`
          : `That was the ${answer.name} - ${answer.note}.`);
        this.theoryRound++;
        this.time.delayedCall(2400, () => this.runClaveRound());
      }, { fillColor: PALETTE.teal, fontSize: '16px' });
      this.contentLayer.add(btn);
    });
  }


  // =============================================================================================
  // The Van Ledger — five money decisions with real numbers on screen. Pure logic lives in
  // src/game/ledger.ts; these methods are only the table the numbers sit on.
  // =============================================================================================

  /** Shared frame: a sand card with a title, a subtitle, and a live line the exercise updates. */
  private ledgerFrame(title: string, sub: string): Phaser.GameObjects.Text {
    this.clearContent();
    this.card(220, 760);
    this.contentLayer.add(this.add.text(W / 2, 250, title, textStyle('h2', { color: PALETTE_HEX.plum })).setOrigin(0.5));
    this.contentLayer.add(this.add.text(W / 2, 286, sub, textStyle('small', { fontSize: '15px', color: PALETTE_HEX.plum, wordWrap: { width: W - 150 }, align: 'center' })).setOrigin(0.5, 0));
    const live = this.add.text(W / 2, 560, '', textStyle('dialogue', { fontSize: '19px', color: PALETTE_HEX.plum, wordWrap: { width: W - 150 }, align: 'center', lineSpacing: 4 })).setOrigin(0.5, 0);
    this.contentLayer.add(live);
    return live;
  }

  /** Explain the money for a beat, then hand off to the normal three-tier outro. */
  private settleLedger(outcome: LedgerOutcome): void {
    this.ledgerOutcome = outcome;
    this.clearContent();
    this.card(300, 320);
    this.contentLayer.add(this.add.text(W / 2, 330, 'The ledger', textStyle('h2', { color: PALETTE_HEX.plum })).setOrigin(0.5));
    this.contentLayer.add(this.add.text(W / 2, 372, outcome.explain, textStyle('dialogue', {
      fontSize: '20px', color: PALETTE_HEX.plum, wordWrap: { width: W - 150 }, align: 'center', lineSpacing: 5,
    })).setOrigin(0.5, 0));
    if (outcome.tier === 'perfect') { spawnPerfectSpark(this, W / 2, 330); hitstop(this, 40); }
    else if (outcome.tier === 'rough') shake(this, 3);
    this.contentLayer.add(createButton(this, W / 2 - 130, 540, 260, 62, 'Continue', () => this.finish(outcome.tier !== 'rough', outcome.tier === 'perfect'), { fillColor: 0xd9a441 }));
  }

  private stepper(y: number, label: string, get: () => number, set: (v: number) => void, fmt: (v: number) => string, step: number, min: number, max: number, onChange: () => void): void {
    this.contentLayer.add(this.add.text(90, y + 28, label, textStyle('dialogue', { fontSize: '19px', color: PALETTE_HEX.plum })).setOrigin(0, 0.5));
    const value = this.add.text(W - 250, y + 28, fmt(get()), textStyle('h2', { fontSize: '22px', color: PALETTE_HEX.plum })).setOrigin(0.5);
    this.contentLayer.add(value);
    const bump = (d: number) => { set(Phaser.Math.Clamp(get() + d, min, max)); value.setText(fmt(get())); audio.playSfx('tap'); onChange(); };
    this.contentLayer.add(createButton(this, W - 340, y, 56, 56, '−', () => bump(-step), { fillColor: PALETTE.plum, fontSize: '26px' }));
    this.contentLayer.add(createButton(this, W - 160, y, 56, 56, '+', () => bump(step), { fillColor: PALETTE.plum, fontSize: '26px' }));
  }

  private runSplit(): void {
    const d = { ...DEFAULT_LEDGER.split, ...(this.mg.ledger ?? {}) } as { guarantee: number; doorPct: number; ticketPrice: number; capacity: number };
    const live = this.ledgerFrame('The deal', `The venue offers $${d.guarantee} flat, or ${d.doorPct}% of the door: ${d.capacity} seats at $${d.ticketPrice}. Rowan wants your read on the room.`);
    const est = { v: 50 };
    const actual = this.theoryRng.int(25, 96) / 100;
    const update = () => {
      const t = est.v / 100;
      live.setText(`If the room is ${est.v}% full, the door pays $${doorTake(d, t)}.\nBreak-even is ${Math.round(breakEvenTurnout(d) * 100)}% full.`);
    };
    this.stepper(400, 'How full will it be?', () => est.v, (v) => { est.v = v; }, (v) => `${v}%`, 10, 10, 100, update);
    update();
    this.contentLayer.add(createButton(this, W / 2 - 300, 700, 290, 66, `Take the $${d.guarantee}`, () => this.settleLedger(resolveSplit(d, 'guarantee', est.v / 100, actual)), { fillColor: PALETTE.teal, fontSize: '18px' }));
    this.contentLayer.add(createButton(this, W / 2 + 10, 700, 290, 66, 'Take the door', () => this.settleLedger(resolveSplit(d, 'door', est.v / 100, actual)), { fillColor: PALETTE.terracotta, fontSize: '18px' }));
    this.contentLayer.add(this.add.text(W / 2, 800, 'A sure thing is worth something. So is being right about the room.', textStyle('small', { fontSize: '14px', color: PALETTE_HEX.plum, wordWrap: { width: W - 160 }, align: 'center' })).setOrigin(0.5, 0));
  }

  private runPricing(): void {
    const d = { ...DEFAULT_LEDGER.pricing, ...(this.mg.ledger ?? {}) } as { unitCost: number; stock: number; minPrice: number; maxPrice: number };
    const live = this.ledgerFrame('The merch table', `${d.stock} shirts in the box at $${d.unitCost} each to print. Mira wants them seen; the tour needs them paid for.`);
    const price = { v: Math.round((d.minPrice + d.maxPrice) / 2) };
    const update = () => {
      const sold = demandAt(d, price.v);
      live.setText(`At $${price.v}, about ${sold} people buy.\nThat is $${sold * price.v} in, against $${d.stock * d.unitCost} already spent on the box.`);
    };
    this.stepper(400, 'Price per shirt', () => price.v, (v) => { price.v = v; }, (v) => `$${v}`, 2, d.minPrice, d.maxPrice, update);
    update();
    this.contentLayer.add(createButton(this, W / 2 - 150, 700, 300, 66, 'Open the table', () => this.settleLedger(resolvePricing(d, price.v)), { fillColor: PALETTE.terracotta }));
    this.contentLayer.add(this.add.text(W / 2, 800, 'Margin is price minus cost, times how many actually buy.', textStyle('small', { fontSize: '14px', color: PALETTE_HEX.plum, wordWrap: { width: W - 160 }, align: 'center' })).setOrigin(0.5, 0));
  }

  private runPerDiem(): void {
    const d = { ...DEFAULT_LEDGER.perdiem, ...(this.mg.ledger ?? {}) } as { budget: number };
    const live = this.ledgerFrame('Tomorrow\'s per diem', `$${d.budget} for the day. Theo would like one real meal and one real bed. Whatever is left goes back in the float.`);
    const a = { food: 20, lodging: 20, rest: 0 };
    const update = () => {
      const spent = a.food + a.lodging + a.rest;
      const f = perDiemForecast(a);
      live.setText(`$${spent} of $${d.budget}${spent > d.budget ? ' — over budget' : `, $${d.budget - spent} back in the float`}.\nTomorrow: energy ${f.energy >= 0 ? '+' : ''}${f.energy}, harmony ${f.harmony >= 0 ? '+' : ''}${f.harmony}.`);
    };
    this.stepper(380, 'Food', () => a.food, (v) => { a.food = v; }, (v) => `$${v}`, 10, 0, 60, update);
    this.stepper(446, 'A bed', () => a.lodging, (v) => { a.lodging = v; }, (v) => `$${v}`, 10, 0, 60, update);
    this.stepper(512, 'Rest stop', () => a.rest, (v) => { a.rest = v; }, (v) => `$${v}`, 10, 0, 40, update);
    update();
    this.contentLayer.add(createButton(this, W / 2 - 150, 700, 300, 66, 'Set the budget', () => this.settleLedger(resolvePerDiem(d, { ...a })), { fillColor: PALETTE.teal }));
    this.contentLayer.add(this.add.text(W / 2, 800, 'Every dollar not spent on one thing was spent on another. That is the whole idea.', textStyle('small', { fontSize: '14px', color: PALETTE_HEX.plum, wordWrap: { width: W - 160 }, align: 'center' })).setOrigin(0.5, 0));
  }

  private runGearCall(): void {
    const d = { ...DEFAULT_LEDGER.gearcall, ...(this.mg.ledger ?? {}) } as { price: number; rentPerShow: number };
    const showsLeft = Math.max(1, State.data.route.length - State.data.currentCityIndex);
    const live = this.ledgerFrame('The synth', `A used synth Jun has wanted for a year. $${d.price} to buy, or $${d.rentPerShow} a night to rent. ${showsLeft} show${showsLeft === 1 ? '' : 's'} left on this tour.`);
    live.setText(`Renting for the rest of the tour: ${showsLeft} × $${d.rentPerShow} = $${showsLeft * d.rentPerShow}.\nBuying: $${d.price}, and it comes home with you.`);
    const mk = (y: number, label: string, choice: 'buy' | 'rent' | 'pass', color: number) =>
      this.contentLayer.add(createButton(this, W / 2 - 220, y, 440, 62, label, () => this.settleLedger(resolveGearCall(d, showsLeft, choice)), { fillColor: color, fontSize: '19px' }));
    mk(660, `Buy it ($${d.price})`, 'buy', PALETTE.terracotta);
    mk(736, `Rent it ($${d.rentPerShow} a show)`, 'rent', PALETTE.teal);
    mk(812, 'Pass — the old rig is fine', 'pass', PALETTE.plum);
  }

  private runExchange(): void {
    const rates: { label: string; rate: number; feePct: number }[] = [...(this.mg.ledger?.rates ?? DEFAULT_LEDGER.exchange.rates)];
    const live = this.ledgerFrame('Changing money', 'Three windows, three rates, three fees. $200 of the float needs to become local money for the week.');
    live.setText('What you get is the rate with the fee taken off. Pick the window.');
    rates.forEach((r, i) => {
      this.contentLayer.add(createButton(this, W / 2 - 260, 380 + i * 90, 520, 74, `${r.label}\nrate ${r.rate.toFixed(2)} · fee ${r.feePct}%`, () => this.settleLedger(resolveExchange(rates, i)), { fillColor: i % 2 === 0 ? PALETTE.teal : PALETTE.plum, fontSize: '17px' }));
    });
  }

  // =============================================================================================
  // Music theory, continued — same pedagogy as interval/clave: play it, answer, name it either way.
  // =============================================================================================

  private theoryFrame(question: string, rounds: number): Phaser.GameObjects.Text {
    this.clearContent();
    this.contentLayer.add(addTextScrim(this, W / 2, 250, W - 60, 116));
    this.contentLayer.add(this.add.text(W / 2, 226, question, textStyle('h2', { color: PALETTE_HEX.cream })).setOrigin(0.5));
    const hint = this.add.text(W / 2, 268, `Question ${this.theoryRound + 1} of ${rounds} - listen, then choose`,
      textStyle('small', { color: PALETTE_HEX.gold, wordWrap: { width: W - 120 }, align: 'center' })).setOrigin(0.5);
    this.contentLayer.add(hint);
    return hint;
  }

  private playChordSymbol(symbol: string, delay = 0): void {
    for (const f of chordFrequencies(symbol, 3)) audio.playPitch(f, 1.1, delay, 'triangle');
  }

  private theoryDone(rounds: number): boolean {
    if (this.theoryRound >= rounds) {
      this.finish(this.theoryHits >= Math.ceil(rounds / 2), this.theoryHits === rounds);
      return true;
    }
    return false;
  }

  private runChordQualityRound(): void {
    const rounds = this.mg.theoryRounds ?? 4;
    if (this.theoryDone(rounds)) return;
    const LADDER = [['', 'm'], ['', 'm', '7'], ['', 'm', '7', 'maj7'], ['m', '7', 'maj7', '']];
    const set = LADDER[Math.min(this.theoryRound, LADDER.length - 1)];
    const roots = ['C', 'D', 'E', 'F', 'G', 'A'];
    const root = roots[this.theoryRng.int(0, roots.length)];
    const answer = set[this.theoryRng.int(0, set.length)];
    const symbol = `${root}${answer}`;
    const hint = this.theoryFrame('What kind of chord was that?', rounds);
    this.playChordSymbol(symbol);
    this.contentLayer.add(createButton(this, W / 2 - 110, 320, 220, 58, 'Hear it again', () => this.playChordSymbol(symbol), { fillColor: PALETTE.plum, fontSize: '17px' }));
    let answered = false;
    set.forEach((q, i) => {
      this.contentLayer.add(createButton(this, W / 2 - 260, 410 + i * 84, 520, 70, QUALITY_LABELS[q], () => {
        if (answered) return;
        answered = true;
        const right = q === answer;
        if (right) { this.theoryHits++; spawnPerfectSpark(this, W / 2, 400); hitstop(this, 40); } else shake(this, 3);
        hint.setText(right ? `Yes - ${QUALITY_LABELS[answer].toLowerCase()}: ${QUALITY_HINTS[answer]}.` : `That was ${QUALITY_LABELS[answer].toLowerCase()} - ${QUALITY_HINTS[answer]}.`);
        this.playChordSymbol(symbol);
        this.theoryRound++;
        this.time.delayedCall(2200, () => this.runChordQualityRound());
      }, { fillColor: PALETTE.teal, fontSize: '19px' }));
    });
  }

  private runTransposeRound(): void {
    const rounds = this.mg.theoryRounds ?? 4;
    if (this.theoryDone(rounds)) return;
    const song = getSong(getCity(this.cityId).songId);
    const chords = song.chordProgression.split('-');
    const from = chords[this.theoryRng.int(0, chords.length)];
    const MOVES = [{ semis: -2, name: 'down a whole step' }, { semis: 2, name: 'up a whole step' }, { semis: -1, name: 'down a half step' }, { semis: 5, name: 'up a fourth' }, { semis: 7, name: 'up a fifth' }];
    const move = MOVES[Math.min(this.theoryRound, MOVES.length - 1)];
    const answer = transposeChord(from, move.semis);
    const wrongs = [transposeChord(from, move.semis + 1), transposeChord(from, move.semis - 1), transposeChord(from, move.semis + 2)].filter((c) => c !== answer);
    const options = this.theoryRng.shuffle([answer, wrongs[0], wrongs[1]]);
    const hint = this.theoryFrame(`Move ${from} ${move.name}`, rounds);
    hint.setText(`Question ${this.theoryRound + 1} of ${rounds} - Mira's voice is shot tonight; the set moves ${move.name}. Which chord does ${from} become?`);
    this.playChordSymbol(from);
    this.contentLayer.add(createButton(this, W / 2 - 110, 320, 220, 58, `Hear ${from}`, () => this.playChordSymbol(from), { fillColor: PALETTE.plum, fontSize: '17px' }));
    let answered = false;
    options.forEach((opt, i) => {
      this.contentLayer.add(createButton(this, W / 2 - 260, 410 + i * 84, 520, 70, opt, () => {
        if (answered) return;
        answered = true;
        const right = opt === answer;
        if (right) { this.theoryHits++; spawnPerfectSpark(this, W / 2, 400); hitstop(this, 40); } else shake(this, 3);
        const { quality } = splitChord(from);
        hint.setText(right ? `Yes - ${from} ${move.name} is ${answer}${quality ? ' (same quality, new root)' : ''}.` : `${from} ${move.name} is ${answer}, not ${opt}. Same shape, ${Math.abs(move.semis)} fret${Math.abs(move.semis) === 1 ? '' : 's'} over.`);
        this.playChordSymbol(from);
        this.playChordSymbol(answer, 0.9);
        this.theoryRound++;
        this.time.delayedCall(2600, () => this.runTransposeRound());
      }, { fillColor: PALETTE.teal, fontSize: '22px' }));
    });
  }

  private runMeterRound(): void {
    const rounds = this.mg.theoryRounds ?? 3;
    if (this.theoryDone(rounds)) return;
    const METERS = [
      { name: '4/4', beats: 4, step: 0.5, accents: [0], note: 'four even beats, the heaviest on one - almost everything on the radio' },
      { name: '3/4', beats: 3, step: 0.5, accents: [0], note: 'ONE two three, ONE two three - a waltz, a lullaby, a slow sway' },
      { name: '6/8', beats: 6, step: 0.25, accents: [0, 3], note: 'six quick pulses in two groups of three - a lilt, a rolling feel' },
    ];
    const answer = METERS[this.theoryRng.int(0, METERS.length)];
    const play = () => {
      for (let bar = 0; bar < 2; bar++) for (let b = 0; b < answer.beats; b++) {
        const t = (bar * answer.beats + b) * answer.step;
        audio.playPitch(answer.accents.includes(b) ? 1320 : 880, answer.accents.includes(b) ? 0.12 : 0.07, t, 'square');
      }
    };
    const hint = this.theoryFrame('What time signature was that?', rounds);
    hint.setText(`Question ${this.theoryRound + 1} of ${rounds} - Theo counts it in. Feel where the heavy beat lands.`);
    play();
    this.contentLayer.add(createButton(this, W / 2 - 110, 320, 220, 58, 'Hear it again', play, { fillColor: PALETTE.plum, fontSize: '17px' }));
    let answered = false;
    METERS.forEach((m, i) => {
      this.contentLayer.add(createButton(this, W / 2 - 260, 410 + i * 84, 520, 70, m.name, () => {
        if (answered) return;
        answered = true;
        const right = m.name === answer.name;
        if (right) { this.theoryHits++; spawnPerfectSpark(this, W / 2, 400); hitstop(this, 40); } else shake(this, 3);
        hint.setText(right ? `Yes - ${answer.name}: ${answer.note}.` : `That was ${answer.name} - ${answer.note}.`);
        this.theoryRound++;
        this.time.delayedCall(2400, () => this.runMeterRound());
      }, { fillColor: PALETTE.teal, fontSize: '24px' }));
    });
  }

  private runTempoRound(): void {
    const rounds = this.mg.theoryRounds ?? 2;
    if (this.theoryDone(rounds)) return;
    const target = getCity(this.cityId).tempo + this.theoryRng.int(-14, 15);
    const beat = 60 / target;
    const play = () => { for (let i = 0; i < 8; i++) audio.playPitch(i % 4 === 0 ? 1320 : 880, 0.07, i * beat, 'square'); };
    const hint = this.theoryFrame('Find the tempo', rounds);
    hint.setText(`Round ${this.theoryRound + 1} of ${rounds} - the crowd claps at one speed. Tap the pad along with it, at least five times.`);
    play();
    this.tempoTaps = [];
    this.contentLayer.add(createButton(this, W / 2 - 110, 320, 220, 58, 'Hear it again', play, { fillColor: PALETTE.plum, fontSize: '17px' }));
    const pad = this.add.rectangle(W / 2, 560, 360, 240, PALETTE.terracotta, 0.95).setStrokeStyle(4, PALETTE.cream, 0.9).setInteractive({ useHandCursor: true });
    this.contentLayer.add(pad);
    const readout = this.add.text(W / 2, 560, 'TAP', textStyle('h1', { fontSize: '34px', color: PALETTE_HEX.cream })).setOrigin(0.5);
    this.contentLayer.add(readout);
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      const t = this.tempoTaps;
      const gaps = t.slice(1).map((v, i) => v - t[i]).sort((a, b) => a - b);
      const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : beat * 1000;
      const bpm = Math.round(60000 / Math.max(1, median));
      const err = Math.abs(bpm - target) / target;
      const right = err <= 0.1;
      if (err <= 0.04) { this.theoryHits++; spawnPerfectSpark(this, W / 2, 560); hitstop(this, 40); }
      else if (right) { this.theoryHits++; }
      else shake(this, 3);
      readout.setText(`${bpm} BPM`);
      hint.setText(right ? `Yes - you tapped ${bpm}, the crowd is at ${target}. ${err <= 0.04 ? 'Dead on.' : 'Close enough to lock in.'}` : `You tapped ${bpm}; the crowd is at ${target}. ${bpm > target ? 'Rushing' : 'Dragging'} - relax the shoulders and listen for the heavy beat.`);
      this.theoryRound++;
      this.time.delayedCall(2600, () => this.runTempoRound());
    };
    pad.on('pointerdown', () => {
      if (settled) return;
      this.tempoTaps.push(this.time.now);
      audio.playSfx('tap');
      spawnRingPulse(this, W / 2, 560, PALETTE.cream);
      readout.setText(`${this.tempoTaps.length} / 6`);
      if (this.tempoTaps.length >= 6) this.time.delayedCall(250, settle);
    });
    // No-fail: a player who never taps still moves on after a while.
    this.time.delayedCall(20000, () => { if (!settled) { if (this.tempoTaps.length >= 2) settle(); else { settled = true; hint.setText('Moving on - no penalty'); this.theoryRound++; this.time.delayedCall(900, () => this.runTempoRound()); } } });
  }

}
