import Phaser from 'phaser';
import { SCREEN_FADE_MS } from '../const';

/** 250ms fade-to-black then start the target scene, passing data through. */
export function goTo(scene: Phaser.Scene, key: string, data?: object): void {
  scene.cameras.main.fadeOut(SCREEN_FADE_MS, 43, 58, 85);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data);
  });
}

export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(SCREEN_FADE_MS, 43, 58, 85);
}
