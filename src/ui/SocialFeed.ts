// The return leg's social feed panel.
//
// Shown once, on arriving in a city the band has already played, before that night's dialogue
// starts. It is the payoff for everything the tour remembered about the first visit: how the show
// went, how the town felt, whether the load-out was a triumph or a farce.
//
// Code-drawn like every other UI surface here (the painted-world / code-drawn-UI rule): rounded
// post cards over the city's own backdrop, tinted by tone so a hostile take reads as hostile at a
// glance without needing to be read first.
import Phaser from 'phaser';
import { PALETTE, PALETTE_HEX, W } from '../const';
import { ensureRoundedRect } from '../art/sprites';
import { createButton } from './Button';
import { textStyle } from './textStyles';
import type { SocialPost } from '../game/social';

const PANEL_X = 30;
const PANEL_W = W - PANEL_X * 2;
const CARD_GAP = 12;

/** Tone colours: warm for a fan, cool-grey for a hater, sand for the neutral listings account.
 *  Deliberately low-saturation — this is a feed in a cozy game, not an alert. */
const TONE_TINT: Record<SocialPost['tone'], number> = {
  fan: 0xe8d9c0,
  hater: 0xcfd0d6,
  neutral: 0xe3e0d8,
};
const TONE_HANDLE_HEX: Record<SocialPost['tone'], string> = {
  fan: PALETTE_HEX.terracotta,
  hater: '#5C6270',
  neutral: '#6E6A60',
};

/** Renders the feed and calls `onDone` when the player dismisses it.
 *  Returns the container so the caller can destroy it early if it needs to. */
export function showSocialFeed(
  scene: Phaser.Scene,
  cityName: string,
  posts: SocialPost[],
  onDone: () => void,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0).setDepth(120);

  // Dim the city behind the feed so the cards carry the screen.
  const scrim = scene.add.rectangle(0, 0, W, scene.cameras.main.height, PALETTE.night, 0.82)
    .setOrigin(0, 0)
    .setInteractive(); // swallows taps so the city underneath cannot be clicked through the feed
  container.add(scrim);

  container.add(scene.add.text(W / 2, 92, 'While you were away', textStyle('h1')).setOrigin(0.5));
  container.add(scene.add.text(W / 2, 140, `${cityName} has opinions`, textStyle('small', {
    color: PALETTE_HEX.gold,
  })).setOrigin(0.5));

  // Cards are measured, not guessed: each one is sized to its own wrapped text so a long post is
  // never clipped and a short one leaves no dead space. Same defensive fit Button.ts uses.
  let y = 190;
  for (const post of posts) {
    const textStyleObj = textStyle('dialogue', {
      fontSize: '21px',
      color: '#3A2C33',
      wordWrap: { width: PANEL_W - 44 },
      lineSpacing: 4,
    });
    const probe = scene.add.text(0, 0, post.text, textStyleObj).setVisible(false);
    const textH = probe.height;
    probe.destroy();

    const cardH = textH + 62;
    const key = ensureRoundedRect(scene, PANEL_W, cardH, 18);
    container.add(scene.add.image(PANEL_X, y, key).setOrigin(0, 0).setTint(TONE_TINT[post.tone]).setAlpha(0.97));
    container.add(scene.add.text(PANEL_X + 22, y + 14, post.handle, textStyle('small', {
      fontSize: '17px', color: TONE_HANDLE_HEX[post.tone],
    })));
    container.add(scene.add.text(PANEL_X + 22, y + 40, post.text, textStyleObj));
    y += cardH + CARD_GAP;
  }

  const btn = createButton(scene, W / 2 - 130, y + 18, 260, 66, 'Tonight, then', () => {
    container.destroy();
    onDone();
  }, { fillColor: PALETTE.plum });
  container.add(btn);

  return container;
}
