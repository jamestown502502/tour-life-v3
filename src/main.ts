import Phaser from 'phaser';
import { H, PALETTE_HEX, W } from './const';
import { TitleScene } from './ui/TitleScene';
import { BandCreatorScene } from './ui/BandCreatorScene';
import { OpeningScene } from './ui/OpeningScene';
import { VanScene } from './ui/VanScene';
import { RoutePlanScene } from './ui/RoutePlanScene';
import { HubScene } from './ui/HubScene';
import { CityScene } from './ui/CityScene';
import { RhythmScene } from './ui/RhythmScene';
import { ResultsScene } from './ui/ResultsScene';
import { ScrapbookScene } from './ui/ScrapbookScene';
import { SettingsScene } from './ui/SettingsScene';
import { HowToPlayScene } from './ui/HowToPlayScene';
import { MiniGameScene } from './ui/MiniGameScene';
import { TransitionScene } from './ui/TransitionScene';
import { audio } from './core/audio';
import { BootScene } from './ui/BootScene';
import { State } from './core/state';

// Wait for the self-hosted webfonts before booting: Phaser Text drawn before a font finishes
// loading silently falls back to the browser default and never re-renders once the font
// arrives, so gating the whole boot on font-load avoids a flash of unstyled text entirely.
async function waitForFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('800 32px "Baloo 2"'),
      document.fonts.load('700 16px "Nunito"'),
    ]);
  } catch {
    // font loading API unavailable or fonts failed to load — boot anyway with fallback fonts
  }
}

// PWA install path (also the web fallback for offline play once assets are cached once). A
// missing/failing registration is never fatal — the game plays the same either way, this is
// purely additive. Skipped in dev: Vite's own dev-server caching + a stale SW fighting HMR is a
// worse experience than no SW at all while iterating.
function registerServiceWorker(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // offline/PWA support degrades gracefully — the game still plays fully online.
    });
  });
}

async function boot(): Promise<void> {
  registerServiceWorker();
  await waitForFonts();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: PALETTE_HEX.night,
    // Phaser tracks ONE touch pointer by default — a second simultaneous finger is silently
    // dropped, which made two-lane chords in the rhythm charts unplayable on a phone. One
    // pointer per lane.
    input: { activePointers: 4 },
    scale: {
      mode: Phaser.Scale.FIT,
      // NO_CENTER, not CENTER_BOTH: index.html's #app is already a flex container with
      // align-items/justify-content: center (needed regardless, to host the safe-area-inset
      // padding around the canvas). Phaser's own CENTER_BOTH sets an inline margin-left/margin-top
      // on the canvas to center it WITHIN its parent — stacked on top of a parent that's already
      // centering it, the two compound: confirmed live at a wide desktop viewport (1366x768), the
      // canvas rendered at x=700.5 instead of the correct x=467, using getBoundingClientRect() —
      // exactly what you get when a flexbox centers an item that itself carries a `margin-left`
      // equal to the correct centering offset (the item's larger effective margin-box gets
      // centered, then the margin pushes the actual content further right again). One centering
      // mechanism only; the CSS flexbox already does the job correctly on its own.
      autoCenter: Phaser.Scale.NO_CENTER,
      width: W,
      height: H,
    },
    // BootScene loads real painted assets (if present) then starts Title.
    scene: [BootScene, TitleScene, BandCreatorScene, OpeningScene, RoutePlanScene, HubScene, VanScene, CityScene, RhythmScene, ResultsScene, ScrapbookScene, SettingsScene, HowToPlayScene, MiniGameScene, TransitionScene],
  });

  if (import.meta.env.DEV) { (window as any).__game = game; (window as any).__audio = audio; (window as any).__state = State; }
}

boot();
