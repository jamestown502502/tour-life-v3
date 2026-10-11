import { describe, it, expect } from 'vitest';
import { KeyQueue, nearest, firstTarget, pickInDirection, center, type Rect } from '../core/keys';

// Keyboard and gamepad play (web pivot, 2026-10-11): the focus ring moves between tap targets.
const box = (x: number, y: number, w = 60, h = 60): Rect => ({ x, y, w, h });

describe('keyboard focus navigation', () => {
  const grid = [box(100, 300), box(250, 300), box(400, 300), box(100, 450), box(250, 450), box(400, 450)];

  it('moves to the neighbour in the pressed direction', () => {
    expect(pickInDirection(grid[0], grid, 1, 0)).toBe(grid[1]);
    expect(pickInDirection(grid[0], grid, 0, 1)).toBe(grid[3]);
    expect(pickInDirection(grid[4], grid, -1, 0)).toBe(grid[3]);
    expect(pickInDirection(grid[4], grid, 0, -1)).toBe(grid[1]);
  });

  it('stays put at an edge', () => {
    expect(pickInDirection(grid[2], grid, 1, 0)).toBeNull();
    expect(pickInDirection(grid[0], grid, 0, -1)).toBeNull();
  });

  it('prefers a straight line over a closer diagonal', () => {
    const from = box(100, 300), straight = box(300, 300), diagonal = box(180, 390);
    expect(pickInDirection(from, [from, straight, diagonal], 1, 0)).toBe(straight);
  });

  it('never starts on the HUD strip (Settings, Help, History)', () => {
    const gear = box(640, 20), a = box(300, 600), b = box(100, 600), c = box(500, 200);
    expect(firstTarget([gear, a, b, c], 110)).toBe(c);
    expect(firstTarget([gear], 110)).toBeNull();
  });

  it('follows a moving target by nearest center', () => {
    const t = [box(100, 100), box(500, 900)];
    expect(nearest(center(box(110, 95)), t)).toBe(t[0]);
  });
});

describe('gamepad (standard mapping) feeds the same queue as the keyboard', () => {
  it('D-pad moves with repeat, A presses and releases, B and Start go back once per press', () => {
    const q = new KeyQueue();
    const pad = { connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) } as unknown as Gamepad;
    const btn = (i: number, v: boolean) => { (pad.buttons[i] as { pressed: boolean }).pressed = v; };
    btn(15, true);
    q.pollGamepad(1 / 60, [null, pad]);
    expect(q.consume()).toEqual([{ type: 'move', dx: 1, dy: 0 }]);
    q.pollGamepad(0.2, [pad]);
    expect(q.consume()).toEqual([]);
    q.pollGamepad(0.4, [pad]);
    expect(q.consume()).toEqual([{ type: 'move', dx: 1, dy: 0 }]);
    btn(15, false);
    (pad.axes as number[])[1] = -0.9;
    q.pollGamepad(1 / 60, [pad]);
    expect(q.consume()).toEqual([{ type: 'move', dx: 0, dy: -1 }]);
    (pad.axes as number[])[1] = 0;
    btn(0, true); q.pollGamepad(1 / 60, [pad]);
    btn(0, false); q.pollGamepad(1 / 60, [pad]);
    expect(q.consume()).toEqual([{ type: 'down' }, { type: 'up' }]);
    btn(9, true); q.pollGamepad(1 / 60, [pad]); q.pollGamepad(1 / 60, [pad]);
    expect(q.consume()).toEqual([{ type: 'back' }]);
  });
});
