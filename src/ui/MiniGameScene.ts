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
import { fillTemplate, DEFAULT_LEDGER, resolveSplit, resolvePricing, resolvePerDiem, resolveGearCall, resolveExchange, exchangeWorking, exchangeCalcQuestion, doorTake, breakEvenTurnout, demandAt, perDiemForecast, type LedgerOutcome } from '../game/ledger';
import { chordFrequencies, splitChord, transposeChord, QUALITY_LABELS, QUALITY_HINTS } from '../core/musicTheory';
import { rapportFor, RAPPORT_LABEL, HOST_NAMES, quietLine, wrongToRemove, chordHint, transposeHint, meterHint, tempoHint, splitHint, pricingHint, perDiemHint, gearHint, setlistHint, type Rapport } from '../game/bandHelp';
import { getSong } from '../game/content';
import { makeRng } from '../core/rng';
import { stamp, countUp, cameo, verbSplash, beatPulse, encore, buzz } from '../art/juice';
import { VERB, resultStamp, ledgerStamp, LEVEL_STAMP, cameoMood, beatMs, shouldEncore } from '../game/juiceRules';
import { drawHand, bestSet, segue, arc, scoreSet, setTier, CIRCLE_MAJORS, CIRCLE_MINORS, type SetCard, type SegueVerdict } from '../game/setbuilder';
import { haulOffers, bestHaul, playDay, doorPay, breakEven, turnoutFor, haulTier, HAUL_DAYS, HAUL_FLOAT, MOTEL, TIRED_MAX, TIRED_TURNOUT, HAUL_LESSON, type Deal, type Bed } from '../game/longhaul';
import { problemSequence, channelLevel, inPocket, masterLevel, mixOutcome, MIX_CHANNELS, POCKET, CLIP_AT, FADER_MAX, FIX_WINDOW, PROBLEM_GAP, DRIVE, PROBLEM_LINE, type MixProblem } from '../game/mixdesk';
import { gainVerdict, GAIN_FEEDBACK, GAIN_CHANNELS, isHeavy, packIssue, SIGNAL_CHAIN, takeawayFor, MINIGAME_SKILL, hostReaction, priorHosted, type Tier } from '../game/craft';

const HELP_TEXT: Record<MiniGameDef['type'], string> = {
  timing: 'Set the level: tap when the needle is in the gold sweet spot. Left of it is too quiet (hiss), right of it clips (distortion). No penalty for missing.',
  drag: 'Load the gear before the timer runs out. Heavy items (marked) go on the floor row at the bottom; light gear goes on top.',
  choice: 'Pick the answer you would give. Neither is wrong, but one lands better, and after each answer you are told why.',
  sequence: 'The pads are a synth, in signal order: oscillator, filter, envelope, amp. Watch them light, then tap them back in order.',
  sustain: 'Listen for what goes wrong: a channel spikes into the red, or drops out. Find it and drag its fader until its meter sits in the green pocket.',
  pressure: 'Answer fast, live on air. Silence answers for you, which is also an answer. Each answer is explained.',
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
  setlist: 'Pick 4 of your 6 songs, in order. Keys side by side on the circle of fifths flow; a big jump or a tempo lurch clashes. Open strong, give them a breather, build, and close on the biggest song.',
  longhaul: 'Three days on the road. Each day: a stop, a deal, a bed. Fuel and beds are paid before the show pays you, so watch the float. A tired band draws a smaller crowd.',
};

// No-fail, structurally: the header of this file promises every path reaches an outro, "including
// simply not touching anything until a safety timer fires." The timing/drag/sequence/sustain/choice
// types always kept that promise. The decision types did not — interval, clave, and every ledger
// and theory game added later waited for a tap forever. These are their safety timers.
const THEORY_IDLE_MS = 25000;
const LEDGER_IDLE_MS = 45000;

export class MiniGameScene extends Phaser.Scene {
  constructor() { super('MiniGame'); }

  private cityId!: string;
  private mg!: MiniGameDef;
  private returnPhase!: string;
  /** QA #9 / decision D6: launched from the Hub's Practice picker. No reward, no relationship
   *  change, no played-flag, no memory entry; returns to the Hub instead of the city. */
  private practice = false;
  private practiceBack: Phaser.GameObjects.Container | null = null;
  /** Fix the Mix: the current problem's fader and its target (read by e2e/minigame-playthrough). */
  mixHint: { x: number; y: number } | null = null;
  private outcomeGood = false;
  /** True only when the player aced it outright, not merely passed. Gates outroTextPerfect. */
  private outcomePerfect = false;
  private theoryRound = 0;
  private theoryHits = 0;
  private theoryRng!: ReturnType<typeof makeRng>;
  private contentLayer!: Phaser.GameObjects.Container;
  private titleText!: Phaser.GameObjects.Text;
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
  /** Rapport with this game's host bandmate, fixed when the game opens; null if nobody hosts it.
   *  It decides the help the host gives (src/game/bandHelp.ts). */
  private rapport: Rapport | null = null;
  private helpUsed = false;
  private tempoPulse: Phaser.Time.TimerEvent | null = null;

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
    this.rapport = this.mg.hostBandmate ? rapportFor(State.data.relationships[this.mg.hostBandmate]) : null;
    this.helpUsed = false;
    this.tempoPulse = null;
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
    this.titleText = this.add.text(W / 2, 60, this.mg.title, textStyle('h1', { color: PALETTE_HEX.cream })).setOrigin(0.5);
    addHelpButton(this, HELP_TEXT[this.mg.type]);
    addMenuButton(this, 'MiniGame');

    this.contentLayer = this.add.container(0, 0);
    this.showIntro();
    // Practice has a way out at every moment, not only at the result card (QA round 3 #6). Bottom
    // centre: the one strip no minigame draws into (the title owns the top, the host strip and
    // every game's content sit above y=1100). Nothing is at stake, so it leaves without asking.
    this.practiceBack = null;
    if (this.practice) {
      this.practiceBack = createButton(this, W / 2 - 150, SAFE_BOTTOM_Y - 74, 300, 66, '← Back to practice', () => {
        audio.stopMusic();
        goTo(this, 'Hub', { practiceCity: this.cityId });
      }, { fillColor: PALETTE.plum, fontSize: '18px' }).setDepth(300);
    }
  }

  private clearContent(): void {
    this.contentLayer.removeAll(true);
  }

  /** The host's strip under the title: who is hosting, how close you are, and a line their help
   *  (or their silence) fills in. Returns that line, or null for a game nobody hosts. */
  private hostStrip(): Phaser.GameObjects.Text | null {
    if (!this.rapport || !this.mg.hostBandmate) return null;
    this.contentLayer.add(addTextScrim(this, W / 2, 144, W - 60, 80));
    const color = this.rapport === 'close' ? PALETTE_HEX.gold : PALETTE_HEX.cream;
    this.contentLayer.add(this.add.text(W / 2, 118, `${HOST_NAMES[this.mg.hostBandmate]} · ${RAPPORT_LABEL[this.rapport]}`,
      textStyle('small', { fontSize: '15px', color })).setOrigin(0.5));
    const line = this.add.text(W / 2, 140, '', textStyle('small', { fontSize: '15px', color: PALETTE_HEX.cream, wordWrap: { width: W - 110 }, align: 'center' })).setOrigin(0.5, 0);
    this.contentLayer.add(line);
    return line;
  }

  /** Close: the help arrives on its own. Steady: an "Ask <name>" button, once per game. Distant:
   *  the host keeps to themselves. `apply` performs the help and returns the host's line. */
  private offerHelp(line: Phaser.GameObjects.Text | null, apply: () => string, askX: number, askY: number): void {
    if (!line || !this.rapport || !this.mg.hostBandmate) return;
    if (this.rapport === 'distant') { line.setText(quietLine(this.mg.hostBandmate)); return; }
    if (this.rapport === 'close') { line.setText(apply()); return; }
    if (this.helpUsed) return;
    const btn = createButton(this, askX, askY, 176, 58, `Ask ${HOST_NAMES[this.mg.hostBandmate]}`, () => {
      if (this.helpUsed) return;
      this.helpUsed = true;
      btn.setVisible(false);
      line.setText(apply());
      audio.playSfx('tap');
    }, { fillColor: PALETTE.plum, fontSize: '17px' });
    this.contentLayer.add(btn);
  }

  /** Grey out some wrong answers (never the right one, always leaving at least one wrong). */
  private dimWrong(opts: { key: string; btn: Phaser.GameObjects.Container }[], answer: string, dimmed: Set<string>): void {
    const wrong = this.theoryRng.shuffle(opts.filter((o) => o.key !== answer && !dimmed.has(o.key)));
    // the buttons fade in (Button.ts); stop that tween or it would restore full alpha afterwards
    for (const o of wrong.slice(0, wrongToRemove(opts.length))) { dimmed.add(o.key); this.tweens.killTweensOf(o.btn); o.btn.setScale(1).setAlpha(0.45); }
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
      case 'timing': { const r = this.timingRoundsSec; return { seconds: r.reduce((a, b) => a + b, 0) * 1.6 + r.length * 1.5, rounds: r.length }; }
      case 'drag': return { seconds: mg.dragTimeSec ?? 30, rounds: (mg.dragItems ?? []).length || 6 };
      case 'choice': return { seconds: (mg.questions ?? []).length * 7, rounds: (mg.questions ?? []).length };
      case 'pressure': return { seconds: (mg.questions ?? []).length * ((mg.pressureSeconds ?? 4) + 2.5), rounds: (mg.questions ?? []).length };
      case 'sequence': { const r = mg.sequenceRounds ?? [3, 4, 5]; return { seconds: r.reduce((a, b) => a + b * 0.34 * 2 + 2.2, 0), rounds: r.length }; }
      case 'sustain': return { seconds: (mg.sustainSeconds ?? 12) * 1.4, rounds: 1 };
      case 'interval': case 'clave': case 'chordquality': case 'transpose': case 'meter': return { seconds: (mg.theoryRounds ?? 4) * 8, rounds: mg.theoryRounds ?? 4 };
      case 'tempo': return { seconds: (mg.theoryRounds ?? 2) * 14, rounds: mg.theoryRounds ?? 2 };
      case 'exchange': return { seconds: 50, rounds: 2 };
      case 'setlist': return { seconds: 90, rounds: 1 };
      case 'longhaul': return { seconds: 120, rounds: 3 };
      case 'split': case 'pricing': case 'perdiem': case 'gearcall': return { seconds: 35, rounds: 1 };
      default: return { seconds: 30, rounds: 3 };
    }
  }

  private showIntro(): void {
    this.clearContent();
    const cardImg = this.card(300, 300);
    const intro = this.add.text(W / 2, 330, this.mg.introText, textStyle('dialogue', {
      fontSize: '24px', wordWrap: { width: W - 140 }, align: 'center', lineSpacing: 6,
    })).setOrigin(0.5, 0);
    this.contentLayer.add(intro);
    // Name the skill before the practice (QA round 4 depth pass): what this minigame teaches.
    const skillY = Math.max(452, intro.y + intro.height + 16);
    this.contentLayer.add(this.add.text(W / 2, skillY, `You'll practise: ${MINIGAME_SKILL[this.mg.type]}`,
      textStyle('small', { fontSize: '17px', fontStyle: '700', color: PALETTE_HEX.teal, align: 'center', wordWrap: { width: W - 160 } })).setOrigin(0.5));
    const est = this.estimate();
    const secs = Math.max(10, Math.round(est.seconds / 10) * 10);
    const roundsLabel = est.rounds > 1 ? `${est.rounds} rounds` : 'one round';
    this.contentLayer.add(this.add.text(W / 2, skillY + 34, `About ${secs} seconds · ${roundsLabel}${this.practice ? ' · practice, nothing at stake' : ' · no way to fail'}`,
      textStyle('small', { fontSize: '14px', color: PALETTE_HEX.plum, align: 'center', wordWrap: { width: W - 160 } })).setOrigin(0.5));
    const startY = skillY + 68;
    if (startY + 66 + 14 > 600) { cardImg.destroy(); this.contentLayer.sendToBack(this.card(300, startY + 80 - 300)); }
    this.contentLayer.add(createButton(this, W / 2 - 130, startY, 260, 66, 'Start', () => this.beginGame(), { fillColor: 0x3e7c7b }));
  }

  private beginGame(): void {
    this.clearContent();
    verbSplash(this, VERB[this.mg.type], this.titleText);
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
    else if (this.mg.type === 'setlist') this.runSetlist();
    else if (this.mg.type === 'longhaul') this.runLongHaul();
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
    // A level meter, not an abstract gauge (2026-10-02): left of the gold window is too quiet (the
    // noise floor comes up with it later), right of it is clipping (distortion you cannot undo).
    this.contentLayer.add(this.add.rectangle(barX, barY, barW, barH, 0x000000, 0.3).setOrigin(0, 0));
    this.contentLayer.add(this.add.rectangle(zoneX + zoneW, barY, barX + barW - zoneX - zoneW, barH, 0xc0392b, 0.45).setOrigin(0, 0));
    this.contentLayer.add(this.add.rectangle(zoneX, barY, zoneW, barH, PALETTE.gold, 0.55).setOrigin(0, 0));
    this.contentLayer.add(addTextScrim(this, W / 2, barY + barH + 24, barW + 20, 34));
    const zoneLabel = (x: number, text: string) => this.contentLayer.add(this.add.text(x, barY + barH + 24, text, textStyle('small', { fontSize: '15px', color: PALETTE_HEX.cream })).setOrigin(0.5));
    zoneLabel(barX + (zoneX - barX) / 2, 'too quiet');
    zoneLabel(zoneX + zoneW / 2, 'sweet spot');
    zoneLabel(zoneX + zoneW + (barX + barW - zoneX - zoneW) / 2, 'clipping');
    const channel = GAIN_CHANNELS[makeRng(`${State.data.seed}:gain:${this.mg.id}:${this.timingRound}`).int(0, GAIN_CHANNELS.length)];
    this.contentLayer.add(addTextScrim(this, W / 2, barY - 40, 420, 48));
    // h2's default sky measures 2.90:1 on this scrim (just under the 3:1 large-text floor).
    this.contentLayer.add(this.add.text(W / 2, barY - 40, `Level ${this.timingRound + 1} of ${rounds.length}: ${channel}`,
      textStyle('h2', { color: PALETTE_HEX.cream })).setOrigin(0.5));
    // LED ladder above the meter: segments light as the needle passes, in the zone's own color
    const leds: Phaser.GameObjects.Rectangle[] = [];
    const ledN = 18, ledW = barW / ledN;
    for (let k = 0; k < ledN; k++) {
      const lx = barX + k * ledW;
      const col = lx + ledW / 2 < zoneX ? 0x4caf50 : lx + ledW / 2 <= zoneX + zoneW ? PALETTE.gold : 0xe53935;
      const led = this.add.rectangle(lx + 2, barY - 13, ledW - 4, 8, col, 0.18).setOrigin(0, 0);
      leds.push(led);
      this.contentLayer.add(led);
    }
    const lightLeds = (): void => { const nx = this.needle?.x ?? barX; leds.forEach((l) => l.setFillStyle(l.fillColor, l.x <= nx ? 0.95 : 0.18)); };
    const verdictText = this.add.text(W / 2, barY + barH + 74, '', textStyle('small', { fontSize: '17px', color: PALETTE_HEX.cream, wordWrap: { width: W - 120 }, align: 'center' })).setOrigin(0.5);
    const verdictScrim = addTextScrim(this, W / 2, barY + barH + 74, W - 80, 52).setVisible(false);
    this.contentLayer.add([verdictScrim, verdictText]);

    this.needle = this.add.circle(barX, barY + barH / 2, 14, PALETTE.cream, 1);
    this.contentLayer.add(this.needle);
    const sweepMs = rounds[this.timingRound] * 1000;
    this.needleTween = this.tweens.add({
      targets: this.needle, x: barX + barW, duration: sweepMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      onUpdate: lightLeds,
    });

    let resolved = false;
    const resolve = (verdict: 'quiet' | 'sweet' | 'clip' | null) => {
      if (resolved) return;
      resolved = true;
      this.needleTween?.stop();
      const hit = verdict === 'sweet';
      audio.playSfx(hit ? 'perfect' : 'ok');
      if (hit) { this.timingHits++; spawnRingPulse(this, this.needle!.x, barY + barH / 2, PALETTE.gold); } else if (verdict === 'clip') shake(this, 3);
      // Say what the level did, so a miss teaches the same lesson a hit does.
      verdictScrim.setVisible(true);
      verdictText.setText(verdict ? GAIN_FEEDBACK[verdict] : 'No level set. The engineer moves on.');
      if (verdict) this.contentLayer.add(stamp(this, W / 2, 712, LEVEL_STAMP[verdict], verdict === 'sweet' ? PALETTE.teal : PALETTE.terracotta, 28));
      this.timingRound++;
      this.time.delayedCall(1300, () => this.runTimingRound());
    };
    // Safety timeout: a player who never taps still advances — no-fail is structural, not just a design intent.
    this.time.delayedCall(sweepMs * 3, () => resolve(null));

    const btn = createButton(this, W / 2 - 130, 580, 260, 70, 'Set level', () => {
      resolve(gainVerdict(this.needle!.x, zoneX, zoneW));
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

    // Weight-aware (2026-10-02): when the def names heavyItems, the bottom row of slots is the floor
    // and is sized to fit exactly the heavy items; light gear rides on top. Any drop still lands
    // (no-fail), but a heavy item up top is called out, and only a load with every heavy item on
    // the floor is perfect. Without heavyItems the layout is the original 3-wide grid.
    const heavy = this.mg.heavyItems ?? [];
    const floorCount = heavy.length;
    const topCount = items.length - floorCount;
    const slots: { rect: Phaser.GameObjects.Rectangle; filled: boolean; floor: boolean; tag: Phaser.GameObjects.Text | null }[] = [];
    items.forEach((_, i) => {
      let x: number, y: number, floor = false;
      if (floorCount > 0) {
        floor = i >= topCount;
        const k = floor ? i - topCount : i, inRow = floor ? floorCount : topCount;
        const rowW = inRow * (slotW + 14) - 14;
        x = (W - rowW) / 2 + k * (slotW + 14);
        y = floor ? 776 : 700;
      } else {
        const col = i % cols, row = Math.floor(i / cols);
        x = startX + col * (slotW + 14); y = 700 + row * (slotH + 16);
      }
      const slot = this.add.rectangle(x, y, slotW, slotH, floor ? 0x3a2410 : 0x000000, floor ? 0.45 : 0.25).setOrigin(0, 0);
      slot.setStrokeStyle(2, PALETTE.gold, 0.6);
      this.contentLayer.add(slot);
      let tag: Phaser.GameObjects.Text | null = null;
      if (floorCount > 0) {
        tag = this.add.text(x + slotW / 2, y + slotH / 2, floor ? 'floor: heavy' : 'top: light', textStyle('small', { fontSize: '15px', color: PALETTE_HEX.cream })).setOrigin(0.5).setAlpha(0.85);
        this.contentLayer.add(tag);
      }
      slots.push({ rect: slot, filled: false, floor, tag });
    });

    let placedCount = 0;
    let heavyUpTop = 0;
    this.contentLayer.add(addTextScrim(this, W / 2, 500, 340, 90));
    // Both default to gold/sky, which measure 2.77:1 / 2.90:1 on this scrim (just under 3:1) —
    // cream reliably clears it, see docs/contrast-audit.md.
    const timerText = this.add.text(W / 2, 480, `${timeSec}s`, textStyle('h1', { fontSize: '26px', color: PALETTE_HEX.cream })).setOrigin(0.5);
    this.contentLayer.add(timerText);
    const dragHint = this.add.text(W / 2, 520, floorCount > 0 ? 'Heavy items on the floor row, light gear on top' : 'Drag each item into an open slot', textStyle('small', { fontSize: '15px', color: PALETTE_HEX.cream })).setOrigin(0.5);
    this.contentLayer.add(dragHint);

    let secondsLeft = timeSec;
    let finished = false;
    const finishOnce = () => {
      if (finished) return;
      finished = true;
      timerEvent.destroy();
      const all = placedCount >= items.length;
      this.finish(all, all && floorCount > 0 && heavyUpTop === 0);
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
      const heavyItem = isHeavy(label, heavy);
      if (heavyItem) chip.setTint(PALETTE.plum);
      const label_ = this.add.text(startPosX + chipW / 2, startPosY + chipH / 2, heavyItem ? `${label} (heavy)` : label, textStyle('button', { fontSize: '15px' })).setOrigin(0.5);
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
          target.tag?.setVisible(false);
          const issue = packIssue(label, heavy, target.floor);
          if (issue) { heavyUpTop++; dragHint.setText(issue); shake(this, 2); } else if (floorCount > 0 && heavyItem) dragHint.setText(`${label} on the floor. Solid.`);
          if (heavyItem) {
            // weight: a thud, a dust ring, a nudge of the camera; up top, the stack wobbles
            shake(this, 2); buzz('thud'); audio.playPitch(98, 0.14, 0, 'square');
            spawnRingPulse(this, target.rect.x + slotW / 2, target.rect.y + slotH, PALETTE.sand);
            if (issue && !State.data.accessibility.reducedMotion) this.tweens.add({ targets: chip, angle: { from: -4, to: 4 }, duration: 90, yoyo: true, repeat: 3, onComplete: () => chip.setAngle(0) });
          } else if (!State.data.accessibility.reducedMotion) {
            this.tweens.add({ targets: chip, scaleX: 1.06, scaleY: 1.06, duration: 70, yoyo: true });
            buzz('tick');
          }
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
    this.card(300, q.coach ? 520 : 460);
    this.contentLayer.add(this.add.text(W / 2, 60 + 280, `Question ${this.questionIndex + 1} of ${questions.length}`,
      textStyle('small', { color: PALETTE_HEX.plum })).setOrigin(0.5));
    this.contentLayer.add(this.add.text(W / 2, 350, q.prompt, textStyle('dialogue', {
      fontSize: '24px', wordWrap: { width: W - 140 }, align: 'center', lineSpacing: 6,
    })).setOrigin(0.5, 0));

    let answered = false;
    const advance = (picked: 'A' | 'B' | null) => {
      if (answered) return;
      answered = true;
      const warm = picked === q.warmerOption;
      if (warm) this.warmerCount++;
      audio.playSfx('choiceConfirm');
      this.questionIndex++;
      // Media coaching (2026-10-02): say why the warmer answer works, whichever was picked. Without
      // a note the interview moves straight on, exactly as before.
      if (q.coach) {
        coachText.setText(`${warm ? 'That lands.' : picked ? 'Fine, but the other one lands better.' : 'Silence on air.'} ${q.coach}`);
        coachText.setVisible(true);
        // a producer's sticky note slapped onto the card
        if (!State.data.accessibility.reducedMotion) { coachText.setScale(1.15).setAlpha(0); this.tweens.add({ targets: coachText, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' }); }
        buzz('tick');
        this.time.delayedCall(2600, () => this.runChoiceQuestion());
      } else this.time.delayedCall(250, () => this.runChoiceQuestion());
    };
    const coachText = this.add.text(W / 2, 700, '', textStyle('small', { fontSize: '17px', color: PALETTE_HEX.plum, wordWrap: { width: W - 190 }, align: 'center', backgroundColor: '#F6E7A1', padding: { x: 14, y: 10 } })).setOrigin(0.5, 0).setVisible(false).setAngle(1.5);
    this.contentLayer.add(coachText);
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
      // Each pad is a module, left to right in signal order (2026-10-02), so the pattern is a patch.
      this.contentLayer.add(this.add.text(pad.x + padW / 2, padY + padH / 2, SIGNAL_CHAIN[i], textStyle('button', { fontSize: '20px' })).setOrigin(0.5));
    }
    if (this.sequenceRound === 0) {
      this.contentLayer.add(addTextScrim(this, W / 2, padY + padH + 84, W - 80, 40));
      this.contentLayer.add(this.add.text(W / 2, padY + padH + 84, 'Sound flows left to right: make it, shape it, move it, send it.', textStyle('small', { fontSize: '15px', color: PALETTE_HEX.cream })).setOrigin(0.5));
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
            // the signal flows OSC -> FILTER -> ENV -> AMP
            if (!State.data.accessibility.reducedMotion) pads.forEach((p, k) => this.tweens.add({ targets: p, scaleY: 1.12, duration: 90, yoyo: true, delay: k * 80 }));
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
  // ---- FIX THE MIX (2026-10-07): hear a problem, find the channel, ride its fader. ----
  // Four channels, each with a fader and a meter, and a real four-stem band playing through them
  // (audio.startStems). Problems arrive one at a time: a channel spikes into the red or drops out.
  // Find it (by ear and by meter) and drag its fader until the meter sits in the green pocket.
  // Replaces "Hold the Mix", which asked the player to chase a drifting window. src/game/mixdesk.ts.
  private runSustain(): void {
    this.clearContent();
    const problems = problemSequence(`${State.data.seed}:${this.mg.id}`);
    const n = MIX_CHANNELS.length;
    const stripW = 120, gap = 42, left = (W - (n * stripW + (n - 1) * gap)) / 2;
    const trackTop = 380, trackH = 380;
    const faders = MIX_CHANNELS.map(() => 0.7);
    const drives = MIX_CHANNELS.map(() => 1);
    const fixTimes: (number | null)[] = [];
    let current: { p: MixProblem; at: number } | null = null;
    let index = 0, nextAt = 1.4, t = 0, done = false;
    const stems = audio.startStems(this.mg.bpm ?? 100);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => stems?.stop());
    this.events.on(Phaser.Scenes.Events.PAUSE, () => MIX_CHANNELS.forEach((_, i) => stems?.setLevel(i, 0)));

    this.contentLayer.add(addTextScrim(this, W / 2, 232, W - 60, 120));
    this.contentLayer.add(this.add.text(W / 2, 196, 'Fix the mix', textStyle('h2', { color: PALETTE_HEX.cream })).setOrigin(0.5));
    const talk = this.add.text(W / 2, 236, 'Listen. Every channel is in the pocket for now.', textStyle('small', {
      fontSize: '17px', color: PALETTE_HEX.gold, wordWrap: { width: W - 120 }, align: 'center',
    })).setOrigin(0.5, 0);
    this.contentLayer.add(talk);

    const fy = (v: number) => trackTop + trackH - (v / FADER_MAX) * trackH;          // fader value -> y
    const fv = (y: number) => Phaser.Math.Clamp(((trackTop + trackH - y) / trackH) * FADER_MAX, 0, FADER_MAX);
    const meterMax = 1.4;
    const my = (v: number) => trackTop + trackH - (Math.min(v, meterMax) / meterMax) * trackH;
    const knobs: Phaser.GameObjects.Rectangle[] = [];
    const meters: Phaser.GameObjects.Rectangle[] = [];
    const states: Phaser.GameObjects.Text[] = [];
    MIX_CHANNELS.forEach((name, i) => {
      const x = left + i * (stripW + gap);
      // a solid strip and label plate: the desk painting behind is busy, the controls must not be
      this.contentLayer.add(this.add.rectangle(x, trackTop - 10, stripW, trackH + 90, PALETTE.night, 0.86).setOrigin(0, 0));
      // the meter: the pocket in green, the clip zone in red
      const mx = x + stripW - 30;
      this.contentLayer.add(this.add.rectangle(mx, trackTop, 18, trackH, 0x000000, 0.45).setOrigin(0, 0));
      this.contentLayer.add(this.add.rectangle(mx, my(POCKET.hi), 18, my(POCKET.lo) - my(POCKET.hi), 0x4caf50, 0.35).setOrigin(0, 0));
      this.contentLayer.add(this.add.rectangle(mx, trackTop, 18, my(CLIP_AT) - trackTop, 0xc0392b, 0.4).setOrigin(0, 0));
      const meter = this.add.rectangle(mx + 3, my(0), 12, 1, PALETTE.gold, 0.95).setOrigin(0, 0);
      this.contentLayer.add(meter); meters.push(meter);
      // the fader: tap or drag anywhere on the strip and the knob follows the finger
      const track = this.add.rectangle(x, trackTop - 10, stripW - 34, trackH + 20, 0x000000, 0.001).setOrigin(0, 0).setInteractive();
      this.contentLayer.add(track);
      this.contentLayer.add(this.add.rectangle(x + (stripW - 34) / 2 - 3, trackTop, 6, trackH, PALETTE.cream, 0.35).setOrigin(0, 0));
      const knob = this.add.rectangle(x + 6, fy(faders[i]) - 22, stripW - 46, 44, PALETTE.cream, 0.95).setOrigin(0, 0);
      this.contentLayer.add(knob); knobs.push(knob);
      const follow = (p: Phaser.Input.Pointer): void => { if (!done) faders[i] = fv(p.y); };
      track.on('pointerdown', follow);
      track.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.isDown) follow(p); });
      this.contentLayer.add(this.add.text(x + stripW / 2, trackTop + trackH + 30, name, textStyle('small', { fontSize: '17px', fontStyle: '700', color: PALETTE_HEX.cream })).setOrigin(0.5));
      const st = this.add.text(x + stripW / 2, trackTop + trackH + 56, 'OK', textStyle('small', { fontSize: '15px', color: PALETTE_HEX.cream })).setOrigin(0.5);
      this.contentLayer.add(st); states.push(st);
    });
    this.contentLayer.add(this.add.text(W / 2, trackTop - 34, 'Green = in the pocket   ·   Red = clipping', textStyle('small', { fontSize: '15px', color: PALETTE_HEX.cream })).setOrigin(0.5));
    // the master: the whole mix, what the room hears
    const masterY = trackTop + trackH + 96;
    this.contentLayer.add(addTextScrim(this, W / 2, masterY, W - 100, 44, 0.8));
    this.contentLayer.add(this.add.text(left, masterY, 'Master', textStyle('small', { fontSize: '16px', color: PALETTE_HEX.cream })).setOrigin(0, 0.5));
    const mbX = left + 90, mbW = W - left * 2 - 180;
    this.contentLayer.add(this.add.rectangle(mbX, masterY - 8, mbW, 16, 0x000000, 0.5).setOrigin(0, 0));
    const masterBar = this.add.rectangle(mbX, masterY - 8, 1, 16, 0x4caf50, 0.95).setOrigin(0, 0);
    this.contentLayer.add(masterBar);
    const progress = this.add.text(W - left, masterY, '', textStyle('small', { fontSize: '16px', color: PALETTE_HEX.gold })).setOrigin(1, 0.5);
    this.contentLayer.add(progress);

    const finishMix = (): void => {
      if (done) return;
      done = true;
      stems?.stop();
      const out = mixOutcome(fixTimes);
      this.finish(out.good, out.perfect);
    };
    const tick = this.time.addEvent({
      delay: 50, loop: true, callback: () => {
        if (done) { tick.remove(); return; }
        t += 0.05;
        // a new problem arrives
        if (!current && index < problems.length && t >= nextAt) {
          const p = problems[index++];
          drives[p.ch] = DRIVE[p.kind];
          current = { p, at: t };
          talk.setText(PROBLEM_LINE[p.kind](MIX_CHANNELS[p.ch]));
          audio.playSfx(p.kind === 'hot' ? 'ok' : 'miss');
        }
        const levels = faders.map((f, i) => channelLevel(f, drives[i]));
        levels.forEach((lv, i) => {
          stems?.setLevel(i, lv);
          knobs[i].y = fy(faders[i]) - 22;
          // grow upward from the meter's floor: position at the level, size down to the floor
          const top = my(lv);
          meters[i].setPosition(meters[i].x, top).setSize(12, Math.max(1, my(0) - top));
          meters[i].setFillStyle(lv > CLIP_AT ? 0xe53935 : inPocket(lv) ? 0x4caf50 : PALETTE.gold, 0.95);
          const hot = lv > POCKET.hi, low = lv < POCKET.lo;
          states[i].setText(lv > CLIP_AT ? 'CLIPPING' : hot ? 'TOO HOT' : low ? 'TOO QUIET' : 'OK');
          states[i].setColor(hot || low ? '#ffb3a8' : PALETTE_HEX.cream);
        });
        const m = masterLevel(levels);
        masterBar.setSize(Math.max(1, Math.min(1, m / meterMax) * mbW), 16);
        masterBar.setFillStyle(levels.some((lv) => lv > CLIP_AT) ? 0xe53935 : 0x4caf50, 0.95);
        progress.setText(`Fixed ${fixTimes.filter((x) => x !== null).length} of ${problems.length}`);
        // the current problem: fixed when its channel is back in the pocket
        if (current) {
          const ch = current.p.ch;
          if (inPocket(levels[ch])) {
            fixTimes.push(t - current.at);
            talk.setText(`${MIX_CHANNELS[ch]} is back in the pocket. ${t - current.at <= 3 ? 'Quick hands.' : 'Got there.'}`);
            this.contentLayer.add(stamp(this, left + ch * (stripW + gap) + stripW / 2, trackTop + 40, 'FIXED', PALETTE.teal, 22));
            current = null; nextAt = t + PROBLEM_GAP;
          } else if (t - current.at > FIX_WINDOW) {
            // no-fail: the engineer steps in, sets the channel right, and the night goes on
            fixTimes.push(null);
            faders[ch] = ((POCKET.lo + POCKET.hi) / 2) / drives[ch];
            talk.setText(`The engineer reaches over and fixes the ${MIX_CHANNELS[ch].toLowerCase()} himself.`);
            current = null; nextAt = t + PROBLEM_GAP;
          }
        }
        if (!current && index >= problems.length && t >= nextAt) finishMix();
        // For the real-time playthrough test: where the problem is, and where its fader should go.
        this.mixHint = current ? { x: left + current.p.ch * (stripW + gap) + (stripW - 34) / 2, y: fy(((POCKET.lo + POCKET.hi) / 2) / drives[current.p.ch]) } : null;
      },
    });
    // No-fail ceiling, as before: the round always resolves.
    this.time.delayedCall((problems.length * (FIX_WINDOW + PROBLEM_GAP) + 4) * 1000, finishMix);
  }

  // =============================================================================================
  // Long-form (2026-10-03). Rules live in src/game/setbuilder.ts and src/game/longhaul.ts.
  // =============================================================================================

  // ---- The Setlist: order four songs; circle-of-fifths segues and an energy arc. ----
  private runSetlist(): void {
    const hand = drawHand(makeRng(`${State.data.seed}:setlist:${this.mg.id}`));
    const best = bestSet(hand);
    const picked: SetCard[] = [];
    let played = false;
    let hostSaid: string | null = null;
    const VERDICT_COLOR: Record<SegueVerdict, string> = { smooth: PALETTE_HEX.teal, okay: PALETTE_HEX.plum, clash: PALETTE_HEX.terracotta };
    const dots = (e: number) => '●'.repeat(e) + '○'.repeat(5 - e);

    const draw = (): void => {
      this.clearContent();
      this.card(196, 900);
      this.contentLayer.add(this.add.text(W / 2, 226, 'Tonight\'s set', textStyle('h2', { color: PALETTE_HEX.plum })).setOrigin(0.5));
      this.contentLayer.add(this.add.text(W / 2, 254, 'Pick 4 of 6, in order. Neighbors on the circle flow. Open strong, dip, build, close big.', textStyle('small', { fontSize: '16px', color: PALETTE_HEX.plum, wordWrap: { width: W - 150 }, align: 'center' })).setOrigin(0.5, 0));
      // the circle of fifths, majors over their relative minors; keys in the set light up
      const inSet = new Set(picked.map((c) => c.key));
      const colW = 76, x0 = (W - colW * 8) / 2;
      this.contentLayer.add(this.add.text(W / 2, 322, 'The circle of fifths: side by side = smooth', textStyle('small', { fontSize: '14px', color: PALETTE_HEX.plum })).setOrigin(0.5));
      [CIRCLE_MAJORS, CIRCLE_MINORS].forEach((row, r) => row.forEach((k, i) => {
        const on = inSet.has(k);
        this.contentLayer.add(this.add.text(x0 + i * colW + colW / 2, 352 + r * 26, k, textStyle('small', { fontSize: on ? '19px' : '16px', fontStyle: on ? 'bold' : 'normal', color: on ? PALETTE_HEX.teal : PALETTE_HEX.plum })).setOrigin(0.5));
      }));
      // the four slots
      const sw = 148, gap = 10, sx = (W - (sw * 4 + gap * 3)) / 2, sy = 432;
      ['Opener', 'Second', 'Third', 'Closer'].forEach((lbl, i) => {
        const x = sx + i * (sw + gap);
        this.contentLayer.add(this.add.text(x + sw / 2, sy - 14, lbl, textStyle('small', { fontSize: '14px', color: PALETTE_HEX.plum })).setOrigin(0.5));
        const slot = this.add.rectangle(x, sy, sw, 112, 0x000000, picked[i] ? 0.12 : 0.05).setOrigin(0, 0).setStrokeStyle(2, PALETTE.gold, 0.7);
        this.contentLayer.add(slot);
        const c = picked[i];
        if (!c) return;
        slot.setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (!played) { picked.splice(i, 1); audio.playSfx('tap'); draw(); } });
        this.contentLayer.add(this.add.text(x + sw / 2, sy + 10, c.name, textStyle('small', { fontSize: '15px', fontStyle: 'bold', color: PALETTE_HEX.plum, wordWrap: { width: sw - 14 }, align: 'center' })).setOrigin(0.5, 0));
        this.contentLayer.add(this.add.text(x + sw / 2, sy + 66, `${c.key} · ${c.bpm} bpm`, textStyle('small', { fontSize: '14px', color: PALETTE_HEX.plum })).setOrigin(0.5));
        this.contentLayer.add(this.add.text(x + sw / 2, sy + 90, dots(c.energy), textStyle('small', { fontSize: '14px', color: PALETTE_HEX.terracotta })).setOrigin(0.5));
      });
      // live segue verdicts, under the gap between each pair of slots
      for (let i = 0; i + 1 < picked.length; i++) {
        const s = segue(picked[i], picked[i + 1]);
        this.contentLayer.add(this.add.text(sx + (i + 1) * (sw + gap) - gap / 2, sy + 132, s.verdict, textStyle('small', { fontSize: '15px', fontStyle: 'bold', color: VERDICT_COLOR[s.verdict] })).setOrigin(0.5));
      }
      // the hand
      const cw = 196, ch = 100, cg = 12, cx0 = (W - (cw * 3 + cg * 2)) / 2;
      hand.forEach((c, i) => {
        const used = picked.includes(c);
        const b = createButton(this, cx0 + (i % 3) * (cw + cg), 612 + Math.floor(i / 3) * (ch + 12), cw, ch, `${c.name}\n${c.key} · ${c.bpm} bpm\n${dots(c.energy)}`, () => {
          if (played || used || picked.length >= 4) return;
          picked.push(c); audio.playSfx('tap'); draw();
        }, { fillColor: used ? PALETTE.night : (i % 2 === 0 ? PALETTE.teal : PALETTE.plum), fontSize: '15px' });
        // Button.ts fades buttons in; stop that tween or it would restore full alpha afterwards
        if (used) { this.tweens.killTweensOf(b); b.setScale(1).setAlpha(0.35); }
        this.contentLayer.add(b);
      });
      if (picked.length === 4) {
        this.contentLayer.add(createButton(this, W / 2 - 130, 846, 260, 66, 'Play the set', () => play(picked.slice()), { fillColor: 0xd9a441 }));
      } else {
        this.contentLayer.add(this.add.text(W / 2, 872, `Pick ${4 - picked.length} more. Tap a placed song to take it back.`, textStyle('small', { fontSize: '16px', color: PALETTE_HEX.plum })).setOrigin(0.5));
      }
      const line = this.hostStrip();
      if (hostSaid && line) line.setText(hostSaid);
      else this.offerHelp(line, () => (hostSaid = setlistHint(this.mg.hostBandmate!, best.set[0].name, best.set[3].name)), W / 2 - 88, 1000);
    };

    const play = (set: SetCard[]): void => {
      if (played) return;
      played = true;
      this.clearContent();
      this.card(196, 860);
      this.contentLayer.add(this.add.text(W / 2, 226, 'The set', textStyle('h2', { color: PALETTE_HEX.plum })).setOrigin(0.5));
      set.forEach((c, i) => {
        const y = 276 + i * 124;
        this.time.delayedCall(i * 850, () => {
          this.contentLayer.add(this.add.text(W / 2, y, `${i + 1}. ${c.name}`, textStyle('dialogue', { fontSize: '20px', color: PALETTE_HEX.plum })).setOrigin(0.5, 0));
          this.contentLayer.add(this.add.text(W / 2, y + 28, `${c.key} · ${c.bpm} bpm · ${dots(c.energy)}`, textStyle('small', { fontSize: '14px', color: PALETTE_HEX.plum })).setOrigin(0.5, 0));
          if (i > 0) {
            const s = segue(set[i - 1], c);
            const seg = this.add.text(W / 2, y - 40, `${s.verdict === 'smooth' ? 'Smooth' : s.verdict === 'okay' ? 'Okay' : 'Clash'}: ${s.why}`, textStyle('small', { fontSize: '15px', fontStyle: 'bold', color: VERDICT_COLOR[s.verdict], wordWrap: { width: W - 140 }, align: 'center' })).setOrigin(0.5, 0);
            this.contentLayer.add(seg);
            if (!State.data.accessibility.reducedMotion) { seg.setScale(0.85); this.tweens.add({ targets: seg, scale: 1, duration: 160, ease: 'Back.easeOut' }); }
            s.verdict === 'clash' ? shake(this, 2) : spawnRingPulse(this, W / 2, y + 10, PALETTE.gold);
          }
          audio.playSfx(i % 2 ? 'ok' : 'perfect');
        });
      });
      this.time.delayedCall(4 * 850 + 200, () => {
        const checks = arc(set);
        checks.forEach((c, i) => this.contentLayer.add(this.add.text(W / 2, 784 + i * 26, `${c.ok ? '✓' : '✗'} ${c.label}`, textStyle('small', { fontSize: '16px', color: c.ok ? PALETTE_HEX.teal : PALETTE_HEX.terracotta })).setOrigin(0.5, 0)));
        const score = scoreSet(set);
        const tier = setTier(score, best.score);
        const scoreText = this.add.text(W / 2, 900, '', textStyle('h2', { fontSize: '22px', color: PALETTE_HEX.plum })).setOrigin(0.5);
        this.contentLayer.add(scoreText);
        countUp(this, scoreText, score, (v) => `Set score ${v} · best from this hand ${best.score}`, 800);
        if (tier === 3) { spawnPerfectSpark(this, W / 2, 900); hitstop(this, 40); }
        this.contentLayer.add(createButton(this, W / 2 - 130, 946, 260, 66, 'Continue', () => this.finish(tier >= 2, tier === 3), { fillColor: 0xd9a441 }));
      });
    };

    draw();
    // house lights come up on the hand
    if (!State.data.accessibility.reducedMotion) {
      const lights = this.add.rectangle(0, 0, W, 1400, 0x000000, 0.6).setOrigin(0, 0).setDepth(300);
      this.tweens.add({ targets: lights, fillAlpha: 0, duration: 700, delay: 150, onComplete: () => lights.destroy() });
    }
    // No-fail: an untouched hand fills itself in order and plays.
    this.time.delayedCall(60000, () => {
      if (played) return;
      for (const c of hand) if (picked.length < 4 && !picked.includes(c)) picked.push(c);
      play(picked.slice());
    });
  }

  // ---- The Long Haul: three days of stop, deal and bed out of the van float. ----
  private runLongHaul(): void {
    const offers = haulOffers(`${State.data.seed}:${this.mg.id}`);
    const best = bestHaul(offers);
    let day = 0, float = HAUL_FLOAT, tired = 0;
    let vanAt = 0;   // the day the van was last drawn at, so it only drives when a new day starts
    let idle: Phaser.Time.TimerEvent | null = null;
    const arm = (fn: () => void): void => { idle?.remove(); idle = this.time.delayedCall(LEDGER_IDLE_MS, fn); };
    const pips = (n: number) => '●'.repeat(n) + '○'.repeat(TIRED_MAX - n);
    const frame = (step: string): Phaser.GameObjects.Text => {
      this.clearContent();
      this.card(196, 900);
      this.contentLayer.add(this.add.text(W / 2, 226, `Day ${day + 1} of ${HAUL_DAYS}: ${step}`, textStyle('h2', { color: PALETTE_HEX.plum })).setOrigin(0.5));
      this.contentLayer.add(this.add.text(W / 2, 262, `Float $${float}   ·   Tired ${pips(tired)}`, textStyle('dialogue', { fontSize: '19px', color: PALETTE_HEX.plum })).setOrigin(0.5));
      this.contentLayer.add(this.add.text(W / 2, 292, 'Fuel and beds come out first. The show pays after.', textStyle('small', { fontSize: '15px', color: PALETTE_HEX.plum })).setOrigin(0.5));
      const live = this.add.text(W / 2, 760, '', textStyle('small', { fontSize: '17px', color: PALETTE_HEX.plum, wordWrap: { width: W - 150 }, align: 'center' })).setOrigin(0.5, 0);
      this.contentLayer.add(live);
      // the route strip: three stops on a dotted road, the van at today's
      const rx = (d: number): number => 180 + d * 180;
      const road = this.add.graphics();
      road.lineStyle(4, PALETTE.plum, 0.35);
      for (let x = rx(0); x < rx(HAUL_DAYS - 1); x += 18) road.lineBetween(x, 1010, x + 9, 1010);
      this.contentLayer.add(road);
      for (let d = 0; d < HAUL_DAYS; d++) {
        this.contentLayer.add(this.add.circle(rx(d), 1010, 9, d < day ? PALETTE.teal : PALETTE.plum, d <= day ? 1 : 0.35));
        this.contentLayer.add(this.add.text(rx(d), 1040, `Day ${d + 1}`, textStyle('small', { fontSize: '14px', color: PALETTE_HEX.plum })).setOrigin(0.5, 0));
      }
      const van = this.add.rectangle(rx(vanAt), 990, 34, 18, PALETTE.terracotta, 1).setStrokeStyle(2, PALETTE.plum, 1);
      this.contentLayer.add(van);
      if (day > vanAt && !State.data.accessibility.reducedMotion) this.tweens.add({ targets: van, x: rx(day), duration: 600, ease: 'Sine.easeInOut' });
      else van.x = rx(day);
      vanAt = day;
      return live;
    };

    const chooseStop = (): void => {
      const live = frame('pick a stop');
      offers[day].forEach((s, i) => {
        const afford = s.fuel <= float;
        const label = `${s.venue}\n${s.miles} mi · fuel $${s.fuel}\n$${s.guarantee} flat, or ${s.doorPct}% of the door\n${s.capacity} seats at $${s.ticket} · read ${s.hintLo}-${s.hintHi}% full`;
        this.contentLayer.add(createButton(this, 60, 340 + i * 196, W - 120, 172, label, () => {
          if (!afford) { live.setText(`Not enough float for $${s.fuel} of fuel. Costs come due before the pay.`); shake(this, 3); audio.playSfx('miss'); return; }
          chooseDeal(i as 0 | 1);
        }, { fillColor: afford ? (i ? PALETTE.plum : PALETTE.teal) : PALETTE.night, fontSize: '21px' }));
      });
      live.setText('A far stop pays more, but its fuel comes out of tonight\'s float.');
      arm(() => chooseDeal(offers[day][0].fuel <= float ? 0 : 1));
    };

    const chooseDeal = (ix: 0 | 1): void => {
      const s = offers[day][ix];
      const live = frame('the deal');
      this.contentLayer.add(this.add.text(W / 2, 352, `${s.venue}: ${s.capacity} seats at $${s.ticket}. The band reads ${s.hintLo}-${s.hintHi}% full${tired ? `, minus ${tired * Math.round(TIRED_TURNOUT * 100)}% for a tired band` : ''}.`, textStyle('dialogue', { fontSize: '19px', color: PALETTE_HEX.plum, wordWrap: { width: W - 150 }, align: 'center' })).setOrigin(0.5, 0));
      this.contentLayer.add(this.add.text(W / 2, 450, `The door beats $${s.guarantee} once the room is ${Math.round(breakEven(s) * 100)}% full.`, textStyle('dialogue', { fontSize: '19px', fontStyle: 'bold', color: PALETTE_HEX.plum, wordWrap: { width: W - 150 }, align: 'center' })).setOrigin(0.5, 0));
      this.contentLayer.add(createButton(this, 80, 530, W - 160, 70, `Take the $${s.guarantee} flat`, () => chooseBed(ix, 'flat'), { fillColor: PALETTE.teal, fontSize: '19px' }));
      this.contentLayer.add(createButton(this, 80, 620, W - 160, 70, `Take ${s.doorPct}% of the door`, () => chooseBed(ix, 'door'), { fillColor: PALETTE.terracotta, fontSize: '19px' }));
      live.setText('A sure thing is worth something. So is being right about the room.');
      this.offerHelp(this.hostStrip(), () => splitHint(this.mg.hostBandmate!, turnoutFor(s, tired)), W / 2 - 88, 900);
      arm(() => chooseBed(ix, 'flat'));
    };

    const chooseBed = (ix: 0 | 1, deal: Deal): void => {
      const s = offers[day][ix];
      const after = float - s.fuel;
      const live = frame('a bed');
      this.contentLayer.add(this.add.text(W / 2, 360, `After $${s.fuel} of fuel, the float is $${after}.`, textStyle('dialogue', { fontSize: '19px', color: PALETTE_HEX.plum })).setOrigin(0.5, 0));
      this.contentLayer.add(createButton(this, 80, 440, W - 160, 76, 'Sleep in the van\n(free, wake up more tired)', () => resolve(ix, deal, 'van'), { fillColor: PALETTE.plum, fontSize: '20px' }));
      const canMotel = after >= MOTEL;
      this.contentLayer.add(createButton(this, 80, 540, W - 160, 76, `Motel, $${MOTEL}\n(wake up rested)`, () => {
        if (!canMotel) { live.setText(`$${after} left: not enough for a $${MOTEL} motel tonight.`); shake(this, 3); audio.playSfx('miss'); return; }
        resolve(ix, deal, 'motel');
      }, { fillColor: canMotel ? PALETTE.teal : PALETTE.night, fontSize: '20px' }));
      live.setText(tired >= 2 ? 'The band is running on fumes. A tired band plays a smaller night.' : 'Rest costs money tonight and pays at tomorrow\'s door.');
      arm(() => resolve(ix, deal, 'van'));
    };

    const resolve = (ix: 0 | 1, deal: Deal, bed: Bed): void => {
      idle?.remove();
      const s = offers[day][ix];
      const r = playDay(s, { stop: ix, deal, bed }, float, tired)!;
      const other = deal === 'flat' ? `The door would have paid $${doorPay(s, r.turnout)}.` : `The flat was $${s.guarantee}.`;
      const lines = [
        `${s.venue}: ${Math.round(r.turnout * 100)}% full${tired ? ` (tired: -${tired * Math.round(TIRED_TURNOUT * 100)}%)` : ''}.`,
        `${deal === 'flat' ? 'The flat' : 'The door'} paid $${r.pay}. ${other}`,
        `Fuel -$${s.fuel}${bed === 'motel' ? `, motel -$${MOTEL}` : ''}. Float now $${r.floatAfter}.`,
      ];
      float = r.floatAfter; tired = r.tiredAfter;
      const live = frame('the night');
      this.contentLayer.add(this.add.text(W / 2, 360, lines.join('\n\n'), textStyle('dialogue', { fontSize: '20px', color: PALETTE_HEX.plum, wordWrap: { width: W - 150 }, align: 'center', lineSpacing: 4 })).setOrigin(0.5, 0));
      if (r.pay >= s.guarantee) spawnRingPulse(this, W / 2, 400, PALETTE.gold); else shake(this, 2);
      live.setText(bed === 'van' ? 'Free tonight. Tomorrow\'s crowd pays for it.' : 'Paid tonight. Rested for tomorrow.');
      const last = day === HAUL_DAYS - 1;
      let moved = false;
      const next = (): void => {
        if (moved) return;
        moved = true;
        idle?.remove();
        if (!last) { day++; chooseStop(); return; }
        const profit = float - HAUL_FLOAT;
        this.settleLedger({ tier: haulTier(float, best), funds: Math.round(profit / 20), label: `Long haul, ${profit >= 0 ? '+' : '-'}$${Math.abs(profit)}`, explain: `Three days: $${HAUL_FLOAT} became $${float}. The best this leg allowed was $${best}. ${HAUL_LESSON}` });
      };
      this.contentLayer.add(createButton(this, W / 2 - 130, 640, 260, 66, last ? 'Settle up' : 'Next day', next, { fillColor: 0xd9a441 }));
      arm(next);
    };

    chooseStop();
  }

  private finish(good: boolean, perfect = false): void {
    // The result card has its own Continue (back to practice) where this button sits.
    this.practiceBack?.setVisible(false);
    // Remembered for the return leg's social feed — the concrete callback ("they still talk about
    // that load-out") rather than a generic one about the show.
    if (!this.practice) recordMinigame(this.cityId, good, this.mg.title);
    this.outcomeGood = good;
    this.outcomePerfect = perfect && good;
    this.clearContent();
    // A result header above the outro (2026-10-02, "clear feedback after mini-games"): a tier
    // title, one to three stars, the score where there is one, and what the result earned, so the
    // ending says how you did against the goal instead of only how the moment felt.
    const tier = this.outcomePerfect ? 3 : good ? 2 : 1;
    const top = 196;
    // The tier is a rubber stamp in the minigame's own words (2026-10-04): STOWED, FLAT BOARD, ROUGH.
    this.contentLayer.add(stamp(this, W / 2, top + 40, resultStamp(this.mg.type, tier as Tier), tier === 1 ? PALETTE.terracotta : PALETTE.teal, 30));
    const beat = beatMs(this.mg.bpm);
    const stars: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < 3; i++) {
      const on = i < tier;
      const st = this.add.text(W / 2 + (i - 1) * 64, top + 98, '★', textStyle('title', { fontSize: '52px', color: on ? PALETTE_HEX.gold : '#B9A88A' })).setOrigin(0.5);
      this.contentLayer.add(st);
      if (on && !State.data.accessibility.reducedMotion) {
        // the stars land on the music's beat, one per beat
        st.setScale(0.2).setAlpha(0);
        this.tweens.add({ targets: st, scale: 1, alpha: 1, duration: 220, delay: 240 + i * beat, ease: 'Back.easeOut', onStart: () => { audio.playPitch(660 + i * 220, 0.08, 0, 'triangle'); buzz('tick'); } });
      }
      stars.push(st);
    }
    let y = top + 142;
    const THEORY = ['interval', 'clave', 'chordquality', 'transpose', 'meter', 'tempo'];
    if (THEORY.includes(this.mg.type)) {
      const rounds = this.mg.theoryRounds ?? (this.mg.type === 'tempo' ? 2 : 4);
      const hits = this.add.text(W / 2, y, '', textStyle('body', { fontSize: '20px', color: PALETTE_HEX.plum })).setOrigin(0.5, 0);
      this.contentLayer.add(hits);
      countUp(this, hits, this.theoryHits, (v) => `${v} of ${rounds} right`, 500);
      y += 34;
    }
    const text = !good ? this.mg.outroTextRough
      : (this.outcomePerfect && this.mg.outroTextPerfect) ? this.mg.outroTextPerfect
      : this.mg.outroText;
    const outro = this.add.text(W / 2, y + 6, text, textStyle('dialogue', {
      fontSize: '22px', wordWrap: { width: W - 140 }, align: 'center', lineSpacing: 6,
    })).setOrigin(0.5, 0);
    this.contentLayer.add(outro);
    y = outro.y + outro.height + 16;
    const earned = this.practice ? 'Practice round: nothing changes on the tour.' : rewardLine(this.rewardFor(good, this.outcomePerfect), this.ledgerOutcome?.funds);
    if (earned) {
      this.contentLayer.add(this.add.text(W / 2, y, earned, textStyle('small', { fontSize: '17px', color: PALETTE_HEX.plum, wordWrap: { width: W - 140 }, align: 'center' })).setOrigin(0.5, 0));
      y += 46;
    }
    // The host answers in their own voice and remembers the last game they ran with you (2026-10-02).
    const host = this.mg.hostBandmate;
    if (host && !this.practice) {
      const prior = priorHosted(State.data.hostedGames, host);
      const { reaction, callback } = hostReaction(host, tier as Tier, this.rapport === 'close', prior);
      // the host's painted portrait, in a mood that matches the result, beside their line
      const r = this.add.text(W / 2 + 46, y, reaction, textStyle('dialogue', { fontSize: '19px', color: PALETTE_HEX.plum, wordWrap: { width: W - 250 }, align: 'center', lineSpacing: 4 })).setOrigin(0.5, 0);
      this.contentLayer.add(r);
      this.contentLayer.add(cameo(this, host, cameoMood(tier as Tier), 112, y + Math.max(42, r.height / 2), 84));
      y = Math.max(r.y + r.height, y + 84) + 12;
      if (callback) {
        const t = this.add.text(W / 2, y, callback, textStyle('dialogue', { fontSize: '19px', color: PALETTE_HEX.plum, wordWrap: { width: W - 140 }, align: 'center', lineSpacing: 4 })).setOrigin(0.5, 0);
        this.contentLayer.add(t);
        y = t.y + t.height + 12;
      }
    }
    // Every minigame ends on the skill it practised: one line to take off the tour with you. The
    // craft games had one; the money and theory games now use the same line their van recall
    // explains (QA round 4 depth pass).
    const lesson = takeawayFor(this.mg.type);
    if (lesson) {
      const t = this.add.text(W / 2, y + 4, `On the road: ${lesson}`, textStyle('small', { fontSize: '17px', color: PALETTE_HEX.teal, wordWrap: { width: W - 140 }, align: 'center' })).setOrigin(0.5, 0);
      this.contentLayer.add(t);
      y = t.y + t.height + 12;
    }
    const cardImg = this.card(top, Math.max(300, y - top + 12));
    this.contentLayer.sendToBack(cardImg);
    const btnY = Math.min(Math.max(y + 24, 560), SAFE_BOTTOM_Y - 66);
    const cont = createButton(this, W / 2 - 130, btnY, 260, 66, 'Continue', () => this.applyRewardAndReturn(), { fillColor: 0xd9a441 });
    this.contentLayer.add(cont);
    // Continue sits where the last round's button was, so a tap meant for that button skipped the
    // whole result card (found by the playthrough audit, 2026-10-05). It wakes with its pulse.
    const contBg = cont.list.find((o) => (o as Phaser.GameObjects.Image).input) as Phaser.GameObjects.Image;
    contBg.disableInteractive();
    this.time.delayedCall(600, () => { if (cont.active) { contBg.setInteractive(); beatPulse(this, cont, beat); } });
    // The Encore: a perfect run only, never in practice
    if (shouldEncore(tier as Tier, this.practice)) this.time.delayedCall(250, () => encore(this, host));
  }

  /** The reward that applies for this outcome (the same choice applyRewardAndReturn makes). */
  private rewardFor(good: boolean, perfect: boolean): MiniGameReward | undefined {
    return !good ? (this.mg.roughReward ?? this.mg.reward) : (perfect ? (this.mg.perfectReward ?? this.mg.reward) : this.mg.reward);
  }

  private applyRewardAndReturn(): void {
    if (this.practice) { goTo(this, 'Hub', { practiceCity: this.cityId }); return; }
    // Ledger money lands on top of the authored reward, and the decision is remembered for the Hub card.
    if (this.ledgerOutcome) {
      State.applyStatDeltas({ funds: this.ledgerOutcome.funds });
      State.recordLedger({ cityId: this.cityId, label: this.ledgerOutcome.label, funds: this.ledgerOutcome.funds, type: this.mg.type, tier: this.ledgerOutcome.tier });
    }
    // A hosted minigame is time spent with that bandmate: it moves their arc like a scene does, and
    // they remember how it went (recorded here, with the played flag, so a resumed save never has a
    // host remembering a game the run has not finished).
    if (this.mg.hostBandmate) {
      State.recordArcScene(this.mg.hostBandmate);
      State.recordHostedGame({ host: this.mg.hostBandmate, title: this.mg.title, tier: this.outcomePerfect ? 3 : this.outcomeGood ? 2 : 1 });
    }
    const reward = this.rewardFor(this.outcomeGood, this.outcomePerfect);
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
    this.time.delayedCall(THEORY_IDLE_MS, () => {
      if (answered) return;
      answered = true;
      hint.setText(`Moving on - that was a ${answer.name.toLowerCase()}: ${answer.anchor}.`);
      this.theoryRound++;
      this.time.delayedCall(2100, () => this.runIntervalRound());
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
    this.time.delayedCall(THEORY_IDLE_MS, () => {
      if (answered) return;
      answered = true;
      hint.setText(`Moving on - that was the ${answer.name}: ${answer.note}.`);
      this.theoryRound++;
      this.time.delayedCall(2400, () => this.runClaveRound());
    });
  }


  // =============================================================================================
  // The Van Ledger — five money decisions with real numbers on screen. Pure logic lives in
  // src/game/ledger.ts; these methods are only the table the numbers sit on.
  // =============================================================================================

  /** A copy field from the minigame's content if it has one, otherwise the type's own default.
   *  Either way {tokens} are filled from the live numbers, so prose cannot disagree with the maths. */
  private copyText(field: keyof NonNullable<MiniGameDef['copy']>, fallback: string, vars: Record<string, string | number>): string {
    const authored = this.mg.copy?.[field];
    const template = typeof authored === 'string' && authored.length > 0 ? authored : fallback;
    return fillTemplate(template, vars);
  }

  /** Shared frame: a sand card with a title, a subtitle, and a live line the exercise updates. */
  private ledgerFrame(title: string, sub: string): Phaser.GameObjects.Text {
    this.clearContent();
    this.card(220, 760);
    this.contentLayer.add(this.add.text(W / 2, 250, title, textStyle('h2', { color: PALETTE_HEX.plum })).setOrigin(0.5));
    // 17px, was 15: the setup line is the game's whole premise, and 15px on a phone read as fine
    // print (round 3 feedback: the intro text was hard to read).
    this.contentLayer.add(this.add.text(W / 2, 286, sub, textStyle('small', { fontSize: '17px', color: PALETTE_HEX.plum, wordWrap: { width: W - 150 }, align: 'center' })).setOrigin(0.5, 0));
    const live = this.add.text(W / 2, 560, '', textStyle('dialogue', { fontSize: '19px', color: PALETTE_HEX.plum, wordWrap: { width: W - 150 }, align: 'center', lineSpacing: 4 })).setOrigin(0.5, 0);
    this.contentLayer.add(live);
    return live;
  }

  /** Explain the money for a beat, then hand off to the normal three-tier outro. */
  private settleLedger(outcome: LedgerOutcome, idle = false): void {
    if (this.ledgerOutcome) return;
    if (idle) outcome = { ...outcome, explain: `Nobody made the call, so the band took the safe one. ${outcome.explain}` };
    this.ledgerOutcome = outcome;
    this.clearContent();
    this.card(300, 320);
    this.contentLayer.add(this.add.text(W / 2, 330, 'The ledger', textStyle('h2', { color: PALETTE_HEX.plum })).setOrigin(0.5));
    this.contentLayer.add(stamp(this, W / 2 + 190, 300, ledgerStamp(this.mg.type, outcome.tier), outcome.tier === 'rough' ? PALETTE.terracotta : PALETTE.teal, 20));
    this.contentLayer.add(this.add.text(W / 2, 372, outcome.explain, textStyle('dialogue', {
      fontSize: '20px', color: PALETTE_HEX.plum, wordWrap: { width: W - 150 }, align: 'center', lineSpacing: 5,
    })).setOrigin(0.5, 0));
    if (outcome.tier === 'perfect') { spawnPerfectSpark(this, W / 2, 330); hitstop(this, 40); }
    else if (outcome.tier === 'rough') shake(this, 3);
    this.contentLayer.add(createButton(this, W / 2 - 130, 540, 260, 62, 'Continue', () => this.finish(outcome.tier !== 'rough', outcome.tier === 'perfect'), { fillColor: 0xd9a441 }));
  }

  private stepper(y: number, label: string, get: () => number, set: (v: number) => void, fmt: (v: number) => string, step: number, min: number, max: number, onChange: () => void): void {
    this.contentLayer.add(this.add.text(90, y + 28, label, textStyle('dialogue', { fontSize: '19px', color: PALETTE_HEX.plum })).setOrigin(0, 0.5));
    // The value sits exactly midway between the − and + buttons (QA round 3 #11: it was 28px left
    // of centre, crowding the −).
    const minusX = W - 340, plusX = W - 160, btn = 56;
    const value = this.add.text((minusX + btn + plusX) / 2, y + 28, fmt(get()), textStyle('h2', { fontSize: '22px', color: PALETTE_HEX.plum })).setOrigin(0.5);
    this.contentLayer.add(value);
    const bump = (d: number) => { set(Phaser.Math.Clamp(get() + d, min, max)); value.setText(fmt(get())); audio.playSfx('tap'); onChange(); };
    this.contentLayer.add(createButton(this, minusX, y, btn, btn, '−', () => bump(-step), { fillColor: PALETTE.plum, fontSize: '26px' }));
    this.contentLayer.add(createButton(this, plusX, y, btn, btn, '+', () => bump(step), { fillColor: PALETTE.plum, fontSize: '26px' }));
  }

  private runSplit(): void {
    const d = { ...DEFAULT_LEDGER.split, ...(this.mg.ledger ?? {}) } as { guarantee: number; doorPct: number; ticketPrice: number; capacity: number };
    const vars = { guarantee: d.guarantee, doorPct: d.doorPct, capacity: d.capacity, ticketPrice: d.ticketPrice };
    const live = this.ledgerFrame(this.copyText('heading', 'The deal', vars), this.copyText('setup', `The venue offers $${d.guarantee} flat, or ${d.doorPct}% of the door: ${d.capacity} seats at $${d.ticketPrice}. Rowan wants your read on the room.`, vars));
    const est = { v: 50 };
    const actual = this.theoryRng.int(25, 96) / 100;
    const update = () => {
      const t = est.v / 100;
      live.setText(`If the room is ${est.v}% full, the door pays $${doorTake(d, t)}.\nBreak-even is ${Math.round(breakEvenTurnout(d) * 100)}% full.`);
    };
    this.stepper(400, this.copyText('prompt', 'How full will it be?', vars), () => est.v, (v) => { est.v = v; }, (v) => `${v}%`, 10, 10, 100, update);
    update();
    this.contentLayer.add(createButton(this, W / 2 - 300, 700, 290, 66, `Take the $${d.guarantee}`, () => this.settleLedger(resolveSplit(d, 'guarantee', est.v / 100, actual)), { fillColor: PALETTE.teal, fontSize: '18px' }));
    this.contentLayer.add(createButton(this, W / 2 + 10, 700, 290, 66, 'Take the door', () => this.settleLedger(resolveSplit(d, 'door', est.v / 100, actual)), { fillColor: PALETTE.terracotta, fontSize: '18px' }));
    this.time.delayedCall(LEDGER_IDLE_MS, () => this.settleLedger(resolveSplit(d, 'guarantee', est.v / 100, actual), true));
    this.contentLayer.add(this.add.text(W / 2, 800, this.copyText('tip', 'A sure thing is worth something. So is being right about the room.', vars), textStyle('small', { fontSize: '15px', color: PALETTE_HEX.plum, wordWrap: { width: W - 160 }, align: 'center' })).setOrigin(0.5, 0));
    this.offerHelp(this.hostStrip(), () => splitHint(this.mg.hostBandmate!, actual), W / 2 - 88, 900);
  }

  private runPricing(): void {
    const d = { ...DEFAULT_LEDGER.pricing, ...(this.mg.ledger ?? {}) } as { unitCost: number; stock: number; minPrice: number; maxPrice: number };
    const vars = { stock: d.stock, unitCost: d.unitCost };
    const live = this.ledgerFrame(this.copyText('heading', 'The merch table', vars), this.copyText('setup', `${d.stock} shirts in the box at $${d.unitCost} each to print. Mira wants them seen; the tour needs them paid for.`, vars));
    const price = { v: Math.round((d.minPrice + d.maxPrice) / 2) };
    const update = () => {
      const sold = demandAt(d, price.v);
      live.setText(`At $${price.v}, about ${sold} people buy.\nThat is $${sold * price.v} in, against $${d.stock * d.unitCost} already spent on the box.`);
    };
    this.stepper(400, this.copyText('prompt', 'Price per shirt', vars), () => price.v, (v) => { price.v = v; }, (v) => `$${v}`, 2, d.minPrice, d.maxPrice, update);
    update();
    this.contentLayer.add(createButton(this, W / 2 - 150, 700, 300, 66, 'Open the table', () => this.settleLedger(resolvePricing(d, price.v)), { fillColor: PALETTE.terracotta }));
    this.time.delayedCall(LEDGER_IDLE_MS, () => this.settleLedger(resolvePricing(d, price.v), true));
    this.contentLayer.add(this.add.text(W / 2, 800, this.copyText('tip', 'Margin is price minus cost, times how many actually buy.', vars), textStyle('small', { fontSize: '15px', color: PALETTE_HEX.plum, wordWrap: { width: W - 160 }, align: 'center' })).setOrigin(0.5, 0));
    this.offerHelp(this.hostStrip(), () => pricingHint(this.mg.hostBandmate!, d), W / 2 - 88, 900);
  }

  private runPerDiem(): void {
    const d = { ...DEFAULT_LEDGER.perdiem, ...(this.mg.ledger ?? {}) } as { budget: number };
    const vars = { budget: d.budget };
    const lbl = this.mg.copy?.labels ?? ['Food', 'A bed', 'Rest stop'];
    const over = this.mg.copy?.overBudgetLine;
    const live = this.ledgerFrame(this.copyText('heading', 'Tomorrow\'s per diem', vars), this.copyText('setup', `$${d.budget} for the day. Theo would like one real meal and one real bed. Whatever is left goes back in the float.`, vars));
    const a = { food: 20, lodging: 20, rest: 0 };
    const update = () => {
      const spent = a.food + a.lodging + a.rest;
      const f = perDiemForecast(a);
      live.setText(`$${spent} of $${d.budget}${spent > d.budget ? ' — over budget' : `, $${d.budget - spent} back in the float`}.\nTomorrow: energy ${f.energy >= 0 ? '+' : ''}${f.energy}, harmony ${f.harmony >= 0 ? '+' : ''}${f.harmony}.`);
    };
    this.stepper(380, lbl[0], () => a.food, (v) => { a.food = v; }, (v) => `$${v}`, 10, 0, 60, update);
    this.stepper(446, lbl[1], () => a.lodging, (v) => { a.lodging = v; }, (v) => `$${v}`, 10, 0, 60, update);
    this.stepper(512, lbl[2], () => a.rest, (v) => { a.rest = v; }, (v) => `$${v}`, 10, 0, 40, update);
    update();
    this.contentLayer.add(createButton(this, W / 2 - 150, 700, 300, 66, 'Set the budget', () => this.settleLedger(resolvePerDiem(d, { ...a }, over)), { fillColor: PALETTE.teal }));
    this.time.delayedCall(LEDGER_IDLE_MS, () => this.settleLedger(resolvePerDiem(d, { ...a }, over), true));
    this.contentLayer.add(this.add.text(W / 2, 800, this.copyText('tip', 'Every dollar not spent on one thing was spent on another. That is the whole idea.', vars), textStyle('small', { fontSize: '15px', color: PALETTE_HEX.plum, wordWrap: { width: W - 160 }, align: 'center' })).setOrigin(0.5, 0));
    this.offerHelp(this.hostStrip(), () => perDiemHint(this.mg.hostBandmate!, d.budget, lbl), W / 2 - 88, 900);
  }

  private runGearCall(): void {
    const d = { ...DEFAULT_LEDGER.gearcall, ...(this.mg.ledger ?? {}) } as { price: number; rentPerShow: number };
    const showsLeft = Math.max(1, State.data.route.length - State.data.currentCityIndex);
    const shows = `${showsLeft} show${showsLeft === 1 ? '' : 's'}`;
    const vars = { price: d.price, rentPerShow: d.rentPerShow, shows, rentTotal: showsLeft * d.rentPerShow };
    const gearCopy = { thing: this.mg.copy?.thing, passLine: this.mg.copy?.passLine };
    const live = this.ledgerFrame(this.copyText('heading', 'The synth', vars), this.copyText('setup', `A used synth Jun has wanted for a year. $${d.price} to buy, or $${d.rentPerShow} a night to rent. ${shows} left on this tour.`, vars));
    // Work it out first (2026-10-02): the full comparison used to be printed before the choice, so
    // the decision was read off the screen rather than made. Now the player is asked to do the
    // multiplication, and "Show the math" reveals it for anyone who wants it. Doing the sum yourself
    // is what makes it stick (the generation effect).
    const detail = this.copyText('detail', `Renting for the rest of the tour: ${showsLeft} × $${d.rentPerShow} = $${showsLeft * d.rentPerShow}.\nBuying: $${d.price}, and it comes home with you.`, vars);
    live.setText(`Work it out first: ${shows} at $${d.rentPerShow} each, or $${d.price} once.`);
    const reveal = createButton(this, W / 2 - 120, 604, 240, 52, 'Show the math', () => { live.setText(detail); reveal.setVisible(false); audio.playSfx('tap'); }, { fillColor: PALETTE.plum, fontSize: '17px' });
    this.contentLayer.add(reveal);
    const mk = (y: number, label: string, choice: 'buy' | 'rent' | 'pass', color: number) =>
      this.contentLayer.add(createButton(this, W / 2 - 220, y, 440, 62, label, () => this.settleLedger(resolveGearCall(d, showsLeft, choice, gearCopy)), { fillColor: color, fontSize: '19px' }));
    mk(678, this.copyText('buyLabel', `Buy it ($${d.price})`, vars), 'buy', PALETTE.terracotta);
    mk(750, this.copyText('rentLabel', `Rent it ($${d.rentPerShow} a show)`, vars), 'rent', PALETTE.teal);
    mk(822, this.copyText('passLabel', 'Pass — the old rig is fine', vars), 'pass', PALETTE.plum);
    this.time.delayedCall(LEDGER_IDLE_MS, () => this.settleLedger(resolveGearCall(d, showsLeft, 'pass', gearCopy), true));
    this.offerHelp(this.hostStrip(), () => gearHint(this.mg.hostBandmate!, d.price, d.rentPerShow, showsLeft), W / 2 - 88, 900);
  }

  private runExchange(): void {
    const rates: { label: string; rate: number; feePct: number }[] = [...(this.mg.ledger?.rates ?? DEFAULT_LEDGER.exchange.rates)];
    // Step 1, the fee calculator (2026-10-02): before choosing, work out what the best-looking
    // window really pays. Answer or not, the working is shown, then the choice opens.
    const calc = exchangeCalcQuestion(rates);
    const work = exchangeWorking(calc.window);
    const live = this.ledgerFrame('Changing money', `First, the trap. ${calc.window.label} shows the best rate, ${calc.window.rate.toFixed(2)}, with a ${calc.window.feePct}% fee. What does $200 really get you there?`);
    live.setText('Rate times 200, then take the fee off that.');
    let stepDone = false;
    const toChoice = (picked: number | null) => {
      if (stepDone) return;
      stepDone = true;
      const right = picked === calc.answer;
      if (right) { spawnPerfectSpark(this, W / 2, 560); hitstop(this, 40); } else if (picked !== null) shake(this, 3);
      live.setText(`${right ? 'Right.' : picked === null ? 'Here is the working.' : `Not ${picked}.`} ${work.line}.`);
      this.time.delayedCall(3200, () => this.runExchangeChoice(rates));
    };
    this.theoryRng.shuffle(calc.options).forEach((v, i) => {
      this.contentLayer.add(createButton(this, W / 2 - 260, 664 + i * 86, 520, 70, `${v} local`, () => toChoice(v), { fillColor: i % 2 === 0 ? PALETTE.teal : PALETTE.plum, fontSize: '19px' }));
    });
    this.time.delayedCall(THEORY_IDLE_MS, () => toChoice(null));
  }

  /** Step 2: pick the window. The live line asks for the comparison; Show the math does every sum. */
  private runExchangeChoice(rates: { label: string; rate: number; feePct: number }[]): void {
    const live = this.ledgerFrame('Changing money', 'Three windows, three rates, three fees. $200 of the float needs to become local money for the week.');
    live.setText('Work it out first: compare what you keep after the fee.');
    this.time.delayedCall(LEDGER_IDLE_MS, () => this.settleLedger(resolveExchange(rates, 0), true));
    const reveal = createButton(this, W / 2 - 120, 604, 240, 52, 'Show the math', () => {
      live.setText(rates.map((r) => exchangeWorking(r).short).join('\n'));
      reveal.setVisible(false);
      audio.playSfx('tap');
    }, { fillColor: PALETTE.plum, fontSize: '17px' });
    this.contentLayer.add(reveal);
    // Window buttons sit below the live line ledgerFrame places at y=560 and the reveal button
    // (they once started at 380 and buried the hint; see round 3 in HANDOFF.md §20).
    rates.forEach((r, i) => {
      this.contentLayer.add(createButton(this, W / 2 - 260, 664 + i * 86, 520, 74, `${r.label}\nrate ${r.rate.toFixed(2)} · fee ${r.feePct}%`, () => this.settleLedger(resolveExchange(rates, i)), { fillColor: i % 2 === 0 ? PALETTE.teal : PALETTE.plum, fontSize: '17px' }));
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
    if (this.mg.copy?.setup) hint.setText(this.copyText('setup', '', { round: this.theoryRound + 1, rounds }));
    this.playChordSymbol(symbol);
    this.contentLayer.add(createButton(this, W / 2 - 110, 320, 220, 58, 'Hear it again', () => this.playChordSymbol(symbol), { fillColor: PALETTE.plum, fontSize: '17px' }));
    let answered = false;
    const opts: { key: string; btn: Phaser.GameObjects.Container }[] = [];
    const dimmed = new Set<string>();
    set.forEach((q, i) => {
      opts.push({ key: q, btn: createButton(this, W / 2 - 260, 410 + i * 84, 520, 70, QUALITY_LABELS[q], () => {
        if (answered || dimmed.has(q)) return;
        answered = true;
        const right = q === answer;
        if (right) { this.theoryHits++; spawnPerfectSpark(this, W / 2, 400); hitstop(this, 40); } else shake(this, 3);
        hint.setText(right ? `Yes - ${QUALITY_LABELS[answer].toLowerCase()}: ${QUALITY_HINTS[answer]}.` : `That was ${QUALITY_LABELS[answer].toLowerCase()} - ${QUALITY_HINTS[answer]}.`);
        this.playChordSymbol(symbol);
        this.theoryRound++;
        this.time.delayedCall(2200, () => this.runChordQualityRound());
      }, { fillColor: PALETTE.teal, fontSize: '19px' }) });
    });
    for (const o of opts) this.contentLayer.add(o.btn);
    this.offerHelp(this.hostStrip(), () => { this.dimWrong(opts, answer, dimmed); this.playChordSymbol(symbol); return chordHint(this.mg.hostBandmate!); }, W - 196, 320);
    this.time.delayedCall(THEORY_IDLE_MS, () => {
      if (answered) return;
      answered = true;
      hint.setText(`Moving on - that was ${QUALITY_LABELS[answer].toLowerCase()}: ${QUALITY_HINTS[answer]}.`);
      this.theoryRound++;
      this.time.delayedCall(2200, () => this.runChordQualityRound());
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
    hint.setText(this.copyText('setup', `Question ${this.theoryRound + 1} of ${rounds} - Mira's voice is shot tonight; the set moves ${move.name}. Which chord does ${from} become?`, { round: this.theoryRound + 1, rounds, from, move: move.name }));
    this.playChordSymbol(from);
    this.contentLayer.add(createButton(this, W / 2 - 110, 320, 220, 58, `Hear ${from}`, () => this.playChordSymbol(from), { fillColor: PALETTE.plum, fontSize: '17px' }));
    let answered = false;
    const opts: { key: string; btn: Phaser.GameObjects.Container }[] = [];
    const dimmed = new Set<string>();
    options.forEach((opt, i) => {
      opts.push({ key: opt, btn: createButton(this, W / 2 - 260, 410 + i * 84, 520, 70, opt, () => {
        if (answered || dimmed.has(opt)) return;
        answered = true;
        const right = opt === answer;
        if (right) { this.theoryHits++; spawnPerfectSpark(this, W / 2, 400); hitstop(this, 40); } else shake(this, 3);
        const { quality } = splitChord(from);
        hint.setText(right ? `Yes - ${from} ${move.name} is ${answer}${quality ? ' (same quality, new root)' : ''}.` : `${from} ${move.name} is ${answer}, not ${opt}. Same shape, ${Math.abs(move.semis)} fret${Math.abs(move.semis) === 1 ? '' : 's'} over.`);
        this.playChordSymbol(from);
        this.playChordSymbol(answer, 0.9);
        this.theoryRound++;
        this.time.delayedCall(2600, () => this.runTransposeRound());
      }, { fillColor: PALETTE.teal, fontSize: '22px' }) });
    });
    for (const o of opts) this.contentLayer.add(o.btn);
    this.offerHelp(this.hostStrip(), () => { this.dimWrong(opts, answer, dimmed); return transposeHint(this.mg.hostBandmate!, move.semis); }, W - 196, 320);
    this.time.delayedCall(THEORY_IDLE_MS, () => {
      if (answered) return;
      answered = true;
      hint.setText(`Moving on - ${from} ${move.name} is ${answer}.`);
      this.playChordSymbol(from);
      this.playChordSymbol(answer, 0.9);
      this.theoryRound++;
      this.time.delayedCall(2600, () => this.runTransposeRound());
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
    hint.setText(this.copyText('setup', `Question ${this.theoryRound + 1} of ${rounds} - Theo counts it in. Feel where the heavy beat lands.`, { round: this.theoryRound + 1, rounds }));
    play();
    this.contentLayer.add(createButton(this, W / 2 - 110, 320, 220, 58, 'Hear it again', play, { fillColor: PALETTE.plum, fontSize: '17px' }));
    let answered = false;
    const opts: { key: string; btn: Phaser.GameObjects.Container }[] = [];
    const dimmed = new Set<string>();
    METERS.forEach((m, i) => {
      opts.push({ key: m.name, btn: createButton(this, W / 2 - 260, 410 + i * 84, 520, 70, m.name, () => {
        if (answered || dimmed.has(m.name)) return;
        answered = true;
        const right = m.name === answer.name;
        if (right) { this.theoryHits++; spawnPerfectSpark(this, W / 2, 400); hitstop(this, 40); } else shake(this, 3);
        hint.setText(right ? `Yes - ${answer.name}: ${answer.note}.` : `That was ${answer.name} - ${answer.note}.`);
        this.theoryRound++;
        this.time.delayedCall(2400, () => this.runMeterRound());
      }, { fillColor: PALETTE.teal, fontSize: '24px' }) });
    });
    for (const o of opts) this.contentLayer.add(o.btn);
    this.offerHelp(this.hostStrip(), () => {
      this.dimWrong(opts, answer.name, dimmed);
      // the host claps only the heavy beats of the count-in
      for (let bar = 0; bar < 2; bar++) for (const a of answer.accents) audio.playPitch(1760, 0.1, (bar * answer.beats + a) * answer.step, 'triangle');
      return meterHint(this.mg.hostBandmate!);
    }, W - 196, 320);
    this.time.delayedCall(THEORY_IDLE_MS, () => {
      if (answered) return;
      answered = true;
      hint.setText(`Moving on - that was ${answer.name}: ${answer.note}.`);
      this.theoryRound++;
      this.time.delayedCall(2400, () => this.runMeterRound());
    });
  }

  private runTempoRound(): void {
    const rounds = this.mg.theoryRounds ?? 2;
    this.tempoPulse?.remove();
    this.tempoPulse = null;
    if (this.theoryDone(rounds)) return;
    const target = getCity(this.cityId).tempo + this.theoryRng.int(-14, 15);
    const beat = 60 / target;
    const play = () => { for (let i = 0; i < 8; i++) audio.playPitch(i % 4 === 0 ? 1320 : 880, 0.07, i * beat, 'square'); };
    const hint = this.theoryFrame('Find the tempo', rounds);
    hint.setText(this.copyText('setup', `Round ${this.theoryRound + 1} of ${rounds} - the crowd claps at one speed. Tap the pad along with it, at least five times.`, { round: this.theoryRound + 1, rounds }));
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
      this.tempoPulse?.remove();
      this.tempoPulse = null;
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
    this.offerHelp(this.hostStrip(), () => {
      this.tempoPulse?.remove();
      this.tempoPulse = this.time.addEvent({ delay: beat * 1000, loop: true, callback: () => { if (!settled) spawnRingPulse(this, W / 2, 560, PALETTE.gold); } });
      return tempoHint(this.mg.hostBandmate!);
    }, W - 196, 320);
    // No-fail: a player who never taps still moves on after a while.
    this.time.delayedCall(20000, () => { if (!settled) { if (this.tempoTaps.length >= 2) settle(); else { settled = true; hint.setText('Moving on - no penalty'); this.theoryRound++; this.time.delayedCall(900, () => this.runTempoRound()); } } });
  }

}

const REWARD_STAT_LABELS: Record<string, string> = { energy: 'Energy', harmony: 'Harmony', inspiration: 'Inspiration', funds: 'Funds' };

/** "Harmony +3 · Inspiration +2 · Mira +4", from a reward plus any ledger money. */
export function rewardLine(reward: MiniGameReward | undefined, ledgerFunds?: number): string {
  const parts: string[] = [];
  const fx: Record<string, number | undefined> = { ...(reward?.effects ?? {}) };
  if (ledgerFunds) fx.funds = (fx.funds ?? 0) + ledgerFunds;
  for (const [k, v] of Object.entries(fx)) if (v) parts.push(`${REWARD_STAT_LABELS[k] ?? k} ${v > 0 ? '+' : ''}${v}`);
  for (const [k, v] of Object.entries(reward?.relationshipEffects ?? {})) if (v) parts.push(`${k.charAt(0).toUpperCase()}${k.slice(1)} ${v > 0 ? '+' : ''}${v}`);
  return parts.length ? parts.join('  ·  ') : '';
}
