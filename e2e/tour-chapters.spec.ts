// Narrative upgrades (2026-10-16), end to end on the real build: the intro's two choices, the
// end-of-Tour-1 chapter, a reload after "Start a new tour" (which used to forget every finished
// tour and every setting), the second tour remembering the first, and the end-of-Tour-2 chapter.
import { test, expect, type Page } from './fixtures';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene, startScene, canvasClick, clickButtonByLabel, waitForCondition } from './helpers';

/** Taps through `sceneKey`'s dialogue, answering each choice with the first wanted label it
 *  offers (by substring), until the scene is gone. Returns every line shown, for assertions. */
async function walkAnswering(page: Page, sceneKey: string, wanted: string[], maxSteps = 80): Promise<string[]> {
  for (let i = 0; i < maxSteps; i++) {
    const state = await page.evaluate(([key, want]) => {
      const g = (window as any).__game;
      if (!g.scene.getScenes(true).some((s: any) => s.scene.key === key)) return { done: true } as const;
      const db = g.scene.getScene(key)?.dialogueBox;
      if (!db || !db.container.visible) return { done: false, wait: true } as const;
      const btns = db.choiceButtons as any[];
      if (!btns.length) return { done: false, wait: false, xy: null } as const;
      const label = (b: any) => (b.list ?? []).filter((c: any) => c.type === 'Text').map((t: any) => t.text).join(' ');
      const pick = btns.find((b) => (want as string[]).some((w) => label(b).includes(w))) ?? btns[0];
      const r = pick.getBounds();
      return { done: false, wait: false, xy: { x: r.centerX, y: r.centerY } } as const;
    }, [sceneKey, wanted] as const);
    if (state.done) break;
    if (state.wait) { await page.waitForTimeout(200); continue; }
    await canvasClick(page, state.xy ? state.xy.x : 360, state.xy ? state.xy.y : 800);
    await page.waitForTimeout(state.xy ? 400 : 200);
  }
  return page.evaluate((key) => ((window as any).__game.scene.getScene(key)?.dialogueBox?.backlog ?? []).map((b: any) => b.text), sceneKey);
}

/** Clicks a Scrapbook button once it has stopped moving: buttons pop in with an entrance tween,
 *  and on a slow WebKit runner a click aimed mid-tween landed on the button above it (CI, PR #27:
 *  "Two Tours" opened "What we learned"). */
async function clickSettled(page: Page, sceneKey: string, label: string) {
  let last = '';
  for (let i = 0; i < 40; i++) {
    const now = await page.evaluate(([key, want]) => {
      const scene: any = (window as any).__game.scene.getScene(key as string);
      let found = '';
      const walk = (list: any[]) => { for (const o of list) { if (o.type === 'Container') {
        if ((o.list ?? []).some((c: any) => c.type === 'Text' && String(c.text).includes(want as string))) { const b = o.getBounds(); found ||= `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)},${o.alpha}`; }
        walk(o.list ?? []); } } };
      walk(scene?.children.list ?? []);
      return found;
    }, [sceneKey, label] as const);
    if (now && now === last) break;
    last = now;
    await page.waitForTimeout(300);
  }
  await clickButtonByLabel(page, sceneKey, label);
}

/** A run that has played every stop, parked on the Hub, ready to wrap. */
async function finishedRunAtHub(page: Page, seed: string, flags: string[], relationships: Record<string, number>) {
  await page.evaluate(({ seed, flags, relationships }) => {
    const g: any = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => s.sys.settings.key !== 'Transition' && g.scene.stop(s.sys.settings.key));
    const S: any = (window as any).__state;
    S.newRun(seed);
    S.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because CI said so', members: ['mira', 'theo', 'jun', 'rowan'] };
    S.data.route = [{ cityId: 'lisbon', visited: true }, { cityId: 'berlin', visited: true }];
    S.data.currentCityIndex = 2;
    S.data.flags = flags;
    S.data.relationships = relationships;
    S.data.localLove = { lisbon: 60, berlin: 50 };
  }, { seed, flags, relationships });
  await startScene(page, 'Hub');
  await waitForActiveScene(page, 'Hub', 15000);
}

test.describe('tour chapters', () => {
  test('the intro asks for the split sheet and the shotgun seat, then reaches the route', async ({ page }) => {
    test.setTimeout(180000);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await page.evaluate(() => {
      const g: any = (window as any).__game;
      g.scene.stop('Title');
      const S: any = (window as any).__state;
      S.newRun('intro-e2e');
      S.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because CI said so', members: ['mira', 'theo', 'jun', 'rowan'] };
    });
    await startScene(page, 'Opening');
    await waitForActiveScene(page, 'Opening', 15000);
    const lines = await walkAnswering(page, 'Opening', ['Mira and Jun wrote it', 'Rowan']);
    expect(lines[0]).toMatch(/Four weeks from now/);
    expect(lines.some((l) => /who wrote what/i.test(l))).toBe(true);
    const flags: string[] = await page.evaluate(() => (window as any).__state.data.flags);
    expect(flags).toContain('split_writers');
    expect(flags).toContain('shotgun_rowan');
    await waitForActiveScene(page, 'RoutePlan', 20000);
  });

  test('the first finished tour earns The Credits Roll, and a reload after Start a new tour remembers it', async ({ page }) => {
    test.setTimeout(300000);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);

    // ---- Tour 1: the split sheet was skipped, so the liner notes have to settle it.
    await finishedRunAtHub(page, 'chapter-one-e2e', ['split_skipped', 'shotgun_theo'], { mira: 60, theo: 20, jun: 40, rowan: 40 });
    await page.evaluate(() => { (window as any).__state.data.accessibility.reducedMotion = true; });
    await page.evaluate(() => (window as any).__game.scene.getScene('Hub').wrapTour());
    await waitForActiveScene(page, 'Chapter', 20000);
    const one = await walkAnswering(page, 'Chapter', ['Writers own the song', 'Not for ads']);
    expect(one.join('\n')).toMatch(/featured artist/);
    expect(one.join('\n')).toMatch(/Inês/);
    expect(one.join('\n')).toMatch(/envelope/);
    await waitForActiveScene(page, 'Scrapbook', 20000);
    const meta1 = await page.evaluate(() => (window as any).__state.data.meta);
    expect(meta1.completedRuns).toBe(1);
    expect(meta1.chaptersSeen).toEqual([1]);
    expect(meta1.tourOne.split).toBe('writers');
    expect(meta1.tourOne.license).toBe('never');

    // ---- "Start a new tour" clears the run save; then the player closes the tab.
    await clickSettled(page, 'Scrapbook', 'Start a new tour');
    await waitForActiveScene(page, 'Title', 20000);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).__game, null, { timeout: 30000 });
    await waitForActiveScene(page, 'Title', 30000);
    const back = await page.evaluate(() => {
      const d = (window as any).__state.data;
      return { runs: d.meta.completedRuns, license: d.meta.tourOne?.license, reducedMotion: d.accessibility.reducedMotion };
    });
    expect(back, 'a reload after Start a new tour must keep finished tours and settings').toEqual({ runs: 1, license: 'never', reducedMotion: true });
  });

  // Nightly only (the gate's per-device time budget): Tour 1 is seeded as finished rather than
  // replayed, so this covers what the second tour does with it.
  test('the second tour remembers the first and earns Own the Room @nightly', async ({ page }) => {
    test.setTimeout(300000);
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await page.evaluate(() => {
      const S: any = (window as any).__state;
      Object.assign(S.data.meta, {
        completedRuns: 1, chaptersSeen: [1],
        runHistory: [{ seed: 'chapter-one-e2e', bandName: 'The Testbeds', endingId: 'live_album', tags: [], completedAt: 1, route: ['lisbon', 'tokyo'] }],
        tourOne: { split: 'writers', license: 'never', tiers: { mira: 'denied', theo: 'fulfilled', jun: 'unresolved', rowan: 'unresolved' }, endingId: 'live_album' },
      });
    });

    // ---- Tour 2 remembers: the intro opens on the last ending, the first drive has the envelope.
    await page.evaluate(() => {
      const g: any = (window as any).__game;
      g.scene.stop('Title');
      const S: any = (window as any).__state;
      S.newRun('chapter-two-intro-e2e');
      S.data.band = { name: 'The Testbeds', genre: 'indie', whyTour: 'because CI said so', members: ['mira', 'theo', 'jun', 'rowan'] };
    });
    await startScene(page, 'Opening');
    await waitForActiveScene(page, 'Opening', 15000);
    const intro2 = await walkAnswering(page, 'Opening', ['Four ways', 'Jun']);
    expect(intro2[0]).toMatch(/Last tour ended as a/);
    expect(intro2.some((l) => /Same page as last tour/.test(l))).toBe(true);

    // ---- Tour 2 finished: the direct-to-fan night, the envelope, both tours looked back on.
    await finishedRunAtHub(page, 'chapter-two-e2e', ['split_equal', 'shotgun_jun'], { mira: 70, theo: 10, jun: 40, rowan: 80 });
    await page.evaluate(() => (window as any).__game.scene.getScene('Hub').wrapTour());
    await waitForActiveScene(page, 'Chapter', 20000);
    const two = await walkAnswering(page, 'Chapter', ["$12", 'Hand it back']);
    const text = two.join('\n');
    expect(text).toMatch(/people bought it at \$12/);
    expect(text).toMatch(/No advance/);
    expect(text).toMatch(/finish/i);
    await waitForActiveScene(page, 'Scrapbook', 20000);
    const meta2 = await page.evaluate(() => (window as any).__state.data.meta);
    expect(meta2.completedRuns).toBe(2);
    expect(meta2.chaptersSeen).toEqual([1, 2]);
    expect(meta2.dealChoice).toBe('indie');
    expect(meta2.runHistory[1].route).toEqual(['lisbon', 'berlin']);

    await clickSettled(page, 'Scrapbook', 'Two Tours');
    const panel = await waitForCondition(page, () => !!(window as any).__game.scene.getScene('Scrapbook').children.getByName('twoToursPanel'), 10000);
    expect(panel).toBe(true);
    const summary = await page.evaluate(() => {
      const p: any = (window as any).__game.scene.getScene('Scrapbook').children.getByName('twoToursPanel');
      return p.list.filter((o: any) => o.type === 'Text').map((t: any) => t.text).join('\n');
    });
    expect(summary).toMatch(/stayed independent/);
    expect(summary).toMatch(/no ads/);
    expect(summary).toMatch(/Lisbon → Berlin/);
  });
});
