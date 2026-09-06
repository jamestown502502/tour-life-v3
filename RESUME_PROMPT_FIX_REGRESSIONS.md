# RESUME PROMPT — Tour Life v3: Live-Regression Fix (drag minigame, rhythm entry, VN flash elements)

**Paste this at the start of the next session.** Three NEW live-reported regressions after commit e7b5991 (which CI showed green): (1) drag-and-drop minigames malfunctioning; (2) entering rhythm gameplay — the interface immediately disappears, preventing progress; (3) random visual elements in VN portions appear/disappear too quickly — unclear if intentional, loading, or transition error. **Reproduce each with a failing e2e test FIRST (real input, not logic-bypass), then fix the root cause, then keep the test.** Evidence-first; no new cities, no Part 3 reality layer, no new systems.

---

```text
Three live regressions on "Tour Life: International Dates" (tour-life-v3, HEAD e7b5991, CI
green). CI being green proves the e2e suite does NOT cover these paths with real input —
that gap is the root problem. For EACH issue: write a failing test that drives the REAL
interaction, watch it fail, fix the root cause, watch it pass. No logic-layer bypass for
these three (the resume/no-skip tests legitimately bypass; these must not).

KNOWN MECHANISMS FROM THE CODE (verify each, don't assume):
- Transition system (src/ui/transition.ts): goTo() now has a full-screen input BLOCKER
  (alpha 0.001, depth 1000, setInteractive) destroyed on complete(), a single-flight WeakSet
  (transitioning), a 5x watchdog delayedCall, and a SHUTDOWN cleanup. A blocker that is NOT
  destroyed in some path leaves an invisible full-screen input eater alive -> nothing under
  it is ever interactive again (taps land on it, topOnly wins). PRIME SUSPECT for (2) and
  possibly (1). Audit EVERY exit path from goTo (complete, SHUTDOWN, scene.stop() from tests,
  a scene started by some other path while mid-transition) and add a post-transition
  assertion: after every goTo, no object at depth >= 500 with interactive=true remains alive.
- Rhythm entry (CityScene.ts ~line 405): goTo('Rhythm', {cityId}, {transition:'lights', line}).
  RhythmScene.create() -> if hasSeenRhythmTutorial() is true, beginRealSong immediately:
  startTime = now + 1200, notes = arrangement.notes. If pickArrangement returns an
  arrangement with EMPTY notes (a chart regeneration changed arrangement ids and the city
  JSON's storyGate arrangement id no longer matches, or the fallback chain returns a broken
  arrangement), longestNoteEndSeconds() = 0 -> update() calls finish() at t > 1.5s ->
  INSTANT transition to Results: exactly "the interface immediately disappears, preventing
  progress." ALSO verify the 'lights' overlay itself clears (same blocker/overlay audit) and
  that the practice-pass demo path can't crash on a returning player (tutorialActive is
  false -> no demo -> song starts; any crash in create() from the new painted crowd/stage
  textures (manifest keys crowd_*/bg_rhythm_*) leaves a frozen scene.
- Pack the Van drag (MiniGameScene.ts): native Phaser drag (setInteractive({draggable:true})
  + drag/dragend). Suspects: (a) a lingering blocker eating pointerdown so drag never begins;
  (b) the menu/backlog gear buttons overlapping the drag field (they were stacked at top-
  left — verify the drag area is clear of interactive UI); (c) the second-minigame insertion
  (addendum v2 Item 8: returnPhase 'preshow') entering the scene with stale state (scene
  instance reuse — any array/Map/Set field must reset in init()); (d) an item chip whose
  hit area shrank (Button-style pad changes don't apply to chips, but check the chip size at
  the measured 0.5417x scale — is a drag target >= 44 CSS px?). Reproduce with REAL pointer
  events (Playwright mouse down/move/up across the screen, not dispatchEvent).
- VN "random visual elements" (3): candidates from the recent passes — the themed transition
  overlays (card/lights/drive at depth 500) flashing at phase boundaries; the location color-
  grade overlay (CityScene.setLocationGrade tint) fading in/out on location changes; fireflies
  spawning at scene start; the back button (new) and backlog "=" toggle appearing; the
  portrait bob + chevron (INTENTIONAL — don't remove). Identify which element the player
  means by stepping through a city with Playwright's clock (or slow playback) and
  screenshotting each phase boundary; determine per element: intentional / bug / polish.
  Intentional beats that read as errors are a UX failure too — make them legible (fade
  clearly, add a beat label) or remove them if they add nothing.

ITEM A — REPRODUCE FIRST (3 failing tests, committed BEFORE fixes):
 A1. e2e/drag.spec.ts: full Pack the Van flow with REAL pointer drags (mouse down on an item,
     move to a slot, up) -> assert the item lands in the slot and the countdown completes.
     Run it at Pixel 7 profile. Watch it fail with the live symptom.
 A2. e2e/rhythm-entry.spec.ts: enter Rhythm the REAL way (CityScene preshow -> goTo) for a
     RETURNING player (hasSeenRhythmTutorial true — seed the onboarding flag), assert: lanes/
     notes/HUD/city label visible within 3s; the song does NOT transition to Results before
     20s; zero pageerrors. Watch it fail (either instant-finish or frozen scene).
 A3. e2e/no-leftover-overlay.spec.ts: after EVERY goTo in the city loop, assert no
     interactive object at depth >= 500 remains (the blocker/overlay leak detector). Plus
     VN-flash capture: step the city with the clock, screenshot each phase boundary, and
     record which element appears/disappears (this is evidence for A4).
 A4. VN element triage (not a test yet): from A3's screenshots, classify each appearing/
     disappearing element as intentional / bug / polish, list them in the fix report, and
     decide per element (keep with clearer affordance / remove / fix).
 DONE-WHEN: A1-A3 fail with the exact reported symptoms; A4 has the triage list.

ITEM B — FIX THE ROOT CAUSES (one at a time, tests from A go green as each lands):
 B1. Transition blocker/overlay leak: audit every path; make destruction unconditional and
     idempotent (a single destroyLeaves() that runs on complete, SHUTDOWN, and scene.stop);
     add a dev-time assertion (throw in dev if a depth>=500 interactive object outlives a
     scene's shutdown) so a leak is caught at the source, not in e2e.
 B2. Rhythm entry: fix whatever A2 exposes (empty-arrangement instant-finish: harden
     pickArrangement's fallback to ALWAYS return the default arrangement when the gated id
     is missing AND the chart is non-empty; add a dev warning when a city JSON references an
     arrangement id that doesn't exist; if the crash is a texture key, fix the manifest).
     Add a content check: every city's storyGate arrangement id must exist in its song
     (content.test.ts).
 B3. Drag minigame: fix whatever A1 exposes (blocker leak is covered by B1; if it's
     overlapping UI, move the drag field clear; if it's scene-instance state, reset in
     init(); if it's hit-target size, size the chips up). Re-verify at 390px width.
 B4. VN element triage actions from A4: implement the decisions (clearer affordance for
     intentional beats — e.g. a small "Next: <city>" label on the card transition, longer
     min-visible time so a beat can't flash; remove or fix actual bugs like a location-grade
     overlay that double-fades).
 DONE-WHEN: A1-A3 pass; A4 decisions implemented; the full city loop (fullrun.spec.ts) is
 green; 128 unit + all e2e green locally.

ITEM C — CLOSE THE CI-GREEN-BUT-BROKEN-LIVE GAP (permanent):
 C1. The three new spec files run in CI (they're in e2e/, picked up by the matrix).
 C2. Add to docs/TESTING_PROCEDURES.md: the new rule — gameplay-mechanic changes REQUIRE a
     real-input e2e test (drag/pointer/rhythm-entry), logic-bypass tests are for state
     logic only; and a "transition leak" assertion pattern for any future transition work.
 C3. Run the FULL matrix locally (Pixel 7) 2x + push; confirm CI green (all profiles).
 DONE-WHEN: CI green on this push including A1-A3; TESTING_PROCEDURES updated.

ITEM D — REDEPLOY + LIVE CONFIRM:
 D1. git push (Vercel auto-deploys; confirm READY via list_deployments, don't race the CLI).
 D2. On the LIVE url: play Pack the Van to completion (drag works), enter rhythm and play
     >= 20s (interface stays), step a city and screenshot the phase boundaries (no mystery
     flashes), zero console errors. Screenshots as evidence.
 D3. Report the final tally (unit/e2e counts, all green) and a one-line verdict.

GUARDRAILS: no new cities, no Part 3 reality layer, no new systems; accessibility + no-fail
intact (re-verify the all-miss rhythm run); painted-world/code-drawn-UI rule; constants in
src/const.ts; scene array/Map/Set fields reset in init(); DialogueBox scenes un-duck in
SHUTDOWN; no fillGradientStyle in cached textures; dialogue nodes <=40 words; additive save
schema only. Do NOT delete/skip the flaky hold-rail test (already fixed deterministically).

FINISH with: per-issue repro evidence (failing-then-passing test output), root-cause
writeups, the VN element triage table with decisions, CI result, live-URL verification, and
the honest remainder. Answer explicitly: what was a real bug, what was intentional content
that read as a bug, and what the new CI rules prevent going forward.
```
