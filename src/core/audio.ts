// Web Audio API synthesis engine. No audio files. Everything behind a first-gesture unlock.

export type SfxName =
  | 'tap' | 'perfect' | 'good' | 'ok' | 'miss'
  | 'choiceConfirm' | 'menuHover' | 'pickup' | 'metronome' | 'metronomeAccent' | 'typewriter';

class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private metronomeGain!: GainNode;
  private unlocked = false;
  private musicNodes: { stop(fadeSec?: number): void } | null = null;

  volumes = { master: 1, music: 0.7, sfx: 0.9, metronome: 0.6 };

  /** Call on first user gesture (pointerdown/keydown). Idempotent. */
  unlock(): void {
    if (this.unlocked) return;
    // No Web Audio at all (a stripped WebKit build, a locked-down kiosk): the game plays silent
    // rather than throwing on the first tap. Every play* method already no-ops on a null ctx.
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();

    // Master chain: gentle low/high shelf for warmth + a compressor so layered ambience +
    // arpeggio + bass pulse + SFX never clips, even at full volume with everything playing.
    const lowShelf = this.ctx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 200;
    lowShelf.gain.value = 2;

    const highShelf = this.ctx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 6000;
    highShelf.gain.value = -3;

    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 24;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.25;

    lowShelf.connect(highShelf).connect(compressor).connect(this.ctx.destination);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volumes.master;
    this.masterGain.connect(lowShelf);

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

  /** One clean pitch, for the ear-training minigames.
   *
   *  Everything else in here is either a chord pad (playAmbience) or a fixed sound effect. Teaching
   *  a player to hear an interval needs a single sustained note at a known frequency, twice, with
   *  a gap — so this is the primitive those games are built on. Routed through sfxGain, not
   *  musicGain, so a player who has turned the music down to read still hears the exercise.
   *
   *  Scheduled on the AudioContext clock (delaySeconds), never a scene timer: a two-note interval
   *  whose gap wanders with the frame rate is not the same exercise. */
  playPitch(freq: number, durationSec = 0.8, delaySeconds = 0, waveform: OscillatorType = 'triangle'): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delaySeconds;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = waveform;
    osc.frequency.setValueAtTime(freq, t0);
    // A soft attack and release: a hard gate on a pure tone reads as a click, and the click is
    // easier to time off than the pitch is to hear.
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.5, t0 + 0.04);
    gain.gain.setValueAtTime(0.5, t0 + durationSec - 0.12);
    gain.gain.linearRampToValueAtTime(0, t0 + durationSec);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + durationSec + 0.02);
  }

  /** A rhythm played as identical short clicks at given offsets in seconds — the clave exercise.
   *  Offsets are absolute from "now", so the pattern's internal timing is exact. */
  playRhythm(offsetsSec: number[], freq = 880, clickSec = 0.09): void {
    for (const at of offsetsSec) this.playPitch(freq, clickSec, at, 'square');
  }

  playSfx(name: SfxName): void {
    if (!this.ctx) return;
    const bus = name === 'metronome' || name === 'metronomeAccent' ? this.metronomeGain : this.sfxGain;
    switch (name) {
      // Softened toward sine/triangle — square reads harsh/cheap for a cozy game.
      case 'tap': return this.tone(220, 330, 0.05, 0.14, 'triangle', bus);
      case 'perfect':
        this.tone(880, 1320, 0.08, 0.25, 'sine', bus);
        this.tone(1760, 1760, 0.06, 0.15, 'sine', bus);
        this.tone(2200, 2200, 0.05, 0.05, 'sine', bus); // 5th-harmonic shimmer
        return;
      case 'good': return this.tone(660, 660, 0.07, 0.16, 'triangle', bus);
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
      // Soft per-character dialogue tick: very short, quiet, pitch jittered +-10% so a run of
      // them reads as texture rather than a mechanical buzz. On the SFX bus like everything else.
      case 'typewriter': {
        const f = 520 * (0.9 + Math.random() * 0.2);
        return this.tone(f, f, 0.012, 0.05, 'sine', bus);
      }
    }
  }

  crowdSwell(durationSec = 0.8): void {
    this.noiseBurst(durationSec, 0.2, 1400, this.sfxGain);
  }

  /** Procedural ambience bed: a sustained chord-progression pad + a slow arpeggio picking
   *  through each chord's tones (with a little per-note gain wobble for an organic feel) + a
   *  soft bass pulse on beat 1 of every bar + a very quiet filtered-noise room-tone layer
   *  (the "city ambience" — crowd murmur / traffic bed). Crossfades with whatever was already
   *  playing instead of hard-cutting it. Returns nothing — call stopMusic() to end it. */
  playAmbience(chords: number[][], bpm: number, waveform: OscillatorType = 'triangle'): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const previous = this.musicNodes;
    previous?.stop(0.8);

    const beatSec = 60 / bpm;
    const barSec = beatSec * 4;
    const padGain = ctx.createGain();
    padGain.gain.value = 0;
    padGain.connect(this.musicGain);
    padGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.8);

    // Sustained pad: re-voice the oscillators to the next chord at each bar. Assumes every
    // chord in the progression has the same tone count (true for both songs today — Lisbon's
    // Am7/Fmaj7/Cmaj7/G6 are all 4-tone, Tokyo's Am/F/C/G are all 3-tone triads); a
    // progression that shrinks voice count mid-loop would leave a stale oscillator holding
    // the last chord's extra tone rather than fading it out.
    let chordIndex = 0;
    const padOscillators: OscillatorNode[] = [];
    const padGains: GainNode[] = [];
    const voiceChord = (freqs: number[], atTime: number) => {
      freqs.forEach((freq, i) => {
        if (!padOscillators[i]) {
          const osc = ctx.createOscillator();
          osc.type = waveform;
          const g = ctx.createGain();
          g.gain.value = 0.05 / freqs.length;
          osc.connect(g).connect(padGain);
          osc.start(atTime);
          padOscillators.push(osc);
          padGains.push(g);
        }
        padOscillators[i].frequency.setTargetAtTime(freq, atTime, 0.4);
      });
    };
    voiceChord(chords[0], ctx.currentTime);

    // Slow ambient LFO breathing on the pad gain.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1 / (beatSec * 4);
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    padGains.forEach((g) => lfoGain.connect(g.gain));
    lfo.start();

    // Room-tone bed: very quiet filtered noise, standing in for crowd murmur / traffic.
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    noiseSrc.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 800;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.015;
    noiseSrc.connect(noiseFilter).connect(noiseGain).connect(padGain);
    noiseSrc.start();

    // Arpeggio: an 8th-note pluck cycling through the current chord, one octave up.
    let arpStep = 0;
    const arpInterval = window.setInterval(() => {
      const freqs = chords[chordIndex % chords.length];
      const freq = freqs[arpStep % freqs.length] * 2;
      arpStep++;
      const wobble = 0.85 + Math.random() * 0.3; // velocity variation, not a flat sequencer
      this.tone(freq, freq, 0.35, 0.035 * wobble, 'sine', padGain);
    }, (beatSec / 2) * 1000);

    // Bass pulse on beat 1 of every bar.
    let bar = 0;
    const bassInterval = window.setInterval(() => {
      const freqs = chords[bar % chords.length];
      this.tone(freqs[0] / 2, freqs[0] / 2, 0.4, 0.09, 'sine', padGain);
      bar++;
      chordIndex = bar;
      voiceChord(chords[bar % chords.length], ctx.currentTime + 0.05);
    }, barSec * 1000);

    let stopped = false;
    this.musicNodes = {
      stop: (fadeSec = 0.4) => {
        if (stopped) return;
        stopped = true;
        clearInterval(arpInterval);
        clearInterval(bassInterval);
        const t = ctx.currentTime;
        padGain.gain.cancelScheduledValues(t);
        padGain.gain.setValueAtTime(padGain.gain.value, t);
        padGain.gain.linearRampToValueAtTime(0, t + fadeSec);
        window.setTimeout(() => {
          padOscillators.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
          lfo.stop();
          noiseSrc.stop();
        }, fadeSec * 1000 + 50);
      },
    };
  }

  stopMusic(): void {
    this.musicNodes?.stop();
    this.musicNodes = null;
  }

  /** The one real (non-procedural) music track the design allows (DESIGN.md §15.17) — takes an
   *  already-decoded AudioBuffer (from Phaser's Loader/cache, which decodes via its own
   *  AudioContext; an AudioBuffer's PCM data is context-agnostic — only nodes aren't — so it can
   *  be fed straight into a BufferSourceNode on this system's own ctx) and loops it through the
   *  same musicGain bus playAmbience uses, crossfading out whatever was already playing the same
   *  way switching songs already does. duckMusic/setVolume('music')/stopMusic all keep working
   *  unchanged since they only ever touch musicGain, never the source feeding it. */
  playMusicTrack(buffer: AudioBuffer, delaySeconds = 0, loop = true, fadeInSeconds = 0.8): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const previous = this.musicNodes;
    previous?.stop(0.8);

    const trackGain = ctx.createGain();
    trackGain.gain.value = 0;
    trackGain.connect(this.musicGain);
    trackGain.gain.linearRampToValueAtTime(1, ctx.currentTime + fadeInSeconds);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    src.connect(trackGain);
    // Scheduled on the AUDIO clock, not a scene timer. A rhythm chart starts 1.2s after the scene
    // does, and the backing track has to land on that same moment or every note is judged against
    // music it does not match. scene.time.delayedCall advances on clamped FRAME DELTA — the exact
    // mechanism behind the stale-clock bug that made a song end before it began — so on a slow
    // device it would drift audibly. AudioContext.currentTime is sample-accurate and unaffected
    // by frame rate.
    src.start(delaySeconds > 0 ? ctx.currentTime + delaySeconds : 0);

    let stopped = false;
    this.musicNodes = {
      stop: (fadeSec = 0.4) => {
        if (stopped) return;
        stopped = true;
        const t = ctx.currentTime;
        trackGain.gain.cancelScheduledValues(t);
        trackGain.gain.setValueAtTime(trackGain.gain.value, t);
        trackGain.gain.linearRampToValueAtTime(0, t + fadeSec);
        window.setTimeout(() => { try { src.stop(); } catch { /* already stopped */ } }, fadeSec * 1000 + 50);
      },
    };
  }
}

export const audio = new AudioSystem();
