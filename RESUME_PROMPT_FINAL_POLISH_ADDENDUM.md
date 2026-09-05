# RESUME PROMPT — Tour Life v3: Final Polish ADDENDUM v2 (Text Audit · Dynamic Crowds · More Minigames · Transitions · Rhythm Stages)

**Read this AFTER `RESUME_PROMPT_FINAL_POLISH.md` (the 5-item final pass) and BEFORE touching code.** This addendum v2 supersedes addendum v1 and adds FIVE items (6–10) to that pass. Triggered by a live bug report (garbled minigame text — screenshot) plus three new product asks: minigames more often and story-connected, better transitions between gameplay moments, and Gemini rhythm-stage backgrounds that match each city.

---

```text
ADDENDUM v2 to the final-polish pass on "Tour Life: International Dates" (tour-life-v3). Five
new items, executed after RESUME_PROMPT_FINAL_POLISH.md's Item 5, in this order. Guardrails:
no new cities, no Part 3 reality layer, no audio-file swap (Title theme from the main prompt
stays the only real audio file), accessibility + no-fail intact, painted-world/code-drawn-UI
rule kept, evidence-first for every claim.

GROUND TRUTH (verified in the code):
- src/ui/MiniGameScene.ts: the Interview (choice) minigame's option buttons are
  createButton(W/2-300, 540/622, 600, 66, q.optionA/B, { fontSize: '19px' }) — 600px buttons,
  long sentence labels, no wordWrap in Button.ts's label creation; textStyles 'button' uses
  fontStyle:'700' with Baloo 2 (a variable font). This is the garbled-text class.
- src/ui/transition.ts: goTo() is a single 250ms fade to navy (43,58,85) then scene.start.
  There are no themed transitions anywhere.
- src/ui/RhythmScene.ts: the playfield backdrop is a flat PALETTE.night rectangle; painted
  city backgrounds exist (bg_city_<id>.webp via manifest) but are NOT used during rhythm.
- src/game/minigame.ts + CityScene: at most ONE minigame per city per run —
  nextUnplayedMinigame(city.minigames) is called once (after arrival, returnPhase
  'locations'). Rewards apply stats; some set story flags (e.g. pack_van -> fast_load_out
  gates Tokyo's alternate after-show) — the story-wiring mechanism EXISTS but is used once.
- Crowd: 5 code-drawn silhouettes in RhythmScene (ensureCrowdFigure, idle/arms-raised),
  swapped by crowd stat. Painted crowds exist baked into city backgrounds, not in rhythm.

ITEM 6 — TEXT-RENDERING AUDIT: make garbled text impossible. (from v1, unchanged)
  REPRODUCE FIRST: run the Interview minigame with long option labels; screenshot at 390x844
  and desktop; confirm the garbling is in the button labels only (prompt bar with wordWrap is
  fine). Investigate: (a) Button.ts label has NO wordWrap — long labels overflow the baked
  button texture; (b) textStyles 'button' numeric fontStyle '700' on variable-font Baloo 2 —
  classic Phaser canvas-sized-at-creation-with-fallback-metrics garbling; (c) MiniGameScene
  lines ~270-271 600px buttons with 19px sentence labels; (d) the third-button bottom clipping
  vs SAFE_BOTTOM_Y (1230). Fix the CLASS: Button.ts labels get wordWrap {width: w - 2*pad} or
  auto-fit shrink; fix the fontStyle handling (proper 'bold'/'normal' or ensure the variable
  weight loads before text creation). SWEEP every text site: dialogue choice labels, route
  descriptions, hub objective, backlog, scrapbook, epilogue, minigame intro/outro/options, cue
  banners, HowToPlay — no silent overflow anywhere. MAKE IT IMPOSSIBLE: scripts/text-fit-audit.mjs
  walks every authored string (content JSON + UI labels), estimates width at the smallest
  viewport vs container, FAILS CI on any overrun (names the string + screen); e2e screenshot
  sweep of every screen at 390x844 as CI artifacts with label-presence assertions.
  EVIDENCE: before/after screenshots of the exact reported screen; root-cause writeup; gate
  green; sweep artifacts.
 DONE-WHEN: reported screen renders every option legible, spaced, unclipped at 390x844 and
 desktop; text-fit audit zero overruns; sweep green; root cause documented.

ITEM 7 — GEMINI DYNAMIC CROWDS: before/after, city-matched, faces visible. (from v1, unchanged)
  Per city (4), generate 5-7 diverse crowd members (faces clearly visible; varied skin tones/
  ages/styles; city-appropriate dress matching each backdrop: Berlin coats/umbrellas, Lisbon
  warm layers, Tokyo neon accents, Mexico City festive color) via
  C:/Users/Jbthi/.claude/skills/user/game-image-generator/scripts/generate_sprite.mjs
  (--chroma-key, VIVID GREEN background, then verify + contact sheet + LOOK — bug #14 rule).
  Each member in TWO moods: GOOD SHOW (cheering, arms raised, smiling) vs BAD SHOW (bored,
  crossed arms, looking away). Wire via manifest keys crowd_<city>_<member>_<mood>; silhouette
  fallback stays. RhythmScene crowd becomes density + mood live (0-40 bad, 41-59 mixed, 60+
  good; perfect streak pushes good, miss streak sours), positioned below the hit line, never
  overlapping notes/judgement text, modest opacity, purely visual (no hit areas).
  Results screen gets a "the crowd" strip at the run's final mood. reducedMotion/noFlash
  respected. ~56 small PNGs, cache textures.
  EVIDENCE: silhouette vs painted, good vs bad for one city, two cities at same stat, Results
  strip — all at 390x844, docs/polish-before-after/.
 DONE-WHEN: all 4 city crowd sets verified and wired; crowd reflects live performance; Results
 strip works; fallback works; no console errors.

ITEM 8 — MINIGAMES: MORE OFTEN, STORY-CONNECTED, BETTER PACING.
  8a. FREQUENCY: raise from one to up to TWO minigames per city per run, at two insertion
      points: (1) after arrival (exists), (2) before preShowChoices (new). Mechanics:
      CityScene calls nextUnplayedMinigame at BOTH phases (it already takes a played-flag
      checker — the minigame array drives it, so authoring a SECOND MiniGameDef entry per city
      in content JSON makes 2-per-run real with zero engine changes beyond the second call
      site + returnPhase 'preshow'). Do NOT repeat the same minigame id twice in a run (the
      played flag already prevents it). Author a second entry per city: Lisbon adds 'pack'
      (pack the van — load-in before the show), Tokyo adds 'timing' (soundcheck), Mexico City
      adds a second 'choice' beat (street interview with a local zine writer), Berlin gets its
      FIRST minigame (currently has none) — 'timing' (synth soundcheck) or 'drag' (load the
      modular rig) — pick the one that fits the ambition/experimentation tone.
  8b. STORY-CONNECTED OUTCOMES (the "add to the story" ask): every minigame def already has
      reward/roughReward + type fields; ADD an optional storyFlags: string[] on the def
      (schema additive, validated) applied on a GOOD outcome, and roughFlags applied on a ROUGH
      outcome (or reuse the existing reward-flag pattern). Then WIRE them into dialogue:
      (i) the city's after-show/journal/relationship nodes get condition-gated branches on the
      minigame outcome flags (like Tokyo's fast_load_out — extend to every city); (ii) the
      minigame's NPC recurs: the soundcheck engineer / van-loading roadie / zine writer /
      modular artist appears in the after-show or a relationship scene with a callback line
      ("the engineer still talks about your soundcheck"); (iii) the epilogue references the
      run's minigame outcomes ("the band still tells the story about the van that almost lost
      the bass amp"). At least one visible story consequence per city per run.
  8c. PACING: minigames must never cluster — the two per city land at arrival + pre-show, so
      VN scenes sit between them; keep each 20-45s, no-fail structural (safety timers already
      exist), and make the intro line diegetic to the city's narrative beat, not a generic
      "minigame time".
  8d. Gemini backdrops for the NEW minigames (existing 3 already have painted backdrops):
      generate per §11.1 pipeline, process-bg.sh, manifest keys bg_mini_<id>; code-drawn
      fallback stays.
  EVIDENCE: before (one minigame/city) vs after (two/city); the story consequence for one city
  shown end-to-end (minigame -> flagged -> after-show branch differs); screenshots.
 DONE-WHEN: two minigames per city reachable per run (all 4 cities; Berlin gains its first);
 every city has >=1 dialogue branch gated on a minigame outcome flag; epilogue references
 minigame outcomes; no-fail verified; tests green (schema + new branches via content.test.ts).

ITEM 9 — BETTER TRANSITIONS BETWEEN GAMEPLAY MOMENTS (VN <-> minigame <-> rhythm).
  9a. TRANSITION SYSTEM: extend transition.ts's goTo with an optional themed transition, a
      tiny overlay (scene-level container, not a new scene): 'fade' (current, default),
      'card' (a sand card slides up with a location/venue line: "Next stop — Fado House
      soundcheck" / "Where to, before the show?"), 'lights' (for entering rhythm: dark overlay
      + a gold spotlight wipe + "On stage — Lisbon"), 'drive' (for hub travel: a subtle
      night-road drift). Duration 300-450ms; reducedMotion -> plain fade; noFlash respected
      (no strobes). Keep the 250ms default everywhere it already works; only wire the themed
      ones at the moments below.
  9b. WIRE THE MOMENTS (each is a one-line goTo(..., { transition: 'X' }) change):
      - VN -> minigame (arrival beat done): 'card' with the minigame's diegetic intro line.
      - minigame -> back to VN (locations): 'fade' (or a soft 'card' with the outcome line).
      - VN -> rhythm (preShowChoices -> RhythmScene): 'lights' — the show is about to start.
      - rhythm -> Results: 'fade'. Results -> afterShow VN: 'fade'.
      - Hub -> city travel: 'drive'. City -> Hub: 'drive' (or 'card' with the next stop).
  9c. AUDIO continuity: transitions must not double-trigger ambience (RhythmScene already
      starts its own; CityScene its own at half bpm) — verify each transitioned moment has
      exactly one ambience start + correct duck state (the SHUTDOWN un-duck rule).
  EVIDENCE: before/after screenshots of the 'lights' rhythm entry and 'card' minigame entry;
  console-error-free transition walkthrough of the full city loop.
 DONE-WHEN: every wired moment uses its themed transition, reducedMotion falls back to plain
 fade, audio state correct at every seam, e2e fullrun still green.

ITEM 10 — GEMINI RHYTHM STAGE BACKGROUNDS (per city, matching the city).
  10a. GENERATE 4 stage/venue backgrounds via the proven pipeline
       (C:/Users/Jbthi/.claude/skills/threejs-image-generator/scripts/generate_image.py
       --resolution 2K, style block from docs/asset-probes/lisbon_bg_probe.png + scene):
       - Lisbon: intimate fado room, warm amber/terracotta, string lights, small stage.
       - Tokyo: neon-soaked club, teal/pink palette, rain-slick window, compact stage.
       - Mexico City: open-air festival stage, citrus/community colors, banners, warm crowd.
       - Berlin: warehouse club, midnight_indigo, concrete + haze + minimal lights.
       All: stage viewed from the audience, city-specific iconography, DARK enough in the
       center that notes/lanes read clearly, NO text, no border. process-bg.sh -> manifest
       keys bg_rhythm_<city>.
  10b. WIRE into RhythmScene: replace the flat night rectangle with the city's stage bg
       (addCoverBackground + applyVignette), lane textures already semi-transparent (teal
       0.18) so they sit over painted art; add a subtle center dark scrim (existing
       legibility-scrim pattern) so notes + judgement text stay readable; crowd figures
       (Item 7) stand at the bottom against the painted crowd; keep reducedMotion/noFlash
       respected and the perf budget (single texture per city, cached).
  10c. Results screen: reuse the city's stage bg behind the grade plate (same key), with the
       crowd strip from Item 7 — the show you just played, where you played it.
  EVIDENCE: rhythm screenshots per city (all 4) at 390x844 with notes readable over the art;
  before (flat navy) vs after; Results screen with stage + crowd.
 DONE-WHEN: all 4 stage bgs generated, processed, manifest-wired; rhythm plays over painted
 stage art with notes/judgement text fully readable (screenshot proof per city); fallback to
 navy if files missing; no console errors; perf fine on the 0.5417-scale phone viewport.

FINAL VERIFY (items 6-10):
 1. npm run typecheck && npm test — green (existing + text-fit gate + new minigame schema/
    branch tests + content.test.ts covering the new story gates).
 2. npx playwright test + --config=playwright.dist.config.ts — green (extended sweep incl.
    the new minigame entries and the themed transitions).
 3. Deploy via git push; curl live URL 200 + title correct; the reported Interview screen
    legible on the LIVE url; rhythm shows painted stage art; a full run on the live url plays
    two minigames in one city with a visible story consequence.
 4. Unverifiable hardware items go on the owner's checklist, not "verified".

FINISH with: per-item evidence (text gate + sweep, crowd sets + contact sheet, minigame
count + story-wiring examples, transition screenshots, stage-bg screenshots), test counts,
deploy verification, and the honest remainder.
```
