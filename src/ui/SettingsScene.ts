import Phaser from 'phaser';
import { W } from '../const';
import { createButton, getButtonText } from './Button';
import { State, type RhythmMode } from '../core/state';
import { audio } from '../core/audio';
import { saveRun } from '../core/save';
import { textStyle } from './textStyles';

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
    this.add.rectangle(0, 0, W, this.cameras.main.height, 0x2b3a55, 0.98).setOrigin(0, 0);
    this.add.text(W / 2, 50, 'Settings', textStyle('h1')).setOrigin(0.5);
    this.add.text(W / 2, 90, 'Rhythm score never gates the story. No-fail mode is always on.',
      textStyle('small', { fontSize: '13px', wordWrap: { width: W - 120 }, align: 'center' })).setOrigin(0.5);

    let y = 140;
    BOOL_ROWS.forEach(({ key, label }) => {
      this.add.text(60, y, label, textStyle('body', { fontSize: '16px' }));
      const btn = createButton(this, W - 160, y - 12, 100, 40, State.data.accessibility[key] ? 'On' : 'Off', () => {
        State.data.accessibility[key] = !State.data.accessibility[key];
        saveRun(State.data);
        getButtonText(btn)?.setText(State.data.accessibility[key] ? 'On' : 'Off');
      }, { fontSize: '16px', fillColor: State.data.accessibility[key] ? 0x3e7c7b : 0x8a8a8a });
      y += 50;
    });

    this.add.text(60, y, 'Rhythm mode', textStyle('body', { fontSize: '16px' }));
    const modeBtn = createButton(this, W - 220, y - 12, 160, 40, State.data.accessibility.rhythmMode, () => {
      const idx = RHYTHM_MODES.indexOf(State.data.accessibility.rhythmMode);
      State.data.accessibility.rhythmMode = RHYTHM_MODES[(idx + 1) % RHYTHM_MODES.length];
      saveRun(State.data);
      getButtonText(modeBtn)?.setText(State.data.accessibility.rhythmMode);
    }, { fontSize: '16px' });
    y += 60;

    this.add.text(60, y, 'Volumes', textStyle('h2'));
    y += 40;
    VOLUME_KEYS.forEach((key) => {
      this.add.text(60, y, key, textStyle('body', { fontSize: '15px' }));
      const valueText = this.add.text(300, y, `${Math.round(State.data.accessibility.volumes[key] * 100)}%`, textStyle('small', { fontSize: '15px' }));
      createButton(this, 380, y - 10, 44, 36, '-', () => this.adjustVolume(key, -0.1, valueText), { fontSize: '18px' });
      createButton(this, 434, y - 10, 44, 36, '+', () => this.adjustVolume(key, 0.1, valueText), { fontSize: '18px' });
      y += 44;
    });

    createButton(this, W / 2 - 150, y + 30, 300, 56, 'Back', () => {
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
