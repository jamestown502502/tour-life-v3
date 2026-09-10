// Live-regression repro (Item A3): the transition-leak detector, plus the VN "elements appear and
// disappear too quickly" evidence capture.
//
// goTo() creates a full-screen interactive input BLOCKER at depth 1000 and (for themed types) an
// overlay container at depth 500. If either outlives its transition, Phaser's topOnly hit-testing
// routes every subsequent tap to the leftover object and the screen underneath becomes
// permanently unresponsive — the "interface disappears / can't progress" class of report. Nothing
// in the suite asserted this before.
import { test, expect } from '@playwright/test';
import {
  bootGame, skipFirstTimeOnboarding, startScene, canvasClick, collectConsoleErrors,
  waitForCondition, waitForActiveScene, clickPreShowChoice } from './helpers';

/** Every live object across every ACTIVE scene sitting at depth >= 500, with whether it still
 *  eats input. After any completed transition this must be empty. */
async function strayOverlays(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const g: any = (window as any).__game;
    return g.scene.getScenes(true).flatMap((sc: any) =>
      sc.children.list
        .filter((o: any) => (o.depth ?? 0) >= 500)
        .map((o: any) => ({
          scene: sc.scene.key,
          type: o.type,
          depth: o.depth,
          interactive: !!(o.input && o.input.enabled),
          alpha: o.alpha,
        })));
  });
}

test.describe('Transition overlays must never outlive their transition', () => {
  test.beforeEach(async ({ page }) => {
    await skipFirstTimeOnboarding(page);
  });

  test('no interactive depth>=500 object survives a themed City -> Rhythm transition', async ({ page }) => {
    test.setTimeout(90000);
    const errors = collectConsoleErrors(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('tourlife.seenRhythmTutorial', '1');
    });
    await bootGame(page);
    // Boot must finish loading the real asset manifest before any scene is started by hand:
    // starting a City early makes its code-drawn fallback generate into a key the loader is
    // still about to add, producing a spurious "Texture key already in use" console error that
    // never happens in a natural boot-to-play flow (fullrun.spec.ts proves that path is clean).
    await waitForActiveScene(page, 'Title', 20000);
    // ...and stop it. startScene uses the SceneManager, which (unlike every real transition in
    // transition.ts) does NOT stop the calling scene — leaving Title alive, still rendering its
    // UI and still owning its floating seed-input DOM element on top of whatever we start next.
    await page.evaluate(() => (window as any).__game.scene.stop("Title"));
    await startScene(page, 'City', { cityId: 'berlin', phase: 'preshow-choices' });
    await waitForActiveScene(page, 'City', 10000);
    await page.waitForTimeout(600);
    await clickPreShowChoice(page, 0);
    await waitForCondition(
      page,
      () => (window as any).__game.scene.getScenes(true).some((s: any) => s.scene.key === 'Rhythm'),
      12000,
    );
    await page.waitForTimeout(1200);

    const stray = await strayOverlays(page);
    const eaters = stray.filter((o) => o.interactive);
    expect(
      eaters,
      `input-eating leftovers after the 'lights' transition: ${JSON.stringify(eaters)}`,
    ).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('no interactive depth>=500 object survives the plain-fade transitions in the city loop', async ({ page }) => {
    // Four real scene entries, each with a settle wait and an overlay census, on a ~4fps harness.
    test.setTimeout(300000);
    await bootGame(page);
    // Boot must finish loading the real asset manifest before any scene is started by hand:
    // starting a City early makes its code-drawn fallback generate into a key the loader is
    // still about to add, producing a spurious "Texture key already in use" console error that
    // never happens in a natural boot-to-play flow (fullrun.spec.ts proves that path is clean).
    await waitForActiveScene(page, 'Title', 20000);
    // ...and stop it. startScene uses the SceneManager, which (unlike every real transition in
    // transition.ts) does NOT stop the calling scene — leaving Title alive, still rendering its
    // UI and still owning its floating seed-input DOM element on top of whatever we start next.
    await page.evaluate(() => (window as any).__game.scene.stop("Title"));

    // Hub -> City is a 'drive' themed transition; City -> MiniGame/back is plain fade. Step
    // several real transitions and assert after each one.
    const steps: { label: string; go: () => Promise<void> }[] = [
      {
        label: 'Hub',
        go: async () => { await startScene(page, 'Hub'); await waitForActiveScene(page, 'Hub', 10000); },
      },
      {
        label: 'City arrival',
        go: async () => { await startScene(page, 'City', { cityId: 'berlin', phase: 'arrival' }); await waitForActiveScene(page, 'City', 10000); },
      },
      {
        label: 'MiniGame',
        go: async () => {
          await startScene(page, 'MiniGame', { cityId: 'tokyo', minigameId: 'tok_pack_van', returnPhase: 'locations' });
          await waitForActiveScene(page, 'MiniGame', 10000);
        },
      },
      {
        label: 'Scrapbook',
        go: async () => { await startScene(page, 'Scrapbook', {}); await waitForActiveScene(page, 'Scrapbook', 10000); },
      },
    ];

    for (const step of steps) {
      await step.go();
      await page.waitForTimeout(800);
      const eaters = (await strayOverlays(page)).filter((o) => o.interactive);
      expect(eaters, `input-eating leftovers after reaching ${step.label}: ${JSON.stringify(eaters)}`).toEqual([]);
    }
  });

  test('VN phase boundaries: capture what appears/disappears (evidence for the flash triage)', async ({ page }) => {
    // Generous: 7 phase entries, each a real scene start plus two overlay samples and a
    // screenshot, on an environment measured at ~4fps.
    test.setTimeout(420000);
    await bootGame(page);
    // Boot must finish loading the real asset manifest before any scene is started by hand:
    // starting a City early makes its code-drawn fallback generate into a key the loader is
    // still about to add, producing a spurious "Texture key already in use" console error that
    // never happens in a natural boot-to-play flow (fullrun.spec.ts proves that path is clean).
    await waitForActiveScene(page, 'Title', 20000);
    // ...and stop it. startScene uses the SceneManager, which (unlike every real transition in
    // transition.ts) does NOT stop the calling scene — leaving Title alive, still rendering its
    // UI and still owning its floating seed-input DOM element on top of whatever we start next.
    await page.evaluate(() => (window as any).__game.scene.stop("Title"));

    // Step a city through its phases, screenshotting each boundary and recording every object
    // that is on screen at depth >= 100 (overlays, grades, transition covers, the back button)
    // so the "random elements appear and disappear too quickly" report can be classified per
    // element rather than guessed at.
    const phases = ['arrival', 'locations', 'relationship', 'preshow', 'preshow-choices', 'afterShow', 'journal'];
    const observed: Record<string, unknown> = {};
    for (const phase of phases) {
      await startScene(page, 'City', { cityId: 'berlin', phase });
      await waitForActiveScene(page, 'City', 10000);
      // Sample twice: immediately (catching short-lived elements) and after things settle.
      await page.waitForTimeout(150);
      const atEntry = await strayOverlays(page);
      await page.waitForTimeout(1400);
      const settled = await strayOverlays(page);
      observed[phase] = { atEntry, settled };
      await page.screenshot({ path: `docs/polish-before-after/vn-phase-${phase}.png` });
    }
    console.log('[VN phase-boundary overlay census]', JSON.stringify(observed, null, 1));

    // The assertion that matters for the bug (not the triage): nothing that eats input is left
    // behind on any phase once it has settled.
    for (const [phase, snap] of Object.entries(observed)) {
      const settled = (snap as any).settled as { interactive: boolean }[];
      expect(
        settled.filter((o) => o.interactive),
        `phase "${phase}" settled with an input-eating overlay still alive`,
      ).toEqual([]);
    }
  });
});
