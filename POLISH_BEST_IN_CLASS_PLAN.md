# Tour Life v3 — Best-in-Class Pass: Mobile UX, Rhythm Feel, VN Depth & Minigames

**Date:** 2026-09-01
**Author:** Hermes (BAIS)
**Repo:** tour-life-v3 (jamestown502502)
**Grounded in:** live reading of `RhythmScene.ts`, `DialogueBox.ts`, `Button.ts`, `TitleScene.ts`, `main.ts` + 10 web/social searches (citations inline)

---

## Part 1 — Diagnosis: what's actually wrong (from the code, not vibes)

### 1.1 Rhythm is not mobile-grade — three concrete defects found in `RhythmScene.ts`

| Defect | Evidence in code | Why it fails on iPhone |
|---|---|---|
| **No multi-touch enabled** | `main.ts` Phaser config sets no `input.activePointers`. Phaser defaults to a single active pointer. Each lane's `zone.on('pointerdown')` only ever sees one finger | Two-note chords (common in charts) are literally unplayable — the second tap is dropped. This is the single biggest "rhythm feels bad" cause |
| **Hit line at y=1100 of 1280** | `HIT_LINE_Y = 1100`; hit zones at `HIT_LINE_Y - 40` (y=1060) sized 120 tall → bottom edge at 1180 | On iPhone the home-indicator/gesture area covers roughly the bottom ~30–50 CSS px of the viewport. The canvas scales to ~0.54× → 1180 game px ≈ 638 CSS px, which on a 844px-tall phone is ~75% down — but with `viewport-fit=cover` the hit area can sit behind/under the home indicator, and it's in the thumb-stretch zone. **Move it up.** |
| **Lanes + notes small, no lane-local feedback** | `LANE_W = 140` game px → ~76 CSS px/lane on a 390px phone. Perfect-hit spark always at fixed `hitX = LANE_X_START + LANE_W/2` (lane 0), not at the actual lane; no per-lane hit flash; no judgement text | Narrow lanes + a spark that fires in the wrong lane + no "Perfect/Good" text = feels imprecise and dead |

Plus: cue banner and combo stamps render fine, but there's no judgement-feedback text and no note "approach" assist beyond the optional visualAssist label.

### 1.2 Dialogue/VN is functional but flat

- `DialogueBox` PANEL at y=740..1040; choices stack from 1054 downward, 48px tall → **4th choice bottom ≈ 1228**, under the phone home-indicator zone. Choice buttons are 20px font at 0.54× scale ≈ 11 CSS px — small for a tap target and for reading.
- **Zero text presence polish**: no portrait animation (static image), no typewriter click SFX, no name-colored accent bar, no fade-in, no "advance" affordance arrow. Genre-leader VNs (Coffee Talk, 80 Days, Spiritfarer) make the textbox feel alive; this one is a static card.
- Backgrounds are one-per-city; every location (5 per city) reuses the same painted backdrop → locations read as identical.

### 1.3 Story is thin, and there are no breaks in the VN flow

~2,221 words across 3 cities; the run is arrival → 2 locations → 1 relationship → preshow → rhythm → after-show → journal, with **only the rhythm as a non-dialogue moment**. "Very boring" is the direct consequence: too much pure text, no variety of interaction. Research consensus (r/gamedesign, Andrew Russell's QTE piece) is that the fix isn't "more QTEs everywhere" — it's **sparse, thematic, low-stakes interactive beats** that break the text flow while staying on-fantasy.

---

## Part 2 — What best-in-class actually means (research, cited)

1. **Rhythm feel** — r/gamedesign ("Your experience with rhythm games"): *"Tightness and feedback of controls is the biggest factor… Latency, feedback."* Exceed7's note-charting guide: pattern readability > density; don't clutter charts; sparse charts with rests read better. → **Fix input first (multi-touch + bigger targets + lane feedback), then make charts readable, then add juice.**
2. **Multi-touch** — Phaser docs: `input.activePointers` config controls how many simultaneous touches Phaser tracks. Default is 1. For a 4-lane rhythm game you need ≥4. (Confirmed: the game never sets this.)
3. **VN textbox** — VNConf 2025 "Make your visual novel readable": contrast, clear text hierarchy, and not covering the art. r/visualnovels + Lemma Soft: ADV-style box that leaves the art visible + portrait + name accent is the consensus good default. Autoplay/skip/rollback are expected QoL (Ari Made's "100 VNs" post).
4. **QTEs done right** — Andrew Russell ("How to Design a Good QTE") + r/gamedesign ("Why everyone hates QTEs"): QTEs fail when they're random, untimed, disconnected from gameplay, or overused. They succeed when they *use the game's existing verbs*, are optional/low-stakes, and serve the narrative moment. → Our minigames must map to tour verbs (tune, soundcheck, pack the van, merch fold, interview), be short, and reward but never punish.
5. **Cozy depth** — r/CozyGamers ("why do recent cozy games miss the mark"): *"Mostly lack of content. So many indie titles only have a few hours before they feel empty/repetitive."* → variety = more authored content + more *kinds* of interaction, not more of the same.
6. **iPhone safe areas** — WebKit "Designing Websites for iPhone X" + Polypane: `viewport-fit=cover` + `env(safe-area-inset-*)` are mandatory; interactive content must stay inside the safe area. The game already has the CSS; the canvas layout itself (hit line at 1100, 4th choice at 1228) ignores it.

---

## Part 3 — The plan: five workstreams

### A. Mobile rhythm feel (highest priority — it's the game's name)

1. **Enable multi-touch**: `input.activePointers: 4` in the Phaser config (guard for memory — 4 is plenty for 4 lanes). Verify with a real two-finger test.
2. **Move the playfield up + widen lanes**: `HIT_LINE_Y` 1100 → ~980; lanes `LANE_W` 140 → 165 and `LANE_X_START` 90 → 30 (4×165 = 660, fits 720). Bigger targets = better feel on every screen.
3. **Per-lane hit feedback**: perfect/good/ok/miss judgement text spawned at the *actual lane's* hit line (not lane 0), lane flash tint on hit, and a "combo ring" at the lane. Kill the fixed `hitX` bug.
4. **Judgement popups + scoreplate**: floating "Perfect! +100" text at the lane, "Combo xN" center plate, grade letter (S/A/B/C) shown at Results with a tween.
5. **Chart readability**: hand-tune the algorithmic generator to leave real rests and follow the kick/snare (Exceed7 principle) — sparse beats read better than dense walls. Rebuild `scripts/generate-chart.mjs` with a motif system (kick→tap, snare→tap, offbeat→hold, break→rest), and add at least one fully hand-authored chart as the "hero" song.
6. **Practice pass → tap-along**: keep it but make the demo notes land on actual beats (not just a timed tween) so the player learns the timing feel, not just the gesture.
7. **Latency guard**: ensure Web Audio is unlocked before the first chart starts (already gated by Title's first tap; keep it), and set note `LEAD_MS` per difficulty (relaxed 1800 / standard 1600 / expert 1400) so expert players aren't fighting lead time.

### B. VN textbox that feels alive (genre-leader standard)

1. **Portrait life**: subtle bob on typewriter progress (tween y ±3px synced to typing), mouth-open/closed flicker while typing, and a per-bandmate accent glow behind the nameplate (BANDMATE_BASE already exists — extend to a soft radial).
2. **Typewriter SFX**: a soft per-character click (sine 520Hz, 12ms, low gain, randomized pitch ±10%) — the single cheapest "alive" upgrade. Respect the existing SFX volume bus.
3. **Name bar + advance affordance**: a small gold chevron "▼" that pulses when a line is fully typed (tap target = skipZone, already separate from choices). Name text already colors per bandmate — add a 2px colored underline bar under the nameplate.
4. **Panel position + size**: raise `PANEL_Y` to ~700, cap at 4 choices with a scroll/fade for >3, and add `env(safe-area-inset-bottom)` padding inside the panel container so nothing interactive sits under the home indicator. Re-verify the `panel.y + 300 + rows*58 ≤ safe` arithmetic.
5. **Skip/auto QoL**: Settings already exists — add **Auto mode** (advance after N seconds, Pause on choice) and **Skip read text** (instant) toggles, the two QoL VN players expect (Ari Made consensus).
6. **Location variety without new art**: apply a per-location color grade (tint overlay + vignette strength + ambient particle color) over the shared city background so the 5 locations feel distinct at near-zero asset cost. (Full new backgrounds per location = optional later.)

### C. Minigames to break the VN flow (sparse, thematic, low-stakes)

Design rule from the research: **use the tour's own verbs, keep it short, reward-don't-punish.** Each is a reusable `MiniGameDef` in content JSON + one shared Phaser scene (`MiniGameScene.ts`) keyed by type. All gate no story; each awards a small stat/flag (Harmony, Funds, Inspiration, or a story flag like `tight_soundcheck`).

Proposed set (3 ship now, JSON-driven, extensible):

1. **Soundcheck (timing)**: a needle sweeps across a gauge; tap when it's in the green zone. 3 rounds, escalating speed. Rewards: Harmony + Funds. Reuses the rhythm timing engine's `judgeHit`. **Feels like the band, teaches timing.**
2. **Pack the van (quick-drag)**: 6 items appear; drag each to a grid slot before a short timer. Cozy, tactile, breaks text. Rewards: Energy + a travel-flavor flag.
3. **Interview (rapid-tap chat)**: a promoter lobs 3 quick questions; pick the right answer from 2 options under a soft timer. Rewards: Funds/Inspiration + relationship with the interviewed member.

Each minigame: 20–45 seconds, one intro line, one outro line with a stat result, **no fail state** (worst = "rough but fine" flavor). Insert points: after arrival (Soundcheck), on a travel day (Pack the van), before preshow (Interview). Wire through the city JSON (a `minigames` array with gating flags) — content-only to add more later.

Gemini asset support (proven pipeline): one soft-gouache backdrop per minigame (e.g. a backstage soundboard, a van interior, a radio-booth) via `generate_image.py` → `process-bg.sh` → manifest, same as cities. See Part 5.

### D. Story depth (beef up without a rewrite)

1. **Deepen the 3 existing cities**: +1 location each (5→6), +2 relationship-pool entries each (→6), +1 alternate after-show variant each (flag-gated). Target ~800–1,000 words/city added (→ ~1,300–2,200/city total).
2. **Add city #4 (Berlin)** — unused tint `midnight_indigo`; the blueprint's ambition/experimentation tone; author to Mexico City's depth (~1,200+ words, 5 locations, 4–5 pool, 3 preshow, 1 song with 3 arrangements). This also unlocks the `Ambitious` ending tag's route≥6 condition once the pool is 4.
3. **Bandmate backstory beats**: 2 short gated scenes per bandmate ("letter from home" / "why they're here"), surfacing via relationship thresholds — deepens the relationship matrix the game already tracks.
4. **Micro-variety in dialogue**: occasional 2-line nodes with a tiny "…" pause, and one "silence" choice per city (a no-op that just changes flavor text) — cheap ways to stop the flow feeling uniform.

### E. iPhone/mobile fixes (the "can't see / unclear / unreadable" complaints)

1. **Safe-area-first layout**: move every interactive element above `H ≈ 1230` game px; add `env(safe-area-inset-bottom)` margin inside the panel/choice stack; verify at 390×844 and 430×932 with `getBoundingClientRect()` (the game already has the measured 0.5417× scale method — reuse it).
2. **Readability pass**: bump dialogue body to ≥24px game px (≈13 CSS px at 0.54× — still small; consider a min 26px), button font ≥24px, higher-contrast text shadow on dialogue over painted backgrounds (the scrim exists — strengthen it under choices).
3. **Hit-target audit screen-by-screen** (Settings, BandCreator, RoutePlan, Hub): every tappable ≥64 game px tall OR explicitly padded (Button.ts's +8 pad already exists; extend per-layout where spacing allows). Fix the Settings volume +/- pair and genre grids with real spacing (flagged in handoff §4.8 — now the explicit ask).
4. **Full-screen capture test on iPhone viewport** (Playwright `resize_window` to iPhone 12/14 preset) for every screen — not just the two fixed so far.

---

## Part 4 — What NOT to do (guardrails)

- **No new systems**: no Wellbeing/Groundedness/vice layer (still deferred — owner decision pending). Minigames reuse existing rhythm/state machinery.
- **No audio-file swap**: procedural ambience stays. Only optional: a Lyria Title theme.
- **No asset-ifying the UI**: painted world + code-drawn UI stays the rule.
- **No punishing difficulty**: every minigame and the rhythm stay no-fail; accessibility settings (relaxed mode, wiggle room, autoplay, no-fail) remain intact and re-verified after any change.

---

## Part 5 — Gemini asset generation (proven, do this alongside content)

- **Minigame backdrops** (3): soundboard/backstage, van interior, radio booth — soft-gouache style block from `docs/asset-probes/lisbon_bg_probe.png`, portrait 9:16, via `generate_image.py` → `scripts/process-bg.sh` → manifest entry.
- **Berlin background**: one 2K city backdrop, `midnight_indigo` palette.
- **Portrait mood-2 variants (optional)**: reuse `scripts/generate-portraits.sh` identity blocks, image-to-image from bases, **vivid green bg, then open the contact sheet and look** (bug #14 rule).

---

## Part 6 — Close-out definition

**Done when:**
1. Two-finger simultaneous taps register on distinct lanes (verified live); per-lane judgement feedback shows at the correct lane; playfield moved up + lanes widened; charts re-tuned with rests + a hand-authored hero chart.
2. Dialogue box feels alive: portrait animation, typewriter SFX, advance chevron, auto/skip toggles; choices always inside the safe area at 390×844.
3. 3 minigames live and reachable in a normal run, JSON-defined, no-fail, each rewarding a stat/flag; Gemini backdrops wired.
4. Berlin city live with painted background; all 3 old cities deepened; bandmate backstory beats present.
5. Safe-area + readability + hit-target audit green at iPhone 12/14 viewports; nothing interactive under the home indicator.
6. `npm run typecheck && npm test` green (39 + new tests: minigame logic, multi-touch config sanity, new schema fields); live URL curls 200.

---

## Part 7 — Research grounding (citations)

- Phaser 3 input docs — `input.activePointers`, multi-touch: `docs.phaser.io/phaser/concepts/input`
- r/gamedesign "Your experience with rhythm games" — tightness/feedback/latency is the top factor
- Exceed7 "Game design and notecharting" — readability over density; sparse charts with rests; don't clutter
- VNConf 2025 (Kigyo) "Make your visual novel readable" + r/visualnovels / Lemma Soft textbox threads — ADV box, contrast, portrait, name accent
- Ari Made "I played over 100 visual novels…" — autoplay/skip/rollback are expected QoL
- Andrew Russell "How to Design a Good QTE" + r/gamedesign "Why everyone hates QTEs" — sparse, verb-tied, low-stakes QTEs win
- r/CozyGamers "why do recent cozy games miss the mark" — "mostly lack of content… feel empty/repetitive" = the exact complaint Jameson has
- WebKit "Designing Websites for iPhone X" + Polypane safe-area guide — viewport-fit=cover + env(safe-area-inset-*)

---

## Part 8 — Bottom line

The game's engine is solid; its *interface to the player* is not yet mobile-grade. The three highest-leverage fixes, in order: **(1) multi-touch + a raised, widened rhythm playfield with per-lane feedback** (fixes "rhythm gameplay is poor"), **(2) a living textbox + safe-area layout + bigger touch targets** (fixes "can't see/unclear/unreadable on iPhone"), **(3) three thematic minigames + Berlin + deeper pools** (fixes "bland, boring, empty"). Everything maps to existing systems and the proven Gemini pipeline. Resume prompt written, committed, pushed — `RESUME_PROMPT_BEST_IN_CLASS.md`.
