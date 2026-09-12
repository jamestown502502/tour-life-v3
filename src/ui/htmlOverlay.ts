// Real text input, positioned by tracking the canvas's actual bounding rect rather than going
// through Phaser's DOM plugin — under Scale.FIT the DOM plugin's own transform math drifts from
// the canvas's true screen position (confirmed by measuring both rects directly in-browser).
import Phaser from 'phaser';
import { H, W } from '../const';

export interface FloatingInput {
  el: HTMLInputElement;
  destroy(): void;
}

/** `scene` is required so the element's teardown is registered ATOMICALLY with its creation.
 *  Callers used to append the element and then register their own SHUTDOWN handler on the next
 *  line; anything that stopped the scene in between left a real DOM input floating over the game
 *  forever, on top of whatever scene came next. Observed as a Scrapbook button whose caption
 *  measured 1.11:1 because a stray white text field was sitting on it. Callers may still call
 *  destroy() early — it is idempotent. */
export function createFloatingInput(
  scene: Phaser.Scene, gameX: number, gameY: number, widthPx: number, placeholder: string,
): FloatingInput {
  const el = document.createElement('input');
  el.placeholder = placeholder;
  el.maxLength = 30;
  Object.assign(el.style, {
    position: 'fixed', zIndex: '1000', textAlign: 'center', borderRadius: '8px',
    border: 'none', padding: '6px', boxSizing: 'border-box' as const,
  });
  el.style.touchAction = 'manipulation';
  document.body.appendChild(el);
  // Belt and braces for the same iOS behaviour: snap the visual viewport back when the keyboard closes.
  el.addEventListener('blur', () => { try { window.scrollTo(0, 0); } catch { /* ignore */ } });

  const reposition = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / W;
    const scaleY = rect.height / H;
    const wPx = widthPx * scaleX;
    const hPx = 34 * scaleY;
    el.style.left = `${rect.left + gameX * scaleX - wPx / 2}px`;
    el.style.top = `${rect.top + gameY * scaleY - hPx / 2}px`;
    el.style.width = `${wPx}px`;
    el.style.height = `${hPx}px`;
    // Never under 16px: iOS Safari zooms the whole page into any focused input smaller than that,
    // and the zoom does not fully undo on blur — reported as the welcome screen being stuck
    // half-scrolled. 16px is the documented threshold.
    el.style.fontSize = `${Math.max(16, 16 * scaleY)}px`;
  };

  reposition();
  window.addEventListener('resize', reposition);
  const interval = window.setInterval(reposition, 250); // covers Scale.FIT reflow without a resize event

  let destroyed = false;
  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    window.removeEventListener('resize', reposition);
    window.clearInterval(interval);
    el.remove();
  };
  // Registered here, not by the caller: this is the whole point of taking `scene`.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);
  scene.events.once(Phaser.Scenes.Events.DESTROY, destroy);

  return { el, destroy };
}
