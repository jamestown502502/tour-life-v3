// Live-regression repro (Item A2): "upon entering rhythm gameplay the interface immediately
// disappears, preventing progress."
//
// The existing no-skip guard (critical-issues-followup.spec.ts) starts RhythmScene DIRECTLY.
// This one enters through the REAL path a player takes — CityScene's pre-show choice ->
// goTo('Rhythm', {transition:'lights'}) — as a RETURNING player (rhythm tutorial already seen),
// which is the exact combination the live report describes and the one no test covered.
import { test, expect } from '@playwright/test';
import {
  bootGame, skipFirstTimeOnboarding, startScene, canvasClick, collectConsoleErrors,
  waitForCondition, waitForActiveScene, getActiveSceneKeys,
} from './helpers';

/** Marks this profile as a returning player for BOTH onboarding gates the rhythm scene reads:
 *  the how-to-play overlay and the one-time rhythm practice pass. A returning player skips the
 *  practice pass and goes straight into the real song — the reported path. */
async function seedReturningRhythmPlayer(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('tourlife.seenHowToPlay', '1');
    window.localStorage.setItem('tourlife.seenRhythmTutorial', '1');
    window.localStorage.setItem('tourlife.seenHoldHint', '1');
    window.localStorage.setItem('tourlife.seenCueHint', '1');
  });
}

/** Everything that must be true for the rhythm interface to be "there and playable". */
async function readRhythmState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const g: any = (window as any).__game;
    const s: any = g.scene.getScene('Rhythm');
    const active = g.scene.getScenes(true).map((x: any) => x.scene.key);
    if (!s || !active.includes('Rhythm')) return { present: false, active };
    return {
      present: true,
      active,
      noteCount: s.notes?.length ?? 0,
      cueCount: s.cues?.length ?? 0,
      finished: s.finished,
      judgements: s.judgements?.length ?? 0,
      cityLabel: s.cityLabel?.text ?? '',
      // Anything left over from the outgoing scene's 'lights' cover would sit at depth >= 500.
      strayHighDepth: g.scene.getScenes(true).flatMap((sc: any) =>
        sc.children.list
          .filter((o: any) => o.depth >= 500 && o.input && o.input.enabled)
          .map((o: any) => `${sc.scene.key}:${o.type}@${o.depth}`)),
    };
  });
}

test.describe('Rhythm entry via the real pre-show path (live-regression repro)', () => {
  test('a returning player reaching Rhythm through the pre-show sees a playable interface that stays', async ({ page }) => {
    test.setTimeout(120000);
    await seedReturningRhythmPlayer(page);
    const errors = collectConsoleErrors(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
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

    // Land on the city's pre-show choices — the screen whose button calls goTo('Rhythm').
    await startScene(page, 'City', { cityId: 'berlin', phase: 'preshow-choices' });
    await waitForActiveScene(page, 'City', 10000);
    await page.waitForTimeout(600);

    // Click the first pre-show option (CityScene.renderPreShowChoices: buttons at y = 960 + i*82,
    // full-width-ish, so the row's vertical center for i=0 is ~y 960+33).
    await canvasClick(page, 360, 993);

    // The 'lights' transition is 380ms; give it generous room, then assert the scene is REALLY up.
    const reached = await waitForCondition(
      page,
      () => (window as any).__game.scene.getScenes(true).some((s: any) => s.scene.key === 'Rhythm'),
      12000,
    );
    expect(reached, `never reached Rhythm from the pre-show choice; active = ${(await getActiveSceneKeys(page)).join(',')}`).toBe(true);

    await page.waitForTimeout(1500);
    const early = await readRhythmState(page);
    expect(early.present, 'Rhythm should be the active scene shortly after entering').toBe(true);
    expect(early.noteCount, 'the real song should have loaded a non-empty chart').toBeGreaterThan(0);
    expect(early.finished, 'the song must not already be finished moments after entering').toBe(false);
    expect(early.cityLabel, 'the city/arrangement label should be populated').not.toBe('');
    expect(
      early.strayHighDepth,
      `a transition overlay/blocker outlived its scene: ${early.strayHighDepth.join(', ')}`,
    ).toEqual([]);

    await page.screenshot({ path: 'docs/polish-before-after/rhythm-entry-1-just-entered.png' });

    // The core symptom: the song ending on its own without being played. Asserted against the
    // SCENE'S OWN clock, never a count of polling iterations — every page.evaluate here costs a
    // CDP round-trip, so wall-clock loop counts badly understate how much song time really
    // elapsed and would make a correct end-of-song finish look like a premature one.
    const outcome = await page.evaluate(async () => {
      const s: any = (window as any).__game.scene.getScene('Rhythm');
      const longest = (): number => {
        let max = 0;
        for (const ns of s.notes) max = Math.max(max, ns.note.t + (ns.note.dur ?? 0.2));
        for (const cs of s.cues) max = Math.max(max, cs.cue.t + 0.5);
        return max;
      };
      const started = performance.now();
      // Poll inside the page so the scene clock is sampled every frame, not every round-trip.
      return await new Promise<any>((resolve) => {
        const tick = () => {
          const t = (s.time.now - s.startTime) / 1000;
          if (s.finished) {
            resolve({ finishedAtT: t, longest: longest(), judgements: s.judgements.length, notes: s.notes.length, reason: 'finished' });
            return;
          }
          if (t > 25 || performance.now() - started > 90000) {
            resolve({ finishedAtT: null, tReached: t, longest: longest(), judgements: s.judgements.length, notes: s.notes.length, reason: 'still-playing' });
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      });
    });

    console.log('[rhythm-entry] outcome =', JSON.stringify(outcome));
    await page.screenshot({ path: 'docs/polish-before-after/rhythm-entry-2-into-the-song.png' });

    // A finish is only legitimate once the chart has actually played out. Finishing at t=3s on a
    // 61s chart is the reported bug; finishing at t=62.5s is correct behaviour.
    if (outcome.finishedAtT !== null) {
      expect(
        outcome.finishedAtT,
        `the song self-finished at t=${outcome.finishedAtT}s on a chart ${outcome.longest}s long ` +
        `(${outcome.judgements} judgements over ${outcome.notes} notes) — it ended without being played`,
      ).toBeGreaterThanOrEqual(outcome.longest);
    }
    const stillThere = await readRhythmState(page);
    expect(stillThere.present, `Rhythm disappeared (active: ${stillThere.active?.join(',')})`).toBe(true);
    expect(pageErrors, `page errors during rhythm entry:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  // The returning-player path above is only half the story: a FIRST-time player instead gets the
  // one-time practice pass, during which `finished` is deliberately true and notes/cues are empty
  // (update() no-ops throughout). The real song only begins when the practice pass's closing tween
  // fires its onComplete -> onDone -> beginRealSong. If that hand-off ever fails to fire, the
  // player is left on a rhythm screen with no notes and no way forward — indistinguishable from
  // "the interface immediately disappears, preventing progress". Nothing covered this path.
  for (const cityId of ['berlin', 'lisbon', 'tokyo', 'mexico_city']) {
    test(`first-time player in ${cityId}: the practice pass hands off to a real, playable song`, async ({ page }) => {
      test.setTimeout(120000);
      const pageErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      // Deliberately NOT seeding seenRhythmTutorial — this is the first-timer path.
      await skipFirstTimeOnboarding(page);
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
      await startScene(page, 'Rhythm', { cityId });
      await waitForActiveScene(page, 'Rhythm', 10000);

      // The practice pass is ~14 beats (roughly 7-9s depending on the song's bpm). Poll in-page
      // so this is measured against the scene's own frames rather than CDP round-trips.
      const handoff = await page.evaluate(async () => {
        const s: any = (window as any).__game.scene.getScene('Rhythm');
        const started = performance.now();
        return await new Promise<any>((resolve) => {
          const tick = () => {
            const elapsed = performance.now() - started;
            if (s.notes.length > 0 && s.finished === false) {
              resolve({ ok: true, afterMs: Math.round(elapsed), notes: s.notes.length, label: s.cityLabel?.text ?? '' });
              return;
            }
            if (elapsed > 45000) {
              resolve({
                ok: false, afterMs: Math.round(elapsed), notes: s.notes.length,
                finished: s.finished, tutorialActive: s.tutorialActive, label: s.cityLabel?.text ?? '',
              });
              return;
            }
            requestAnimationFrame(tick);
          };
          tick();
        });
      });

      console.log(`[practice-pass ${cityId}]`, JSON.stringify(handoff));
      expect(
        handoff.ok,
        `the practice pass never handed off to the real song in ${cityId}: ${JSON.stringify(handoff)}`,
      ).toBe(true);
      expect(handoff.notes, 'the real song should have a non-empty chart').toBeGreaterThan(0);
      expect(pageErrors, `page errors during the first-time rhythm path:\n${pageErrors.join('\n')}`).toEqual([]);
    });
  }

  // THE DISCRIMINATING TEST for the live report "the rhythm game ends in a bad grade and moves
  // on". No-fail design means a totally broken rhythm system is indistinguishable, to the player,
  // from playing badly — so the question is whether a tap that IS on time actually scores.
  //
  // Every existing rhythm assertion in this repo only ever checked that *a judgement was
  // recorded*, never that it was a HIT. Both logged "miss" and passed:
  //   [Item 4a] {"D":"PASS (miss, score 0 -> 0)", ...}   [Item 4b] hold ... graded: miss
  // Those are satisfied by update()'s own auto-miss safety net firing, with the tap contributing
  // nothing — exactly the hole that lets "no input ever registers" ship green.
  //
  // Timed and judged ENTIRELY IN-PAGE: attemptHit() reads this.time.now, which only advances once
  // per rendered frame, so a tap dispatched over CDP (~1s latency here) can never land in a 160ms
  // window. Tapping on the frame closest to the note's hit time removes the transport from the
  // measurement; the assertion is then conditioned on the delta actually achieved, so a harness
  // too slow to land in-window reports inconclusive instead of failing a correct game.
  test('a tap landing inside the timing window scores a HIT, not a miss', async ({ page }) => {
    test.setTimeout(120000);
    await seedReturningRhythmPlayer(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await page.evaluate(() => (window as any).__game.scene.stop('Title'));
    await startScene(page, 'Rhythm', { cityId: 'berlin' });
    await waitForActiveScene(page, 'Rhythm', 10000);
    await page.waitForTimeout(1500);

    const shot = await page.evaluate(async () => {
      const s: any = (window as any).__game.scene.getScene('Rhythm');
      if (!s.notes.length) return { error: 'no chart loaded' };

      // Measure this device's frame interval so we can tap on the frame NEAREST the hit time
      // rather than the first frame past it (which at 4fps could be 250ms late on its own).
      const frameMs: number = await new Promise((resolve) => {
        let last = 0, n = 0, total = 0;
        const tick = (ts: number) => {
          if (last) { total += ts - last; n++; }
          last = ts;
          if (n >= 5) { resolve(total / n); return; }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

      // A plain tap note far enough ahead that we can still get in front of it.
      const target = s.notes
        .filter((ns: any) => !ns.judged && ns.note.type !== 'hold')
        .map((ns: any) => ({ ns, hitMs: s.hitMsFor(ns.note.t) }))
        .filter((c: any) => c.hitMs > s.time.now + Math.max(1200, frameMs * 4))
        .sort((a: any, b: any) => a.hitMs - b.hitMs)[0];
      if (!target) return { error: 'no reachable tap note', frameMs };

      const before = s.judgements.length;
      const scoreBefore = s.score;
      // Fire on the first frame whose clock is within half a frame of the hit time — the closest
      // sample this device can offer.
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (s.time.now + frameMs / 2 >= target.hitMs) { resolve(); return; }
          requestAnimationFrame(tick);
        };
        tick();
      });
      const tappedAt = s.time.now;
      s.attemptHit(target.ns.note.l);

      return {
        frameMs: Math.round(frameMs),
        lane: target.ns.note.l,
        deltaMs: Math.round(tappedAt - target.hitMs),
        judgementsBefore: before,
        judgementsAfter: s.judgements.length,
        lastJudgement: s.judgements[s.judgements.length - 1] ?? null,
        judgedFlag: target.ns.judged,
        scoreBefore,
        scoreAfter: s.score,
      };
    });

    console.log('[timed-tap]', JSON.stringify(shot));
    expect((shot as any).error, `could not run the timed tap: ${(shot as any).error}`).toBeUndefined();
    const r = shot as any;

    // 160ms is the STANDARD 'ok' window (src/const.ts RHYTHM_WINDOWS.ok, scale 1.0); relaxed and
    // wiggleRoom only widen it, so a tap inside 160ms must score under any settings.
    if (Math.abs(r.deltaMs) > 160) {
      // Frame granularity beat us. Say so plainly rather than reporting a pass or a failure.
      console.log(`[timed-tap] INCONCLUSIVE: closest frame was ${r.deltaMs}ms off at ${r.frameMs}ms/frame`);
      test.skip(true, `harness could not land a tap inside 160ms (best ${r.deltaMs}ms at ${r.frameMs}ms/frame)`);
      return;
    }
    expect(
      r.judgementsAfter,
      `a tap ${r.deltaMs}ms from the note recorded NO judgement at all — attemptHit found no note in range`,
    ).toBeGreaterThan(r.judgementsBefore);
    expect(
      r.lastJudgement,
      `a tap only ${r.deltaMs}ms from the note was judged "${r.lastJudgement}" — inside the window, this must score`,
    ).not.toBe('miss');
    expect(r.scoreAfter, 'a scoring hit must increase the score').toBeGreaterThan(r.scoreBefore);
  });

  // THE LIVE BUG, as a regression guard. Reported symptom: every rhythm song and every minigame
  // "appears for a second and leaves" straight back to the VN, with no gameplay at all and an
  // all-miss result. Mechanism: init() reset notes=[] and finished=false but NOT startTime, and
  // longestNoteEndSeconds() returns 0 for an empty chart — so a single update() tick reaching
  // `t > 0 + 1.5` before beginRealSong() ran ended the song on its first frame. t there is the
  // whole elapsed game clock, so the condition is true immediately and always.
  //
  // This drives that exact state directly (empty chart + a song that never started) rather than
  // hoping a texture failure reproduces it, because the trigger is environmental — in production
  // a stale service-worker-cached asset manifest can throw out of create() before beginRealSong.
  // The invariant is what matters and it is unconditional: a song that never started cannot end.
  test('a song that never started can never finish itself', async ({ page }) => {
    test.setTimeout(90000);
    await seedReturningRhythmPlayer(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title', 20000);
    await page.evaluate(() => (window as any).__game.scene.stop('Title'));
    await startScene(page, 'Rhythm', { cityId: 'berlin' });
    await waitForActiveScene(page, 'Rhythm', 10000);
    await page.waitForTimeout(1200);

    const outcome = await page.evaluate(async () => {
      const g: any = (window as any).__game;
      const s: any = g.scene.getScene('Rhythm');
      // Reproduce the pre-beginRealSong state on a live scene: no chart, nothing started.
      s.notes = [];
      s.cues = [];
      s.finished = false;
      s.startTime = 0;
      s.songStarted = false;
      const before = g.scene.getScenes(true).map((x: any) => x.scene.key);
      await new Promise((r) => setTimeout(r, 2500));
      return {
        before,
        after: g.scene.getScenes(true).map((x: any) => x.scene.key),
        finished: s.finished,
      };
    });

    console.log('[never-started]', JSON.stringify(outcome));
    expect(
      outcome.finished,
      'an empty, never-started song finished itself — this is the live "appears for a second and leaves" bug',
    ).toBe(false);
    expect(
      outcome.after,
      `Rhythm bailed to [${outcome.after.join(',')}] without ever starting a song`,
    ).toContain('Rhythm');
  });

  test('the lane tap zones actually respond after entering through the pre-show', async ({ page }) => {
    test.setTimeout(90000);
    await seedReturningRhythmPlayer(page);
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
    await canvasClick(page, 360, 993);
    await waitForCondition(
      page,
      () => (window as any).__game.scene.getScenes(true).some((s: any) => s.scene.key === 'Rhythm'),
      12000,
    );
    await page.waitForTimeout(2500);

    // A real tap in lane 0's zone must reach the handler. If an invisible full-screen blocker
    // outlived the transition, Phaser's topOnly hit test sends the tap there instead and this
    // count never moves — the "frozen/unresponsive" half of the report.
    const before = await page.evaluate(() => (window as any).__game.scene.getScene('Rhythm').judgements.length);
    for (let i = 0; i < 6; i++) {
      await canvasClick(page, 130, 900);
      await page.waitForTimeout(250);
    }
    const after = await page.evaluate(() => (window as any).__game.scene.getScene('Rhythm').judgements.length);
    expect(after, 'tapping a lane after a real pre-show entry must register judgements').toBeGreaterThan(before);
  });
});
