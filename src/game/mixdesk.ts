// FIX THE MIX (2026-10-07). Replaces "Hold the Mix", where two faders chased a drifting gold
// window: an outside critique called that mechanically arbitrary, and it was our lowest-rated
// minigame. A real front-of-house job is reacting to problems you can HEAR: a channel suddenly too
// hot, another one gone. So the desk has four channels, each with a fader and a meter; problems hit
// one channel at a time, audibly (src/core/audio.ts startStems plays the four stems at these
// levels), and the player finds the channel and rides its fader back into the pocket.
//
// Pure rules here; MiniGameScene.runSustain draws them. Unit-tested in src/tests/mixdesk.test.ts.
import { makeRng } from '../core/rng';

export const MIX_CHANNELS = ['Vocals', 'Guitar', 'Bass', 'Drums'] as const;

/** Where a channel should sit: loud enough to hear, clear of the clip light. */
export const POCKET = { lo: 0.55, hi: 0.85 } as const;
/** Over this, a channel is clipping (distorting). */
export const CLIP_AT = 1.0;
export const FADER_MAX = 1.4;
/** Seconds a problem waits for the player before the engineer fixes it himself. */
export const FIX_WINDOW = 6;
/** Seconds between one problem being fixed and the next one arriving. */
export const PROBLEM_GAP = 1.6;

export type ProblemKind = 'hot' | 'gone';
export interface MixProblem { ch: number; kind: ProblemKind; }

/** How much louder (or quieter) a channel's source gets when its problem hits. */
export const DRIVE: Record<ProblemKind, number> = { hot: 1.75, gone: 0.5 };

export const PROBLEM_LINE: Record<ProblemKind, (name: string) => string> = {
  hot: (n) => `${n} just spiked. It is clipping the board.`,
  gone: (n) => `Where did the ${n.toLowerCase()} go? It has dropped right back.`,
};

export function channelLevel(fader: number, drive: number): number {
  return fader * drive;
}

export function inPocket(level: number): boolean {
  return level >= POCKET.lo && level <= POCKET.hi;
}

/** The whole mix: the average of the channels, which is what the master meter shows. */
export function masterLevel(levels: readonly number[]): number {
  return levels.reduce((a, b) => a + b, 0) / Math.max(1, levels.length);
}

/** Six problems in a seeded order: every channel gets one, never the same channel twice running,
 *  and both kinds appear. */
export function problemSequence(seed: string, count = 6): MixProblem[] {
  const rng = makeRng(`${seed}:mix`);
  const out: MixProblem[] = [];
  let last = -1;
  for (let i = 0; i < count; i++) {
    let ch = rng.int(0, MIX_CHANNELS.length);
    if (ch === last) ch = (ch + 1) % MIX_CHANNELS.length;
    // alternate-ish kinds, so a run always has both
    const kind: ProblemKind = i % 2 === 0 ? (rng.next() < 0.5 ? 'hot' : 'gone') : (out[i - 1].kind === 'hot' ? 'gone' : 'hot');
    out.push({ ch, kind });
    last = ch;
  }
  return out;
}

/** Outcome from how fast each problem was fixed (seconds; null = the engineer had to step in). */
export function mixOutcome(fixTimes: readonly (number | null)[]): { good: boolean; perfect: boolean; fixed: number } {
  const fixed = fixTimes.filter((t) => t !== null).length;
  const quick = fixTimes.filter((t) => t !== null && (t as number) <= 3).length;
  return { good: fixed >= Math.ceil(fixTimes.length * 0.6), perfect: quick === fixTimes.length, fixed };
}
