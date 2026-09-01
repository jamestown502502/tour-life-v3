# RESUME PROMPT — Tour Life v3: Onboarding, Depth & Close-Out

**Paste this to Claude Code at the start of the next session.** Read `HANDOFF.md`, `DESIGN.md`, `CLAUDE.md`, and `POLISH_ONBOARDING_DEPTH_PLAN.md` in the repo root first. Follow this prompt exactly. One run, three goals in order: **explain the game → deepen the content → fix the small things → verify at mobile → ship.**

---

```text
You are closing out the next pass on "Tour Life: International Dates" (tour-life-v3,
Vite + TS strict + Phaser 3.90). The game LOOKS good now (real painted Gemini backgrounds +
16 portraits are wired through the texture-key seam) but it has NO onboarding at all and its
content is thin (~460 words/city, scene pools at the schema minimum). Your job this run:
hand-holding, content depth, and the small polish items — in that order. Do NOT build the
Part 3 reality layer (Wellbeing/Groundedness/vices/Return Home) — the owner has explicitly
deferred it pending a tone/rating decision. Do NOT swap audio to files (procedural stays).

GROUND TRUTH YOU MUST TRUST:
- No tutorial/help system exists. Grep confirms: no "tutorial", "how to play", "onboarding",
  or help scene anywhere in src/ or content/.
- Content is JSON-only and the pipeline is proven. A new city needs ZERO engine changes;
  its background is the only non-JSON step (generate -> scripts/process-bg.sh -> manifest
  entry). Existing cities: content/cities/lisbon.json and tokyo.json (30 scenes each,
  ~460 words, pools: 3 relationships / 4 locations / 3 pre-show choices).
- The texture-key seam: every ensureX() in src/art/sprites.ts early-returns when
  scene.textures.exists(key); real assets load via BootScene.ts + public/assets/manifest.json;
  missing file = code-drawn fallback. Keep it that way.
- Assets live at public/assets/img/ (bg_*.webp, portrait_*.png). City backgrounds are
  processed by scripts/process-bg.sh <raw.png> then added to the manifest.
- API keys live in the WINDOWS USER env, not the shell. Load:
  KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')")
  Use native Windows paths (C:/Users/...) with native tools, not MSYS /c/ paths.
- Verdict-style notes: the 40-word-per-node pacing check in content/schema.ts is ENFORCED
  (throws in dev) — keep every node under 40 words. Schema requires locations >=3,
  relationshipScenePool >=2, preShowChoices >=2. Run `npm run typecheck && npm test`
  (37 tests today) after every phase.

PHASE 1 — EXPLAIN THE GAME (diegetic onboarding; do this first).
 1a. "How to Play" screen: a small button on Title ("How to Play", placed below the seed
     buttons; NOT a primary action). 3 short pages, touch-advance (tap), styled with the
     existing textStyle() + createButton() + DialogueBox visual language (sand card, plum
     text, gold accents, soft shadows). Pages: THE TOUR (choose a route, live on the bus,
     choices shape the story — "no wrong answers"), THE SHOW (tap notes as they reach the
     gold line; hold notes = press and hold; choice cues = tap the banner; relaxed mode
     exists if you want it), THE BAND (stats, relationships, scrapbook). Reuse existing UI
     chrome only — no new art.
     Done-when: a new player can reach it from Title and read all 3 pages on touch.
 1b. First-run guided beats (diegetic, once per save): the promoter NPC "Sol" introduces
     RoutePlan and Hub with 1-2 short DialogueBox lines the first time each screen appears,
     gated by existing flags (flag:onboard_routeplan, flag:onboard_hub — set them when the
     line plays). E.g. RoutePlan: "Pick the cities that feel right. You can't play them all —
     that's the point." Use the existing dialogue node structure or a simple per-screen
     inline hint. Zero new systems.
     Done-when: fresh save shows each intro exactly once; replaying a save never re-shows it.
 1c. Rhythm micro-tutorial (in-scene, first performance only): before Lisbon's first song on
     a fresh save, run a 3-beat unscored practice pass with a one-time label "Tap when the
     note touches the line!" — then the real song starts. No scoring on the practice pass;
     ignoring it must still proceed (no-fail guarantee holds). First song auto-selects
     relaxed mode if the player never opened Settings. First hold note and first choice cue
     each get a one-line in-scene hint the first time they appear.
     Done-when: a first-timer understands TAP vs HOLD vs CUE without reading docs; autoplay
     and no-fail still pass (re-run the all-miss path: must reach Results with "Rough night").
 1d. Contextual help: a small "?" button top-right on Hub, City, Rhythm, Scrapbook opens a
     one-line panel explaining that screen. Rhythm song 1 shows a corner legend
     "TAP = touch the note  HOLD = press & hold  CUE = tap the banner" once.
     Done-when: help reachable on all 4 screens at 390px width without overlap.

PHASE 2 — DUMMY-PROOF THE EDGES.
 2a. New Run with an existing save -> confirm dialog ("Start a new tour? Your current tour
     will be overwritten.") with Confirm/Cancel buttons (reuse createButton). Do NOT just
     overwrite silently.
 2b. Audit every screen's Back/exit path live in-browser: Title->How to Play->Back,
     Settings->Back (already exists via launch/pause), Scrapbook->Title. No dead-ends.
 2c. Persistent goal line on Hub under the Travel button: surface the city's current phase
     objective (CityScene already knows phase; show e.g. "Tonight: soundcheck at the Fado
     House" from the current location/phase).
 2d. Mobile spacing pass: Settings volume +/- pair and BandCreator genre/why-tour grids —
     every touch target >= 44px at 390x844 WITHOUT hit-area overlap (handoff §4.8 flagged
     this residual gap; close it with real spacing, not more blanket padding).
     Done-when: measured getBoundingClientRect() at 390px shows >=44px targets, no overlaps.

PHASE 3 — THE TWO COSMETIC FIXES.
 3a. Favicon: add public/favicon.svg (64x64 gold music note on plum, hand-written SVG — no
     image tool needed) + <link rel="icon" href="/favicon.svg"> in index.html. Kills the
     favicon.ico 404 on every load. Done-when: network tab shows no favicon 404.
 3b. (Optional, only if 1-3a land clean) Title theme: one Lyria clip loop for the Title
     screen ONLY via generate_music.mjs (C:/Users/Jbthi/.claude/skills/user/game-music-
     generator/scripts/generate_music.mjs --model clip), self-hosted in public/audio/, played
     on Title after unlock. Do NOT touch the procedural per-city ambience. If the generation
     or wiring fights you, skip it and report — it is explicitly optional.

PHASE 4 — CONTENT DEPTH (the bigger lift; do this after onboarding is stable).
 4a. Deepen Lisbon + Tokyo FIRST (cheap, high replay value): add 2 relationship scenes to
     each pool (3 -> 5) and 1 new location each (4 -> 5). Pure JSON. Keep nodes <=40 words.
     Re-run validate (npm test) and playtest the new scenes via
     window.__game.scene.start('City', {cityId:'lisbon'}) jump.
 4b. City #3, fully authored. Pick ONE with an unused tint (blueprint table, choose:
     Mexico City community/percussion -> citrus_bloom, OR Berlin ambition/experimentation ->
     midnight_indigo, OR Reykjavik isolation/ambience -> lavender_dusk — your call, keep it
     consistent with that tone). Author in content/cities/<id>.json, matching the Lisbon
     template exactly (locations >=4, relationshipScenePool 4-5, preShowChoices 3, song with
     3 arrangements, collaborator NPC + gift, story gate, weather pool, arrival/preShow/
     afterShow/journal scenes, storyGate condition). Word budget: 1,200-1,800 words — a real
     step toward the 3,200 target, honestly below it; keep every node <=40 words (enforced).
 4c. New song for city #3 in content/songs/<id>.json: bpm per city tone, 3 arrangements,
     chart via the same algorithmic pattern as the existing songs (note grid per arrangement
     style), 55-70s duration.
 4d. City #3 background: generate via generate_image.py (2K, portrait ~9:16, style block
     from docs/asset-probes/lisbon_bg_probe.png — soft gouache, city's tint palette, "no
     text"), then scripts/process-bg.sh, then add {key:"bg_city_<id>", file:"img/bg_city_<id>.webp"}
     to public/assets/manifest.json. Confirm the manifest entry + code-drawn fallback.
 4e. (Optional, only if 4a-4d land clean) Wire the mid-tour complication mechanically — it's
     currently flavor-only (State.data.midTourComplication). Give it ONE real effect, e.g. a
     stat modifier applied at the route midpoint or a flag-gated after-show line. Small,
     surgical, in the existing state machine. If it touches systems more than ~15 lines, stop
     and report instead.
     Done-when: a full run includes city #3 with its painted background; Lisbon/Tokyo pools
     are 5; run playtime is measurably ~20-30 min (time it, don't guess).

PHASE 5 — VERIFY & SHIP (non-negotiable).
 1. npm run typecheck && npm test — all green (37 existing + new tests for anything added:
    onboarding flag gating, confirm-dialog logic, any new condition usage, city #3 schema).
 2. Live browser pass (Playwright, NOT the Claude_Browser pane): fresh save walks the FULL
    onboarding (How to Play -> BandCreator -> RoutePlan intro -> Hub intro -> City ->
    practice pass -> first song) with no confusion/dead-ends; New Run shows the confirm
    dialog when a save exists; all-miss run still reaches Results.
 3. Mobile 390x844 + 430x932: touch targets >=44px, no overlap, dialogue panel fits
    (PANEL_Y 740 + rows*58 + 14 <= 1280), safe-area ok.
 4. Screenshot before/after to docs/polish-before-after/ for onboarding + city #3.
 5. Deploy: npx --yes vercel@latest deploy --prod --yes  (NO --name flag; project linked).
    If it "hangs" at Building -> git-identity BLOCK, not a slow build; see HANDOFF.md §1 /
    bug #11. Repo-local git email is already fixed — do not change it.
 6. curl -s -o /dev/null -w "%{http_code}" https://tour-life-v3.vercel.app -> 200 AND title
    tag "Tour Life: International Dates". No favicon 404 in network tab.

HARD RULES:
- Do NOT build the Part 3 reality layer. It is deferred pending the owner's tone/rating call.
- Do NOT swap audio to files. Procedural ambience stays (chord-driven, crossfading, ducked).
  Only the optional Title theme (3b) may be a real file.
- Content JSON in /content stays schema-validated (nodes <=40 words enforced by validator).
- Keep all 8 accessibility settings intact. No-fail/autoplay guarantees hold (re-verify the
  all-miss path after ANY rhythm change).
- One system at a time; match existing style; surgical changes; don't "improve" adjacent code.
- Constants only in src/const.ts (circular-dep rule). New scene array/Map/Set fields MUST be
  reset in that scene's init() (Phaser reuses scene instances — bug #10 class).
- If you add any DialogueBox usage to a new scene, that scene's SHUTDOWN handler must call
  audio.duckMusic(false) unconditionally (bug #12 class).

FINISH with: files changed, new tests added + count, onboarding walkthrough result, city #3
word count + pool sizes, playtime measurement, mobile verification, favicon/404 status,
deploy verification, and anything deliberately deferred (reality layer, remaining cities,
optional items skipped). Report honestly.
```
