// Small persistent menu button, top-left on City/MiniGame — Workstream 2 of the UX/QA fix pass
// found these had NO way back to Settings (and so no way to Quit to Title) at all: only Title
// and Hub could open it. Opens Settings via the same launch+pause pattern Hub/Title already use;
// Settings' own Back/Quit-to-Title buttons resume or replace whichever scene passed itself as
// returnTo. Deliberately NOT added to RhythmScene — its lanes' tap zones already cover most of
// the play area, so a persistent tap target there risks an accidental mid-song pause, and a song
// is always a short, bounded segment that reaches Results on its own (see docs/navigation-fixes.md).
import Phaser from 'phaser';
import { PALETTE } from '../const';
import { createButton } from './Button';

const BTN_SIZE = 66; // matches HelpButton's BTN_SIZE — same measured 44px-floor fix
const BTN_X = 20;
const BTN_Y = 20;

/** `yOffset` lets a caller that also constructs a DialogueBox (CityScene) stack this button
 *  below DialogueBox's own top-left "≡" backlog toggle (src/ui/DialogueBox.ts, same (20,20,66,66)
 *  spot) instead of exactly overlapping it — confirmed live: with both at (20,20), a tap there
 *  always hit whichever was added later in the display list, so Settings was silently
 *  unreachable from City (the backlog toggle intercepted every tap instead). MiniGameScene
 *  doesn't construct a DialogueBox, so it has no such collision and uses the default. */
export function addMenuButton(scene: Phaser.Scene, returnTo: string, yOffset = 0): void {
  // A gear, not '☰'/'≡' — DialogueBox's backlog toggle (same corner in CityScene, see yOffset's
  // own comment) uses '≡', and the two stacked right on top of each other looked like duplicate
  // buttons in a live screenshot even once the collision itself was fixed.
  createButton(scene, BTN_X, BTN_Y + yOffset, BTN_SIZE, BTN_SIZE, '⚙', () => {
    scene.scene.launch('Settings', { returnTo });
    scene.scene.pause();
  }, { fillColor: PALETTE.plum, fontSize: '26px' });
}
