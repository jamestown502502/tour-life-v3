# RESUME PROMPT — Tour Life v3: Verify & Harden (post critical-fix session)

**When to paste:** AFTER Claude finishes its current fix session (the reported critical issues — rhythm/minigame skips, VN text repetition, off-center layout). This prompt VERIFIES those fixes end-to-end, closes whatever remains, hardens regression guards, and answers the two insight questions (testing procedures + token optimization). Read `HANDOFF.md`, `CLAUDE.md`, `docs/CROSS_PLATFORM_TESTING.md` first. **The working tree likely has uncommitted changes from the current session — start with `git status` and commit the in-flight fix before verifying.**

---

```text
You are VERIFYING and HARDENING the critical-issue fixes just made to "Tour Life:
International Dates" (tour-life-v3, Vite + TS strict + Phaser 3.90). A prior session fixed a
transition race and stuck screens; the owner then reported four NEW critical issues: (1)
rhythm and minigames skip gameplay entirely / transitions too fast; (2) VN text repeats
material; (3) the canvas sits on the far right instead of centered; (4) needs a back button
or dialogue log to review missed dialogue. Verify each fix with evidence, close any
remainder, add regression guards, and deliver the two insight docs. NO new cities, NO Part 3
reality layer, NO new systems. Evidence-first: every claim needs a screenshot, console log,
or test.

KNOWN STATE (verified by reading the repo BEFORE this pass):
- src/main.ts scale config was changed to autoCenter: Phaser.Scale.NO_CENTER with a comment
  that index.html's #app is a flex container (display:flex; align-items:center;
  justify-content:center) that centers the canvas. The "far right" report means that CSS
  contract is BROKEN somewhere (likely: #app isn't full-size, a parent has no width/height,
  the canvas has a conflicting inline style, or a recent change added a wrapper). Phaser's own
  docs: with NO_CENTER, centering is entirely the DOM's job; with CENTER_BOTH, Phaser sets
  inline margins that can fight a flex parent — pick ONE mechanism and make it provably
  centered.
- Transition system (src/ui/transition.ts) is goTo(): 250ms fade then scene.start. Themed
  transitions (card/lights/drive) were added in a recent pass — the reported "skips gameplay"
  is consistent with a double-goTo (input during fade starts the target scene twice), a
  transition completing but the target scene's lead-in (RhythmScene startTime = now + 1200ms)
  being consumed by the fade, or a themed transition that starts the scene before the player
  can see the playfield. Investigate ALL of these with a repro, not one.
- RhythmScene: practice-pass/tutorial logic sets finished=true during the demo; beginRealSong
  sets startTime = this.time.now + 1200 and finished=false. If a transition or double-start
  interferes, the song can appear to "skip".
- BacklogPanel exists (close-out Item 3a) with a toggle that had a known collision with the
  Menu gear (fixed by stacking + distinct icons). The owner's report says a dialogue log is
  still missing/needed — verify the backlog is actually reachable and working, and add a BACK
  (rollback) affordance for pure-dialogue nodes.
- Testing stack today: ~112 unit / 22 e2e (smoke + fullrun + dist) / 4 dist-smoke, CI matrix
  (iPhone 12/14, Pixel 7, generic Android) — but there is NO e2e assertion that a rhythm song
  actually plays N seconds of real gameplay (a "skip detector"), NO assertion that a scene/node
  id never repeats within a single run, and NO layout assertion that the canvas is centered.

PART A — VERIFY THE FOUR REPORTED ISSUES (fix any remainder; evidence each):
 A1. RHYTHM + MINIGAME PLAYABILITY: play a real song start-to-finish (autoplay AND a touch
     pass). Assert (test + manual log): the song runs >= ~40s of actual gameplay, notes are
     judged, the per-city stage background renders (Gemini bg_rhythm_<city> if wired, else
     navy fallback), Results follows, and the return to the VN lands on the correct phase
     (afterShow), NOT back at arrival. Also run each minigame start-to-finish and assert the
     same. FIX the skip class: input lockout during any transition (a scene-level "transitioning"
     flag that swallows pointerdown/keyboard until the fade completes — or Phaser's input
     enable/disable on the camera), guard goTo() against double-invocation (a per-scene
     "leaving" flag: if already leaving, ignore), and make the themed transitions NOT advance
     the scene until the fade is fully complete AND the target scene's lead-in is intact.
 A2. VN NO-REPEAT + BACKLOG/BACK: (a) add a runtime + content assertion that a dialogue
     node/scene id is never shown twice within a single run unless it is explicitly authored
     to repeat (check CityScene phase advancement — a stuck progress pointer that doesn't move
     after a minigame/rhythm return is the most likely repetition cause: the same node re-
     renders). (b) Verify the BacklogPanel: reachable in City (the toggle), scrolls, shows the
     last ~30 lines with speaker colors, dismisses. (c) Add a BACK affordance for pure-dialogue
     nodes: a small "‹" button (or swipe-down) that re-renders the previous node WITHOUT
     re-applying its choice effects (a per-node display history, not a re-execution) — Ren'Py
     semantics: rollback must NOT re-run stat/relationship effects; block "back" across
     irreversible points (minigame outcomes, rhythm results, choice applications) and show a
     toast "Can't go back past a choice" if attempted there.
 A3. LAYOUT CENTERING: diagnose why the canvas is not centered (repro at 390x844, 430x932,
     desktop, and against the built dist/). Check: #app size vs viewport, body/html height,
     any inline canvas styles, flexbox behavior with the NO_CENTER canvas. FIX it so the
     canvas center == viewport center within ~2px at every viewport. ANSWER THE ANDROID
     QUESTION in docs/CROSS_PLATFORM_TESTING.md: the same web content runs in the Capacitor
     WebView, so the centering fix applies identically — document that NO_CENTER + a
     correctly-sized flex parent is the recommended pattern (Phaser docs) and that it does NOT
     break the port; the port only needs the same CSS to load (it already ships in index.html).
 A4. TRANSITIONS: walk the full city loop and verify each themed transition (card for minigame
     entry, lights for rhythm entry, drive for travel, fade elsewhere) with the input lockout
     from A1; reducedMotion must fall back to plain fade; no console errors; audio state
     correct at every seam (no double ambience, no stuck duck).

PART B — REGRESSION HARDENING (make these unrepeatable; flaky-test best practices:
 NO hard sleeps — explicit waits or drive logic directly where this sandbox's RAF is
 unreliable; deterministic assertions over timing races):
 B1. e2e no-skip detector: start a rhythm song (autoplay), assert a note was judged AND
     gameplay elapsed >= ~40s before Results appears (a transition that skips gameplay fails
     this). Same for each minigame (>= 15s or round-count reached).
 B2. node-unique-per-run test: extend content.test.ts + a runtime walker — within one city
     visit, no scene/node id plays twice (unless authored repeat); a stuck progress pointer
     fails this.
 B3. centering layout assertion: an e2e/layout.spec.ts that reads canvas.getBoundingClientRect()
     at the 4 viewports and asserts |canvasCenter - viewportCenter| <= 2px.
 B4. transition-lockout test: fire a click during a fade and assert it did NOT double-start
     the target scene (scene count / no duplicate active scenes).
 B5. backlog + back tests: backlog opens and contains the last lines; back re-renders the
     previous node without stat changes (assert stat deltas unchanged); back is blocked past
     a choice/minigame outcome.
 Add these to CI (the matrix already runs e2e on push/PR).

PART C — TESTING PROCEDURES INSIGHT (the "how do we stop this reaching production" answer):
 Write docs/TESTING_PROCEDURES.md documenting: the current stack (unit/e2e/dist + CI matrix),
 the NEW guards from Part B, how to read a CI run (which job covers what), the golden path
 (fullrun.spec.ts) and what it proves, the known sandbox limitations (RAF flakiness -> the
 deterministic strategies used: force:true canvas clicks, direct logic drives, no timing
 races), and the still-manual items (real iPhone/Android device pass, physical key presses,
 hold-rail slow-mo, PWA install on hardware). Be honest about what automation cannot catch
 (visual garble class -> the screenshot sweep artifacts + text-fit gate already in CI).

PART D — TOKEN-OPTIMIZATION STRATEGIES (the "spend fewer tokens" answer):
 Write docs/TOKEN_OPTIMIZATION.md with concrete, repo-specific practices:
 1. Incremental prompts: one focused task per prompt ("fix A3 centering", not "fix everything")
    with the specific file/line cited — Claude re-reads less.
 2. Git-diff-scoped reports: ask for final reports as changed-file lists + key diffs, not
    full-file dumps.
 3. /compact cadence: after every completed part (A/B/C/D), run /compact before the next
    prompt so context stays small.
 4. Same model/provider per session (prompt-cache is invalidated by switching) — never switch
    mid-session.
 5. Targeted tests before the full matrix: run the one new spec locally first; run the full
    e2e matrix only once per push, not per iteration.
 6. Commit-per-fix: each verified fix is its own commit so a future session can review
    `git log --stat` instead of reading everything.
 7. Narrow reads: when a follow-up session needs context, read HANDOFF.md's relevant § + the
    changed files only; the full DESIGN.md is the last resort, not the default.
 8. Batch evidence: screenshots and console dumps in one call, not one per call.

FINAL VERIFY & SHIP:
 1. npm run typecheck && npm test — green (existing + new B1-B5 tests).
 2. npx playwright test + --config=playwright.dist.config.ts — green at all 4 profiles.
 3. Deploy via git push (Vercel auto-deploys; confirm via list_deployments). curl live URL:
    200 + title. On the LIVE url: play one rhythm song end-to-end (no skip), open the
    backlog, verify the canvas is centered, and capture one screenshot per issue as evidence.
 4. Commit the two docs (TESTING_PROCEDURES, TOKEN_OPTIMIZATION) and the PART A fixes with
    before/after evidence.

GUARDRAILS: no new cities, no Part 3 reality layer, no new systems, no audio-file swap,
accessibility + no-fail intact (re-verify the all-miss run after ANY RhythmScene change),
painted-world/code-drawn-UI rule kept, constants in src/const.ts, scene array/Map/Set fields
reset in init(), DialogueBox scenes un-duck in SHUTDOWN, no fillGradientStyle in cached
textures, dialogue nodes <=40 words.

FINISH with: per-issue verification evidence (A1-A4), the B1-B5 tests added + counts, both
insight docs committed, deploy verification, and the honest remainder (hardware-only items on
the owner's checklist).
```
