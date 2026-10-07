// Android Back (TWA / WebView) and the browser's back button (2026-10-07). Both arrive as a history
// pop. main.ts keeps one guard entry on the history stack, so Back stays inside the game:
//   - an overlay on top (Settings, How to Play, a help or picker panel) closes
//   - during play (city, show, minigame, the bus, the drive, results) it pauses into Settings
//   - band creation steps back to the title screen
//   - at the title or the scrapbook it asks once, and a second Back within 2 s leaves the app
// A decision card (Stop complete) swallows it: it has its own two buttons.
import Phaser from 'phaser';
import { goTo } from './transition';

const PAUSABLE = ['City', 'Rhythm', 'MiniGame', 'Hub', 'Van', 'Results', 'RoutePlan', 'Opening'];

export function handleBack(game: Phaser.Game): boolean {
  const mgr = game.scene;
  if (mgr.isActive('HowToPlay')) { (mgr.getScene('HowToPlay') as unknown as { close(): void }).close(); return true; }
  if (mgr.isActive('Settings')) { (mgr.getScene('Settings') as unknown as { resumeGame(): void }).resumeGame(); return true; }
  const top = mgr.getScenes(true).filter((s) => s.scene.key !== 'Transition').pop();
  if (!top) return false;
  // an open panel in the scene on top: the decision card stays, anything else closes
  const panels = top.children.list.filter((o) => o instanceof Phaser.GameObjects.Container && (o as Phaser.GameObjects.Container).depth >= 150) as Phaser.GameObjects.Container[];
  const panel = panels.sort((a, b) => b.depth - a.depth)[0];
  if (panel) {
    if (panel.name === 'stopComplete' || panel.name === 'interruptedShow') return true;
    panel.destroy();
    return true;
  }
  const key = top.scene.key;
  if (key === 'BandCreator') { goTo(top, 'Title'); return true; }
  if (PAUSABLE.includes(key)) {
    top.scene.launch('Settings', { returnTo: key });
    top.scene.pause();
    return true;
  }
  return false;   // Title, Scrapbook: Back may leave
}
