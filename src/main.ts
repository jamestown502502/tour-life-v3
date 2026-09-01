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
  scene: [TitleScene, BandCreatorScene, RoutePlanScene, HubScene, CityScene, RhythmScene, ResultsScene, ScrapbookScene, SettingsScene],
});

if (import.meta.env.DEV) (window as any).__game = game;
