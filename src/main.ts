import Phaser from 'phaser';
import { H, PALETTE_HEX, W } from './const';
import { TitleScene } from './ui/TitleScene';
import { BandCreatorScene } from './ui/BandCreatorScene';
import { RoutePlanScene } from './ui/RoutePlanScene';
import { HubScene } from './ui/HubScene';
import { CityScene } from './ui/CityScene';
import { RhythmScene } from './ui/RhythmScene';
import { ResultsScene } from './ui/ResultsScene';
import { ScrapbookScene } from './ui/ScrapbookScene';
import { SettingsScene } from './ui/SettingsScene';
import { HowToPlayScene } from './ui/HowToPlayScene';
import { MiniGameScene } from './ui/MiniGameScene';
import { audio } from './core/audio';
import { BootScene } from './ui/BootScene';

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
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: W,
      height: H,
    },
    // BootScene loads real painted assets (if present) then starts Title.
    scene: [BootScene, TitleScene, BandCreatorScene, RoutePlanScene, HubScene, CityScene, RhythmScene, ResultsScene, ScrapbookScene, SettingsScene, HowToPlayScene, MiniGameScene],
  });

  if (import.meta.env.DEV) { (window as any).__game = game; (window as any).__audio = audio; }
}

boot();
