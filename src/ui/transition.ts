import Phaser from 'phaser';
import { PALETTE, SCREEN_FADE_MS, W, H } from '../const';
import { State } from '../core/state';
import { textStyle } from './textStyles';

/** Addendum v2, Item 9: themed transitions between gameplay moments, on top of the original
 *  plain 250ms fade — 'card' for a location/venue beat, 'lights' for stepping on stage, 'drive'
 *  for hub travel. Each is drawn as a temporary overlay by the OUTGOING scene (a container, not
 *  a new scene) that grows to fully cover the screen, then the target scene starts — the
 *  incoming scene's own existing fadeIn() (camera fade from the same night-navy the overlay
 *  ends on) handles the reveal, so the two compose into one continuous cover-then-reveal rather
 *  than needing the two scenes to hand off overlay ownership to each other. */
export type TransitionType = 'fade' | 'card' | 'lights' | 'drive';

export interface GoToOptions {
  transition?: TransitionType;
  /** Shown on 'card' (a venue/location line) and 'lights' (defaults to "On stage — <line>" — pass
   *  just the city name). Ignored for 'fade'/'drive'. */
  line?: string;
}

const THEMED_DURATION_MS = 380;

/** 250ms fade-to-black then start the target scene, passing data through. Pass `opts.transition`
 *  for a themed cover instead of the plain fade — automatically downgraded to plain fade when
 *  reducedMotion is on (every type) or noFlash is on and the type is 'lights' (its spotlight
 *  wipe reads flash-adjacent even though it's a soft radial, not a strobe). */
export function goTo(scene: Phaser.Scene, key: string, data?: object, opts: GoToOptions = {}): void {
  let type: TransitionType = opts.transition ?? 'fade';
  if (State.data.accessibility.reducedMotion) type = 'fade';
  if (type === 'lights' && State.data.accessibility.noFlash) type = 'fade';

  if (type === 'fade') {
    scene.cameras.main.fadeOut(SCREEN_FADE_MS, 43, 58, 85);
    scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      scene.scene.start(key, data);
    });
    return;
  }

  const overlay = buildThemedOverlay(scene, type, opts.line);
  scene.time.delayedCall(THEMED_DURATION_MS, () => {
    overlay.destroy();
    scene.scene.start(key, data);
  });
}

export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(SCREEN_FADE_MS, 43, 58, 85);
}

function buildThemedOverlay(scene: Phaser.Scene, type: TransitionType, line?: string): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0).setDepth(500);

  if (type === 'card') {
    // A sand card slides up from off-screen to fully cover — the same visual language as the
    // game's dialogue/choice panels, so a location/venue beat reads as "the story turning a
    // page," not a generic loading screen.
    const card = scene.add.rectangle(0, H, W, H, PALETTE.sand, 1).setOrigin(0, 0);
    container.add(card);
    if (line) {
      const label = scene.add.text(W / 2, H + H / 2, line, textStyle('h2', { color: '#4A2C40', align: 'center', wordWrap: { width: W - 120 } }))
        .setOrigin(0.5).setAlpha(0);
      container.add(label);
      scene.tweens.add({ targets: label, alpha: 1, delay: THEMED_DURATION_MS * 0.5, duration: THEMED_DURATION_MS * 0.4 });
      scene.tweens.add({ targets: [card, label], y: (t: any) => t === card ? 0 : H / 2, duration: THEMED_DURATION_MS, ease: 'Cubic.easeOut' });
    } else {
      scene.tweens.add({ targets: card, y: 0, duration: THEMED_DURATION_MS, ease: 'Cubic.easeOut' });
    }
  } else if (type === 'lights') {
    // Dark cover with a gold spotlight ring that shrinks in on the center — "the show is about
    // to start." A soft radial closing-in, not a flash: alpha ramps smoothly, no strobing.
    const dark = scene.add.rectangle(0, 0, W, H, PALETTE.night, 0).setOrigin(0, 0);
    const ring = scene.add.circle(W / 2, H / 2, W, PALETTE.gold, 0).setStrokeStyle(6, PALETTE.gold, 0.9);
    container.add([dark, ring]);
    scene.tweens.add({ targets: dark, alpha: 0.92, duration: THEMED_DURATION_MS, ease: 'Sine.easeIn' });
    scene.tweens.add({ targets: ring, radius: 40, duration: THEMED_DURATION_MS, ease: 'Cubic.easeIn' });
    if (line) {
      const label = scene.add.text(W / 2, H / 2, `On stage — ${line}`, textStyle('h1', { color: '#D9A441' })).setOrigin(0.5).setAlpha(0);
      container.add(label);
      scene.tweens.add({ targets: label, alpha: 1, delay: THEMED_DURATION_MS * 0.4, duration: THEMED_DURATION_MS * 0.5 });
    }
  } else if (type === 'drive') {
    // A night-road drift: a navy cover with a few pale streaks sliding left-to-right, like
    // passing streetlights seen from a moving bus window — for hub travel specifically.
    const dark = scene.add.rectangle(0, 0, W, H, PALETTE.night, 0).setOrigin(0, 0);
    container.add(dark);
    scene.tweens.add({ targets: dark, alpha: 0.95, duration: THEMED_DURATION_MS, ease: 'Sine.easeIn' });
    for (let i = 0; i < 4; i++) {
      const y = 200 + i * 250;
      const streak = scene.add.rectangle(-200, y, 160, 6, PALETTE.gold, 0.5).setOrigin(0, 0.5);
      container.add(streak);
      scene.tweens.add({
        targets: streak, x: W + 200, duration: THEMED_DURATION_MS * 1.1, delay: i * 40, ease: 'Sine.easeIn',
      });
    }
  }

  return container;
}
