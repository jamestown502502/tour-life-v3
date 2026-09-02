import Phaser from 'phaser';
import {
  H, PALETTE, PALETTE_HEX, W, RHYTHM_LEAD_MS, RHYTHM_HIT_LINE_Y, RHYTHM_SPAWN_Y, RHYTHM_LANE_W, RHYTHM_LANE_X_START,
} from '../const';
import { ensureCueIcon, ensureCrowdFigure, ensureHitLineGlow, ensureHoldRail, ensureLaneTextures } from '../art/sprites';
import { spawnPerfectSpark, comboPop, hitstop, shake, spawnRingPulse } from '../art/effects';
import { goTo, fadeIn } from './transition';
import { createButton } from './Button';
import { State } from '../core/state';
import { audio, type SfxName } from '../core/audio';
import { getCity, getSong } from '../game/content';
import {
  adjustedHitMs, buildPerformanceResult, combineHoldJudgement, effectiveWindows, judgeHit,
  pickArrangement, scoreForHit, type HitJudgement, type PerformanceContext,
} from '../game/rhythm';
import type { ChartCue, ChartNote, ChoiceCueType } from '../../content/schema';
import { saveRun } from '../core/save';
import { textStyle } from './textStyles';
import { parseChordProgression } from '../core/musicTheory';
import { addHelpButton } from './HelpButton';
import {
  hasSeenRhythmTutorial, markRhythmTutorialSeen, hasEverOpenedSettings,
  hasSeenHoldHint, markHoldHintSeen, hasSeenCueHint, markCueHintSeen,
} from '../core/onboarding';
import type { RhythmMode } from '../core/state';
import type { CityDef, SongDef } from '../../content/schema';

const HIT_LINE_Y = RHYTHM_HIT_LINE_Y;
const SPAWN_Y = RHYTHM_SPAWN_Y;
const LANE_X_START = RHYTHM_LANE_X_START;
const LANE_W = RHYTHM_LANE_W;
const HOLD_RAIL_W = 82;
const CUE_LABELS: Record<ChoiceCueType, string> = {
  pull_back: 'Pull back', build: 'Build', invite_crowd: 'Invite the crowd', improvise: 'Improvise', spotlight_bandmate: 'Spotlight a bandmate',
};
const COMBO_MILESTONES = [10, 25, 50];
const COMBO_STAMPS: Record<number, string> = { 10: 'Warming up!', 25: 'Lit up!', 50: 'On fire!' };
const JUDGEMENT_LABEL: Record<HitJudgement, string> = { perfect: 'Perfect!', good: 'Good', ok: 'OK', miss: 'Miss' };
const JUDGEMENT_COLOR: Record<HitJudgement, number> = {
  perfect: PALETTE.gold, good: PALETTE.cream, ok: PALETTE.sky, miss: PALETTE.softRed,
};
const JUDGEMENT_HEX: Record<HitJudgement, string> = {
  // softRed itself measures 2.56:1 against this scene's night background — under the 3:1 floor
  // even for this popup's large bold text. This lighter tint (still reads as "miss") clears it
  // at ~3.7:1; only the popup text uses it — JUDGEMENT_COLOR's softRed (the lane-flash fill,
  // not text) is untouched.
  perfect: PALETTE_HEX.gold, good: PALETTE_HEX.cream, ok: PALETTE_HEX.sky, miss: '#E27272',
};

interface NoteState {
  note: ChartNote;
  judged: boolean;
  sprite?: Phaser.GameObjects.Image;
  holding?: boolean;
  holdStartDelta?: number;
  holdStartAt?: number;
}
interface CueState { cue: ChartCue; handled: boolean; banner?: Phaser.GameObjects.Container; }

export class RhythmScene extends Phaser.Scene {
  constructor() { super('Rhythm'); }

  private cityId!: string;
  private notes: NoteState[] = [];
  private cues: CueState[] = [];
  private judgements: HitJudgement[] = [];
  private expressionChoices: ChoiceCueType[] = [];
  private combo = 0;
  private comboMilestonesShown = new Set<number>();
  private score = 0;
  private startTime = 0;
  private leadMs: number = RHYTHM_LEAD_MS.standard;
  private pxPerMs = (HIT_LINE_Y - SPAWN_Y) / RHYTHM_LEAD_MS.standard;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private cityLabel!: Phaser.GameObjects.Text;
  private crowdFigures: Phaser.GameObjects.Image[] = [];
  private laneFlashes: Phaser.GameObjects.Rectangle[] = [];
  private crowd = 40;
  private finished = false;
  private metronomeEvent: Phaser.Time.TimerEvent | null = null;
  private ctx!: PerformanceContext;
  private activeHolds = new Map<number, NoteState>();
  private tutorialActive = false;
  private forceRelaxedFirstSong = false;
  private holdHintShown = false;
  private cueHintShown = false;

  init(data: { cityId: string }): void {
    this.cityId = data.cityId;
    this.notes = [];
    this.cues = [];
    this.judgements = [];
    this.expressionChoices = [];
    this.combo = 0;
    this.comboMilestonesShown = new Set();
    this.score = 0;
    this.crowd = Math.round(State.data.stats.harmony * 0.4 + 20);
    this.finished = false;
    this.activeHolds = new Map();
    this.tutorialActive = false;
    this.forceRelaxedFirstSong = false;
    this.holdHintShown = false;
    this.cueHintShown = false;
    // Phaser reuses this scene instance across visits — images from the last visit are
    // destroyed on shutdown but the arrays themselves aren't cleared automatically, so a stale
    // reference here would crash the next updateCrowdFigures()/lane-flash call.
    this.crowdFigures = [];
    this.laneFlashes = [];
  }

  create(): void {
    fadeIn(this);
    const city = getCity(this.cityId);
    const song = getSong(city.songId);

    // Decide the tutorial + timing mode up front: lead time (and so fall speed) depends on it.
    this.tutorialActive = !hasSeenRhythmTutorial();
    // Wide windows + slow fall for a first-timer's first real song, but only if they've never
    // touched Settings — a returning player's own configured rhythmMode always wins.
    this.forceRelaxedFirstSong = this.tutorialActive && !hasEverOpenedSettings();
    this.leadMs = RHYTHM_LEAD_MS[this.currentRhythmMode()];
    this.pxPerMs = (HIT_LINE_Y - SPAWN_Y) / this.leadMs;

    this.add.rectangle(0, 0, W, H, PALETTE.night, 1).setOrigin(0, 0);
    const tex = ensureLaneTextures(this, LANE_W);
    for (let l = 0; l < song.lanes; l++) {
      this.add.image(LANE_X_START + l * LANE_W, 0, tex.lane).setOrigin(0, 0);
      // One flash overlay per lane, kept invisible until a hit lands in that lane.
      const flash = this.add.rectangle(LANE_X_START + l * LANE_W, 0, LANE_W, H, PALETTE.gold, 1)
        .setOrigin(0, 0).setAlpha(0).setDepth(5);
      this.laneFlashes.push(flash);
    }
    const hitLineKey = ensureHitLineGlow(this, LANE_W * song.lanes);
    this.add.image(LANE_X_START, HIT_LINE_Y - 14, hitLineKey).setOrigin(0, 0).setDepth(6);

    this.scoreText = this.add.text(24, 24, 'Score: 0', textStyle('h2', { fontSize: '22px', color: PALETTE_HEX.cream })).setDepth(50);
    this.comboText = this.add.text(24, 56, '', textStyle('h2', { fontSize: '20px' })).setDepth(50);
    // Top-right cluster: city/arrangement label, then the crowd meter, both kept left of the
    // "?" help button (which occupies the last ~100px of the top edge).
    this.cityLabel = this.add.text(W - 110, 24, '', textStyle('small')).setOrigin(1, 0).setDepth(50);
    addHelpButton(this, 'Tap notes as they reach the gold line. Hold notes: press and hold. Choice cues: tap the banner. Score never blocks the story.');

    this.add.text(W - 110, 50, 'Crowd', textStyle('small', { fontSize: '13px' })).setOrigin(1, 0).setDepth(50);
    const downKey = ensureCrowdFigure(this, false);
    for (let i = 0; i < 5; i++) {
      this.crowdFigures.push(this.add.image(W - 240 + i * 26, 72, downKey).setOrigin(0, 0).setScale(0.7).setDepth(50));
    }
    this.updateCrowdFigures();

    if (State.data.accessibility.visualAssist) {
      this.add.text(W / 2, HIT_LINE_Y + 30, 'Tap a lane as its note crosses the line', textStyle('small', { fontSize: '14px' }))
        .setOrigin(0.5).setDepth(50);
    }

    for (let l = 0; l < song.lanes; l++) {
      // Tap zone: the whole lane below the spawn area, so a thumb resting anywhere in the lane's
      // lower half registers — not just a thin band at the line. Timing is judged by the clock,
      // never by where in the zone the finger landed.
      const zone = this.add.zone(LANE_X_START + l * LANE_W, HIT_LINE_Y - 160, LANE_W, 300).setOrigin(0, 0).setInteractive();
      zone.on('pointerdown', () => this.attemptHit(l));
      const keyMap = ['D', 'F', 'J', 'K'];
      if (keyMap[l]) {
        this.input.keyboard?.on(`keydown-${keyMap[l]}`, () => this.attemptHit(l));
        this.input.keyboard?.on(`keyup-${keyMap[l]}`, () => this.releaseAllHolds());
      }
    }
    // Scene-level pointerup so a hold releases even if the finger drifts off its lane zone.
    this.input.on('pointerup', () => this.releaseAllHolds());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.metronomeEvent?.destroy());

    // The very first rhythm scene the player ever reaches gets a short, unscored, un-skippable-
    // but-unpunishing practice pass before the real song. `this.finished = true` here is load-
    // bearing: update() no-ops entirely while it's true, so with this.notes/this.cues still
    // empty (set in init()) there is nothing for it to prematurely judge or finish() over.
    if (this.tutorialActive) {
      this.finished = true;
      this.runPracticePass(song, () => this.beginRealSong(city, song));
    } else {
      this.beginRealSong(city, song);
    }
  }

  /** Builds and starts the actual playable song — split out from create() so the one-time
   *  practice pass can run first without duplicating any of the scoring/finish machinery. */
  private beginRealSong(city: CityDef, song: SongDef): void {
    const arrangement = pickArrangement(song, State.data.flags);
    audio.playAmbience(parseChordProgression(song.chordProgression), song.bpm, song.waveform);
    this.ctx = {
      cityId: city.id, songId: song.id, arrangement,
      bandHarmony: State.data.stats.harmony, energy: State.data.stats.energy,
      audienceMood: State.data.stats.harmony, storyFlags: State.data.flags,
    };
    this.notes = arrangement.notes.map((note) => ({ note, judged: false }));
    this.cues = arrangement.cues.map((cue) => ({ cue, handled: false }));
    this.cityLabel.setText(`${city.name} — ${arrangement.label}`);

    if (this.tutorialActive) {
      this.add.text(W / 2, 140, 'TAP = touch the note   HOLD = press & hold   CUE = tap the banner',
        textStyle('small', { fontSize: '14px', color: PALETTE_HEX.gold, wordWrap: { width: W - 80 }, align: 'center' })).setOrigin(0.5).setDepth(50);
      markRhythmTutorialSeen();
    }

    if (State.data.accessibility.audioAssist) this.startMetronome(song.bpm);
    this.startTime = this.time.now + 1200;
    this.finished = false;
  }

  private laneCenterX(l: number): number {
    return LANE_X_START + l * LANE_W + LANE_W / 2;
  }

  /** A note/cue's hit time, shifted by the player's calibrated audio offset (§Settings "Audio
   *  sync"). Used for both the falling-note's visual position and judging a tap, so the two
   *  always agree — see game/rhythm.ts's adjustedHitMs. */
  private hitMsFor(t: number): number {
    return adjustedHitMs(this.startTime + t * 1000, State.data.accessibility.audioOffsetMs);
  }

  /** The player's own saved rhythmMode, except for their very first-ever song when they've
   *  never opened Settings — then it's overridden to 'relaxed' for this song only. Never
   *  mutates or saves State.data.accessibility.rhythmMode, so a real preference set in a later
   *  run is never silently clobbered by this one-time nudge. */
  private currentRhythmMode(): RhythmMode {
    return this.forceRelaxedFirstSong ? 'relaxed' : State.data.accessibility.rhythmMode;
  }

  /** Non-interactive demo of the three note types, on the song's actual beat grid: a soft
   *  metronome ticks every beat and each demo note is timed to LAND on a beat (spawned
   *  `leadMs` before it), so the player absorbs the timing feel — not just the gesture.
   *  Deliberately decoupled from the real note/scoring pipeline (this.notes/this.cues stay
   *  empty throughout) so it cannot affect score, combo, or crowd, and cannot be "failed". A
   *  stray tap during it is a harmless no-op: attemptHit() only matches against this.notes. */
  private runPracticePass(song: SongDef, onDone: () => void): void {
    const beatMs = 60000 / song.bpm;
    const at = (beat: number, fn: () => void) => this.time.delayedCall(Math.max(0, beat * beatMs), fn);
    const label = this.add.text(W / 2, 260, 'Tap when the note touches the line!', textStyle('h2', {
      fontSize: '20px', color: PALETTE_HEX.gold, wordWrap: { width: W - 100 }, align: 'center',
    })).setOrigin(0.5).setAlpha(0).setDepth(60);
    this.tweens.add({ targets: label, alpha: 1, duration: 250 });

    const totalBeats = 14;
    for (let b = 0; b < totalBeats; b++) {
      at(b, () => audio.playSfx(b % 4 === 0 ? 'metronomeAccent' : 'metronome'));
    }

    const tex = ensureLaneTextures(this, LANE_W);
    const leadBeats = this.leadMs / beatMs;

    // TAP lands on beat 4.
    at(4 - leadBeats, () => {
      const tapNote = this.add.image(this.laneCenterX(0), SPAWN_Y, tex.noteTap).setDepth(60);
      this.tweens.add({
        targets: tapNote, y: HIT_LINE_Y, duration: this.leadMs, ease: 'Linear',
        onComplete: () => {
          spawnPerfectSpark(this, this.laneCenterX(0), HIT_LINE_Y);
          this.flashLane(0, 'perfect');
          tapNote.destroy();
        },
      });
    });

    // HOLD lands on beat 8.
    at(8 - leadBeats, () => {
      label.setText('Hold notes: press and hold until they end.');
      const railKey = ensureHoldRail(this, 220, HOLD_RAIL_W);
      const rail = this.add.image(this.laneCenterX(2), SPAWN_Y, railKey).setOrigin(0.5, 1).setDepth(60);
      this.tweens.add({
        targets: rail, y: HIT_LINE_Y, duration: this.leadMs, ease: 'Linear',
        onComplete: () => { this.flashLane(2, 'good'); rail.destroy(); },
      });
    });

    // CUE banner on beat 10, gone by beat 13.
    at(10, () => {
      label.setText('Choice cues: tap the banner when it appears.');
      const w = 420, h = 64;
      const banner = createButton(this, W / 2 - w / 2, 500, w, h, '  Like this', () => {},
        { fillColor: PALETTE.terracotta, fontSize: '18px' });
      banner.setDepth(60);
      at(3, () => banner.destroy());
    });

    at(totalBeats, () => {
      this.tweens.add({
        targets: label, alpha: 0, duration: 250,
        onComplete: () => { label.destroy(); onDone(); },
      });
    });
  }

  private startMetronome(bpm: number): void {
    const beatMs = (60 / bpm) * 1000;
    let beatCount = 0;
    this.metronomeEvent = this.time.addEvent({
      delay: beatMs, startAt: beatMs - ((this.time.now + 1200) % beatMs), loop: true,
      callback: () => { audio.playSfx(beatCount % 4 === 0 ? 'metronomeAccent' : 'metronome'); beatCount++; },
    });
  }

  update(): void {
    if (this.finished) return;
    const now = this.time.now;
    const t = (now - this.startTime) / 1000;
    const windows = effectiveWindows(this.currentRhythmMode(), State.data.accessibility.wiggleRoom);

    for (const ns of this.notes) {
      const hitMs = this.hitMsFor(ns.note.t);
      const progress = 1 - (hitMs - now) / this.leadMs;
      if (progress < -0.15 || progress > 1.3) {
        if (!ns.judged && !ns.holding && progress > 1.3) this.judgeMiss(ns);
        continue;
      }
      const y = Phaser.Math.Linear(SPAWN_Y, HIT_LINE_Y, Phaser.Math.Clamp(progress, 0, 1));
      const lane = this.laneCenterX(ns.note.l);
      if (ns.note.type === 'hold') {
        const railHeight = (ns.note.dur ?? 0.2) * 1000 * this.pxPerMs;
        const railKey = ensureHoldRail(this, railHeight, HOLD_RAIL_W);
        if (!ns.sprite) {
          ns.sprite = this.add.image(lane, y, railKey).setOrigin(0.5, 1).setDepth(10);
          this.maybeShowHoldHint(lane);
        } else ns.sprite.setPosition(lane, y);
      } else {
        const texKey = ensureLaneTextures(this, LANE_W)[ns.note.type === 'tap' ? 'noteTap' : 'noteChoice'];
        if (!ns.sprite) ns.sprite = this.add.image(lane, y, texKey).setDepth(10);
        else ns.sprite.setPosition(lane, y);
      }
      if (State.data.accessibility.autoplay && !ns.judged && !ns.holding && now >= hitMs) {
        if (ns.note.type === 'hold') this.beginHold(ns, 0, now);
        else this.judgeNote(ns, 0);
      }
    }

    // Auto-finalize a hold nobody released — reward holding through as if released on time.
    for (const [lane, ns] of this.activeHolds) {
      const expectedEndMs = this.hitMsFor(ns.note.t + (ns.note.dur ?? 0.2));
      if (now > expectedEndMs + windows.ok) {
        this.finalizeHold(ns, expectedEndMs);
        this.activeHolds.delete(lane);
      }
    }

    for (const cs of this.cues) {
      const cueMs = this.hitMsFor(cs.cue.t);
      if (!cs.handled && Math.abs(now - cueMs) < 1200 && !cs.banner) {
        cs.banner = this.showCueBanner(cs);
      }
      if (!cs.handled && State.data.accessibility.autoplay && now >= cueMs) {
        this.resolveCue(cs);
      }
      if (!cs.handled && now > cueMs + 1400) {
        cs.handled = true;
        cs.banner?.destroy();
      }
    }

    if (t > this.longestNoteEndSeconds() + 1.5 && !this.finished) {
      this.finish();
    }
  }

  private longestNoteEndSeconds(): number {
    let max = 0;
    for (const ns of this.notes) max = Math.max(max, ns.note.t + (ns.note.dur ?? 0.2));
    for (const cs of this.cues) max = Math.max(max, cs.cue.t + 0.5);
    return max;
  }

  private attemptHit(lane: number): void {
    const now = this.time.now;
    const windows = effectiveWindows(this.currentRhythmMode(), State.data.accessibility.wiggleRoom);
    let best: NoteState | null = null;
    let bestDelta = Infinity;
    for (const ns of this.notes) {
      if (ns.judged || ns.holding || ns.note.l !== lane) continue;
      const hitMs = this.hitMsFor(ns.note.t);
      const delta = Math.abs(now - hitMs);
      if (delta < bestDelta && delta <= windows.ok) { best = ns; bestDelta = delta; }
    }
    if (!best) return;
    const delta = now - this.hitMsFor(best.note.t);
    if (best.note.type === 'hold') this.beginHold(best, delta, now);
    else this.judgeNote(best, delta);
  }

  private beginHold(ns: NoteState, startDelta: number, now: number): void {
    ns.holding = true;
    ns.holdStartDelta = startDelta;
    ns.holdStartAt = now;
    this.activeHolds.set(ns.note.l, ns);
    this.playHitSfx('tap');
  }

  /** Rhythm hit feedback SFX (tap/perfect/good/ok/miss), muted by the "Tap sound" toggle —
   *  music/ambience/metronome are separate and unaffected. */
  private playHitSfx(name: SfxName): void {
    if (State.data.accessibility.tapSoundEnabled) audio.playSfx(name);
  }

  /** navigator.vibrate is a no-op where unsupported (iOS Safari, desktop) — safe to call
   *  unconditionally behind the Haptics toggle, no platform check needed. */
  private vibrate(pattern: number): void {
    if (State.data.accessibility.haptics) navigator.vibrate?.(pattern);
  }

  private releaseAllHolds(): void {
    const now = this.time.now;
    for (const ns of this.activeHolds.values()) this.finalizeHold(ns, now);
    this.activeHolds.clear();
  }

  private finalizeHold(ns: NoteState, releaseAt: number): void {
    if (ns.judged) return;
    const windows = effectiveWindows(this.currentRhythmMode(), State.data.accessibility.wiggleRoom);
    const dur = (ns.note.dur ?? 0.2) * 1000;
    const heldMs = releaseAt - (ns.holdStartAt ?? releaseAt);
    const completion = Phaser.Math.Clamp(dur > 0 ? heldMs / dur : 1, 0, 1);
    const startJudgement = judgeHit(ns.holdStartDelta ?? 0, windows);
    const finalJudgement = combineHoldJudgement(startJudgement, completion);
    ns.judged = true;
    this.applyJudgement(finalJudgement, ns.note.l);
    ns.sprite?.destroy();
  }

  private judgeNote(ns: NoteState, deltaMs: number): void {
    ns.judged = true;
    const windows = effectiveWindows(this.currentRhythmMode(), State.data.accessibility.wiggleRoom);
    const judgement = judgeHit(deltaMs, windows);
    this.applyJudgement(judgement, ns.note.l);
    ns.sprite?.destroy();
  }

  private judgeMiss(ns: NoteState): void {
    ns.judged = true;
    this.applyJudgement('miss', ns.note.l);
    ns.sprite?.destroy();
  }

  private applyJudgement(judgement: HitJudgement, lane: number): void {
    this.judgements.push(judgement);
    this.combo = judgement === 'miss' ? 0 : this.combo + 1;
    if (this.combo === 0) this.comboMilestonesShown.clear();
    const points = scoreForHit(judgement, this.combo, State.data.accessibility.easyScoring);
    this.score += points;
    this.scoreText.setText(`Score: ${this.score}`);
    this.comboText.setText(this.combo > 1 ? `Combo x${this.combo}` : '');
    comboPop(this, this.comboText);
    this.maybeShowComboStamp();
    this.crowd = Phaser.Math.Clamp(this.crowd + (judgement === 'perfect' ? 3 : judgement === 'good' ? 1 : judgement === 'miss' ? -2 : 0), 0, 100);
    this.updateCrowdFigures();

    // Feedback lands in the lane that was actually hit — previously every spark fired at a
    // fixed lane-0 x, which read as "the game didn't see my tap" on lanes 1-3.
    const hitX = this.laneCenterX(lane);
    this.flashLane(lane, judgement);
    this.showJudgementText(hitX, judgement, points);
    if (judgement === 'perfect') {
      this.playHitSfx('perfect');
      this.vibrate(15);
      spawnPerfectSpark(this, hitX, HIT_LINE_Y);
      spawnRingPulse(this, hitX, HIT_LINE_Y, PALETTE.gold);
      hitstop(this, 30);
    } else if (judgement === 'good') {
      this.playHitSfx('good');
      spawnRingPulse(this, hitX, HIT_LINE_Y, PALETTE.cream);
    } else if (judgement === 'ok') {
      this.playHitSfx('ok');
    } else {
      this.playHitSfx('miss');
      this.vibrate(30);
      if (this.combo === 0) shake(this, 4);
    }
  }

  /** Brief tint over the whole lane on a hit. It's a static alpha fade, not motion, so it's
   *  kept under reducedMotion — but skipped under noFlash, which is the setting it's about. */
  private flashLane(lane: number, judgement: HitJudgement): void {
    if (State.data.accessibility.noFlash) return;
    const flash = this.laneFlashes[lane];
    if (!flash) return;
    flash.setFillStyle(JUDGEMENT_COLOR[judgement], 1);
    flash.setAlpha(judgement === 'miss' ? 0.12 : 0.22);
    this.tweens.killTweensOf(flash);
    this.tweens.add({ targets: flash, alpha: 0, duration: judgement === 'miss' ? 220 : 160, ease: 'Quad.easeOut' });
  }

  /** Floating "Perfect! +100" at the hit line, rising and fading. Under reducedMotion it fades
   *  in place — the information still shows, only the travel is dropped. */
  private showJudgementText(x: number, judgement: HitJudgement, points: number): void {
    const label = judgement === 'miss' ? JUDGEMENT_LABEL.miss : `${JUDGEMENT_LABEL[judgement]} +${points}`;
    const text = this.add.text(x, HIT_LINE_Y - 56, label, textStyle('button', {
      fontSize: judgement === 'perfect' ? '24px' : '20px', color: JUDGEMENT_HEX[judgement],
    })).setOrigin(0.5).setDepth(90);
    const rise = State.data.accessibility.reducedMotion ? 0 : 44;
    this.tweens.add({
      targets: text, y: text.y - rise, alpha: 0, duration: 600, ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private maybeShowComboStamp(): void {
    const milestone = COMBO_MILESTONES.find((m) => this.combo >= m && !this.comboMilestonesShown.has(m));
    if (!milestone) return;
    this.comboMilestonesShown.add(milestone);
    const stamp = this.add.text(W / 2, H / 2 - 100, `Combo x${milestone}\n${COMBO_STAMPS[milestone]}`, textStyle('title', {
      fontSize: '40px', align: 'center', lineSpacing: 4,
    })).setOrigin(0.5).setAlpha(0).setScale(0.7).setDepth(120);
    this.tweens.add({
      targets: stamp, alpha: 1, scale: 1, duration: 200, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: stamp, alpha: 0, delay: 500, duration: 300, onComplete: () => stamp.destroy() });
      },
    });
  }

  private updateCrowdFigures(): void {
    const raisedCount = Math.round((this.crowd / 100) * this.crowdFigures.length);
    const downKey = ensureCrowdFigure(this, false);
    const upKey = ensureCrowdFigure(this, true);
    this.crowdFigures.forEach((fig, i) => {
      fig.setTexture(i < raisedCount ? upKey : downKey);
    });
  }

  private showCueBanner(cs: CueState): Phaser.GameObjects.Container {
    const w = 460, h = 64;
    const container = createButton(this, W / 2 - w / 2, 400, w, h, `  ${CUE_LABELS[cs.cue.type]}`,
      () => this.resolveCue(cs), { fillColor: PALETTE.terracotta, fontSize: '18px', tapSfx: 'choiceConfirm' });
    container.setDepth(95);
    const iconKey = ensureCueIcon(this, cs.cue.type);
    container.add(this.add.image(34, h / 2, iconKey));
    this.maybeShowCueHint();
    return container;
  }

  /** First hold note / first choice cue this player has ever seen gets a one-line hint,
   *  the first time each appears — a persistent (not run-scoped) flag, since a returning
   *  player doesn't need this repeated on their second tour. */
  private maybeShowHoldHint(nearX: number): void {
    if (this.holdHintShown || hasSeenHoldHint()) return;
    this.holdHintShown = true;
    markHoldHintSeen();
    const hint = this.add.text(nearX, SPAWN_Y - 30, 'Press and hold…', textStyle('small', {
      fontSize: '14px', color: PALETTE_HEX.gold,
    })).setOrigin(0.5).setDepth(70);
    this.tweens.add({ targets: hint, alpha: 0, delay: 1600, duration: 400, onComplete: () => hint.destroy() });
  }

  private maybeShowCueHint(): void {
    if (this.cueHintShown || hasSeenCueHint()) return;
    this.cueHintShown = true;
    markCueHintSeen();
    const hint = this.add.text(W / 2, 470, 'Tap the banner to pick the moment\'s direction', textStyle('small', {
      fontSize: '14px', color: PALETTE_HEX.gold, wordWrap: { width: W - 120 }, align: 'center',
    })).setOrigin(0.5).setDepth(70);
    this.tweens.add({ targets: hint, alpha: 0, delay: 1600, duration: 400, onComplete: () => hint.destroy() });
  }

  private resolveCue(cs: CueState): void {
    if (cs.handled) return;
    cs.handled = true;
    this.expressionChoices.push(cs.cue.type);
    audio.crowdSwell(0.6);
    this.crowd = Phaser.Math.Clamp(this.crowd + 4, 0, 100);
    this.updateCrowdFigures();
    cs.banner?.destroy();
  }

  private finish(): void {
    this.finished = true;
    this.releaseAllHolds();
    this.metronomeEvent?.destroy();
    audio.stopMusic();
    const result = buildPerformanceResult(this.judgements, this.expressionChoices, { ...this.ctx, audienceMood: this.crowd });
    for (const flag of result.unlockedFlags) State.addFlag(flag);
    State.applyStatDeltas({ inspiration: Math.round(result.crowdConnection / 20), energy: -4 });
    State.addLocalLove(this.cityId, Math.round(result.crowdConnection / 10));
    saveRun(State.data);
    goTo(this, 'Results', { cityId: this.cityId, result });
  }
}
