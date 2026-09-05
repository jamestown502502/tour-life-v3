# RESUME PROMPT — Tour Life v3: Final Polish ADDENDUM (Text-Rendering Audit + Gemini Dynamic Crowds)

**Read this AFTER `RESUME_PROMPT_FINAL_POLISH.md`.** This addendum adds two items to that final-polish pass (they become Items 6 and 7, executed after Item 5). Triggered by a live bug report: a screenshot of the Interview minigame (Berlin backdrop) showing the answer-option text completely garbled — characters mashed together with no spacing — while the prompt bar above renders fine, and the third button clipped at the bottom of the overlay.

---

```text
ADDENDUM to the final-polish pass on "Tour Life: International Dates" (tour-life-v3). Two new
items, executed after RESUME_PROMPT_FINAL_POLISH.md's Item 5. Same guardrails: no new cities,
no Part 3 reality layer, no new systems, accessibility + no-fail intact, painted-world/
code-drawn-UI rule kept, every claim needs evidence, evidence-first debugging.

ITEM 6 — TEXT-RENDERING AUDIT: make garbled text impossible.

REPRODUCE FIRST (evidence-first, do not guess):
- Reproduce the exact bug from the report: run the Interview minigame (Mexico City) with long
  option labels; screenshot the option buttons at 390x844 and desktop. Confirm the garbling is
  in the ANSWER BUTTON labels only (the prompt bar, which uses add.text with wordWrap, is fine).
- INVESTIGATION TARGETS (candidates found in the code, verify each):
  (a) src/ui/MiniGameScene.ts lines ~270-271: the two option buttons are
      createButton(this, W / 2 - 300, 540/622, 600, 66, q.optionA/optionB, { fontSize: '19px' })
      — 600px-wide buttons with LONG sentence labels at 19px.
  (b) src/ui/Button.ts label creation: the label Text is created with
      textStyle('button', { fontSize: opts.fontSize ?? '22px' }) and NO wordWrap — a label
      longer than the button width cannot wrap; check what it actually does at >container width.
  (c) textStyles.ts 'button' preset uses fontStyle: '700' with Baloo 2 (a VARIABLE font).
      Verify whether Phaser 3.90's Text passes numeric fontStyle through as a CSS font-style
      (invalid) and whether the variable-font metrics at load time vs render time can mis-size
      the text canvas (the classic "characters overlapping" cause: canvas sized at creation
      with fallback metrics, then the real font overflows without re-measuring).
  (d) The third button clipping: check the option/continue stack bottom edge vs SAFE_BOTTOM_Y
      (1230) at 390x844 and against the contentLayer mask/scale.
- FIND THE ACTUAL ROOT CAUSE with an isolated repro (a scratch scene or browser console test
  that renders the exact label+style combo and shows the garbling), then fix THAT.

FIX THE CLASS, NOT THE INSTANCE:
- Button.ts: give the label a wordWrap at { width: w - (padding*2) } when the label is long, OR
  auto-fit (shrink font until the measured width fits), OR explicitly reject/flag overlong
  labels in dev. Choose the cleanest option that keeps every existing screen unchanged where it
  already fits. Do NOT silently accept overflow anywhere.
- Fix the numeric fontStyle issue if it is part of the root cause (use proper 'bold'/'normal'
  or ensure the variable-font weight is loaded before the text is created).
- Sweep ALL label/text sites for the same class: dialogue choice labels (content JSON choice
  label lengths vs button width), route-plan descriptions, hub objective line, backlog lines,
  scrapbook lines, epilogue text, minigame intro/outro, cue-banner labels, HowToPlay pages.
  Any site where text can exceed its container gets wrap or fit.

MAKE IT IMPOSSIBLE TO REGRESS (the "never ever" part):
- scripts/text-fit-audit.mjs: walks every authored string (content JSON text/choice labels/
  intro/outro/epilogue + hardcoded UI labels) and estimates rendered width at the smallest
  viewport against its container width; reports any overrun. Wire into CI (npm run text-fit) as
  a FAILING gate (a new overrun fails the build, with the offending string + screen named).
- e2e: extend the smoke suite with a per-screen screenshot sweep at 390x844 (every menu screen,
  all 3 minigames, dialogue with 3-choice node, rhythm, results, scrapbook, settings, how-to-
  play) captured as CI artifacts; add ONE deterministic assertion per screen that its known
  label texts are present and the page has no console errors (the garbling class is visual —
  the screenshot artifacts + the text-fit gate are the real guards; the label-presence assertion
  catches outright missing text).
- EVIDENCE: before/after screenshots of the exact reported screen (Interview minigame, long
  labels) at 390x844 + desktop; the root-cause writeup; the text-fit gate green; the full
  screenshot sweep in CI artifacts.
 DONE-WHEN: the reported screen renders every option legibly with proper spacing and no
 clipping at 390x844 and desktop; text-fit audit passes with zero overruns; e2e sweep green;
 the root cause is documented, not just patched.

ITEM 7 — GEMINI DYNAMIC CROWDS: before/after, city-matched, faces visible, good vs bad show.

WHAT EXISTS TODAY: the rhythm crowd is 5 small code-drawn silhouettes (ensureCrowdFigure in
src/art/sprites.ts, two poses: idle/arms-raised) that swap as the crowd stat changes; city
backgrounds have painted crowds baked into the art (e.g. Berlin's rainy street has painted
people with umbrellas) but the RHYTHM crowd and Results crowd are still flat silhouettes. The
ask: real painted crowds, per city, dynamic by show quality, WITH FACES.

DESIGN:
- Per city (4 cities), generate a crowd asset set via the proven Gemini sprite pipeline
  (C:/Users/Jbthi/.claude/skills/user/game-image-generator/scripts/generate_sprite.mjs,
  --chroma-key, VIVID GREEN background, then run verify + build the contact sheet and LOOK —
  bug #14 rule: a metric passing is not the same as having looked):
  - 5-7 diverse crowd members per city (varied skin tones, ages, body types, styles; faces
    clearly visible; city-appropriate dress: Berlin coats/umbrellas matching the rainy
    backdrop, Lisbon warm tones, Tokyo layered/neon accents, Mexico City festive color).
  - Each crowd member in TWO mood variants: GOOD SHOW (cheering, arms raised, smiling, eyes
    bright) vs BAD SHOW (bored, arms crossed, looking away, some mid-walk-away, low energy).
  - Match the crowd palette/temperature to each city's tint (warm_amber, teal_pink,
    citrus_bloom, midnight_indigo) so the crowd reads as part of that city's show.
- Wire through the existing texture-key seam (load via public/assets/manifest.json under keys
  crowd_<city>_<member>_<mood>; code-drawn silhouette fallback stays when files are missing).
- RhythmScene crowd becomes dynamic and expressive: crowd stat 0-100 drives BOTH density
  (0-5 figures -> up to the full set as the crowd warms) AND mood (<=40 = bad variants, >=60 =
  good variants, middle = mixed); a perfect streak briefly bumps figures to good-mood variants
  (reuse the existing crowd-swell/ring-pulse hooks); bad-miss streak flips some to bad variants.
  Position the crowd along the bottom of the playfield BELOW the hit line (never overlapping
  notes/judgement text), at modest opacity so it reads as atmosphere, not UI.
- Results screen: add a "the crowd" strip using the city's crowd set at the run's final mood —
  the same figures the player just performed for (before: a stat number; after: a real crowd).
- Scrapbook: keep it text-forward (don't crowd it), but the epilogue page may reuse the final
  city's crowd mood as a small backdrop accent if it fits without clutter.
- PERFORMANCE + SAFETY: ~7 figures x 2 moods x 4 cities = ~56 small PNGs (keep each ~256-512px
  wide, process via the existing pipeline); cache textures; respect reducedMotion (no added
  animation when on) and noFlash; crowd is purely visual/feedback — never gameplay-blocking,
  never input-interfering (no interactive hit areas).
- BEFORE/AFTER EVIDENCE: (1) current silhouette crowd vs painted crowd, same city, same crowd
  stat; (2) good-show vs bad-show variants for ONE city at the same stat; (3) two different
  cities' crowds at the same stat (city-match proof); (4) Results strip. All screenshots at
  390x844, saved to docs/polish-before-after/.
 DONE-WHEN: all 4 cities' crowd sets generated, verified (alpha + contact sheet), and wired;
 rhythm crowd reflects density + mood live (a perfect streak visibly improves the crowd, a miss
 streak worsens it); Results strip shows the final crowd; fallback works with files missing;
 reducedMotion/noFlash respected; no console errors; screenshots committed.

FINAL VERIFY (both items):
 1. npm run typecheck && npm test — green (existing + new text-fit gate + any new tests).
 2. npx playwright test + --config=playwright.dist.config.ts — green (extended sweep).
 3. Deploy via git push; curl live URL 200 + title correct; the Interview minigame screen on the
    LIVE url shows legible option text; the rhythm crowd shows painted faces.
 4. Everything unverifiable (real iPhone/Android) goes on the owner's checklist, not "verified".

FINISH with: root-cause writeup + fix (Item 6), text-fit gate + sweep evidence, crowd asset
count + verify results + contact-sheet path (Item 7), before/after screenshots, test counts,
deploy verification, and the honest remainder.
```
