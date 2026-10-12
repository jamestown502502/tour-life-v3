// Nightly 2026-10-12, keyboard run, Mexico City setlist: the set's score counts up over 0.8 s, and
// Continue is live at once. Pressing it inside that window cleared the screen and destroyed the
// score text; the counter's next tick called setText on it, threw on every frame, and the minigame
// froze. A count-up must stop quietly once its text is gone.
import { describe, it, expect, vi } from 'vitest';
vi.mock('phaser', () => ({ default: {} }));
vi.mock('../core/audio', () => ({ audio: { playPitch: vi.fn(), playSfx: vi.fn() } }));
import { countUp } from '../art/juice';
import { State } from '../core/state';

function fakeScene() {
  const counters: any[] = [];
  const tweens = { addCounter: (cfg: any) => { const tw = { cfg, progress: 0.5, getValue: () => 50, stop: vi.fn() }; counters.push(tw); return tw; }, add: vi.fn() };
  return { scene: { tweens, time: { now: 0 } } as any, counters };
}
function fakeText() {
  const t: any = { active: true, text: '', setText: vi.fn((s: string) => { if (!t.active) throw new TypeError("Cannot read properties of null (reading 'drawImage')"); t.text = s; return t; }) };
  return t;
}

describe('countUp', () => {
  it('counts while its text is alive', () => {
    State.newRun('countup'); State.data.accessibility.reducedMotion = false;
    const { scene, counters } = fakeScene();
    const text = fakeText();
    countUp(scene, text, 100, (v) => `Score ${v}`, 800);
    counters[0].cfg.onUpdate(counters[0]);
    expect(text.text).toBe('Score 50');
  });
  it('stops quietly when the text was destroyed mid-count (no throw, counter stopped)', () => {
    State.newRun('countup'); State.data.accessibility.reducedMotion = false;
    const { scene, counters } = fakeScene();
    const text = fakeText();
    countUp(scene, text, 100, (v) => `Score ${v}`, 800);
    text.active = false;   // the result card cleared the screen
    expect(() => counters[0].cfg.onUpdate(counters[0])).not.toThrow();
    expect(counters[0].stop).toHaveBeenCalled();
    expect(() => counters[0].cfg.onComplete()).not.toThrow();
  });
});
