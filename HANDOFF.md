# Tour Life: International Dates — Handoff Document (v3)

**Written:** 2026-09-01, by Claude (Sonnet 5), for whichever agent (human or LLM) picks this up
next. **This supersedes v1 and v2.** Those were written mid-project, after specific passes
(initial vertical slice; an 8-phase visual/audio polish pass). This version is a full rewrite —
not another patch — written after the game reached a genuinely shippable state, and organized as
a *reference*, not a change-log. Historical "what changed" narrative is kept only where the
*why* prevents a future regression; see the bug ledger (§9) for that. `DESIGN.md` is the
*aspirational* blueprint — the original product spec, still the target to keep building toward.
This file is what's actually true in the code, today. Where they disagree, trust this file.

If you take away exactly three things from this document: **(1)** the game is finished-feeling
and deployed, but its content is roughly 15% of the blueprint's target — the engine promises
more story than exists yet. **(2)** every "what's missing" item beyond that content gap is a
*decision*, not an oversight — the Part 3 reality layer and a larger city roster were both
raised explicitly with the owner and explicitly deferred or declined; don't build either without
re-reading §7. **(3)** if a Vercel deploy looks stuck at "Building…" forever, it is almost
certainly not slow — see §1.

---

## 0. TL;DR — current state at a glance

A cozy rhythm-adventure browser game about an indie band's world tour, built as a playable diary.
Vite + TypeScript (strict) + Phaser 3.90. No React/Next. Deployed and publicly live.

- **Art:** real painted Gemini backgrounds (5) + character portraits (16, all 4 bandmates × 4
  moods), loaded over a full code-drawn fallback system through one texture-key seam (§5.1). UI
  chrome (panels, buttons, HUD) stays code-drawn on purpose — see the art-direction rule below.
- **Audio:** 100% Web Audio API synthesis — oscillators, filtered noise, a real chord-driven
  ambience engine with crossfading and music-ducking. No audio files at all.
- **Content:** 3 fully playable cities (Lisbon, Tokyo, Mexico City), each with arrival →
  exploration → a relationship scene → a rhythm performance → after-show → journal. Total
  ~2,221 words of prose across the three. See §6 for the honest per-city breakdown.
- **Systems:** seeded RNG (deterministic, shareable runs), a JSON node-graph dialogue engine, a
  4-lane rhythm minigame with real hold-note grading, a 6-candidate ending generator, scene-pool
  scarcity for replayability, meta-progression across runs, full onboarding for first-time
  players, 8 accessibility settings, IndexedDB save with schema versioning.
- **Quality bar:** typecheck clean (strict TS), 39/39 tests passing, a production build that
  succeeds, and everything below has been verified live in a browser — not just read as a diff.

**Art direction rule, deliberately chosen: painted world, code-drawn UI.** Backgrounds and
character portraits are real assets; panels, buttons, notes, dialogue lanes, and the rhythm HUD
stay code-drawn Phaser Graphics. Crisp vector chrome over painted art reads as intentional
design; replacing everything with generated art produces a mushier, less coherent look. If you
touch the art system, keep this split — don't "finish the job" by asset-ifying the UI too.

**Live:** https://tour-life-v3.vercel.app
**Repo:** https://github.com/jamestown502502/tour-life-v3 (private, owner `jamestown502502`)
**Vercel project:** `tour-life-v3`, org `team_umNzYj4aX78WbIgY1mj5wNNy`, project id
`prj_icJ8x5VqVsxc9U25QzPYMfF8qKEn`

---

## 1. How to run, test, and deploy

```bash
cd tour-life-v3
npm install
npm run dev        # Vite dev server on http://localhost:5183
npm run typecheck  # tsc --noEmit, strict mode — should be silent
npm test           # vitest run — 39 tests across 7 files
npm run build      # tsc && vite build -> dist/ (check dist/fonts/ exists — see §5.2)
```

Launch config for the Browser-pane preview tooling: `C:\Users\Jbthi\Claude Cowork\.claude\launch.json`,
entry `"tour-life-v3"`. Uses the Windows 8.3 short path
`C:\Users\Jbthi\CLAUDE~2\TOUR-L~1` — Vite's `fs.strict` allowlist rejects the long
path-with-spaces otherwise; `vite.config.ts` also sets `fs.strict:false` as defense in depth.
Regenerate the short path (`(New-Object -ComObject Scripting.FileSystemObject).GetFolder($p).ShortPath`)
if the repo ever moves.

### Deploying

```bash
git push
npx --yes vercel@latest deploy --prod --yes
```

**Do not use `--name`** — deprecated on the current CLI; the project is already linked via
`.vercel/project.json`.

**If the CLI prints `Building…` and then sits there for minutes with no further output, do not
assume it's a slow build and do not keep retrying** — every retry just adds another permanently-
`BLOCKED` deployment to clutter the list. The deployment is not actually building; it's
`BLOCKED` server-side because Vercel couldn't verify the git commit author, and the CLI's own
status output (`UNKNOWN`) hides this completely. This has already been fixed once (repo-local
git `user.email` is deliberately set to a GitHub-verified noreply address, `214519214+jamestown502502@users.noreply.github.com`
— **do not change this back to the user's real email** without re-reading §9 bug #11), but if it
recurs, diagnose with the deployment's raw JSON:

```bash
node -e "
const fs = require('fs');
const token = JSON.parse(fs.readFileSync(process.env.APPDATA + '/xdg.data/com.vercel.cli/auth.json', 'utf8')).token;
fetch('https://api.vercel.com/v13/deployments/<DEPLOYMENT_ID>?teamId=team_umNzYj4aX78WbIgY1mj5wNNy', { headers: { Authorization: 'Bearer ' + token } })
  .then(r => r.json()).then(d => console.log(d.readyStateReason));
"
```

A `readyStateReason` mentioning "no git user associated with the commit" confirms the
git-identity issue. This project does **not** have SSO deployment protection — a plain `curl` to
the live URL should return `200` with real game HTML, not a login redirect.

**Verifying a deploy worked:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://tour-life-v3.vercel.app
curl -s https://tour-life-v3.vercel.app | grep -o '<title>[^<]*</title>'
```
Expect `200` and `<title>Tour Life: International Dates</title>`. Hand the user the stable alias
(`https://tour-life-v3.vercel.app`, auto-repoints to current production), never the per-deploy
hash URL (`tour-life-v3-<hash>-jameson-s-projects.vercel.app` — an immutable snapshot that does
NOT update on the next deploy).

---

## 2. Tech stack (decided — don't relitigate without a real reason)

- **Vite 6 + TypeScript 5 (strict) + Phaser 3.90.** No React, no Next.js, no CSS framework.
- **All UI/game art is code-drawn:** `Phaser.GameObjects.Graphics` → `generateTexture()`, cached
  by a string key. See `src/art/sprites.ts` (~430 lines — portraits, UI chrome, backgrounds,
  rhythm/crowd/cue art all live here). Real painted assets load *over* this system through one
  seam — see §5.1 — rather than replacing it.
- **All audio is Web Audio API synthesis:** oscillators, filtered noise, a chord-driven ambience
  engine (pad + arpeggio + bass pulse + room-tone noise bed). `src/core/audio.ts` +
  `src/core/musicTheory.ts`.
- **Two self-hosted variable-weight webfonts** (Baloo 2 display, Nunito body) are the *only*
  non-code-drawn, non-Gemini-generated assets in the game — self-hosted specifically to avoid a
  CDN hotlink at runtime, from `public/fonts/`.
- **Content is JSON** in `/content`, hand-validated (no JSON-Schema library — see
  `content/schema.ts`) at load time, with a dev-mode `throw` on any validation failure so bad
  content can never silently reach runtime state.
- **State is a module-singleton class** (`src/core/state.ts`'s `State` export) — one live
  `RunState` object, mutated in place, not a reducer/store pattern.
- **Save is IndexedDB with a localStorage fallback**, schema-versioned (`schemaVersion: 1`, with
  a `migrate()` hook already in place for the next version bump — currently a no-op since v1 is
  the only version that has ever existed).
- **Tests are Vitest, pure-logic only** — no Phaser/DOM in the test environment (no jsdom
  configured; one test file ships its own tiny in-memory `localStorage` shim rather than adding
  a DOM dependency for that). 39 tests across 7 files.
- **No CI.** `npm run typecheck && npm test` in a GitHub Action would catch regressions
  automatically and does not exist yet — see §10.

---

## 3. The gameplay loop

### 3.1 Macro loop — one full run (Scale.FIT canvas, 720×1280 game units, portrait-oriented)

```
Title ──(New Run)──► BandCreator ──► RoutePlan ──► Hub ⇄ City[per stop] ──► Scrapbook ──► (Title)
  │                                                    │
  └─(How to Play, Settings, Tour Gallery, seed replay)  └─(Settings, launched paused-over-Hub)
```

- **Title** — band-agnostic entry point. New Run (with an overwrite confirm if a save exists —
  see §5.4), New/type-a-seed, Continue (resumes exactly where you left off via a
  `progress: {screen, cityId?, nodeId?}` pointer persisted on every state change), Settings,
  Tour Gallery (meta-progression history), How to Play.
- **BandCreator** — name the band, pick a genre (4 base + any meta-unlocked extras), pick a
  "why this tour" beat (4 options, flavor + nothing mechanical), see the 4 fixed bandmates
  (Mira/Theo/Jun/Rowan — their identities are NOT player-chosen, only the band's framing is).
- **RoutePlan** — `generateRoute()` seed-picks from the city pool (currently all 3, since the
  pool is ≤6 — see §6) in a shuffled order, one weather variant per city from that city's
  `weather` array, and one mid-tour complication from a pool of 6 (now mechanically real — §3.3).
  Confirming draws each city's relationship-scene-pool availability (§3.3) for this run.
- **Hub** — the tour bus, visited between every city. Shows stat bars, a corkboard of collected
  souvenirs, unlocked meta-decor, and "Travel to `<next city>`" (or "Wrap the tour" once the
  route is exhausted, which computes the ending and goes to Scrapbook). This is also where the
  mid-tour complication's stat effect fires, once, at the route's midpoint.
- **City** (one visit per route stop) — see §3.2, this is where the actual content lives.
- **Scrapbook** — the generated ending (§4), route recap, setlist, souvenirs collected, final
  relationship values, "Start a new tour" (clears the save).

### 3.2 Micro loop — one city visit (`src/ui/CityScene.ts`, a single scene reused across phases)

```
arrival (1 scene, 3 choices)
  → locations (visit 2 of the city's 4-5, each 1 scene + 2-3 choices; the rest are dead this run)
    → relationship (1 scene from that city's pool, drawn at RoutePlan-confirm time — §3.3)
      → preshow (1 flavor scene, no choices)
        → preShowChoices (2-3 buttons, NOT dialogue — picks the song arrangement, one may be
                           gated behind a storyGate condition)
          → [hands off to RhythmScene — see §3.4]
            → Results (grade + score, purely informational)
              → afterShow (1 scene, 2 choices)
                → journal (1 scene, no choices, closes the city)
                  → back to Hub, currentCityIndex += 1
```

Every dialogue node is data (`content/cities/<id>.json` → `DialogueNode` in
`content/schema.ts`), walked by `src/game/dialogue.ts`'s ~70-line `resolveNode`/`applyChoice`
engine. A choice can apply `effects` (stat deltas), `relationshipEffects` (per-bandmate), set
`flags`, and gate on a `condition` expression (`stat.x>=n` / `relationship.x>=n` /
`localLove.x>=n` / `flag:x`, ANDed with `&&`, evaluated by `src/game/condition.ts` — a tiny
regex-based evaluator, no `eval()`). Every node's `text` is capped at 40 words, enforced at
content-validation time (`content/schema.ts`'s `validateSceneGraph`) — this is a real,
throwing-in-dev constraint from the blueprint's pacing rule, not a suggestion.

### 3.3 Replayability mechanics — what actually makes two runs different

- **Seeded RNG** (`src/core/rng.ts`, mulberry32): route order, per-city weather pick, the
  mid-tour complication, and scene-pool draws are all deterministic per seed — the same seed
  string reproduces the identical run, and a shareable seed is a first-class Title-screen
  feature ("type a seed to replay a run").
- **Scene-pool scarcity** (`src/game/scenePool.ts`): each city's `relationshipScenePool` (4-5
  entries) is NOT all shown every run. At RoutePlan-confirm, `drawScenePoolFlags()` draws 1-2
  entries per city (all of them if the pool has ≤2) and flags them `avail_<sceneId>`; `CityScene`
  only offers the first available entry from the pool. **This means most players never see most
  of a city's authored relationship content in any single run** — the honest word-count numbers
  in §6 undercount what a player actually experiences per run, but the full pool is real content
  a second run with the same city can surface differently.
- **Location visits are also partial**: each city has 5 locations, but `LOCATIONS_TO_VISIT = 2`
  (a constant in `CityScene.ts`) — 3 locations go unvisited every run, again meaning single-run
  playtime undercounts total authored content.
- **The mid-tour complication** (`src/game/route.ts`'s `MID_TOUR_COMPLICATIONS`, 6 options) is
  drawn once per route and, as of this pass, has one real stat-delta effect (§below), applied
  once at the route's midpoint Hub visit — previously purely flavor text.
- **The storyGate pattern**: each city's `preShowChoices` includes one option gated on a
  condition (Lisbon: `stat.harmony>=30`; Tokyo: `relationship.rowan>=30`; Mexico City:
  `stat.harmony>=35`) that unlocks a distinct song arrangement — a run that never crosses that
  threshold literally never hears that arrangement.
- **Meta-progression** (`src/game/meta.ts`) persists ACROSS runs (not wiped by `State.newRun()`,
  unlike almost everything else in `RunState`): completing a run unlocks the next genre (of 6)
  and next décor item (of 10) from fixed pools, visible in BandCreator and Hub respectively, and
  appends to the Tour Gallery's run history.

### 3.4 The rhythm minigame (`src/ui/RhythmScene.ts`, `src/game/rhythm.ts`)

4 lanes, notes fall from `SPAWN_Y` to a hit line over a 1600ms lead time, tap/hold/choice-cue
note types. Judgement tiers: perfect/good/ok/miss, each with its own timing window
(`RHYTHM_WINDOWS`), scaled by the player's `rhythmMode` (relaxed/standard/expert) and an
optional "wiggle room" accessibility multiplier. **Hold notes are graded for real** (not
cosmetic): the initial press is judged like a tap, then `combineHoldJudgement()` softens or
keeps that judgement based on what fraction of the note's actual duration was held (≥85% keeps
it, 50-85% softens one tier, <50% is a miss) — see §9 bug #5/#10 for why this matters and what
broke building it. **Score never gates the story** — this is the core design promise, not a
suggestion: `buildPerformanceResult()` always returns a valid result regardless of how badly the
song went, `ResultsScene` always proceeds to `afterShow`, and this is directly re-verified by
`headless_playtest.test.ts`'s "reaches after-show and scrapbook even with a rough performance"
case, which judges every single note as a miss and asserts the run still completes.

A first-time player's first-ever rhythm scene gets a short non-interactive practice demo first
(§5.5) and, if they've never opened Settings, runs with relaxed timing windows for that one song
only (never mutates their saved `rhythmMode`).

---

## 4. Endings & the Scrapbook

`src/game/endings.ts`'s `generateEnding(state)` is a pure function, deterministic given the
run's final tracked state — same final stats/relationships/localLove/route always yields the
same ending, no hidden randomness at ending-computation time (the *inputs* to it came from
seeded RNG earlier, but the ending formula itself doesn't re-roll).

**6 candidate endings**, each scored from final run state, highest score wins:

| Ending | Score formula | Tags |
|---|---|---|
| Found Family Tour | avg(relationships) + harmony | Tender, Community-Minded |
| Breakout Circuit | funds/10 + avg(localLove) | Electric, Ambitious |
| Live Album | inspiration + harmony×0.5 | Electric, Ambitious |
| Beloved Small Tour | avg(localLove) + harmony×0.5 | Tender, Community-Minded |
| Next Chapter | inspiration + funds/20 | Restless, Ambitious |
| Quiet Ending | (100−harmony) + (100−avg(relationships)) | Weathered, Tender |

Plus up to 2 **extra tags** layered on: `Ambitious` if the route had ≥6 stops (currently
impossible with only a 3-city pool — see §6, this tag is presently dead code in practice, not a
bug, just unreachable until a 4th+ city exists), and `Community-Minded` if average relationship
>50 and the winning ending didn't already have that tag. Final tag list is deduped and capped at
4. The Scrapbook screen shows: the ending's id (title-cased) + its tags, the route as a city
chain, the setlist (song ids visited), souvenirs collected (one per city's collaborator gift,
plus a bonus "warped cassette tape" item if a specific Lisbon flag was set), and final per-
bandmate relationship numbers.

**This is honestly a fairly light ending system relative to the blueprint's ambition** — 6
labeled buckets driven by 4 linear formulas over the same 3-4 tracked numbers, not a branching
narrative epilogue. It produces real variety (two different seeds are asserted to diverge in
`headless_playtest.test.ts`, and do — via weather, scene draws, or the ending itself) but it's a
*scorecard* ending, not a written one. The blueprint's actual epilogue ambition — six-months-
later, per-bandmate narrative landings (Thriving/Healing/Coasting/Quiet danger) — is part of the
deferred Part 3 reality layer (§7.1), not built.

---

## 5. Core systems reference

### 5.1 The real-asset seam (`src/art/sprites.ts`, `src/core/assets.ts`, `src/ui/BootScene.ts`)

Every `ensureX()` texture function in `sprites.ts` goes through a shared `withGraphics()`
helper, which **early-returns if `scene.textures.exists(key)`**. `BootScene` (the first scene in
`main.ts`'s scene list) fetches `public/assets/manifest.json` (a flat `[{key, file}]` list) and
loads every entry through Phaser's real asset loader before starting Title. Registering a real
image under the same key a code-drawn function would generate makes the real image win, and the
code-drawn version simply never runs — no "asset mode" flag, no parallel branch to maintain. A
missing or corrupt manifest entry logs a warning and silently falls back to code-drawn; an empty
or absent manifest is a fully valid, fully playable all-code-drawn state (this is how the game
ran for its entire first build phase).

`hasRealAsset(key)` (`core/assets.ts`) lets a scene ask which it got, needed because some
code-drawn art is composed *against its own background* — the Hub bakes a window frame and
corkboard shape into `bg_hub` and overlays a tinted pane + souvenir chips at those exact
baked-in coordinates; painted bus art puts its windows wherever the model drew them, so the pane
overlay is skipped when real art is present (it already conveys "night outside" on its own) and
the corkboard gets a standalone drawn backing instead of floating on nothing.

**preBoot is a trap** (see §9 bug #13): a texture registered before the WebGL renderer exists has
no GL texture behind it and crashes the first render. Real assets load from a proper Scene
(`BootScene`) using `this.load.image()`, never from a `Phaser.Game` config callback.

### 5.2 Typography (`src/ui/textStyles.ts`)

One named-style system (`textStyle(name, overrides?)`, 9 presets: title/h1/h2/speaker/
dialogue/body/button/stat/small) that every `add.text()` call in the game goes through — no
inline `fontFamily` objects anywhere. Two self-hosted variable-weight webfonts (Baloo 2 display,
Nunito body). `main.ts` `await`s `document.fonts.load()` for both faces *before* constructing
`Phaser.Game` — a Phaser Text drawn before its font finishes loading silently falls back to the
browser default and **never re-renders once the font arrives** (Phaser bakes text to canvas at
creation time, doesn't watch for font-load events), so gating the whole boot on font-load avoids
that bug class entirely rather than patching around it.

### 5.3 Audio (`src/core/audio.ts`, `src/core/musicTheory.ts`)

`musicTheory.ts` parses a plain-text chord symbol like `"Am7"` (root + quality suffix from
`{'', m, maj7, m7, 7, 6, m6}`) into real frequencies via an interval table — this is how a
song's `chordProgression` field (plain content JSON) drives the ambience engine. `playAmbience
(chords, bpm, waveform)` builds a sustained pad + an 8th-note arpeggio (randomized per-pluck
gain, not a flat sequence) + a bass pulse on beat 1 of every bar + a quiet filtered-noise
room-tone bed, and **crossfades** (0.8s ramp both directions) rather than hard-cutting when
called again mid-scene. `duckMusic(true/false)` is called from `DialogueBox`'s constructor/
`setVisible`/`destroy`, halving the music bed while dialogue text is on screen — every scene
that creates a `DialogueBox` must also unconditionally un-duck in its own `SHUTDOWN` handler
(not rely on the box's own lifecycle) — see §9 bug #12 for the real bug this produced. A master
chain (low-shelf +2dB@200Hz → high-shelf -3dB@6kHz → `DynamicsCompressorNode`) sits before
`ctx.destination` for headroom, since the mix can get busy (pad+arpeggio+bass+noise+SFX
simultaneously during Rhythm). `window.__audio` is exposed in dev builds specifically because
audio bugs can't be "seen" in a screenshot — inspect `.isUnlocked()`, `['ctx'].state`,
`['musicGain'].gain.value`, `['musicNodes']` (truthy while ambience plays) directly.

### 5.4 Save/state (`src/core/state.ts`, `src/core/save.ts`)

`State` is one live module-singleton (`GameState` class) holding a `RunState` object, mutated in
place by helper methods (`applyStatDeltas`, `applyRelationshipDeltas`, `addFlag`, `addItem`,
etc.) rather than through a reducer. `State.newRun(seed)` rebuilds a fresh `RunState` but
**carries `meta` and `accessibility` forward** — those two are the only fields that survive a new
tour; everything else (stats, flags, route, inventory, relationships) resets. Saves go to
IndexedDB with a localStorage fallback, gated by `isValidRunState()` structural validation on
load (a save that fails validation is treated as no-save, not a crash) and a `migrate()` hook for
future `schemaVersion` bumps (currently a no-op — v1 is the only version that has ever shipped).

**New Run confirms before overwriting**: `TitleScene` tracks whether a save exists (via the same
`hasSave()` promise that gates showing the Continue button) and shows an in-scene modal
(dark backdrop + sand card, blocks click-through via `event.stopPropagation()`) before calling
`State.newRun()` if one does.

### 5.5 Onboarding (`src/ui/HowToPlayScene.ts`, `src/ui/HelpButton.ts`, `src/core/onboarding.ts`)

A 3-page How to Play screen (auto-opens once ever on a fresh player — tracked via a persistent
localStorage flag, reachable any time from Title otherwise), a one-line diegetic "Sol" NPC intro
the first time RoutePlan/Hub appear *each run* (run-scoped — meant to repeat gently on every new
tour, unlike the persistent flags below), a non-interactive tween-driven demo of TAP/HOLD/CUE
before a player's first-ever real rhythm song (deliberately decoupled from the real note/scoring
pipeline — `this.notes`/`this.cues` stay empty throughout the demo, so a stray tap during it is
a harmless no-op, not a special-cased guard), and a "?" help button on Hub/City/Rhythm/Scrapbook
opening a one-line explainer panel.

**Two flag systems, deliberately separate — know which one to reach for:**
- `State.data.flags` (run-scoped, wiped every `State.newRun()`) — for anything that should
  repeat once per *tour* (the RoutePlan/Hub intro lines; also all content-authored story flags).
- `src/core/onboarding.ts`'s localStorage-backed flags (persistent across every run, forever, for
  this browser) — for "has this player EVER seen X": the How to Play auto-open, the rhythm
  tutorial, whether Settings has ever been opened (used to decide if a first-timer's first song
  gets relaxed windows), and the first-hold/first-cue one-line hints.

### 5.6 Touch targets

At a 390px-wide mobile viewport, the canvas renders at a measured ~0.5417× scale (not assumed —
directly measured via `canvas.getBoundingClientRect()`). A button needs its raw canvas-unit
dimension to clear roughly 65px (accounting for `Button.ts`'s own +8px hit-area pad on each
side) before it scales down to a real ≥44 CSS-px touch target. `Button.ts` already pads every
button's *hit area* by 8px beyond its drawn size as a baseline; Settings' volume +/- pair and
BandCreator's genre/why-tour grids additionally needed their raw *drawn* size increased (not
just more padding, which would have started overlapping neighbors at their original spacing) —
this was closed in this pass; see §9 bug entries and §8 for what's still not fully covered.

---

## 6. Content depth — the honest numbers

| City | Words | Locations | Relationship-pool entries | preShowChoices | Song |
|---|---|---|---|---|---|
| Lisbon | ~513 | 5 | 5 (all 4 bandmates + a 2nd Jun arc) | 3 | `sailor_lullaby` |
| Tokyo | ~498 | 5 | 5 (all 4 bandmates + a 2nd Mira arc) | 3 | `neon_rain` |
| Mexico City | ~1,210 | 5 | 4 (all 4 bandmates) | 3 | `callejon_groove` |
| **Total** | **~2,221** | **15** | **14** | **9** | **3** |

Blueprint target (`DESIGN.md`): ~3,200 words **per city**, 12-16 cities in the pool (player
picks 6-8 per run), a 3-4 hour "every run feels different" promise. **Current content is roughly
15-20% of that target by word count, and 3 of 12-16 cities exist.** A single run currently plays
in ~10-20 minutes depending on how much dialogue a player lingers on and how the rhythm songs go
(each song is a real ~55-70 second timer-driven event, not skippable). This is the single
biggest gap between "how the game feels" (finished, polished, onboarded) and "how much game
there is" (a fraction of the vision) — see §7 for why it hasn't been closed further and what the
options are.

**Content-authoring pipeline is proven, cheap, and needs zero engine changes**: adding city #4
means writing `content/cities/<id>.json` to the exact schema `content/schema.ts` enforces
(locations ≥3, relationshipScenePool ≥2, preShowChoices ≥2, every node's `text` ≤40 words,
validated and throwing in dev if violated), a matching `content/songs/<id>.json` (can be hand-
authored or built with `scripts/generate-chart.mjs`'s motif-based approach — see §11.2), a
generated background (`scripts/process-bg.sh` pipeline — §11.1), and two lines in
`src/game/content.ts` (an import + adding it to the `CITIES`/`SONGS` arrays). Proven twice now —
once building Mexico City from scratch, and confirmed by `headless_playtest.test.ts` (which
iterates `State.data.route` generically) passing unmodified both times.

**Word-count caveat, important:** the numbers above are *authored* totals, not what a single
playthrough shows. Scene-pool scarcity (§3.3) means a run only sees 1-2 of each city's 4-5
relationship entries and 2 of 5 locations — real single-run content is meaningfully less than
the table implies, which is a genuine replayability feature, not a shortfall, but worth knowing
when reasoning about "how long is one run" vs. "how much was actually written."

---

## 7. What was deliberately left out — read before building either of these

Both of the items below were raised explicitly with the project owner during this pass and
answered directly. Neither is a gap waiting to be closed by a future agent's initiative — both
need the owner's own go-ahead, on the owner's own terms, before any code or content gets written.

### 7.1 The Part 3 "reality layer" — fully deferred, zero code, zero content

`DESIGN.md`'s Part 3 (its own §20-21) specifies a second, slower layer: two new background stats
(**Wellbeing** — what the tour costs physically/emotionally; **Groundedness** — connection to
home/self, "the player's real health bar," never a fail state, only ever a story-shaping one), a
**Vices ledger** (stimulants buy Energy and accrue withdrawal debt, depressants buy sleep and
accrue "Haze" — modeled as a slow accruing number, "never a cutscene moral"), road-between-shows
"Dead Time" beats where this content would actually live, and — the centerpiece — **The Return
Home epilogue**: a second ending act, six months later, computing a per-bandmate narrative
landing (Thriving / Healing / Coasting / "Quiet danger" — the last one explicitly specified as
rendered "gently and honestly," never framed as player failure).

The blueprint itself already specifies the safety mechanism for this: a first-launch, opt-in,
re-openable **tone dial** ("Warm," default — allusive, no substance names, no exploitation
shown; vs. "Raw," explicit) plus a **content-warning card**. This is real, thoughtful blueprint
design for handling mature themes responsibly — it was never built, because Part 3 as a whole
was never started.

**What happened this pass:** the owner asked directly for a version of this calibrated to read
as dark/mature while still being "subtle" enough to pass Google Play's content-rating review as
something milder than it actually is. That specific framing was declined — building content
designed to misrepresent its own maturity level to a platform's rating review is a form of
deceiving that review process, independent of whether the underlying content itself would be
fine if honestly rated (an app that gets flagged for exactly this after the fact risks takedown
or a developer-account strike, which is a worse outcome for the actual product than not having
the content at all). An honestly-rated alternative (tasteful implication, rated to match) was
offered in its place; the owner chose to skip the reality layer entirely rather than pursue that
either. **If a future request revisits this, the honest-rating path is still open and legitimate
— just make sure that's actually what's being asked for, not a rephrased version of the same
"calibrated to slip past review" request.**

### 7.2 A larger city roster (4th, 5th, up to the blueprint's 12-16)

`DESIGN.md`'s city-pool table names Tokyo/Lisbon/Mexico City/Berlin/Reykjavík/São Paulo/
Melbourne "+ more" as the intended 12-16-city pool, with players picking 6-8 per run. Explicitly
raised this pass (add a 4th/5th city at Mexico City's depth before closing out, or ship with 3)
— the owner chose to ship with 3, citing wanting to close out the session. This is a pure scope/
time decision, not a technical blocker: §6 already establishes the pipeline is proven and cheap.
If you're asked to add cities later, the template to match is Mexico City's — 5 locations, 4-5
relationship-pool entries, 3 preShowChoices with one storyGate-conditioned arrangement,
1,200-1,800 words, a collaborator NPC + gift, a distinct `CITY_TINTS` entry (6 of the 8 named
tints in `src/art/palette.ts` are still unused: `lavender_dusk`, `rose_gold`, `forest_moss`,
`desert_clay`, `midnight_indigo`).

### 7.3 Smaller, lower-stakes deferrals (not decisions, just not done)

- **Real audio files.** Deliberately not pursued — the procedural ambience is chord-driven,
  crossfading, and duckable in a way static files can't replicate without losing per-city
  identity, and would add real payload weight. A single generated Title-theme loop is the one
  place this might be worth reconsidering (see `docs/asset-probes` / the Gemini music-generation
  skill referenced in project memory).
- **CI.** No GitHub Action runs `typecheck`/`test` on push. Cheap to add, not yet done.
- **Real physical-device touch testing.** All mobile verification this whole project has been
  viewport emulation (measured `getBoundingClientRect()` math, not guessed) — never a real phone
  in hand.
- **The `Ambitious` ending tag's route-length condition** (`route.length >= 6`) is currently
  unreachable with only 3 cities in the pool — not a bug, just dead code until city #4+ exists.

---

## 8. Known residual gaps (polish, not architecture)

- **Touch targets** are meaningfully improved (§5.6) but not exhaustively audited screen-by-
  screen — Settings and BandCreator were the two flagged tight layouts and are fixed; if a new
  screen is added with a dense button grid, re-derive the same "(raw dim + 16px pad) × 0.5417 ≥
  44" arithmetic rather than assuming the general `Button.ts` padding alone is enough (it isn't,
  on its own, for a dense grid — that's exactly what happened here).
- **Hold-note visual feel** (the rail growing/shrinking) has been confirmed to render and score
  correctly under a rapid-tap stress test, but has never been watched in slow motion by a human
  to confirm the *visual* growth rate reads well — purely a "nobody's looked yet" gap, not a
  known defect.
- **Keyboard input (D/F/J/K)** for the rhythm lanes is implemented and mirrors the pointer path
  closely, but has never actually been pressed during live verification — only read from source.
- **The `Ambitious` route-length ending tag** — see §7.3.
- **A cold-boot-straight-into-Rhythm audio path** (skipping Title, where `audio.unlock()` always
  fires first in real play) is unexercised — `playAmbience` guards with `if (!this.ctx) return`
  so it should no-op gracefully, but this exact path has never been tested.

---

## 9. Full bug ledger (chronological — read before touching anything this list mentions)

*Original vertical-slice build:*

1. **`scene.add.dom()` mis-positions elements under `Scale.FIT`.** Fixed with
   `src/ui/htmlOverlay.ts`'s `createFloatingInput`, which polls the canvas's real
   `getBoundingClientRect()` instead of trusting Phaser's DOM plugin transform.
2. **`DialogueBox`'s choice buttons could render below the visible canvas** on 3+ choice nodes.
   Fixed by `PANEL_Y = 740` + hiding the panel during picker/preshow-choice UI. Re-verify the
   arithmetic (`panel.y + panel.height(300) + 14 + rows*58 <= 1280`) if you ever touch panel
   layout or choice-row spacing.
3. **A flawless rhythm performance couldn't reach 'perfect' grade** — `buildPerformanceResult`'s
   `maxPossible` formula assumed every hit already sat at the final capped combo multiplier.
4. **"Continue" crashed with `unknown city "undefined"`** — `TitleScene` didn't pass `cityId`
   when resuming into City. Fixed via `resumeTarget(progress)`.

*8-phase polish pass:*

5. Real hold-note grading replaced a cosmetic stand-in (not a bug — a flagged, documented gap
   that got closed; listed because it's the "looks done, isn't" class worth knowing about).
6. A broken `Graphics.fillPoints()` flat-array-to-points conversion, caught before shipping while
   building the spotlight-bandmate cue icon — `fillPoints` wants `Vector2Like[]`, not a flat
   number array.
7. `ensureHubWindowPane`'s gradient fill produced a fully blank texture — the first symptom of
   bug #8.
8. **`Graphics.fillGradientStyle()` bakes as fully transparent through `generateTexture()` in
   this Phaser/WebGL setup** — confirmed by direct pixel readback. Every gradient sky in the
   game had been silently invisible since it was written, masked only because the fill's
   start/end color happened to closely match the page's CSS background. Fixed with a hand-rolled
   `fillVerticalGradient()` (banded solid fills). **If `fillGradientStyle` ever reappears inside
   a `withGraphics()`/`generateTexture()` callback, that's this bug coming back.**
9. **`AudioSystem.playAmbience()`/`.duckMusic()` were fully implemented but never called from
   anywhere** — confirmed by grep. No background music had ever played, in any scene, despite
   the blueprint requiring it. Fixed by wiring both into every relevant scene.
10. **`RhythmScene.crowdFigures` wasn't reset in `init()`.** Phaser reuses scene instances across
    `.start()`/`.stop()` cycles; a second Rhythm visit crashed trying to `.setTexture()` on
    already-destroyed Image objects. **Any array/Map/Set instance field on any Scene must be
    explicitly reset in `init()`** — an initializer only runs once, at first construction.
11. **Vercel CLI deploys silently pile up `BLOCKED`, indistinguishable from a slow build.** Git
    commit author email wasn't verified on the connected GitHub account. See §1 for the fix and
    diagnosis — this is the single most likely thing to bite a future session.
12. **Ducked music could get stuck at half volume indefinitely** — `DialogueBox`'s own
    `setVisible(false)`/`destroy()` un-duck calls don't cover every path a scene can end through
    (e.g. journal's last line → straight to Hub, box never explicitly hidden). Fixed with an
    unconditional `audio.duckMusic(false)` in `CityScene`'s own `SHUTDOWN` handler. **Any new
    scene that creates a `DialogueBox` needs the same unconditional un-duck in its own shutdown
    — don't rely on the box's lifecycle alone.**

*Real-asset pass:*

13. **`preBoot` runs before the WebGL renderer exists** — see §5.1.
14. **The chroma-key verify gate cannot detect the key eating the SUBJECT**, only whether the
    background keyed out. A neutral gray portrait background sat too close to eye-whites and
    pale clothing; 15 of 16 portraits "passed" verification while shipping see-through eyes and
    holes in a shirt. Fixed by regenerating against vivid green and adding a mandatory
    contact-sheet visual check. **A metric passing is not the same as having looked.**
15. A stray edge artifact inflated one portrait's alpha bounding box, silently shrinking it ~40%
    relative to its siblings. Fixed with a minimum-run threshold (≥3 opaque pixels to count).
16. The legibility scrim's 40 bands used a `+1px` height fudge that, being semi-transparent,
    composited visibly on overlap. Fixed with exact integer band edges. (The same `+1` pattern
    in `fillVerticalGradient` is harmless — those fills are opaque.)

*Onboarding + content-depth pass:*

17. **Title's seed-entry field floated on top of every modal launched over it** — a real DOM
    `<input>` entirely outside Phaser's scene stacking; `scene.pause()` doesn't hide DOM
    elements. Already true for Settings before this pass (unnoticed — nothing there happened to
    collide); became visible once a second thing (How to Play) launched over Title. Fixed by
    hiding/showing the input in lockstep with Title's own `PAUSE`/`RESUME` events.

---

## 10. Environment gotchas

- **The Claude_Browser pane doesn't run `requestAnimationFrame` reliably while hidden/backgrounded**
  for this game — screenshots can time out or show stale/scaled content after a resize+navigate
  sequence. A follow-up `navigate()` to the same URL reliably clears it. For anything
  interaction-heavy, prefer dispatching synthetic `mousedown`/`mouseup` events directly via
  `javascript_exec` (Phaser listens for real `MouseEvent`s, not synthetic `PointerEvent`s) over
  the `computer` tool's coordinate-click, which can hang after such a sequence.
- **A dynamically-`import()`-ed module from the browser console is NOT guaranteed to be the same
  module instance the running game is using.** Attempting to mutate `State` this way to shortcut
  manual testing silently operates on a *different* fresh singleton — confirmed the hard way
  this pass (`State.data.route[0]` came back `undefined` after supposedly setting it). Don't use
  this as a testing shortcut; drive the actual UI instead, or use `window.__game`'s already-live
  scene instances.
- Editing source files while a dev-server tab is open triggers a Vite HMR reload, silently
  resetting the game to Title — if something "mysteriously" jumps back to Title mid-test, check
  whether a file was just edited.
- Real wall-clock time passes between tool calls, and Phaser's clock is tied to it — a ~60s
  rhythm song can genuinely finish while several other tool calls happen, not because of a bug.
- `window.__game` (scene manager) and `window.__audio` are exposed in dev builds. Jumping scenes
  via `window.__game.scene.start(key)` from OUTSIDE any scene does **not** auto-stop the
  previously-running scene the way `this.scene.start()` called from *within* a scene does —
  call `.stop()` on the old scene explicitly first, or you'll get overlapping active scenes (this
  is also how bug-class "Title's DOM input bleeds through" symptoms can resurface purely as a
  testing artifact — real in-game navigation always goes through `goTo()`, which uses the
  per-scene `this.scene.start()` form and doesn't have this problem).
- The 8.3 short-path requirement for the dev server (§1) and the repo-local (not global) git
  identity override (§1) are both specific to this machine/repo — don't propagate either
  workaround to a different project without re-reading why.

---

## 11. Authoring guides

### 11.1 Adding or regenerating a background

```bash
export GEMINI_API_KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')" | tr -d '\r')
cd ~/.claude/skills/threejs-image-generator
uv run scripts/generate_image.py --resolution 2K \
  --prompt "Soft gouache painting, cozy storybook illustration style, portrait orientation 9:16. <scene description>. Painterly brushwork, warm inviting palette, no sharp-focus people in the foreground, no text, no border, no frame." \
  --filename "<repo>/public/assets/img/<id>_bg.raw.png"
cd <repo> && ./scripts/process-bg.sh public/assets/img/<id>_bg.raw.png public/assets/img/bg_city_<id>.webp
rm public/assets/img/<id>_bg.raw.png
```
Then add `{"key": "bg_city_<id>", "file": "img/bg_city_<id>.webp"}` to
`public/assets/manifest.json`. No code changes. `process-bg.sh` handles three non-obvious,
measured things: Gemini renders a painterly border regardless of prompt instructions (6% inset
crop removes it), output aspect is close-but-not-exact 9:16 (normalized so the runtime cover-fit
is a safety net, not doing real work), and a raw 2K PNG (~6.3MB) becomes a WebP at q82 (~60-340KB)
with no visible loss.

### 11.2 Adding a song

Hand-author `content/songs/<id>.json` to the `SongDef` shape in `content/schema.ts` (bpm, lanes,
`chordProgression` as a plain chord-symbol string, `waveform`, `arrangements[]` each with
`notes[]`/`cues[]`), or use `scripts/generate-chart.mjs` as a starting template — it's a small
deterministic generator (motif-based note placement cycling through a fixed lane order, holds
substituted periodically, 2-3 cues placed proportionally through the track) matching the pattern
already established in the shipped songs. It's a one-off script, not wired into the build; copy
and adapt it per song rather than trying to make it fully generic.

### 11.3 Adding a city

Match `content/cities/mexico_city.json`'s structure exactly (see `content/schema.ts`'s `CityDef`
for the authoritative shape): `locations` (≥3, schema minimum; 5 is the established norm),
`relationshipScenePool` (≥2 minimum; 4-5 established), `preShowChoices` (≥2 minimum; 3
established, with the pattern of one storyGate-conditioned special arrangement), a
`collaborator` NPC + gift, `arrivalSceneId`/`preShowSceneId`/`afterShowSceneId`/`journalSceneId`
each pointing into the `scenes` graph, and every node's `text` under 40 words (enforced). Pick an
unused `tint` from `src/art/palette.ts`'s `CITY_TINTS` (6 of 8 are still unused). Register it
with two lines in `src/game/content.ts` (import + push into `CITIES`/`SONGS`). Generate its
background (§11.1). No engine/TypeScript changes required for any of this — proven twice.

### 11.4 Adding portraits (new bandmate, or regenerating existing)

`scripts/generate-portraits.sh` (idempotent), the executable form of `docs/character-sheets.md`
— **keep those two in sync**, identity blocks must be reused verbatim across mood variants or
the character visibly drifts. Generate one base per identity text-to-image, derive the other
moods image-to-image from it. The background **must be vivid green** (`#00FF00`), never gray or
white (see bug #14) — and always open `docs/portrait-contact-sheet.png` and actually look before
trusting a run succeeded; the automated verify gate cannot catch the key eating the subject.

---

## 12. Prioritized next steps (current, not the stale ordering from earlier handoffs)

1. **More content, if this game is meant to grow toward the blueprint's scope.** The pipeline
   (§11.3) is proven and cheap; the question is purely how many more cities and how much deeper
   the existing 3 should go, which is a scope/time decision for the owner, not a technical one.
2. **CI** — `npm run typecheck && npm test` in a GitHub Action. Cheap, not yet done, more
   valuable now than ever given how much surface area (audio graph, texture generation, button
   hit-areas, onboarding flag state) has accumulated.
3. **Close the remaining touch-target gap fully** (§8) — a genuine screen-by-screen audit rather
   than the two specific layouts fixed so far, if the game is going toward a real mobile/app
   store release where this matters more than on desktop web.
4. **Hold-note visual polish** and **keyboard-input live verification** (§8) — low-risk, just
   unconfirmed by a human's eyes/hands yet.
5. **The Part 3 reality layer** (§7.1) and **a larger city roster** (§7.2) remain gated on the
   owner's own decision, on honest terms. Don't start either without that.

## 13. Open questions worth asking before assuming

- Is 3 cities / ~10-20 minutes per run "done" for this phase, or is more content depth a
  prerequisite before the live URL is actively promoted/shared further?
- If the reality layer is ever revisited, what's the actual tone-dial default the owner wants
  (`DESIGN.md` proposes Warm-by-default, opt-in Raw) — this is a real product decision, not
  something to infer.
- Is a real mobile/app-store release still the direction, or is this staying a browser-only
  cozy web game? That materially changes how much the touch-target/device-testing gaps (§8)
  matter.
