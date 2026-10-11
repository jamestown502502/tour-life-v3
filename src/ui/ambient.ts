// Desktop presentation (web pivot, 2026-10-11). Tour Life is a portrait game; on a laptop or monitor
// the canvas is a tall column with empty bands either side. Those bands now glow with a blurred copy
// of the current scene (index.html #ambient), the way Side Hustle City fills its letterbox. An 18x32
// copy, five times a second, and only while there is a band to fill: a phone held upright pays nothing.
// Drawn right after Phaser renders, while the WebGL drawing buffer still holds the frame.
import Phaser from 'phaser';

export function startAmbient(game: Phaser.Game): void {
  const el = document.getElementById('ambient');
  if (!el) return;
  const small = document.createElement('canvas');   // never added to the page
  small.width = 18; small.height = 32;   // gotcha-ok: an HTML canvas, not a Phaser shape
  const ctx = small.getContext('2d');
  if (!ctx) return;
  let at = 0;
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    const now = performance.now();
    if (now - at < 200) return;
    at = now;
    const r = game.canvas.getBoundingClientRect();
    if (window.innerWidth - r.width < 80) { el.style.display = 'none'; return; }
    try {
      ctx.drawImage(game.canvas, 0, 0, 18, 32);
      el.style.backgroundImage = `url(${small.toDataURL()})`;
      el.style.display = 'block';
    } catch { /* canvas not ready */ }
  });
}
