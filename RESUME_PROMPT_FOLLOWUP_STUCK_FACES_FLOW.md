# RESUME PROMPT — Tour Life v3: Follow-Up Fixes (Stuck Screens · Text Clip · Character Faces · Grounding · Flow)

**Paste this to Claude Code AFTER `RESUME_PROMPT_FINAL_POLISH.md` + `RESUME_PROMPT_FINAL_POLISH_ADDENDUM.md`.** Triggered by a new screenshot of the live build (Berlin pre-show screen) plus four product asks: the game gets stuck on new screens, characters' faces should be seen at the beginning, the game and characters need grounding, and the flow feels random. Apply VN-opening best practices (research cited below). **No new cities, no Part 3 reality layer, no audio-file swap, no new systems.**

---

```text
You are fixing four reported problems on "Tour Life: International Dates" (tour-life-v3, HEAD
after the Addendum v2 pass, commit b9aa5a6). Evidence from a live screenshot of the Berlin
pre-show screen: (1) the middle pre-show button's 2-line label is CLIPPED — the top of the
first line is cut (ascenders of P/l/t/L missing) — while the other two buttons render fine;
(2) the 'lights' transition overlay ("On stage — Berlin" ring) is visible in the same frame,
and the game has been reported getting STUCK on screens. Plus three product asks: see the
characters' FACES at the beginning, ground the game and characters, and make the flow feel
intentional instead of random. Read HANDOFF.md, CLAUDE.md, RESUME_PROMPT_FINAL_POLISH.md, and
RESUME_PROMPT_FINAL_POLISH_ADDENDUM.md first. Work in order; evidence for every claim.

GROUND TRUTH (verified in the code):
- src/ui/Button.ts: labels wrap at width-40px, then font steps down 1px at a time to a 12px
  floor "until it fits" — but the fit check measures text height with a STALE measurement
  (Phaser Text doesn't re-measure until a render pass; freshly created/updated Text returns
  old height, especially with wordWrap + a variable font). The writeup's own text-fit-audit.mjs
  SIMULATES the algorithm (not Phaser) and passed 189/189 — yet the real render clips. That
  mismatch IS the bug: the audit's line-height model under-measures Baloo 2's real ascender
  metrics, so both the runtime fit AND the audit think 2 lines fit in 66px when the real
  render is ~8-10px taller than the button. The reported screen is CityScene's preShowChoices
  (600x66 buttons, 19px labels) — the exact tight case.
- src/ui/transition.ts: themed transitions build an overlay container at depth 500 and
  scene.time.delayedCall(THEMED_DURATION_MS, () => { overlay.destroy(); scene.scene.start(key) }).
  The overlay has NO setInteractive — taps pass through to the buttons underneath during the
  transition. A double-tap on a pre-show choice fires goTo twice: two overlays, two delayedCalls;
  the first fires scene.start (stopping the outgoing scene and killing its clock), so the
  second delayedCall belongs to a stopped scene and never fires — but its overlay is destroyed
  with the scene, so the visible symptom is a RACE (target scene started twice / started from a
  stopped context) and, on a machine where delayedCall is delayed seconds (documented), a
  stuck-looking cover. This is the most likely "screens getting stuck" cause with the new
  themed transitions.
- src/ui/BandCreatorScene.ts: bandmates are rendered as TEXT LINES only
  ("${b.name} — ${b.instrument} — wants ${b.wants}", line 66). The 16 painted portraits
  (portrait_<id>_<mood> in the manifest) EXIST and load, but no portrait is shown anywhere in
  the opening flow. The why-tour picker sets one flag (why_tour_funeral_promise -> Lisbon
  journal branch) and is otherwise decorative.
- Flow: Title -> BandCreator (text-only cast) -> RoutePlan (seeded random order) -> Hub ->
  cities (minigame at arrival + pre-show, themed transitions). Nothing states the run's intent,
  who these people are, or why this tour matters — hence "random."

VN-OPENING BEST PRACTICES (research, apply these):
- Hook in the first ~2 minutes; introduce the main cast WITH FACES and distinct voices; state
  the stakes/why early; short beats, no info-dump; the opening should make the player care who
  they're traveling with (r/vndevs "best way to start a VN", twoandahalfstudios' VN guide,
  "Writing Great Visual Novel Characters" — character beats before plot beats).
- The opening should ground the player: who am I, who am I with, why are we doing this, what
  could go wrong — answered in the first scene, not drip-fed (Lemma Soft "when should the main
  character introduce themselves").

ITEM A — FIX THE VERTICAL TEXT-CLIP CLASS (the reported screenshot).
 1. Root-cause first with an isolated repro: create a scratch scene (or browser-console test)
    that renders the exact reported label ("Play it loose. Let the room set the tempo tonight",
    19px, Baloo 2 700, 600x66 button) and measure the REAL rendered text height after
    updateText(). Compare against the audit's simulated height. Write the numbers down.
 2. Fix Button.ts: after setting wordWrap width and before/after each font-size step, force a
    synchronous re-measure (text.updateText() or read text.height AFTER a render-forced
    measure) and fit against h - 12 (inner padding). If even the 12px floor is taller than the
    button, GROW the button height (re-bake the bg texture taller, e.g. +16px, and offset the
    shadow/hoverGlow/selectedRing to match) so no label can ever be clipped vertically. The
    container's hit area must match the new height (Rectangle.Contains already parameterized).
 3. Fix the audit's model: scripts/text-fit-audit.mjs must use the REAL measured line-height
    factor for Baloo 2 700 (measure it once from the font file or from a Phaser render and
    hard-code the ascent/line factor; add a comment with the measurement method) instead of a
    generic estimate. Re-run: it must FAIL on the reported label's current 66px button and PASS
    after the fix — proving the gate now models reality.
 4. Pre-show buttons specifically: verify all 4 cities' preShowChoice labels fit at the fixed
    height at 390x844 and desktop; bump CityScene's pre-show button height if the labels are
    naturally 2-line.
 5. Sweep: re-run e2e/text-fit-sweep.spec.ts (extend it to assert no vertical clip — compare
    label bounds vs button bounds — not just non-zero bounds).
 EVIDENCE: before/after screenshots of the exact reported screen (Berlin pre-show, middle
 button) at 390x844 and desktop; the measured-height numbers; audit failing-then-passing.
 DONE-WHEN: the reported button renders both lines fully inside the button at both viewports;
 no button in the game clips vertically (sweep green); audit gate models real metrics.

ITEM B — STUCK-SCREEN HARDENING (themed transitions + resume phases).
 1. transition.ts: (a) the themed overlay gets a full-screen setInteractive() input-block that
    stopPropagation()s every pointer event (no taps reach buttons during a transition);
    (b) add a module-level single-flight guard — if a transition is already in progress, a new
    goTo() call is ignored (or, if to a different key, queued once) instead of racing;
    (c) make completion idempotent + watchdogged: both the delayedCall AND a scene-level
    hard-fallback delayedCall at ~5x duration force-complete exactly once (overlay.destroy +
    scene.start), so a delayed clock can never leave a stuck cover; (d) the 'card'/'lights'/
    'drive' overlays must be destroyed in the outgoing scene's SHUTDOWN if still present.
 2. Resume-phase audit: every phase value CityScene/MiniGameScene/HowToPlay/Backlog can write
    to progress.screen must be in resumeTarget()'s switch AND CityScene's sanitize allowlist —
    add 'preshow-choices' (the new minigame return phase) and any phase added by Addendum v2.
    A save written mid-minigame or mid-preshow must resume to a playable state, never a dead
    one.
 3. Escape-hatch regression: every screen reachable in a run (Title, BandCreator, RoutePlan,
    Hub, City, MiniGame, Rhythm, Results, Scrapbook, Settings, HowToPlay, Backlog) must have a
    working Back / Quit-to-Title path — re-audit after this change (the Addendum v2 pass added
    Menu buttons everywhere; confirm none was broken by the transition guard).
 4. Tests: (a) a deterministic transition-race test — fire goTo twice rapidly (double-tap
    simulation on a pre-show choice) and assert exactly ONE scene.start and no stuck overlay;
    (b) resume from every progress.screen value including 'preshow-choices' and mid-minigame;
    (c) e2e fullrun still green end-to-end (the transition guard must not break the golden
    path).
 EVIDENCE: the double-tap repro before (stuck/race) vs after (single clean transition);
 resume-path table.
 DONE-WHEN: rapid double-taps on any transitioned button land exactly once, never stuck; every
 progress.screen value resumes playable; escape hatches all work; tests + fullrun green.

ITEM C — CHARACTERS' FACES AT THE BEGINNING (the painted portraits already exist — show them).
 1. BandCreator cast row: replace the plain text member lines with a face-first cast display —
    each bandmate's EXISTING painted portrait (portrait_<id>_happy via ensurePortrait/manifest)
    in the portrait frame, with name + instrument + one-line "wants" under it. Face first,
    text second. Tap a face (or a small "Meet the band" button) -> a DialogueBox beat with that
    member's voice line using their painted portrait and mood (worried for Mira, etc.) — the
    cast introduces THEMSELVES.
 2. Opening micro-scene (diegetic, ~90 seconds, follows VN best practice: hook, faces, voices,
    stakes, no info-dump): after BandCreator's "Hit the road" (or before RoutePlan), a short
    "The night before the tour" scene — 4 short beats, one per bandmate (portrait + name + one
    or two lines each: their fear/hope for the tour), closing with the why-tour beat the player
    picked ("Because of <why tour>, we're doing this.") — written into the city/band content as
    gated dialogue (content JSON, node-level, uses existing portraits; each beat <=40 words).
    First-time players get it automatically (persistent onboarding flag, like HowToPlay);
    returning players can skip (a "Skip intro" button appears after the first beat).
 3. WHY_TOUR grounding: the picked why-tour beat now feeds the opening scene's closing line AND
    appears as a one-line echo on RoutePlan ("You're touring because: <why>") and in the
    Scrapbook epilogue — the choice stops being decorative and grounds the whole run.
 EVIDENCE: before (text-only cast) vs after (portrait row + tap-for-voice) screenshots; the
 opening scene screenshots; fresh-run time-to-see-all-4-faces measured (target: < 60s).
 DONE-WHEN: a new player sees all 4 bandmates' faces within the first minute of a run; each
 introduces themselves once; why-tour echoes in opening + RoutePlan + epilogue; skip works;
 tests green (new content nodes validated by content.test.ts).

ITEM D — GROUND THE GAME & FIX THE RANDOM FLOW (a through-line for every run).
 1. Route narrative framing: RoutePlan already orders the route; surface the arc — first city
    labeled "the opener" (get your legs), the city where the mid-tour complication fires
    labeled with the complication's line, last city labeled "the one that matters" (its
    storyGate/venue reads as the finale). One framing line per stop under its name; seeded but
    PRESENTED as intentional (the narrative reads the seed, not vice versa).
 2. Connective tissue at transitions: the themed transitions already take a line — pass a
    through-line reference instead of a bare venue name: 'card' lines reference the run's
    why-tour or the previous city ("From the neon of Tokyo to the rain of Berlin."), the Hub
    objective line shows the current city + why it matters on this run. The flow stops feeling
    random because every moment names its place in the run's story.
 3. Minigame placement: minigame intro lines reference the city's current narrative beat +
    the why-tour flag when set (they already land at arrival/pre-show; make the INTRO diegetic
    to the run's through-line, not generic). At most one new line per minigame.
 4. Verify by playing two full seeded runs with different why-tour picks: the opening, route
    framing, transition lines, and epilogue must READ as different tours, not the same text
    with different order.
 EVIDENCE: screenshots of RoutePlan framing, two transition lines, Hub objective, epilogue
 echo for two different why-tour picks.
 DONE-WHEN: a fresh run has a traceable through-line (opening intent -> framed route ->
 connective transitions -> epilogue echo) that differs across why-tour picks; content tests
 green.

FINAL VERIFY:
 1. npm run typecheck && npm test — green (existing + new tests from A/B/C/D).
 2. scripts/text-fit-audit.mjs — green with the corrected model (fails on the old geometry,
    passes on the fixed one — show both).
 3. npx playwright test + --config=playwright.dist.config.ts — green (extended sweep + the
    transition-race test + fullrun).
 4. Deploy via git push (Vercel auto-deploys; confirm via list_deployments if unsure). curl
    live URL 200 + title correct. On the LIVE url: Berlin pre-show renders both lines unclipped;
    double-tap a pre-show choice lands once; a fresh run shows the cast faces in the first
    minute.
 5. Real-hardware items (iPhone/Android) go on the owner's checklist, not "verified".

GUARDRAILS: no new cities, no Part 3 reality layer, no audio swap, no new systems; painted-
world/code-drawn-UI kept (portraits are already painted — just shown now); accessibility +
no-fail intact (re-verify all-miss rhythm run); node text <=40 words; evidence for every
claim; root causes documented, not patched.

FINISH with: per-item evidence (A: measured heights + before/after screenshot; B: race repro
+ resume table; C: cast row + opening scene screenshots + time-to-faces; D: through-line
screenshots for two why-tour picks), test counts, deploy verification, honest remainder.
```
