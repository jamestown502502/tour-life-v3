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

async function boot(): Promise<void> {
  await waitForFonts();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: PALETTE_HEX.night,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: W,
      height: H,
    },
    // BootScene loads real painted assets (if present) then starts Title.
    scene: [BootScene, TitleScene, BandCreatorScene, RoutePlanScene, HubScene, CityScene, RhythmScene, ResultsScene, ScrapbookScene, SettingsScene, HowToPlayScene],
  });

  if (import.meta.env.DEV) { (window as any).__game = game; (window as any).__audio = audio; }
}

boot();
