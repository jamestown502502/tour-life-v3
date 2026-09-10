// Stuck-screen-hardening follow-up (2026-09-05), Item B. Ground truth: src/ui/transition.ts's
// themed overlays had no input-blocking, so a rapid double-tap on a transitioned button could
// call goTo() twice on the same outgoing scene before the first tap's cover even appeared — two
// overlays, two delayedCalls, the first one's scene.start() stopping the outgoing scene out from
// under the second. The fix (transition.ts) adds a full-screen input-blocking overlay, a
// single-flight WeakSet guard on goTo(), and a watchdog delayedCall. This spec proves the race is
// closed with a real double-tap through the actual Phaser input pipeline (not a direct method
// call), and separately audits that every CityPhase a save can resume into lands somewhere
// playable, not a dead screen.
import { test, expect } from '@playwright/test';
import { bootGame, canvasClick, collectConsoleErrors, getActiveSceneKeys, skipFirstTimeOnboarding, startScene, waitForActiveScene, waitForCondition, clickPreShowChoice, preShowChoiceCenter } from './helpers';

test.describe('Stuck-screen hardening (follow-up, Item B)', () => {
  test('a rapid double-tap on a themed-transition button fires the transition exactly once', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title');

    await page.evaluate(() => {
      const State = (window as any).__state;
      State.newRun('double-tap-race-seed');
      State.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because', members: ['mira', 'theo', 'jun', 'rowan'] };
      State.data.route = [{ cityId: 'berlin', visited: false, weather: 'clear' }];
      State.data.currentCityIndex = 0;
      State.data.flags = ['onboard_hub_seen', 'onboard_routeplan_seen'];
      State.data.accessibility.autoplay = true;
      (window as any).__game.scene.stop('Title');
    });
    await startScene(page, 'City', { cityId: 'berlin', phase: 'preshow-choices' });
    await waitForActiveScene(page, 'City');

    // Berlin's first preshow choice: CityScene.ts's renderPreShowChoices, W/2-300, 960, 600, 66 —
    // found by identity, not a copied coordinate. -> Rhythm, the exact path from the live bug
    // report. Two real clicks fired back-to-back with no artificial delay between them — each is
    // a full, atomic move+down+up (canvasClick), sequential rather than concurrent so Playwright's
    // single shared virtual mouse can't interleave the two actions' own move/down/up steps into
    // something neither click nor the real bug report's double-tap actually looks like.
    // Resolve the position ONCE, then tap it twice. Looking it up a second time would fail by
    // design: the first tap hands off to Rhythm, so City's choice container is already gone.
    const choice = await preShowChoiceCenter(page, 0);
    await canvasClick(page, choice.x, choice.y);
    await canvasClick(page, choice.x, choice.y);

    // Before the fix, this could leave BOTH "City" and a half-destroyed transition in place, or
    // race into "Rhythm" twice. After the fix: exactly one scene, reached once, no leftovers.
    const reachedRhythm = await waitForCondition(page, () => (window as any).__game.scene.getScenes(true).map((s: any) => s.scene.key).includes('Rhythm'), 8000);
    expect(reachedRhythm, 'the double-tapped choice should still hand off to Rhythm, not hang').toBe(true);

    const active = await getActiveSceneKeys(page);
    expect(active, 'exactly one scene should be active after the race resolves — no leftover City, no duplicate').toEqual(['Rhythm']);

    expect(errors, `no console errors from the double-tap race: ${errors.join('; ')}`).toEqual([]);
  });

  // Mirrors CityScene.ts's own VALID_PHASES exactly — every value a save's progress.nodeId can
  // hold for screen:'city'. One test per phase (a fresh page each, Playwright's own isolation)
  // rather than one test looping all 7 on a single page — an earlier version of this spec shared
  // one page across the loop and intermittently hung on a later iteration's setup script for
  // reasons never conclusively pinned down; per-phase isolation removed the question entirely and
  // gives a specific failing phase a specific failing test name instead of one large test dying
  // partway through.
  const phases = ['arrival', 'locations', 'relationship', 'preshow', 'preshow-choices', 'afterShow', 'journal'] as const;

  for (const phase of phases) {
    test(`resume phase "${phase}" lands on a playable, interactive screen`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      await skipFirstTimeOnboarding(page);
      await bootGame(page);
      await waitForActiveScene(page, 'Title');

      await page.evaluate(() => {
        const State = (window as any).__state;
        State.newRun('resume-audit-seed');
        State.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because', members: ['mira', 'theo', 'jun', 'rowan'] };
        State.data.route = [{ cityId: 'berlin', visited: false, weather: 'clear' }];
        State.data.currentCityIndex = 0;
        State.data.flags = ['onboard_hub_seen', 'onboard_routeplan_seen'];
        State.data.accessibility.autoplay = true;
        State.data.relationships.jun = 40; // so Berlin's conditional 3rd preshow choice is present too
        (window as any).__game.scene.stop('Title');
      });
      await startScene(page, 'City', { cityId: 'berlin', phase });
      const reached = await waitForActiveScene(page, 'City', 8000);
      expect(reached, `phase "${phase}" should land on City, not fall through to some other/no scene`).toContain('City');

      // "Playable" here means: within a few seconds, either the dialogue box is visible and has
      // content, or at least one clickable button exists on screen — never a scene that just sits
      // there with nothing to interact with (the actual shape of a "stuck" screen).
      const interactive = await waitForCondition(page, () => {
        const scene = (window as any).__game.scene.getScene('City');
        if (!scene) return false;
        const db = (scene as any).dialogueBox;
        if (db?.container?.visible) return true;
        // Any interactive game object (a button's bg Image) present anywhere in the display list.
        // Only recurse into real Containers — other object types (e.g. a ParticleEmitter) can
        // carry unrelated properties that happen to be named "list" and are not child game
        // objects.
        const hasInteractiveChild = (list: any[]): boolean => list.some((o: any) =>
          (o.input && o.input.enabled) || (o.type === 'Container' && hasInteractiveChild(o.list)));
        return hasInteractiveChild(scene.children.list);
      }, 8000);
      expect(interactive, `phase "${phase}" should reach an interactive state (dialogue or a button), not a blank/dead screen`).toBe(true);

      expect(errors, `no console errors resuming into phase "${phase}": ${errors.join('; ')}`).toEqual([]);
    });
  }
});
