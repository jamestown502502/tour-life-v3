// Keyboard and gamepad play (web pivot, 2026-10-11). Arrows / WASD / D-pad / left stick move a focus
// ring between the live interactive objects of the scene on top; Enter / gamepad A presses there with
// real mouse events on the canvas, so every button, pad, slot and lane answers exactly as it does to a
// click (held = button down). Holding Enter and pressing an arrow drags (the van-loading game).
// Escape / Backspace / B is the browser's Back (ui/backButton.ts). Any mouse or touch press hides the
// ring. Space keeps its own job (advance dialogue, DialogueBox); D F J K stay the rhythm lanes.
import Phaser from 'phaser';
import { H, W } from '../const';
import { KeyQueue, center, firstTarget, nearest, pickInDirection, type Rect } from '../core/keys';
import { handleBack } from './backButton';

interface Target extends Rect { obj: Phaser.GameObjects.GameObject; order: number[]; full: boolean }

const HUD_BOTTOM = 110;   // Settings / Help / History live above this line
const DRAG_STEP = 40;     // game units per arrow while Enter is held

/** Draw order of an object within its scene: its container path of display-list indices. */
function orderOf(o: Phaser.GameObjects.GameObject): number[] {
  const path: number[] = [];
  let cur: Phaser.GameObjects.GameObject = o;
  let parent = (cur as unknown as { parentContainer?: Phaser.GameObjects.Container }).parentContainer;
  while (parent) { path.unshift(parent.getIndex(cur)); cur = parent; parent = parent.parentContainer; }
  path.unshift(cur.scene.children.getIndex(cur));
  return path;
}
const after = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] > b[i];
  return a.length > b.length;
};

/** Visible, and not inside a faded-out container. The object's own alpha does not count: invisible hit
 *  areas (Fix the Mix's fader tracks, alpha 0.001) are real tap targets. */
function shown(o: Phaser.GameObjects.GameObject): boolean {
  let cur: any = o;
  if (cur.visible === false) return false;
  cur = cur.parentContainer;
  while (cur) { if (cur.visible === false || cur.alpha < 0.05) return false; cur = cur.parentContainer; }
  return true;
}

/** What a finger could tap right now: the interactive objects of the topmost running scene, minus
 *  anything drawn under a full-screen backdrop. A lone full-screen object is a "tap anywhere". */
export function liveTargets(game: Phaser.Game): Target[] {
  const mgr = game.scene;
  const tr = mgr.getScene('Transition') as unknown as { isPlaying?: boolean } | null;
  if (mgr.isActive('Transition') && tr?.isPlaying) return [];
  const scenes = mgr.getScenes(true).filter((s) => s.scene.key !== 'Transition' && !s.sys.isPaused() && s.sys.settings.visible);
  for (const s of scenes.reverse()) {
    const list = ((s.input as unknown as { _list?: Phaser.GameObjects.GameObject[] })._list ?? []);
    let out: Target[] = [];
    for (const o of list) {
      const io = (o as unknown as { input?: { enabled: boolean } }).input;
      if (!io || !io.enabled || !o.active || !shown(o)) continue;
      const b = (o as unknown as { getBounds?: () => Phaser.Geom.Rectangle }).getBounds?.();
      if (!b || b.width < 4 || b.height < 4 || b.bottom < 0 || b.top > H || b.right < 0 || b.left > W) continue;
      out.push({ x: b.x, y: b.y, w: b.width, h: b.height, obj: o, order: orderOf(o), full: b.width >= W * 0.9 && b.height >= H * 0.85 });
    }
    if (!out.length) continue;
    const blockers = out.filter((t) => t.full).sort((a, b) => (after(a.order, b.order) ? -1 : 1));
    if (blockers.length) {
      const top = blockers[0];
      const above = out.filter((t) => !t.full && after(t.order, top.order));
      out = above.length ? above : [top];
    }
    return out;
  }
  return [];
}

export function startKeyNav(game: Phaser.Game): void {
  const keys = new KeyQueue();
  const isMirror = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    return !!(el && el.tagName === 'BUTTON' && el.closest?.('#a11y-buttons') && (e.code === 'Enter' || e.code === 'Space' || e.code === 'Tab'));
  };
  keys.attach(window, isMirror);

  const ring = document.createElement('div');
  ring.id = 'key-focus';
  Object.assign(ring.style, { position: 'fixed', display: 'none', pointerEvents: 'none', zIndex: '6', border: '4px solid #F2C14E',
    borderRadius: '14px', boxShadow: '0 0 0 4px rgba(43,58,85,.9), 0 0 18px rgba(242,193,78,.55)', transition: 'left .08s, top .08s, width .08s, height .08s' });
  document.body.appendChild(ring);

  let active = false, hinted = false;
  let point: { x: number; y: number } | null = null;
  let chosen = false;
  let screenSig = '';
  let down: { x: number; y: number } | null = null;
  // e2e / dev only: where the ring is and where a held Enter is pressing (e2e/keyboard.spec.ts)
  let shownAt: { x: number; y: number } | null = null;
  if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') (window as any).__keyFocus = () => ({ ring: shownAt, down, active });

  const canvas = game.canvas;
  canvas.addEventListener('mousedown', (e) => { if (e.isTrusted) { active = false; ring.style.display = 'none'; } });
  canvas.addEventListener('touchstart', () => { active = false; ring.style.display = 'none'; }, { passive: true });

  const toClient = (x: number, y: number) => {
    const r = canvas.getBoundingClientRect();
    return { clientX: r.left + (x / W) * r.width, clientY: r.top + (y / H) * r.height };
  };
  const fire = (type: string, x: number, y: number) => {
    const c = toClient(x, y);
    canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === 'mouseup' ? 0 : 1, ...c }));
  };

  game.events.on(Phaser.Core.Events.POST_STEP, (_t: number, dtMs: number) => {
    keys.pollGamepad(dtMs / 1000);
    const events = keys.consume();
    if (events.length && !active) {
      active = true;
      if (!hinted) { hinted = true; showHint(); }
    }
    if (!active) return;
    const targets = liveTargets(game);
    const sceneKey = targets[0] ? (targets[0].obj as unknown as { scene: Phaser.Scene }).scene.scene.key : '';
    if (sceneKey !== screenSig) { screenSig = sceneKey; point = null; chosen = false; }
    // The HUD strip (Settings, Help, History) holds focus only when the player put it there. When the
    // focused button vanishes mid-game (a pattern playing back, a coach note), the ring must not slide
    // up to Help or Settings, or the next Enter opens a menu over the game.
    const body = targets.filter((t) => t.y >= HUD_BOTTOM || t.full);
    const pool = point && point.y < HUD_BOTTOM ? targets : body;
    let cur: Target | null = (point && nearest(point, pool)) || firstTarget(targets, HUD_BOTTOM) || targets.find((t) => t.full) || null;
    for (const ev of events) {
      if (ev.type === 'move') {
        if (down) {   // Enter held: drag
          down = { x: Phaser.Math.Clamp(down.x + ev.dx * DRAG_STEP, 0, W), y: Phaser.Math.Clamp(down.y + ev.dy * DRAG_STEP, 0, H) };
          fire('mousemove', down.x, down.y);
          continue;
        }
        const n = cur ? pickInDirection(cur, targets, ev.dx, ev.dy) : targets[0] ?? null;
        if (n) { cur = n; point = center(n); chosen = true; }
      } else if (ev.type === 'down' && cur) {
        const c = center(cur);
        down = c;
        fire('mousemove', c.x, c.y);
        fire('mousedown', c.x, c.y);
      } else if (ev.type === 'up' && down) {
        fire('mouseup', down.x, down.y);
        down = null;
      } else if (ev.type === 'back') {
        handleBack(game);   // at the title it does nothing: Escape never leaves the site
      }
    }
    shownAt = cur && !cur.full ? center(cur) : null;
    if (cur && !cur.full) {
      // Focus holds its place only once the player moved it: buttons that pop in a moment later
      // (entrance tweens) must still be able to take the default focus.
      point = chosen ? center(cur) : null;
      const r = canvas.getBoundingClientRect();
      const sx = r.width / W, sy = r.height / H;
      Object.assign(ring.style, { display: 'block', left: `${r.left + cur.x * sx - 6}px`, top: `${r.top + cur.y * sy - 6}px`,
        width: `${cur.w * sx + 4}px`, height: `${cur.h * sy + 4}px` });
    } else ring.style.display = 'none';
  });
}

function showHint(): void {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.textContent = 'Keyboard: arrows move · Enter taps (hold Enter + arrows to drag) · Space advances dialogue · D F J K play the show · Esc goes back';
  Object.assign(el.style, { position: 'fixed', left: '50%', top: '12px', transform: 'translateX(-50%)', maxWidth: '92vw', textAlign: 'center',
    background: 'rgba(26,36,54,0.94)', color: '#F5EBDD', padding: '10px 16px', borderRadius: '14px', border: '1px solid #F2C14E',
    font: '600 14px Nunito, system-ui, sans-serif', zIndex: '2000', pointerEvents: 'none', transition: 'opacity .6s' });
  // A desktop with room beside the portrait game: the hint sits in the left band, off the game.
  const r = document.querySelector('#app canvas')?.getBoundingClientRect();
  const band = r ? r.left : 0;
  if (band >= 260) Object.assign(el.style, { left: `${band / 2}px`, top: '50%', transform: 'translate(-50%, -50%)', maxWidth: `${band - 48}px`, textAlign: 'left', lineHeight: '1.6' });
  document.body.appendChild(el);
  window.setTimeout(() => { el.style.opacity = '0'; }, 6000);
  window.setTimeout(() => el.remove(), 6800);
}
