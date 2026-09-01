import Phaser from 'phaser';
import { H, PALETTE, PALETTE_HEX, W } from '../const';
import { ensureLaneTextures } from '../art/sprites';
import { spawnPerfectSpark, comboPop, hitstop, shake } from '../art/effects';
import { goTo, fadeIn } from './transition';
import { createButton } from './Button';
import { State } from '../core/state';
import { audio } from '../core/audio';
import { getCity, getSong } from '../game/content';
import {
  buildPerformanceResult, comboMultiplier, effectiveWindows, judgeHit,
  pickArrangement, scoreForHit, type HitJudgement, type PerformanceContext,
} from '../game/rhythm';
import type { ChartCue, ChartNote, ChoiceCueType } from '../../content/schema';
import { saveRun } from '../core/save';
import { textStyle } from './textStyles';

const HIT_LINE_Y = 1100;
const SPAWN_Y = 160;
const LEAD_MS = 1600;
const LANE_X_START = 90;
const LANE_W = 140;
const CUE_LABELS: Record<ChoiceCueType, string> = {
  pull_back: 'Pull back', build: 'Build', invite_crowd: 'Invite the crowd', improvise: 'Improvise', spotlight_bandmate: 'Spotlight a bandmate',
};

interface NoteState { note: ChartNote; judged: boolean; sprite?: Phaser.GameObjects.Image; }
interface CueState { cue: ChartCue; handled: boolean; banner?: Phaser.GameObjects.Container; }

export class RhythmScene extends Phaser.Scene {
  constructor() { super('Rhythm'); }

  private cityId!: string;
  private notes: NoteState[] = [];
  private cues: CueState[] = [];
  private judgements: HitJudgement[] = [];
  private expressionChoices: ChoiceCueType[] = [];
  private combo = 0;
  private score = 0;
  private startTime = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private crowdBar!: Phaser.GameObjects.Rectangle;
  private crowd = 40;
  private finished = false;
  private metronomeEvent: Phaser.Time.TimerEvent | null = null;
  private ctx!: PerformanceContext;

  init(data: { cityId: string }): void {
    this.cityId = data.cityId;
    this.notes = [];
    this.cues = [];
    this.judgements = [];
    this.expressionChoices = [];
    this.combo = 0;
    this.score = 0;
    this.crowd = Math.round(State.data.stats.harmony * 0.4 + 20);
    this.finished = false;
  }

  create(): void {
    fadeIn(this);
    const city = getCity(this.cityId);
    const song = getSong(city.songId);
    const arrangement = pickArrangement(song, State.data.flags);
    this.ctx = {
      cityId: city.id, songId: song.id, arrangement,
      bandHarmony: State.data.stats.harmony, energy: State.data.stats.energy,
      audienceMood: State.data.stats.harmony, storyFlags: State.data.flags,
    };

    this.add.rectangle(0, 0, W, H, PALETTE.night, 1).setOrigin(0, 0);
    const tex = ensureLaneTextures(this);
    for (let l = 0; l < song.lanes; l++) {
      this.add.image(LANE_X_START + l * LANE_W, 0, tex.lane).setOrigin(0, 0);
    }
    this.add.rectangle(LANE_X_START, HIT_LINE_Y, LANE_W * song.lanes, 6, PALETTE.gold, 0.9).setOrigin(0, 0);

    this.notes = arrangement.notes.map((note) => ({ note, judged: false }));
    this.cues = arrangement.cues.map((cue) => ({ cue, handled: false }));

    this.scoreText = this.add.text(24, 24, 'Score: 0', textStyle('h2', { fontSize: '22px', color: PALETTE_HEX.cream }));
    this.comboText = this.add.text(24, 56, '', textStyle('h2', { fontSize: '20px' }));
    this.add.text(W - 200, 24, `${city.name} — ${arrangement.label}`, textStyle('small'));

    this.add.rectangle(W - 220, 60, 180, 14, 0x000000, 0.3).setOrigin(0, 0);
    this.crowdBar = this.add.rectangle(W - 220, 60, 0, 14, PALETTE.terracotta, 1).setOrigin(0, 0);
    this.add.text(W - 220, 40, 'Crowd', textStyle('small', { fontSize: '13px' }));

    if (State.data.accessibility.visualAssist) {
      this.add.text(LANE_X_START, HIT_LINE_Y + 20, 'Tap here as notes cross the line', textStyle('small', { fontSize: '13px' }));
    }

    for (let l = 0; l < song.lanes; l++) {
      const zone = this.add.zone(LANE_X_START + l * LANE_W, HIT_LINE_Y - 40, LANE_W, 120).setOrigin(0, 0).setInteractive();
      zone.on('pointerdown', () => this.attemptHit(l));
      const keyMap = ['D', 'F', 'J', 'K'];
      if (keyMap[l]) {
        this.input.keyboard?.on(`keydown-${keyMap[l]}`, () => this.attemptHit(l));
      }
    }

    if (State.data.accessibility.audioAssist) this.startMetronome(song.bpm);

    this.startTime = this.time.now + 1200;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.metronomeEvent?.destroy());
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

    for (const ns of this.notes) {
      const hitMs = this.startTime + ns.note.t * 1000;
      const progress = 1 - (hitMs - now) / LEAD_MS;
      if (progress < -0.15 || progress > 1.3) {
        if (!ns.judged && progress > 1.3) this.judgeMiss(ns);
        continue;
      }
      const y = Phaser.Math.Linear(SPAWN_Y, HIT_LINE_Y, Phaser.Math.Clamp(progress, 0, 1));
      const texKey = ensureLaneTextures(this)[ns.note.type === 'tap' ? 'noteTap' : ns.note.type === 'hold' ? 'noteHold' : 'noteChoice'];
      if (!ns.sprite) {
        ns.sprite = this.add.image(LANE_X_START + ns.note.l * LANE_W + LANE_W / 2, y, texKey);
      } else {
        ns.sprite.setPosition(LANE_X_START + ns.note.l * LANE_W + LANE_W / 2, y);
      }
      if (State.data.accessibility.autoplay && !ns.judged && now >= hitMs) {
        this.judgeNote(ns, 0);
      }
    }

    for (const cs of this.cues) {
      const cueMs = this.startTime + cs.cue.t * 1000;
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
    const windows = effectiveWindows(State.data.accessibility.rhythmMode, State.data.accessibility.wiggleRoom);
    let best: NoteState | null = null;
    let bestDelta = Infinity;
    for (const ns of this.notes) {
      if (ns.judged || ns.note.l !== lane) continue;
      const hitMs = this.startTime + ns.note.t * 1000;
      const delta = Math.abs(now - hitMs);
      if (delta < bestDelta && delta <= windows.ok) { best = ns; bestDelta = delta; }
    }
    if (best) this.judgeNote(best, now - (this.startTime + best.note.t * 1000));
  }

  private judgeNote(ns: NoteState, deltaMs: number): void {
    ns.judged = true;
    const windows = effectiveWindows(State.data.accessibility.rhythmMode, State.data.accessibility.wiggleRoom);
    const judgement = judgeHit(deltaMs, windows);
    this.applyJudgement(judgement);
    ns.sprite?.destroy();
  }

  private judgeMiss(ns: NoteState): void {
    ns.judged = true;
    this.applyJudgement('miss');
    ns.sprite?.destroy();
  }

  private applyJudgement(judgement: HitJudgement): void {
    this.judgements.push(judgement);
    this.combo = judgement === 'miss' ? 0 : this.combo + 1;
    this.score += scoreForHit(judgement, this.combo, State.data.accessibility.easyScoring);
    this.scoreText.setText(`Score: ${this.score}`);
    this.comboText.setText(this.combo > 1 ? `Combo x${this.combo}` : '');
    comboPop(this, this.comboText);
    this.crowd = Phaser.Math.Clamp(this.crowd + (judgement === 'perfect' ? 3 : judgement === 'good' ? 1 : judgement === 'miss' ? -2 : 0), 0, 100);
    this.crowdBar.width = 180 * (this.crowd / 100);
    if (judgement === 'perfect') {
      audio.playSfx('perfect');
      spawnPerfectSpark(this, LANE_X_START + LANE_W / 2, HIT_LINE_Y);
      hitstop(this, 30);
    } else if (judgement === 'good') {
      audio.playSfx('good');
    } else if (judgement === 'ok') {
      audio.playSfx('ok');
    } else {
      audio.playSfx('miss');
      if (this.combo === 0) shake(this, 4);
    }
  }

  private showCueBanner(cs: CueState): Phaser.GameObjects.Container {
    const container = this.add.container(0, 400).setDepth(90);
    const bg = this.add.rectangle(W / 2, 0, 460, 70, PALETTE.terracotta, 0.95).setOrigin(0.5);
    bg.setStrokeStyle(3, PALETTE.gold, 0.9);
    const label = this.add.text(W / 2, 0, `Tap: ${CUE_LABELS[cs.cue.type]}`, textStyle('button', { fontSize: '20px' })).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.resolveCue(cs));
    container.add([bg, label]);
    return container;
  }

  private resolveCue(cs: CueState): void {
    if (cs.handled) return;
    cs.handled = true;
    this.expressionChoices.push(cs.cue.type);
    audio.crowdSwell(0.6);
    this.crowd = Phaser.Math.Clamp(this.crowd + 4, 0, 100);
    this.crowdBar.width = 180 * (this.crowd / 100);
    cs.banner?.destroy();
  }

  private finish(): void {
    this.finished = true;
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
