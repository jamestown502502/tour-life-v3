// Keyboard and gamepad input (web pivot, 2026-10-11). Pure and Phaser-free: raw keys and a standard-
// mapping gamepad become a queue of moves, presses and Backs; ui/keyNav.ts turns those into a focus
// ring over the live tap targets and real pointer input on the canvas. Same model as Side Hustle City.

export type KeyEvent = { type: 'move'; dx: number; dy: number } | { type: 'down' } | { type: 'up' } | { type: 'back' };
export interface Rect { x: number; y: number; w: number; h: number }

const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0],
};
// No KeyD here: D, F, J and K are the rhythm lanes (RhythmScene).
// Enter only: Space already advances dialogue (DialogueBox), and one key must never do two things.
const PRESS_KEYS = new Set(['Enter', 'NumpadEnter']);
const BACK_KEYS = new Set(['Escape', 'Backspace']);

const STICK = 0.5;
const REPEAT_FIRST = 0.35;
const REPEAT_EVERY = 0.16;

export class KeyQueue {
  queue: KeyEvent[] = [];
  private held = new Set<string>();
  private pad = { dir: null as string | null, t: 0, a: false, b: false };

  /** `skip(e)`: true for events the browser should handle itself (Tab focus on a mirrored button). */
  attach(target: Window, skip: (e: KeyboardEvent) => boolean): void {
    target.addEventListener('keydown', (e) => {
      if (skip(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const dir = MOVE_KEYS[e.code];
      if (dir) { e.preventDefault(); this.queue.push({ type: 'move', dx: dir[0], dy: dir[1] }); return; }
      if (PRESS_KEYS.has(e.code)) {
        e.preventDefault();
        if (!this.held.has(e.code)) { this.held.add(e.code); this.queue.push({ type: 'down' }); }
        return;
      }
      if (BACK_KEYS.has(e.code) && !e.repeat) { e.preventDefault(); this.queue.push({ type: 'back' }); }
    });
    target.addEventListener('keyup', (e) => {
      if (!this.held.has(e.code)) return;
      this.held.delete(e.code);
      if (this.held.size === 0) this.queue.push({ type: 'up' });
    });
    target.addEventListener('blur', () => { if (this.held.size) { this.held.clear(); this.queue.push({ type: 'up' }); } });
  }

  /** The first connected standard-mapping gamepad, into the same queue. Call once a frame. */
  pollGamepad(dt: number, pads: (Gamepad | null)[] = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()] : []): void {
    const gp = pads.find((p) => p && p.connected);
    if (!gp) return;
    const btn = (i: number) => !!gp.buttons[i]?.pressed;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const dir = btn(12) || ay < -STICK ? 'up' : btn(13) || ay > STICK ? 'down'
      : btn(14) || ax < -STICK ? 'left' : btn(15) || ax > STICK ? 'right' : null;
    const p = this.pad;
    if (dir !== p.dir) { p.dir = dir; p.t = -REPEAT_FIRST; if (dir) this.queue.push(moveFor(dir)); }
    else if (dir) { p.t += dt; if (p.t >= REPEAT_EVERY) { p.t = 0; this.queue.push(moveFor(dir)); } }
    const a = btn(0), b = btn(1) || btn(9);
    if (a !== p.a) { p.a = a; this.queue.push({ type: a ? 'down' : 'up' }); }
    if (b && !p.b) this.queue.push({ type: 'back' });
    p.b = b;
  }

  consume(): KeyEvent[] { const q = this.queue; this.queue = []; return q; }
}

function moveFor(dir: string): KeyEvent {
  return { type: 'move', dx: dir === 'left' ? -1 : dir === 'right' ? 1 : 0, dy: dir === 'up' ? -1 : dir === 'down' ? 1 : 0 };
}

export const center = (t: Rect) => ({ x: t.x + t.w / 2, y: t.y + t.h / 2 });

export function nearest<T extends Rect>(pt: { x: number; y: number }, targets: T[]): T | null {
  let best: T | null = null, bestD = Infinity;
  for (const t of targets) {
    const c = center(t), d = Math.hypot(c.x - pt.x, c.y - pt.y);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

/** The first target in reading order below the top HUD strip (Settings, Help, History never take
 *  focus by default: Enter on a screen whose buttons arrive late must not open a menu). */
export function firstTarget<T extends Rect>(targets: T[], hudBottom: number): T | null {
  return [...targets].filter((t) => t.y >= hudBottom).sort((a, b) => (a.y - b.y) || (a.x - b.x))[0] ?? null;
}

/** The best target from `from` in direction (dx, dy): ahead of it, favoring a straight line. */
export function pickInDirection<T extends Rect>(from: Rect, targets: T[], dx: number, dy: number): T | null {
  const f = center(from);
  let best: T | null = null, bestScore = Infinity;
  for (const t of targets) {
    if (t === from) continue;
    const c = center(t);
    const ahead = (c.x - f.x) * dx + (c.y - f.y) * dy;
    if (ahead <= 4) continue;
    const side = Math.abs((c.x - f.x) * dy - (c.y - f.y) * dx);
    const score = ahead + side * 2;
    if (score < bestScore) { bestScore = score; best = t; }
  }
  return best;
}
