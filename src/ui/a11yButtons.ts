// Screen-reader buttons for the canvas (QA round 4 #4, 2026-10-10). Phaser draws every button on one
// <canvas>, which TalkBack sees as a single blank image: swiping found nothing to focus. Following
// the approach Side Hustle City and PixiJS use, every live button made by createButton() is
// mirrored as a real <button> placed exactly over the drawn one:
//   - TalkBack / VoiceOver swipe to it in screen order, read its label, and a double-tap presses it
//   - a keyboard Tab reaches it, with a visible focus ring
// The layer never takes a finger or mouse press (pointer-events: none), so play is unchanged.
// Only buttons in scenes that are running and visible are mirrored: a scene paused under Settings
// leaves the reading order with it, so focus never lands on something behind the menu.
import Phaser from 'phaser';
import { W, H } from '../const';

interface Entry { container: Phaser.GameObjects.Container; label: string; press: () => void }
const entries = new Set<Entry>();
let root: HTMLDivElement | null = null;
const pool = new Map<Entry, HTMLButtonElement>();
let lastSig = '';

/** Called by createButton for every enabled button. The entry leaves when the button is destroyed. */
export function registerA11yButton(container: Phaser.GameObjects.Container, label: string, press: () => void): void {
  const clean = label.replace(/^←\s*/, '').replace(/\s+/g, ' ').trim();
  const name = clean === '⚙' ? 'Settings' : clean === '?' ? 'Help' : clean === '≡' ? 'Dialogue history' : clean;
  if (!name) return;
  const e: Entry = { container, label: name, press };
  entries.add(e);
  container.once(Phaser.GameObjects.Events.DESTROY, () => entries.delete(e));
}

function ensureRoot(): HTMLDivElement | null {
  if (root || typeof document === 'undefined') return root;
  root = document.createElement('div');
  root.id = 'a11y-buttons';
  Object.assign(root.style, { position: 'fixed', left: '0', top: '0', width: '0', height: '0', zIndex: '5', pointerEvents: 'none' });
  const style = document.createElement('style');
  style.textContent = `#a11y-buttons button{position:fixed;margin:0;padding:0;border:0;background:transparent;color:transparent;font-size:1px;pointer-events:none;outline:none}
#a11y-buttons button:focus,#a11y-buttons button:focus-visible{outline:4px solid #F2C14E;outline-offset:3px;border-radius:12px;box-shadow:0 0 0 7px rgba(43,58,85,.85)}`;
  document.head.appendChild(style);
  document.body.appendChild(root);
  return root;
}

function liveEntries(game: Phaser.Game): Entry[] {
  const mgr = game.scene;
  if (mgr.isActive('Transition') && (mgr.getScene('Transition') as unknown as { busy?: () => boolean }).busy?.()) return [];
  const out: { e: Entry; order: number; x: number; y: number }[] = [];
  const order = new Map(mgr.scenes.map((s, i) => [s, i]));
  for (const e of entries) {
    const c = e.container;
    if (!c.active || !c.visible || c.alpha < 0.05) continue;
    const sys = c.scene?.sys;
    if (!sys || !sys.isActive() || sys.isPaused() || !sys.settings.visible) continue;
    let p: Phaser.GameObjects.Container | null = c.parentContainer;
    let hidden = false;
    while (p) { if (!p.visible || p.alpha < 0.05) { hidden = true; break; } p = p.parentContainer; }
    if (hidden) continue;
    const b = c.getBounds();
    if (b.width < 4 || b.height < 4 || b.bottom < 0 || b.top > H) continue;
    out.push({ e, order: order.get(c.scene) ?? 0, x: b.x, y: b.y });
  }
  // Reading order: the scene on top first, then top to bottom, left to right.
  out.sort((a, b) => b.order - a.order || Math.round(a.y / 8) - Math.round(b.y / 8) || a.x - b.x);
  return out.map((o) => o.e);
}

/** Mirror the live buttons. Cheap when nothing moved: only a signature is compared. */
export function syncA11yButtons(game: Phaser.Game): void {
  const canvas = game.canvas;
  if (!canvas || !ensureRoot()) return;
  const r = canvas.getBoundingClientRect();
  const sx = r.width / W, sy = r.height / H;
  const live = liveEntries(game);
  const rects = live.map((e) => e.container.getBounds());
  const sig = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}|` + live.map((e, i) => `${e.label}@${Math.round(rects[i].x)},${Math.round(rects[i].y)}`).join(';');
  if (sig === lastSig) return;
  lastSig = sig;
  const keep = new Set(live);
  live.forEach((e, i) => {
    let btn = pool.get(e);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.addEventListener('click', () => e.press());
      pool.set(e, btn);
    }
    btn.setAttribute('aria-label', e.label);
    btn.textContent = e.label;
    const b = rects[i];
    Object.assign(btn.style, { left: `${r.left + b.x * sx}px`, top: `${r.top + b.y * sy}px`, width: `${Math.max(1, b.width * sx)}px`, height: `${Math.max(1, b.height * sy)}px` });
    if (root!.children[i] !== btn) root!.insertBefore(btn, root!.children[i] || null);
  });
  for (const [e, btn] of pool) {
    if (keep.has(e)) continue;
    btn.remove(); pool.delete(e);
  }
}

/** Keep the layer in step with the game, a few times a second. */
export function startA11yButtons(game: Phaser.Game): void {
  window.setInterval(() => { try { syncA11yButtons(game); } catch { /* a scene mid-teardown */ } }, 250);
}
