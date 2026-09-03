import Phaser from 'phaser';
import { W } from '../const';
import { createButton, getButtonText } from './Button';
import { State, type RhythmMode } from '../core/state';
import { audio } from '../core/audio';
import { saveRun } from '../core/save';
import { goTo } from './transition';
import { textStyle } from './textStyles';
import { markSettingsOpened } from '../core/onboarding';
import { computeCalibrationOffset, MIN_CALIBRATION_TAPS } from '../game/calibration';

type BoolKey =
  | 'visualAssist' | 'audioAssist' | 'wiggleRoom' | 'easyScoring' | 'autoplay' | 'reducedMotion'
  | 'noFlash' | 'tapSoundEnabled' | 'haptics';

// Short labels — these render inside a single self-labeled button in a 2-column grid (see
// BOOL_ROWS below), not a full-width row with a separate label, so they need to stay terse.
const BOOL_ROWS: { key: BoolKey; label: string }[] = [
  { key: 'visualAssist', label: 'Visual assist' },
  { key: 'audioAssist', label: 'Metronome' },
  { key: 'wiggleRoom', label: 'Wiggle room' },
  { key: 'easyScoring', label: 'Easy scoring' },
  { key: 'autoplay', label: 'Autoplay' },
  { key: 'reducedMotion', label: 'Reduced motion' },
  { key: 'noFlash', label: 'No screen flash' },
  { key: 'tapSoundEnabled', label: 'Tap sound' },
  { key: 'haptics', label: 'Haptics' },
];

const RHYTHM_MODES: RhythmMode[] = ['relaxed', 'standard', 'expert'];
const VOLUME_KEYS: (keyof typeof State.data.accessibility.volumes)[] = ['master', 'music', 'sfx', 'metronome'];

export class SettingsScene extends Phaser.Scene {
  constructor() { super('Settings'); }

  private returnTo = 'Hub';

  init(data: { returnTo?: string }): void {
    this.returnTo = data.returnTo ?? 'Hub';
  }

  create(): void {
    markSettingsOpened();
    this.add.rectangle(0, 0, W, this.cameras.main.height, 0x2b3a55, 0.98).setOrigin(0, 0);
    this.add.text(W / 2, 50, 'Settings', textStyle('h1')).setOrigin(0.5);
    this.add.text(W / 2, 90, 'Rhythm score never gates the story. No-fail mode is always on.',
      textStyle('small', { fontSize: '13px', wordWrap: { width: W - 120 }, align: 'center' })).setOrigin(0.5);

    // Button/row sizing targets a real >=44 CSS-px touch target at the 390px-wide mobile
    // viewport, not just the blanket pad Button.ts applies. At that width the canvas renders
    // at 0.5417x, so a raw dimension needs (dim + 16px pad) * 0.5417 >= 44 -> dim >= 66. Rows
    // use 68 with a 76 increment (8px gap so adjacent padded hit areas never touch). The whole
    // column, Back button included, must also finish above SAFE_BOTTOM_Y (1230).
    // Verified by measuring getBoundingClientRect() live at 390x844, not just by arithmetic.
    const ROW_H = 68;
    const ROW_INCREMENT = 76;

    // 9 toggles as a self-labeled 2-column grid (matching BandCreator's genre-grid pattern:
    // GRID_ROW_H/GRID_INCREMENT), not 9 stacked full-width rows — adding the close-out pass's
    // 2 new toggles (Haptics, Tap sound) to the old single-column layout would have pushed the
    // column height to ~1450 game units, well past SAFE_BOTTOM_Y (1230) and even past the H=1280
    // canvas itself. The grid keeps 9 toggles in 5 rows (390px) instead of 9 (684px).
    const GRID_ROW_H = 70, GRID_INCREMENT = 78;
    let y = 130;
    BOOL_ROWS.forEach(({ key, label }, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const text = () => `${label}: ${State.data.accessibility[key] ? 'On' : 'Off'}`;
      const btn = createButton(this, W / 2 - 300 + col * 310, 130 + row * GRID_INCREMENT, 290, GRID_ROW_H, text(), () => {
        State.data.accessibility[key] = !State.data.accessibility[key];
        saveRun(State.data);
        getButtonText(btn)?.setText(text());
      }, { fontSize: '15px', fillColor: State.data.accessibility[key] ? 0x3e7c7b : 0x8a8a8a });
    });
    y = 130 + Math.ceil(BOOL_ROWS.length / 2) * GRID_INCREMENT + 10;

    // Dialogue QoL as one row with two side-by-side toggles (a row each would push Back under
    // the safe line). 158 wide, 22px apart: 6px clear once both 8px pads are subtracted.
    this.add.text(60, y, 'Dialogue', textStyle('body', { fontSize: '16px' }));
    const dlg: { key: 'autoAdvance' | 'skipReadText'; label: string; x: number }[] = [
      { key: 'autoAdvance', label: 'Auto', x: W - 350 },
      { key: 'skipReadText', label: 'Instant', x: W - 170 },
    ];
    for (const d of dlg) {
      const text = () => `${d.label}: ${State.data.accessibility[d.key] ? 'On' : 'Off'}`;
      const btn = createButton(this, d.x, y - (ROW_H / 2 - 8), 158, ROW_H, text(), () => {
        State.data.accessibility[d.key] = !State.data.accessibility[d.key];
        saveRun(State.data);
        getButtonText(btn)?.setText(text());
      }, { fontSize: '15px', fillColor: State.data.accessibility[d.key] ? 0x3e7c7b : 0x8a8a8a });
    }
    y += ROW_INCREMENT;

    this.add.text(60, y, 'Rhythm mode', textStyle('body', { fontSize: '16px' }));
    const modeBtn = createButton(this, W - 230, y - (ROW_H / 2 - 8), 170, ROW_H, State.data.accessibility.rhythmMode, () => {
      const idx = RHYTHM_MODES.indexOf(State.data.accessibility.rhythmMode);
      State.data.accessibility.rhythmMode = RHYTHM_MODES[(idx + 1) % RHYTHM_MODES.length];
      saveRun(State.data);
      getButtonText(modeBtn)?.setText(State.data.accessibility.rhythmMode);
    }, { fontSize: '16px' });
    y += ROW_INCREMENT;

    this.add.text(60, y, 'Audio sync', textStyle('body', { fontSize: '16px' }));
    const syncValue = this.add.text(180, y, `${State.data.accessibility.audioOffsetMs}ms`, textStyle('small', { fontSize: '15px' }));
    const setOffset = (ms: number) => {
      State.data.accessibility.audioOffsetMs = Phaser.Math.Clamp(ms, -150, 150);
      saveRun(State.data);
      syncValue.setText(`${State.data.accessibility.audioOffsetMs}ms`);
    };
    createButton(this, 300, y - (ROW_H / 2 - 8), 70, ROW_H, '-5', () => setOffset(State.data.accessibility.audioOffsetMs - 5), { fontSize: '16px' });
    createButton(this, 380, y - (ROW_H / 2 - 8), 70, ROW_H, '+5', () => setOffset(State.data.accessibility.audioOffsetMs + 5), { fontSize: '16px' });
    createButton(this, 460, y - (ROW_H / 2 - 8), 190, ROW_H, 'Re-calibrate', () => this.runCalibration(setOffset), { fontSize: '15px', fillColor: 0x8a6fa3 });
    y += ROW_INCREMENT;

    this.add.text(60, y, 'Volumes', textStyle('h2'));
    y += 36;
    const VOL_BTN = 70, VOL_BTN_H = 68;
    VOLUME_KEYS.forEach((key) => {
      this.add.text(60, y, key, textStyle('body', { fontSize: '15px' }));
      const valueText = this.add.text(230, y, `${Math.round(State.data.accessibility.volumes[key] * 100)}%`, textStyle('small', { fontSize: '15px' }));
      const minusX = 340, plusX = 440; // 30px gap once Button.ts's 8px-each-side pad is subtracted
      createButton(this, minusX, y - (VOL_BTN_H / 2 - 8), VOL_BTN, VOL_BTN_H, '-', () => this.adjustVolume(key, -0.1, valueText), { fontSize: '20px' });
      createButton(this, plusX, y - (VOL_BTN_H / 2 - 8), VOL_BTN, VOL_BTN_H, '+', () => this.adjustVolume(key, 0.1, valueText), { fontSize: '20px' });
      y += ROW_INCREMENT;
    });

    createButton(this, W / 2 - 150, y + 12, 145, 56, 'Back', () => {
      this.scene.stop();
      this.scene.resume(this.returnTo);
    }, { fillColor: 0xc4704f, fontSize: '18px' });
    // Workstream 2 (navigation fix pass): City/Rhythm/MiniGame had no way back to the menu at
    // all before this — the only exits were Title and Hub's own Settings button. this.returnTo
    // is stopped (not just left paused) so its own SHUTDOWN cleanup actually runs (un-duck
    // music, stop fireflies/rain — see CityScene's SHUTDOWN handler) instead of leaking a
    // paused scene in the background forever. audio.stopMusic() is explicit here too: Title
    // only (re)starts its own ambience on the FIRST pointerdown of the whole session (a `.once`
    // gate, so audio.unlock() only ever runs once) — landing back on Title mid-song via Quit to
    // Title otherwise left a Rhythm song's audio playing forever underneath it, since nothing
    // downstream would ever call playAmbience again to crossfade it out.
    createButton(this, W / 2 + 5, y + 12, 145, 56, 'Quit to Title', () => {
      this.scene.stop(this.returnTo);
      audio.stopMusic();
      goTo(this, 'Title');
    }, { fillColor: 0x8a6fa3, fontSize: '14px' });
  }

  private adjustVolume(key: keyof typeof State.data.accessibility.volumes, delta: number, label: Phaser.GameObjects.Text): void {
    const next = Phaser.Math.Clamp(State.data.accessibility.volumes[key] + delta, 0, 1);
    State.data.accessibility.volumes[key] = next;
    audio.setVolume(key, next);
    saveRun(State.data);
    label.setText(`${Math.round(next * 100)}%`);
  }

  /** A short tap-along modal: 6 beats at a fixed 96bpm, tap in time with each. The measured
   *  offset (game/calibration.ts's trimmed-mean math, kept pure and unit-tested there) is
   *  offered as "Apply" rather than written automatically — a bad tap-along (distracted, wrong
   *  rhythm) should never silently overwrite a working setting. */
  private runCalibration(onOffsetSet: (ms: number) => void): void {
    const overlay = this.add.container(0, 0).setDepth(200);
    overlay.add(this.add.rectangle(0, 0, W, this.cameras.main.height, 0x1a2436, 0.94).setOrigin(0, 0).setInteractive());
    const title = this.add.text(W / 2, 300, 'Tap along with the beat', textStyle('h2')).setOrigin(0.5);
    const dot = this.add.circle(W / 2, 420, 26, 0x8a6fa3, 1);
    overlay.add([title, dot]);

    const bpm = 96;
    const beatMs = 60000 / bpm;
    const leadMs = 1200;
    const beatCount = 6;
    const beatTimes: number[] = [];
    const claimed: boolean[] = [];
    const deltas: number[] = [];
    const startAt = this.time.now + leadMs;
    for (let b = 0; b < beatCount; b++) {
      beatTimes.push(startAt + b * beatMs);
      claimed.push(false);
    }

    beatTimes.forEach((t, b) => {
      this.time.delayedCall(Math.max(0, t - this.time.now), () => {
        audio.playSfx(b === 0 ? 'metronomeAccent' : 'metronome');
        this.tweens.add({ targets: dot, scale: 1.4, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      });
    });

    const tapZone = this.add.zone(W / 2, 420, 400, 400).setOrigin(0.5).setInteractive();
    const tapLabel = this.add.text(W / 2, 560, 'Tap anywhere in time with the beat', textStyle('small', { fontSize: '15px' })).setOrigin(0.5);
    overlay.add([tapZone, tapLabel]);
    const onTap = () => {
      const now = this.time.now;
      let nearest = -1, nearestDist = Infinity;
      beatTimes.forEach((t, b) => {
        if (claimed[b]) return;
        const dist = Math.abs(now - t);
        if (dist < nearestDist) { nearest = b; nearestDist = dist; }
      });
      if (nearest === -1 || nearestDist > beatMs / 2) return; // no unclaimed beat nearby — ignore
      claimed[nearest] = true;
      deltas.push(now - beatTimes[nearest]);
      audio.playSfx('tap');
    };
    tapZone.on('pointerdown', onTap);

    this.time.delayedCall(leadMs + (beatCount - 1) * beatMs + 900, () => {
      tapZone.off('pointerdown', onTap);
      tapZone.destroy();
      tapLabel.destroy();
      dot.destroy();
      const offset = computeCalibrationOffset(deltas);
      if (deltas.length < MIN_CALIBRATION_TAPS) {
        title.setText('Not enough taps to measure — try again anytime');
        const closeBtn = createButton(this, W / 2 - 100, 420, 200, 60, 'Close', () => overlay.destroy(), { fillColor: 0x8a8a8a, fontSize: '16px' });
        overlay.add(closeBtn);
      } else {
        title.setText(`Measured offset: ${offset}ms`);
        const applyBtn = createButton(this, W / 2 - 210, 420, 200, 60, 'Apply', () => { onOffsetSet(offset); overlay.destroy(); }, { fillColor: 0x3e7c7b, fontSize: '16px' });
        const skipBtn = createButton(this, W / 2 + 10, 420, 200, 60, 'Skip', () => overlay.destroy(), { fillColor: 0x8a8a8a, fontSize: '16px' });
        overlay.add([applyBtn, skipBtn]);
      }
    });
  }
}
