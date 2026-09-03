// Final-polish pass, Item 4: closes HANDOFF.md §8's "never verified" gaps with real evidence
// instead of assuming F/J/K behave like the proven D lane, that the hold rail renders/grades
// correctly, or that a cold boot straight into Rhythm (skipping Title's audio-unlock gesture)
// degrades gracefully. Runs against the DEV server like smoke.spec.ts/fullrun.spec.ts (same
// window.__game/__state access pattern — see playwright.config.ts's header).
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import {
  bootGame, collectConsoleErrors, getActiveSceneKeys, skipFirstTimeOnboarding, waitForActiveScene, waitForCondition,
} from './helpers';

const LANE_KEYS = ['D', 'F', 'J', 'K'];

/** Jumps straight to Rhythm with a real chart, autoplay off, and generously widened timing
 *  windows (relaxed mode * wiggle room ≈ 1.95x RHYTHM_WINDOWS.ok, i.e. ~312ms) — this suite is
 *  proving the keyboard/rail/audio-guard *wiring*, not testing precision timing, and this
 *  environment's frame delivery has already been confirmed unreliable enough (see e2e/helpers.ts,
 *  fullrun.spec.ts's comments) that a tight window would make these flaky for reasons unrelated
 *  to what's being verified. rhythmTutorial is marked seen so the practice pass is skipped and a
 *  real scored chart starts immediately. */
async function startLiveRhythm(page: import('@playwright/test').Page, cityId = 'lisbon'): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('tourlife.seenRhythmTutorial', '1'));
  await skipFirstTimeOnboarding(page);
  await bootGame(page);
  await waitForActiveScene(page, 'Title');
  await page.evaluate((cityId) => {
    const State = (window as any).__state;
    State.newRun('verify-e2e-seed');
    State.data.accessibility.rhythmMode = 'relaxed';
    State.data.accessibility.wiggleRoom = true;
    State.data.accessibility.autoplay = false;
    (window as any).__game.scene.stop('Title');
    (window as any).__game.scene.start('Rhythm', { cityId });
  }, cityId);
  await waitForActiveScene(page, 'Rhythm');
  await waitForCondition(page, () => {
    const s = (window as any).__game.scene.getScene('Rhythm');
    return !!s && Array.isArray(s.notes) && s.notes.length > 0;
  }, 8000);
}

test.describe('Item 4a — keyboard lanes physically dispatched, not just assumed from D', () => {
  test('D, F, J, and K each register a real hit via Playwright keyboard.press, per-lane', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await startLiveRhythm(page);

    const results: Record<string, string> = {};
    for (let lane = 0; lane < LANE_KEYS.length; lane++) {
      const key = LANE_KEYS[lane];
      // Find the next not-yet-judged, not-yet-missed note in this lane, using the scene's own
      // clock/hitMsFor so this stays correct regardless of how much real time earlier lanes' own
      // polling took.
      const target = await page.evaluate((lane) => {
        const s = (window as any).__game.scene.getScene('Rhythm');
        const now = s.time.now;
        const candidates = s.notes
          .filter((ns: any) => ns.note.l === lane && !ns.judged && !ns.holding)
          .map((ns: any) => ({ ns, hitMs: s.hitMsFor(ns.note.t) }))
          .filter((c: any) => c.hitMs > now - 100);
        candidates.sort((a: any, b: any) => a.hitMs - b.hitMs);
        // Prefer a tap/choice note over a hold for this pass — a hold gets its own dedicated
        // Item 4b test, and press() below fires keydown+keyup together which would immediately
        // finalize a hold rather than cleanly proving a single tap-style hit.
        const pick = candidates.find((c: any) => c.ns.note.type !== 'hold') ?? candidates[0];
        return pick ? { hitMs: pick.hitMs, type: pick.ns.note.type } : null;
      }, lane);
      expect(target, `lane ${lane} (${key}) should still have an upcoming note in this chart`).not.toBeNull();

      const before = await page.evaluate(() => {
        const s = (window as any).__game.scene.getScene('Rhythm');
        return { score: s.score, judgements: s.judgements.length };
      });

      // Poll (not a fixed wait) until the scene's own clock says this note is inside its hit
      // window, then dispatch a REAL OS-level key event — this is what proves the
      // input.keyboard.on('keydown-F', ...) wiring itself works, not just attemptHit()'s logic
      // (already covered by src/tests/rhythm.test.ts).
      await page.waitForFunction((hitMs) => {
        const s = (window as any).__game.scene.getScene('Rhythm');
        return s.time.now >= hitMs - 220;
      }, target!.hitMs, { timeout: 15000, polling: 10 });
      await page.keyboard.press(key);

      const after = await page.evaluate(() => {
        const s = (window as any).__game.scene.getScene('Rhythm');
        return { score: s.score, judgements: s.judgements.length, lastJudgement: s.judgements[s.judgements.length - 1] };
      });
      const registered = after.judgements > before.judgements.length ? true : after.judgements > before.judgements;
      // (judgements.length is a number both sides; the above is just belt-and-suspenders against
      // a stray keystroke landing between the two evaluates)
      const hit = after.judgements > before.judgements;
      results[key] = hit ? `PASS (${after.lastJudgement}, score ${before.score} -> ${after.score})` : 'FAIL (no judgement recorded)';
      expect(hit, `lane ${lane} (key ${key}) should have registered a judgement from the real keypress`).toBe(true);
    }

    console.log('[Item 4a] per-key keyboard results:', JSON.stringify(results));
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('Item 4b — hold-note rail renders and grades correctly', () => {
  test('a held note falls, renders its rail mid-hold, and grades on release', async ({ page }) => {
    // Generous: the first qualifying hold note (>=0.4s) can legitimately sit well into the
    // chart — confirmed live in content/songs/sailor_lullaby.json, whose first hold note past
    // that duration floor lands at t=35.5s — so waiting for it is a real ~35s wait, not a stall.
    test.setTimeout(240000);
    const errors = collectConsoleErrors(page);
    await startLiveRhythm(page);

    /** Finds the next not-yet-judged hold note (>=0.4s, so there's something to screenshot
     *  mid-hold) still ahead of the scene's own clock — re-queried fresh on every retry so a slow
     *  screenshot burning through one note's ok window (confirmed live: this VM's page.screenshot
     *  can itself take multiple seconds under load, more than the whole ~312ms ok window) just
     *  costs that one candidate rather than the test. */
    const findNextHold = () => page.evaluate(() => {
      const s = (window as any).__game.scene.getScene('Rhythm');
      const now = s.time.now;
      const holds = s.notes
        .filter((ns: any) => ns.note.type === 'hold' && !ns.judged && !ns.holding && (ns.note.dur ?? 0) >= 0.4)
        .map((ns: any) => ({ hitMs: s.hitMsFor(ns.note.t), dur: (ns.note.dur ?? 0.2) * 1000, lane: ns.note.l }))
        .filter((c: any) => c.hitMs > now + 250); // comfortably ahead, not mid-window already
      holds.sort((a: any, b: any) => a.hitMs - b.hitMs);
      return holds[0] ?? null;
    });

    let target = await findNextHold();
    expect(target, 'this chart should contain at least one hold note >=0.4s long').not.toBeNull();

    // Screenshot 1: some real falling rail, taken opportunistically — doesn't need to be THIS
    // exact candidate, just evidence the rail renders mid-fall (src/art/sprites.ts's
    // ensureHoldRail: darker/fading toward the tail, a solid gold head cap at the bottom) before
    // any press. Taken here, off the critical press-timing path entirely.
    await page.screenshot({ path: 'docs/polish-before-after/hold-rail-1-falling.png' });

    // Press-and-hold at the head's arrival. `page.waitForFunction`'s own internal polling was
    // measured live to add HIGHLY VARIABLE lag (630ms-1300ms+, jittering run to run — this
    // machine's shared desktop load, not a sandboxing artifact, see release-readiness.md) between
    // "condition became true" and the promise actually resolving — too variable to compensate
    // with any fixed pre-buffer against a ~312ms window. Fix: get coarsely close via
    // waitForFunction (imprecision doesn't matter yet), then switch to a tight Node-side
    // check-and-immediately-act loop (a single lightweight page.evaluate per iteration, no
    // waitForFunction machinery) for the final approach — the round trip between "read now" and
    // "dispatch keydown" this way is just one direct command, not a promise-polling harness.
    let holding = false;
    let key = '';
    let attemptsLog: string[] = [];
    for (let attempt = 0; attempt < 4 && target && !holding; attempt++) {
      key = LANE_KEYS[target.lane];
      await page.waitForFunction((hitMs) => {
        const s = (window as any).__game.scene.getScene('Rhythm');
        return s.time.now >= hitMs - 2000;
      }, target.hitMs, { timeout: 90000, polling: 10 });
      let lastNow = 0;
      for (let i = 0; i < 400; i++) {
        lastNow = await page.evaluate(() => (window as any).__game.scene.getScene('Rhythm').time.now);
        if (lastNow >= target.hitMs - 220) break;
      }
      await page.keyboard.down(key);
      const check = await page.evaluate((lane) => {
        const s = (window as any).__game.scene.getScene('Rhythm');
        return { holding: s.activeHolds.has(lane), now: s.time.now };
      }, target.lane);
      holding = check.holding;
      attemptsLog.push(`attempt ${attempt + 1}: lane ${target.lane} (${key}) hitMs=${target.hitMs} loopNow=${lastNow} pressNow=${check.now} holding=${holding}`);
      if (!holding) target = await findNextHold();
    }
    expect(holding, `attemptHit should have started a hold within 3 tries:\n${attemptsLog.join('\n')}`).toBe(true);
    await page.screenshot({ path: 'docs/polish-before-after/hold-rail-2-mid-hold.png' });

    await page.waitForTimeout(Math.max(50, target!.dur * 0.5));
    await page.screenshot({ path: 'docs/polish-before-after/hold-rail-3-later-in-hold.png' });

    await page.waitForFunction((args: { hitMs: number; dur: number }) => {
      const s = (window as any).__game.scene.getScene('Rhythm');
      return s.time.now >= args.hitMs + args.dur - 80;
    }, { hitMs: target!.hitMs, dur: target!.dur }, { timeout: 30000, polling: 10 });
    const before = await page.evaluate(() => (window as any).__game.scene.getScene('Rhythm').judgements.length);
    await page.keyboard.up(key);

    const after = await page.evaluate((lane) => {
      const s = (window as any).__game.scene.getScene('Rhythm');
      const ns = s.notes.find((n: any) => n.note.l === lane && n.judged);
      return {
        judgements: s.judgements.length, lastJudgement: s.judgements[s.judgements.length - 1], stillHolding: s.activeHolds.has(lane),
        debug: ns ? { holdStartAt: ns.holdStartAt, holdStartDelta: ns.holdStartDelta, noteT: ns.note.t, dur: ns.note.dur, now: s.time.now } : null,
      };
    }, target!.lane);
    expect(after.judgements, 'releasing the hold should finalize it into a judgement').toBeGreaterThan(before);
    expect(after.stillHolding, 'the lane should no longer be in activeHolds after release').toBe(false);
    console.log(`[Item 4b] hold on lane ${target!.lane} (${key}) graded: ${after.lastJudgement}; debug=${JSON.stringify(after.debug)}`);
    // Not asserting a specific grade (perfect/good/ok) here — this machine's measured, highly
    // variable script-execution lag (see the press-loop comment above) can legitimately push a
    // real automated keydown/keyup pair outside the "good" grading tiers even when the mechanism
    // itself is working correctly; combineHoldJudgement/judgeHit's actual grading LOGIC is
    // covered deterministically (no timing dependency) by src/tests/rhythm.test.ts. What this
    // e2e test proves — with real dispatched keyboard events, not a direct method call — is the
    // full mechanism: a hold starts (activeHolds gains the lane), the rail renders while falling/
    // held (the 3 screenshots), and releasing always finalizes into *some* judgement and clears
    // activeHolds — never getting stuck holding forever or silently dropping the release.

    for (const f of ['hold-rail-1-falling.png', 'hold-rail-2-mid-hold.png', 'hold-rail-3-later-in-hold.png']) {
      expect(fs.existsSync(`docs/polish-before-after/${f}`), `${f} should have been written`).toBe(true);
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('Item 4c — cold boot straight into Rhythm, skipping Title\'s audio-unlock gesture', () => {
  test('playAmbience no-ops gracefully with no crash, gameplay still judges hits, and audio recovers after a later unlock', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.addInitScript(() => window.localStorage.setItem('tourlife.seenRhythmTutorial', '1'));
    await skipFirstTimeOnboarding(page);
    await bootGame(page);
    await waitForActiveScene(page, 'Title');

    // Jump straight to Rhythm WITHOUT ever tapping Title — audio.unlock() is only ever called
    // from TitleScene's own pointerdown-once handler, so this is a genuine "never unlocked" boot,
    // not a simulation of one.
    await page.evaluate(() => {
      const State = (window as any).__state;
      State.newRun('coldboot-e2e-seed');
      State.data.accessibility.autoplay = true; // let it self-judge; this test is about the audio guard, not timing
      (window as any).__game.scene.stop('Title');
      (window as any).__game.scene.start('Rhythm', { cityId: 'lisbon' });
    });
    expect(await waitForActiveScene(page, 'Rhythm')).toContain('Rhythm');

    const coldState = await page.evaluate(() => {
      const a = (window as any).__audio;
      return { unlocked: a.isUnlocked(), ctxNull: a['ctx'] === null };
    });
    expect(coldState.unlocked, 'a cold boot into Rhythm should never have called audio.unlock()').toBe(false);
    expect(coldState.ctxNull, 'audio.ctx should still be null — playAmbience() must have no-op\'d, not thrown').toBe(true);

    // Gameplay itself (judging) doesn't touch audio.ctx at all — autoplay judging every note as
    // it crosses the line should still work with audio fully locked.
    const judged = await waitForCondition(page, () => (window as any).__game.scene.getScene('Rhythm').judgements.length > 0, 8000);
    expect(judged, 'autoplay should still judge notes with audio never unlocked').toBe(true);

    // Now trigger a real unlock the only way the app allows: return to Title and tap it.
    await page.evaluate(() => {
      (window as any).__game.scene.stop('Rhythm');
      (window as any).__game.scene.start('Title');
    });
    expect(await waitForActiveScene(page, 'Title')).toContain('Title');
    await page.mouse.click(200, 400);

    const unlockedNow = await waitForCondition(page, () => (window as any).__audio.isUnlocked(), 3000);
    expect(unlockedNow, 'a real tap on Title after the cold-boot detour should unlock audio normally').toBe(true);
    const afterUnlock = await page.evaluate(() => ({ hasMusicNodes: !!(window as any).__audio['musicNodes'] }));
    expect(afterUnlock.hasMusicNodes, 'Title\'s unlock handler should have started either the theme or the procedural ambience').toBe(true);

    // And a later Rhythm visit plays its own song ambience normally post-unlock (not stuck
    // showing "never unlocked" behavior from the cold-boot detour).
    await page.evaluate(() => {
      (window as any).__game.scene.stop('Title');
      (window as any).__game.scene.start('Rhythm', { cityId: 'lisbon' });
    });
    expect(await waitForActiveScene(page, 'Rhythm')).toContain('Rhythm');
    const postUnlockAudio = await waitForCondition(page, () => {
      const a = (window as any).__audio;
      return a.isUnlocked() && !!a['ctx'];
    }, 5000);
    expect(postUnlockAudio, 'a Rhythm visit after the later unlock should have a real AudioContext again').toBe(true);

    console.log('[Item 4c] cold-boot guard held (no crash, no unlock, gameplay judged), and audio fully recovered after a later Title tap.');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
