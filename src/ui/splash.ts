// The opening splash (index.html #splash): the Tour Life key-art banner over the margin backdrop,
// painted by the browser before any script runs, so a cold load shows the game's identity instead of
// an empty screen. BootScene drives its bar and removes it once Title has started.
//
// It never takes input (pointer-events: none in index.html), so a tap during the fade lands on the
// title screen underneath. It stays up at least SPLASH_MIN_MS from page start so a warm-cache load
// does not flash the banner for a few frames, which reads as a glitch rather than a logo. The e2e
// build removes it at once: tests drive the title screen the moment it exists.

const SPLASH_MIN_MS = 1200;
const FADE_MS = 450;

export function setSplashProgress(value: number): void {
  const bar = document.getElementById('splash-bar');
  if (bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`;
}

export function hideSplash(): void {
  const el = document.getElementById('splash');
  if (!el) return;
  if (import.meta.env.MODE === 'e2e') { el.remove(); return; }
  const wait = Math.max(0, SPLASH_MIN_MS - performance.now());
  window.setTimeout(() => {
    el.classList.add('gone');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => el.remove(), reduced ? 0 : FADE_MS);
  }, wait);
}
