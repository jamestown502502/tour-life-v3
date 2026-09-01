# Tour Life v3 — Review: Onboarding, Depth & Close-Out Plan

**Date:** 2026-09-01
**Author:** Hermes (BAIS)
**Repo:** tour-life-v3 (jamestown502502) — commit `486c30d` current
**Status:** Grounded against the actual repo (Phase G verified committed: 4 backgrounds + 16 portraits in `public/assets/img/`, manifest-wired, `BootScene.ts` present, 37/37 tests)

---

## Part 1 — Review of the handoff (v2, post-real-asset)

**Verdict: the handoff is accurate and the game has crossed the "looks good" line. The two things it says are left are exactly the two things that are left — and one of them (hand-holding) is not yet even on its list.**

### What's genuinely done (verified, not just claimed)
- **Phase G landed cleanly.** Painted soft-gouache backgrounds and 16 character portraits are in `public/assets/img/` and loaded through the texture-key seam (`BootScene.ts` + `manifest.json`). Code-drawn fallback intact. The 4 new bugs (13–16) are real catches — especially bug #14 (chroma-key verify passing on see-through eyes) and the lesson it encodes: *a metric passing is not the same as having looked at the output.*
- Engine, systems, accessibility, save/resume, rhythm (incl. real hold scoring), meta-progression, procedural audio — all verified and documented. 37/37 tests. The Vercel git-identity runbook (§1, bug #11) is the most useful ops note in the file.
- Content numbers are stated honestly: ~460 words/city, ~15% of target. Unchanged by design.

### What the handoff misses (the gap you named: "hands holding")
I grepped the repo. **There is no tutorial, no "How to Play," no onboarding, no contextual help — nothing.** A first-time player lands on the Title screen, taps New Run, and is immediately dropped into a 4-lane rhythm game with no explanation of what the lanes are, what a hold note is, what the crowd meter means, or what any of the stats do. For a cozy game whose whole pitch is "low-stress, anyone can play," that's a real hole — it's the difference between "demo for people who already get it" and "something you can hand to anyone."

The residual polish items in the handoff are all real and all small:
- Mobile spacing gap on Settings + BandCreator grids (documented honestly in §4.8).
- Stray `favicon.ico` 404 on every load — confirmed: `index.html` has no icon link.
- Optional title-theme audio — agreed, the rest should stay procedural.

---

## Part 2 — The polish plan: hand-holding & dummy-proofing (do this FIRST)

Ordering logic: onboarding is cheap, high-impact, and makes every future playtest more meaningful (a playtester who understands the game gives feedback on the game, not on the controls). Content depth is the bigger lift — it goes second.

### Phase 1 — Explain the game (diegetic onboarding, not a wall of text)

**A. "How to Play" screen (Title-level, one tap away):**
- Accessible from Title via a small "How to Play" button (and auto-opened on a player's very first run).
- 3 short pages (swipe/tap to advance, all touch-friendly): **The Tour** (you pick a route, live on the bus, make choices that matter), **The Show** (tap notes as they reach the gold line; holds: press and hold; choice cues: tap the banner), **The Band** (stats, relationships, scrapbook — "every tour writes its own story, no wrong answers").
- Reuses the existing dialogue-panel visual language (sand card, plum text, gold accents). No new art needed — text + existing UI chrome.

**B. First-run guided beat (diegetic, in BandCreator/RoutePlan/Hub):**
- The promoter NPC ("Sol") introduces each new screen with 1–2 short lines the first time it appears, e.g. RoutePlan: *"Pick the cities that feel right. You can't play them all — that's the point."* Stored via the existing `flags` system (`flag:onboard_routeplan`), so it only shows once per save.
- Uses the existing DialogueBox — zero new systems, just authored nodes + a flag check.

**C. Rhythm micro-tutorial (in-scene, before the first real song):**
- The player's first performance (Lisbon, first run only) opens with a **3-beat practice pass**: notes fall, a "Tap when the note touches the line!" label shows once, then the song starts. No scoring on the practice pass, no penalty for ignoring it (no-fail guarantee holds).
- First song runs in `relaxed` mode automatically if the player hasn't touched Settings (wide windows = easy first win).
- Hold notes and choice cues get a one-line in-scene hint the first time each appears ("Press and hold…", "Tap the banner to pick the moment's direction").

**D. Contextual help (persistent, cheap):**
- A small "?" button in the top-right of Hub, City, Rhythm, and Scrapbook opens a one-line panel explaining that screen. Existing button component, one static text per screen.
- Rhythm gets an always-on first-time legend: "TAP = touch the note · HOLD = press & hold · CUE = tap the banner" in the corner during song 1 only.

### Phase 2 — Dummy-proof the edges

- **New Run with an existing save → confirm dialog** ("Start a new tour? Your current tour will be overwritten."). Right now New Run just overwrites — an accidental tap loses a run.
- **No dead-ends:** every screen has an obvious way forward and back (Title→How to Play→Back; Settings→Back; Scrapbook→Title). Audit each scene's Back path in the live browser.
- **Goals always visible:** Hub already shows "Travel to X"; add a persistent one-line objective under it ("Tonight: soundcheck at the Fado House") from the city's current phase — CityScene already knows the phase; surface it.
- **Settings sanity:** the volume +/- pair and grid spacing pass (handoff §4.8) so every touch target is ≥44px on 390px-wide phones.

### Phase 3 — The two cosmetic fixes

- **Favicon:** add a 64×64 gold-on-plum music-note icon as `public/favicon.svg` + `<link rel="icon" href="/favicon.svg">` in `index.html`. Kills the 404 on every load, costs one small file (can be a hand-written SVG — no image tool needed).
- **Title theme (optional, small):** one Lyria `clip` loop for the Title screen only (the one place a static track adds polish without costing the per-city adaptive ambience). Only if the above lands cleanly.

---

## Part 3 — The depth plan: tackle content on the next run

### Where depth actually lives (confirmed from source)
- `content/cities/lisbon.json` / `tokyo.json`: 30 scenes, ~460 words each, pools at the schema minimum (3 relationships, 4 locations, 3 pre-show choices).
- `content/songs/`: 1 song per city, 3 arrangements each, ~55–65s charts (algorithmic).
- Pipeline is JSON-only and proven; a city needs **zero engine changes**. Backgrounds are the only non-JSON step (generate → `process-bg.sh` → manifest entry).

### Realistic target for one run (honest numbers)
Full 3–4h needs the 12–16-city roster — that is not one session. What one run *can* deliver is a **meaningful, demoable step up**:

1. **City #3, fully authored** — pick one with an unused tint (blueprint table: Mexico City = community/percussion → `citrus_bloom`; Berlin = ambition/experimentation → `midnight_indigo`; or Reykjavík = isolation/ambience → `lavender_dusk`). Author:
   - ~1,200–1,800 words (a real step toward the 3,200 target, honestly below it — the pipeline now exists to keep going)
   - 4 locations (schema min is 3), 4–5 relationship pool entries, 3 pre-show choices, 1 song with 3 arrangements, collaborator NPC + gift, story gate, weather pool, after-show + journal scenes
   - **Background:** generate via the verified Gemini pipeline → `scripts/process-bg.sh` → add `{key: "bg_city_<id>", file: "img/bg_city_<id>.webp"}` to the manifest → confirm it renders + code-drawn fallback still exists.
2. **Deepen Lisbon + Tokyo** — add 2 relationship scenes each (pools 3 → 5, giving real "1–2 of 5" scarcity), and 1 new location each. This is the replayability lever, and it's pure JSON.
3. **One extra arrangement per existing song** (cheap, adds chart variety per run).
4. **Wire the mid-tour complication mechanically** (currently flavor-only): give it one real effect — e.g. a stat modifier or a flag-gated after-show line at the route midpoint. Small engine touch, big perceived depth. (Optional; only if 1–3 land clean.)

### What stays deferred (explicitly — your call, not the builder's)
- **Reality layer (Part 3 of DESIGN.md):** still not built. It carries real content-policy weight (substance use, exploitation beat) for public web + eventual Android. **The resume prompt below forbids building it** — it needs your tone/rating decision first. When you want it, it's a scoped follow-up with its own Warm/Raw tone-dial UX decision.
- **Audio file swap:** stays procedural. Only the optional Title theme above.

---

## Part 4 — Close-out definition for this run

**Done when (acceptance criteria):**
1. A first-time player, given no instructions, can complete a full run and understand what happened (onboarding covers Title → Route → Hub → City → Rhythm → Scrapbook).
2. City #3 is live in a run with painted background, distinct tint, full chapter; Lisbon + Tokyo pools ≥5 each.
3. Run playtime is measurably longer (~20–30 min vs 10–15) — measured, not guessed.
4. 37/37 tests green + new tests for anything added (onboarding flags, any new condition usage).
5. All screens verified at 390×844 (touch targets ≥44px, no overlap).
6. Favicon 404 gone (network tab clean).
7. Deployed, live URL curls 200, title tag correct.

**Not done by design (state explicitly in the build report):** reality layer, 12–16 cities, real audio files.

---

## Part 5 — Bottom line

The game now looks good; it doesn't yet *welcome* anyone. Onboarding + dummy-proofing is the cheapest, highest-leverage polish left, and it makes the depth work that follows actually testable. The next run should be: **explain the game → deepen the content → fix the small things → verify at mobile → ship.** Written, committed, pushed — the resume prompt is in `RESUME_PROMPT_DEPTH_AND_ONBOARDING.md`.
