// iPhone audio (2026-10-08): "none of the audio works" on iPhone. Two WebKit rules the engine did
// not meet, which no Chromium-based test (CI included) can see:
//   1. The Ring/Silent switch mutes web audio unless the page asks for a 'playback' audio session.
//   2. Audio may only start inside a touchend/click/keydown. Every button here fires on
//      pointerdown (touchstart on iOS), so the gesture handlers must resume AND prime the context.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
const node = () => ({ connect(t: unknown) { return t; }, disconnect() {}, gain: param(), frequency: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), type: '' });

class FakeContext {
  static made: FakeContext[] = [];
  state = 'suspended';
  currentTime = 0;
  sampleRate = 48000;
  destination = node();
  resumes = 0;
  sourcesStarted = 0;
  constructor() { FakeContext.made.push(this); }
  resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  createGain() { return node(); }
  createBiquadFilter() { return node(); }
  createDynamicsCompressor() { return node(); }
  createBuffer() { return { getChannelData: () => new Float32Array(1) }; }
  createBufferSource() { const ctx = this; return { ...node(), buffer: null, start() { ctx.sourcesStarted++; }, stop() {} }; }
}

async function freshAudio(navigatorExtras: Record<string, unknown> = {}) {
  vi.resetModules();
  FakeContext.made = [];
  vi.stubGlobal('window', { AudioContext: FakeContext });
  vi.stubGlobal('navigator', { ...navigatorExtras });
  return (await import('../core/audio')).audio;
}

describe('iPhone audio session', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("asks iOS for a 'playback' session, so the Ring/Silent switch does not mute the game", async () => {
    const session = { type: 'auto' };
    const audio = await freshAudio({ audioSession: session });
    audio.unlock();
    expect(session.type).toBe('playback');
  });

  it('still unlocks where there is no audioSession API (Android Chrome, desktop)', async () => {
    const audio = await freshAudio();
    expect(() => audio.unlock()).not.toThrow();
    expect(audio.isUnlocked()).toBe(true);
  });
});

describe('gesture unlock', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('a gesture creates, resumes and primes the context in one go', async () => {
    const audio = await freshAudio();
    audio.gesture();
    const ctx = FakeContext.made[0];
    expect(ctx, 'the first gesture should create the context').toBeTruthy();
    expect(ctx.resumes).toBeGreaterThan(0);
    expect(ctx.sourcesStarted, 'WebKit opens the output only once a source starts inside the gesture').toBeGreaterThan(0);
  });

  it('a context created outside a gesture (touchstart) is resumed and primed by the next gesture', async () => {
    const audio = await freshAudio();
    audio.unlock();                    // Title's pointerdown = touchstart on iOS: not a valid gesture
    const ctx = FakeContext.made[0];
    ctx.state = 'suspended';
    const before = ctx.sourcesStarted;
    audio.gesture();                   // the touchend that follows
    expect(ctx.state).toBe('running');
    expect(ctx.sourcesStarted).toBeGreaterThan(before);
    expect(FakeContext.made.length, 'one context for the whole session').toBe(1);
  });

  it('a gesture does not resume audio Settings is holding', async () => {
    const audio = await freshAudio();
    audio.gesture();
    const ctx = FakeContext.made[0];
    audio.holdAll(true);
    expect(ctx.state).toBe('suspended');
    audio.gesture();
    expect(ctx.state).toBe('suspended');
  });
});

describe('saved volumes', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('applyVolumes sets every bus, before or after unlock', async () => {
    const audio = await freshAudio();
    audio.applyVolumes({ master: 0.5, music: 0, sfx: 0.3, metronome: 0.2 });
    expect(audio.volumes).toEqual({ master: 0.5, music: 0, sfx: 0.3, metronome: 0.2 });
    audio.unlock();
    audio.applyVolumes({ master: 1, music: 0.4, sfx: 0.9, metronome: 0.6 });
    expect(audio.volumes.music).toBe(0.4);
  });
});
