// Real text input, positioned by tracking the canvas's actual bounding rect rather than going
// through Phaser's DOM plugin — under Scale.FIT the DOM plugin's own transform math drifts from
// the canvas's true screen position (confirmed by measuring both rects directly in-browser).
import { H, W } from '../const';

export interface FloatingInput {
  el: HTMLInputElement;
  destroy(): void;
}

export function createFloatingInput(gameX: number, gameY: number, widthPx: number, placeholder: string): FloatingInput {
  const el = document.createElement('input');
  el.placeholder = placeholder;
  el.maxLength = 30;
  Object.assign(el.style, {
    position: 'fixed', zIndex: '1000', textAlign: 'center', borderRadius: '8px',
    border: 'none', padding: '6px', boxSizing: 'border-box' as const,
  });
  document.body.appendChild(el);

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
    el.style.fontSize = `${16 * scaleY}px`;
  };

  reposition();
  window.addEventListener('resize', reposition);
  const interval = window.setInterval(reposition, 250); // covers Scale.FIT reflow without a resize event

  return {
    el,
    destroy() {
      window.removeEventListener('resize', reposition);
      window.clearInterval(interval);
      el.remove();
    },
  };
}
