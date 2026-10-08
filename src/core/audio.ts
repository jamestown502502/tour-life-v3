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
    // iPhone (2026-10-08): iOS gives web audio an 'ambient' session by default, which the Ring/Silent
    // switch mutes outright: every sound in the game, volume buttons or not. A rhythm game needs
    // its music, so ask for 'playback' (Safari 17+; elsewhere the API does not exist). Trade-off:
    // like any music app, the game pauses the player's own music app while it is open.
    try { const session = (navigator as any).audioSession; if (session) session.type = 'playback'; } catch { /* not iOS */ }
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

  /** A gameplay hold (round 3): SettingsScene opens over a PAUSED RhythmScene, but Web Audio
   *  runs on its own clock, so the song played on while the chart stood still and the rest of
   *  that song graded out of sync (the trade-off RhythmScene.create documented). Holding the
   *  context pauses the song in step with the paused scene; releasing resumes both together. */
  private held = false;
  holdAll(on: boolean): void {
    this.held = on;
    this.syncSuspend();
  }

  private backgrounded = false;
  private syncSuspend(): void {
    if (!this.ctx) return;
    const wantSuspended = this.held || this.backgrounded;
    if (wantSuspended && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    // Not just 'suspended': iOS Safari parks a context in 'interrupted' after an app switch or a
    // call, and only resuming 'suspended' left the game silent until a reload (the same bug QA
    // round 3 #7 found in Side Hustle City).
    else if (!wantSuspended && this.ctx.state !== 'running' && (this.ctx.state as string) !== 'closed') this.ctx.resume().catch(() => {});
  }

  /** Called on every touchend / pointerup / click / keydown (main.ts) — the events iOS accepts as a
   *  gesture. Every button fires on pointerdown, which is touchstart on iPhone and does NOT count,
   *  so a context made or resumed there stays silent. Here, inside a real gesture: create the
   *  context if no scene has yet, resume it, and start a one-sample silent buffer, which is what
   *  makes WebKit actually open the output. */
  gesture(): void {
    this.unlock();
    if (!this.ctx) return;
    const wasRunning = this.ctx.state === 'running';
    this.syncSuspend();
    if (wasRunning || this.held || this.backgrounded) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    src.connect(this.ctx.destination);
    src.start(0);
  }

  /** The saved Settings volumes (State.data.accessibility.volumes), applied when a save loads. */
  applyVolumes(v: typeof this.volumes): void {
    for (const bus of Object.keys(this.volumes) as (keyof typeof this.volumes)[]) this.setVolume(bus, v[bus]);
  }

  /** The app went behind another app (or the screen locked). A web page's audio keeps playing
   *  there unless the page stops it, which is what QA round 2 #5 heard on Android. Suspending the
   *  context silences music, ambience and SFX at once; resuming picks up where it left off. */
  setBackgrounded(hidden: boolean): void {
    this.backgrounded = hidden;
    this.syncSuspend();
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

  /** FIX THE MIX (src/game/mixdesk.ts): a small live band as four stems — vocals (a triangle
   *  melody), guitar (filtered sawtooth stabs), bass (sine roots) and drums (noise kick and hats) —
   *  each through its own gain, so the minigame's faders change what the player actually HEARS.
   *  Scheduled on the audio clock with a short look-ahead; levels 0..~1.5 (1 = nominal). */
  startStems(bpm: number): { setLevel(i: number, v: number): void; stop(): void } | null {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    this.stopMusic();
    const gains = [0, 1, 2, 3].map(() => { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.musicGain); return g; });
    const note = (freq: number, t: number, dur: number, type: OscillatorType, peak: number, dest: GainNode, cutoff = 0): void => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(peak, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; osc.connect(f).connect(env); } else osc.connect(env);
      env.connect(dest);
      osc.start(t); osc.stop(t + dur + 0.02);
    };
    const hit = (t: number, dur: number, hz: number, peak: number, dest: GainNode): void => {
      const n = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = hz < 300 ? 'lowpass' : 'highpass'; f.frequency.value = hz;
      const env = ctx.createGain(); env.gain.setValueAtTime(peak, t); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(env).connect(dest);
      src.start(t); src.stop(t + dur + 0.02);
    };
    const A3 = 220;
    const semis = (s: number) => A3 * Math.pow(2, s / 12);
    const roots = [-12, -7, -9, -5];                 // Am - Dm - C - Em, one per bar, in A3-relative semitones
    const melody = [0, 3, 7, 5, 3, 0, -2, 0];
    const eighth = 30 / bpm;
    let next = ctx.currentTime + 0.1;
    let step = 0;
    const schedule = (): void => {
      if (ctx.state !== 'running') return;
      while (next < ctx.currentTime + 0.3) {
        const t = next, bar = Math.floor(step / 8) % 4, beatStep = step % 8;
        if (beatStep % 2 === 0) note(semis(melody[(step / 2) % melody.length | 0] + 12), t, eighth * 1.8, 'triangle', 0.35, gains[0]);
        if (beatStep === 2 || beatStep === 6) for (const s of [0, 4, 7]) note(semis(roots[bar] + 12 + s), t, eighth * 1.2, 'sawtooth', 0.12, gains[1], 2200);
        if (beatStep % 2 === 0) note(semis(roots[bar] - 12), t, eighth * 1.7, 'sine', 0.6, gains[2]);
        if (beatStep === 0 || beatStep === 4) hit(t, 0.18, 120, 0.9, gains[3]);
        hit(t, 0.04, 6000, 0.18, gains[3]);
        next += eighth; step++;
      }
    };
    const timer = window.setInterval(schedule, 50);
    schedule();
    return {
      setLevel: (i: number, v: number) => gains[i]?.gain.setTargetAtTime(Math.max(0, v) * 0.6, ctx.currentTime, 0.04),
      stop: () => {
        window.clearInterval(timer);
        for (const g of gains) g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        window.setTimeout(() => gains.forEach((g) => g.disconnect()), 500);
      },
    };
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
    // 3.5, not 1 (2026-10-08): measured at the output, this bed (Hub, Van, Route, Scrapbook, City,
    // minigames) ran at -38 dBFS RMS against the title theme's -16, about inaudible on a phone
    // speaker. 3.5x (+11 dB) sits it ~10 dB under the theme; ear-training tones stay ~19 dB clear.
    padGain.gain.linearRampToValueAtTime(3.5, ctx.currentTime + 0.8);

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
      if (ctx.state !== 'running') return; // backgrounded: don't queue notes on a frozen clock
      const freqs = chords[chordIndex % chords.length];
      const freq = freqs[arpStep % freqs.length] * 2;
      arpStep++;
      const wobble = 0.85 + Math.random() * 0.3; // velocity variation, not a flat sequencer
      this.tone(freq, freq, 0.35, 0.035 * wobble, 'sine', padGain);
    }, (beatSec / 2) * 1000);

    // Bass pulse on beat 1 of every bar.
    let bar = 0;
    const bassInterval = window.setInterval(() => {
      if (ctx.state !== 'running') return;
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
