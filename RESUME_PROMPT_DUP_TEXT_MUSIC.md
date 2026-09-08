# RESUME PROMPT — Tour Life v3: Duplicate-Text Fix (double-start guard) + Per-Minigame Music + Intro-BG Close

**Paste at the next session start.** State: rhythm fixed (Clock fix, 54d437e, live), minigames fixed, CI fully green (256). New live report: **duplicate text** during the intro (bandmates / based on selections made at New Run) **and after minigames**; plus a question: *"should I hear different music during each minigame?"* Root cause identified from the code — see below; verify, fix, test, ship.

---

```text
Duplicate-text pass on "Tour Life: International Dates" (tour-life-v3, HEAD 54d437e, CI green).
Two live reports: (1) duplicate dialogue/text during the intro section and after minigames;
(2) a question about whether each minigame should have its own music.

ROOT CAUSE (verified in the code — confirm, don't re-derive):
src/ui/transition.ts (post-revert, 27 lines) is the simple goTo: camera.fadeOut then
once(FADE_OUT_COMPLETE, () => scene.scene.start(key, data)). It has NO single-flight guard
(the themed layer's WeakSet was removed with the revert). A rapid DOUBLE-TAP on any button
that calls goTo fires fadeOut TWICE and registers TWO FADE_OUT_COMPLETE listeners; when the
fade completes, scene.start runs TWICE — Phaser stops + restarts the same scene — so the
target scene's create() runs twice and its dialogue plays twice. This matches BOTH reports:
- Intro: double-tap on "New Run" (Title) or "Hit the road" (BandCreator) double-starts
  BandCreator/the intro scene -> bandmate/intro text repeats (and repeats differently based
  on selections, since the second create() re-reads state).
- After minigames: double-tap on the minigame's "Continue"/outro button double-starts City ->
  the current phase's dialogue replays.
Also verified: MiniGameScene NEVER calls audio.playAmbience — minigames currently inherit the
city's ambient bed (CityScene plays it at half bpm). So no, each minigame does NOT have
distinct music today; that's a design gap, not a bug.

STEP 1 — SINGLE-FLIGHT GUARD ON goTo (the fix; minimal, no overlays, no watchdog):
 1a. Add a module-level WeakSet<Phaser.Scene> to transition.ts. goTo(): if the scene is
     already in the set, return immediately (the first transition wins); add it on entry;
     delete it inside the FADE_OUT_COMPLETE handler AFTER scene.start (and on the scene's
     SHUTDOWN event, so a scene stopped by another path doesn't leak the guard).
 1b. This is pure hardening — it does NOT reintroduce the themed overlays/blocker/watchdog.
     The simple fade stays. Keep the STABILIZATION REVERT comment; append a line noting the
     single-flight guard was re-added on 2026-09-08 after the double-start duplicate-text
     report.
 DONE-WHEN: two rapid goTo() calls on the same scene start the target exactly once.

STEP 2 — PER-MINIGAME MUSIC (answer the question with a fix; additive, content-driven):
 2a. content/schema.ts: MiniGameDef gains optional chordProgression?: string, bpm?: number,
     waveform?: string (additive; validate if present — reuse musicTheory.parseChordProgression
     semantics; absent = fall back to the city's ambience, current behavior).
 2b. Author a distinct progression per minigame type/city (e.g. Soundcheck = tight major
     pulse; Pack the Van = mid-tempo shuffle; Interview = conversational two-chord bed) in the
     minigame content JSON (the 7 existing minigame entries + any new).
 2c. MiniGameScene: on game start (beginGame), if the def has a chordProgression, call
     audio.playAmbience(parseChordProgression(...), bpm, waveform) (crossfades by the engine);
     on return (applyRewardAndReturn), restore the city's ambience (CityScene already calls
     playAmbience on its own entry — verify the return path triggers it; if the return goes
     through goTo('City', returnPhase), CityScene.init() re-runs and re-calls it — confirm).
 2d. Verify ducking: DialogueBox in the minigame intro/outro still ducks music (the SHUTDOWN
     un-duck rule applies to MiniGameScene if it creates a DialogueBox — check and add).
 DONE-WHEN: each minigame plays a distinct music bed; returning to the VN restores the city
 bed; ducking correct; no console errors.

STEP 3 — DUPLICATE-TEXT REGRESSION TESTS (make it unrepeatable):
 3a. e2e/double-start.spec.ts: (i) rapid double-click (two clicks within 50ms, real mouse
     events) on Title's "New Run" -> assert BandCreator started EXACTLY once (hook: expose a
     dev-only scene-start counter, or assert the intro text appears exactly once in the DOM /
     canvas state); (ii) double-click the minigame's Continue after playing one -> assert the
     City phase text renders once; (iii) same for "Hit the road" (BandCreator -> RoutePlan).
     Each must FAIL without the Step 1 guard and PASS with it (prove it both ways).
 3b. Confirm/add the node-unique-per-run assertion: within one city visit, no scene/node id
     plays twice unless authored (extend content.test.ts or the runtime walker if not
     already covered).
 3c. Run the full local suite (unit + e2e, Pixel 7, 2 consecutive clean runs).
 DONE-WHEN: 3a proves failing-then-passing; 3b green; full suite green.

STEP 4 — INTRO-BG CLOSE (the still-open "weird background" item):
 4a. Fresh New Run on the live URL; screenshot the intro/opening and Title at 390x844 +
     desktop. With the missing-texture console warnings now in place (BootScene lists MISSING
     textures), check the console: if it names a texture, that's the __MISSING-placeholder
     confirmation (addCoverBackground scaling Phaser's placeholder) — fix the manifest/load
     for that key. If no missing-texture warning, capture a screenshot and classify against
     the source assets (bg_title.webp, the opening/cast-faces art) — is it a fallback, an
     art mismatch, or intentional art that reads wrong? Report the classification; fix only
     if it's a fallback/load issue.
 DONE-WHEN: intro renders the intended art with no mystery artifact, and the classification
 is in the report.

STEP 5 — CI, DEPLOY, LIVE VERIFY:
 5a. Push; CI green on the full matrix (build-and-test + e2e all profiles + dist).
 5b. Deploy (confirm READY via list_deployments; don't race the CLI).
 5c. Live verify in Jameson's order: close ALL tabs -> fresh load -> New Run (intro text
     appears ONCE, intro bg correct) -> first city -> first minigame (distinct music, return
     without duplicate text) -> first rhythm (full song, real grade) -> zero console errors.
     Screenshots as evidence.
 DONE-WHEN: live playthrough shows no duplicated text anywhere, distinct minigame music,
 intro bg correct, rhythm full.

GUARDRAILS: no new cities, no Part 3 reality layer, no new systems (the music is an additive
content/schema field + one playAmbience call), no re-adding themed transitions; accessibility
+ no-fail intact; painted-world/code-drawn-UI rule; constants in src/const.ts; scene
array/Map/Set fields reset in init(); DialogueBox scenes un-duck in SHUTDOWN; no
fillGradientStyle in cached textures; dialogue nodes <=40 words; additive save schema only.

FINISH with: the double-start proof (failing-then-passing), the music answer + what changed,
the intro-bg classification, CI result, live-URL verification screenshots, and the honest
remainder.
```
