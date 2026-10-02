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
  // Colours are set explicitly, text fill included. Left to the browser, an iPhone in dark mode
  // can draw the typed text in a colour that disappears on the field (QA round 2 #2).
  Object.assign(el.style, {
    position: 'fixed', zIndex: '1000', textAlign: 'center', borderRadius: '8px',
    border: '2px solid #D9A441', padding: '4px 8px', boxSizing: 'border-box' as const,
    background: '#F5EBDD', color: '#2B3A55', caretColor: '#C4704F', opacity: '1',
    fontFamily: 'Nunito, system-ui, sans-serif', fontWeight: '700', outline: 'none',
  });
  el.style.setProperty('-webkit-text-fill-color', '#2B3A55');
  el.style.colorScheme = 'light';
  el.autocomplete = 'off';
  el.spellcheck = false;
  el.setAttribute('autocapitalize', 'off');
  el.enterKeyHint = 'done';
  el.style.touchAction = 'manipulation';
  document.body.appendChild(el);
  // Belt and braces for the same iOS behaviour: snap the visual viewport back when the keyboard closes.
  el.addEventListener('blur', () => { try { window.scrollTo(0, 0); } catch { /* ignore */ } });

  // Touch devices: while the keyboard is up, the field docks just above it, full width, so what
  // you type is always on screen (QA round 2 #2: on iPhone the field sat behind the keyboard).
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  let focused = false;
  const reposition = () => {
    const vv = window.visualViewport;
    if (focused && coarse && vv) {
      const hPx = 48;
      el.style.left = `${vv.offsetLeft + 16}px`;
      el.style.width = `${vv.width - 32}px`;
      el.style.height = `${hPx}px`;
      el.style.top = `${vv.offsetTop + Math.max(16, vv.height - hPx - 16)}px`;
      el.style.fontSize = '18px';
      return;
    }
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
    // QA round 2 #8: 16px is the floor only where iOS needs it (touch). With a mouse, the field
    // scales with the canvas like every other line of text instead of towering over it.
    el.style.fontSize = coarse ? `${Math.max(16, 16 * scaleY)}px` : `${Math.max(11, Math.min(18, 20 * scaleY))}px`;
  };
  el.addEventListener('focus', () => { focused = true; reposition(); });
  el.addEventListener('blur', () => { focused = false; reposition(); });
  window.visualViewport?.addEventListener('resize', reposition);
  window.visualViewport?.addEventListener('scroll', reposition);

  reposition();
  window.addEventListener('resize', reposition);
  const interval = window.setInterval(reposition, 250); // covers Scale.FIT reflow without a resize event

  let destroyed = false;
  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    window.removeEventListener('resize', reposition);
    window.visualViewport?.removeEventListener('resize', reposition);
    window.visualViewport?.removeEventListener('scroll', reposition);
    window.clearInterval(interval);
    el.remove();
  };
  // Registered here, not by the caller: this is the whole point of taking `scene`.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);
  scene.events.once(Phaser.Scenes.Events.DESTROY, destroy);

  return { el, destroy };
}
