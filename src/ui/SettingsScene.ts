import Phaser from 'phaser';
import { W } from '../const';
import { createButton, getButtonText } from './Button';
import { State, type RhythmMode } from '../core/state';
import { audio } from '../core/audio';
import { saveRun } from '../core/save';
import { textStyle } from './textStyles';
import { markSettingsOpened } from '../core/onboarding';

type BoolKey = 'visualAssist' | 'audioAssist' | 'wiggleRoom' | 'easyScoring' | 'autoplay' | 'reducedMotion' | 'noFlash';

const BOOL_ROWS: { key: BoolKey; label: string }[] = [
  { key: 'visualAssist', label: 'Visual assist (timing guide)' },
  { key: 'audioAssist', label: 'Audio assist (metronome)' },
  { key: 'wiggleRoom', label: 'Wiggle room (wider windows)' },
  { key: 'easyScoring', label: 'Easy scoring' },
  { key: 'autoplay', label: 'Autoplay' },
  { key: 'reducedMotion', label: 'Reduced motion' },
  { key: 'noFlash', label: 'No screen flash' },
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

    // Button/row sizing here targets a real >=44 CSS-px touch target at the 390px-wide mobile
    // viewport, not just the blanket pad Button.ts itself applies (which alone still landed
    // under 44px on these specific rows — see the comment there). At that width the canvas
    // renders at ~0.542x, so a raw canvas-unit dimension needs to clear ~65px (including
    // Button.ts's own 8px pad each side) before scaling down to 44 CSS px. Heights below use
    // 68-70; increments leave an 8px gap on top of that so adjacent rows' padded hit areas
    // don't touch. Verified by measuring getBoundingClientRect() live at 390x844, not just by
    // this arithmetic.
    const ROW_H = 70;
    const ROW_INCREMENT = 78;

    let y = 140;
    BOOL_ROWS.forEach(({ key, label }) => {
      this.add.text(60, y, label, textStyle('body', { fontSize: '16px' }));
      const btn = createButton(this, W - 170, y - (ROW_H / 2 - 8), 110, ROW_H, State.data.accessibility[key] ? 'On' : 'Off', () => {
        State.data.accessibility[key] = !State.data.accessibility[key];
        saveRun(State.data);
        getButtonText(btn)?.setText(State.data.accessibility[key] ? 'On' : 'Off');
      }, { fontSize: '16px', fillColor: State.data.accessibility[key] ? 0x3e7c7b : 0x8a8a8a });
      y += ROW_INCREMENT;
    });

    this.add.text(60, y, 'Rhythm mode', textStyle('body', { fontSize: '16px' }));
    const modeBtn = createButton(this, W - 230, y - (ROW_H / 2 - 8), 170, ROW_H, State.data.accessibility.rhythmMode, () => {
      const idx = RHYTHM_MODES.indexOf(State.data.accessibility.rhythmMode);
      State.data.accessibility.rhythmMode = RHYTHM_MODES[(idx + 1) % RHYTHM_MODES.length];
      saveRun(State.data);
      getButtonText(modeBtn)?.setText(State.data.accessibility.rhythmMode);
    }, { fontSize: '16px' });
    y += ROW_INCREMENT;

    this.add.text(60, y, 'Volumes', textStyle('h2'));
    y += 40;
    const VOL_BTN = 70, VOL_BTN_H = 68;
    VOLUME_KEYS.forEach((key) => {
      this.add.text(60, y, key, textStyle('body', { fontSize: '15px' }));
      const valueText = this.add.text(230, y, `${Math.round(State.data.accessibility.volumes[key] * 100)}%`, textStyle('small', { fontSize: '15px' }));
      const minusX = 340, plusX = 440; // 30px gap once Button.ts's 8px-each-side pad is subtracted
      createButton(this, minusX, y - (VOL_BTN_H / 2 - 8), VOL_BTN, VOL_BTN_H, '-', () => this.adjustVolume(key, -0.1, valueText), { fontSize: '20px' });
      createButton(this, plusX, y - (VOL_BTN_H / 2 - 8), VOL_BTN, VOL_BTN_H, '+', () => this.adjustVolume(key, 0.1, valueText), { fontSize: '20px' });
      y += ROW_INCREMENT;
    });

    createButton(this, W / 2 - 150, y + 20, 300, 56, 'Back', () => {
      this.scene.stop();
      this.scene.resume(this.returnTo);
    }, { fillColor: 0xc4704f });
  }

  private adjustVolume(key: keyof typeof State.data.accessibility.volumes, delta: number, label: Phaser.GameObjects.Text): void {
    const next = Phaser.Math.Clamp(State.data.accessibility.volumes[key] + delta, 0, 1);
    State.data.accessibility.volumes[key] = next;
    audio.setVolume(key, next);
    saveRun(State.data);
    label.setText(`${Math.round(next * 100)}%`);
  }
}
