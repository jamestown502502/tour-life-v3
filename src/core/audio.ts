// Web Audio API synthesis engine. No audio files. Everything behind a first-gesture unlock.

export type SfxName =
  | 'tap' | 'perfect' | 'good' | 'ok' | 'miss'
  | 'choiceConfirm' | 'menuHover' | 'pickup' | 'metronome' | 'metronomeAccent';

class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private metronomeGain!: GainNode;
  private unlocked = false;
  private musicNodes: { stop(): void } | null = null;

  volumes = { master: 1, music: 0.7, sfx: 0.9, metronome: 0.6 };

  /** Call on first user gesture (pointerdown/keydown). Idempotent. */
  unlock(): void {
    if (this.unlocked) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volumes.master;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.volumes.music;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.volumes.sfx;
    this.sfxGain.connect(this.masterGain);

    this.metronomeGain = this.ctx.createGain();
    this.metronomeGain.gain.value = this.volumes.metronome;
    this.metronomeGain.connect(this.masterGain);

    this.unlocked = true;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  setVolume(bus: keyof typeof this.volumes, value: number): void {
    this.volumes[bus] = value;
    if (!this.ctx) return;
    const node = { master: this.masterGain, music: this.musicGain, sfx: this.sfxGain, metronome: this.metronomeGain }[bus];
    node.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
  }

  /** Duck music bus during dialogue (-6dB), restore after. */
  duckMusic(on: boolean): void {
    if (!this.ctx) return;
    const target = on ? this.volumes.music * 0.5 : this.volumes.music;
    this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.15);
  }

  private tone(
    freqStart: number, freqEnd: number, durationSec: number, gainValue: number,
    type: OscillatorType, bus: GainNode,
  ): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd !== freqStart) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + durationSec);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
    osc.connect(gain).connect(bus);
    osc.start(t0);
    osc.stop(t0 + durationSec + 0.02);
  }

  private noiseBurst(durationSec: number, gainValue: number, filterHz: number, bus: GainNode): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterHz;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
    src.connect(filter).connect(gain).connect(bus);
    src.start(t0);
    src.stop(t0 + durationSec + 0.02);
  }

  playSfx(name: SfxName): void {
    if (!this.ctx) return;
    const bus = name === 'metronome' || name === 'metronomeAccent' ? this.metronomeGain : this.sfxGain;
    switch (name) {
      case 'tap': return this.tone(220, 330, 0.04, 0.15, 'square', bus);
      case 'perfect':
        this.tone(880, 1320, 0.08, 0.25, 'sine', bus);
        this.tone(1760, 1760, 0.06, 0.15, 'sine', bus);
        return;
      case 'good': return this.tone(660, 660, 0.06, 0.18, 'square', bus);
      case 'ok': return this.tone(440, 440, 0.05, 0.12, 'triangle', bus);
      case 'miss': return this.tone(110, 110, 0.1, 0.12, 'sine', bus);
      case 'choiceConfirm':
        this.tone(440, 440, 0.09, 0.18, 'triangle', bus);
        this.tone(660, 660, 0.09, 0.12, 'triangle', bus);
        return;
      case 'menuHover': return this.tone(520, 520, 0.03, 0.06, 'sine', bus);
      case 'pickup': return this.tone(660, 990, 0.07, 0.14, 'sine', bus);
      case 'metronome': return this.tone(1000, 1000, 0.02, 0.1, 'square', bus);
      case 'metronomeAccent': return this.tone(1200, 1200, 0.02, 0.14, 'square', bus);
    }
  }

  crowdSwell(durationSec = 0.8): void {
    this.noiseBurst(durationSec, 0.2, 1400, this.sfxGain);
  }

  /** Simple procedural chord-loop ambience for a hub/city scene. Returns a stopper. */
  playAmbience(chord: number[], bpm: number, waveform: OscillatorType = 'triangle'): void {
    this.stopMusic();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const beatSec = 60 / bpm;
    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = waveform;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.05 / chord.length;
      osc.connect(g).connect(this.musicGain);
      osc.start(ctx.currentTime + i * 0.01);
      oscillators.push(osc);
      gains.push(g);
    });
    let stopped = false;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1 / (beatSec * 4);
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    gains.forEach((g) => lfoGain.connect(g.gain));
    lfo.start();
    this.musicNodes = {
      stop() {
        if (stopped) return;
        stopped = true;
        oscillators.forEach((o) => o.stop());
        lfo.stop();
      },
    };
  }

  stopMusic(): void {
    this.musicNodes?.stop();
    this.musicNodes = null;
  }
}

export const audio = new AudioSystem();
