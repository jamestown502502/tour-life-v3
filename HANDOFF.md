# Tour Life: International Dates — Handoff Document (v3)

**Written:** 2026-09-01, last updated 2026-09-02, by Claude (Sonnet 5), for whichever agent
(human or LLM) picks this up next. **This supersedes v1 and v2.** Those were written mid-project,
after specific passes (initial vertical slice; an 8-phase visual/audio polish pass). This version
is a full rewrite — not another patch — written after the game reached a genuinely shippable
state, and organized as a *reference*, not a change-log. Historical "what changed" narrative is
kept only where the *why* prevents a future regression; see the bug ledger (§9) for that.
`DESIGN.md` is the *aspirational* blueprint — the original product spec, still the target to keep
building toward. This file is what's actually true in the code, today. Where they disagree, trust
this file.

If you take away exactly three things from this document: **(1)** the game is finished-feeling,
deployed, and — as of the close-out pass (§15) — structurally Android-ready (a full wrap runbook,
PWA scaffolding, haptics), but its content still averages roughly 33% of the blueprint's per-city
target (26-46% range) — the engine promises more story than exists yet, and 4 cities (of a 12-16
target) proved the authoring pipeline scales without engine changes but hasn't closed that gap on
its own. **(2)** every "what's missing" item beyond that content gap is a *decision*, not an
oversight — the Part 3 reality layer is fully deferred (§7.1) and a 5th+ city was never started
(§7.2), across two separate passes now; don't build either without re-reading §7. All 8 of the
originally-planned bandmate backstory beats exist as of §15.6 — that gap is closed. **(3)** if a
Vercel deploy looks stuck at "Building…" forever, it is almost certainly not slow — see §1.

---

## 0. TL;DR — current state at a glance

A cozy rhythm-adventure browser game about an indie band's world tour, built as a playable diary.
Vite + TypeScript (strict) + Phaser 3.90. No React/Next. Deployed and publicly live.

- **Art:** real painted Gemini backgrounds (6 city/hub/title + 3 minigame backdrops) + character
  portraits (16, all 4 bandmates × 4 moods), loaded over a full code-drawn fallback system through
  one texture-key seam (§5.1). UI chrome (panels, buttons, HUD) stays code-drawn on purpose — see
  the art-direction rule below.
- **Audio:** 100% Web Audio API synthesis — oscillators, filtered noise, a real chord-driven
  ambience engine with crossfading and music-ducking. No audio files at all.
- **Content:** 4 fully playable cities (Lisbon, Tokyo, Mexico City, Berlin), each with arrival →
  exploration → (sometimes) a minigame → 2 relationship scenes → a rhythm performance → after-show
  → journal, plus all 8 planned gated bandmate-backstory beats and a flag-gated alternate
  after-show in every city. ~4,278 words of prose across the four, each city's seed-picked weather
  now applying a small real stat delta on arrival. See §6 for the honest per-city breakdown.
- **Systems:** seeded RNG (deterministic, shareable runs, plus a daily "Today's Tour" seed shared
  by every player — §15.4), a JSON node-graph dialogue engine, a 4-lane rhythm minigame with real
  hold-note grading, an S/A/B/C grade plate, and per-device audio-latency calibration (§15.2), 3
  content-driven minigames (timing/drag/choice, real painted backdrops, seed-varied item/question
  order and harmony-scaled difficulty — §14.3/§14.6/§15.5) that break up the pure-dialogue flow, a
  6-candidate ending generator with a written "two months later" epilogue per reachable
  ending+tags combination (§15.7) and a shareable scrapbook PNG export (§15.4), a dialogue backlog
  and 3 manual save slots alongside the original auto-save (§15.3), scene-pool scarcity for
  replayability, meta-progression across runs, full onboarding for first-time players, 9 base
  accessibility settings (haptics included) plus 2 dialogue QoL toggles, IndexedDB save with
  schema versioning, a PWA manifest + service worker, and a complete Android-port runbook
  (§15.1).
- **Mobile-grade end to end:** real multi-touch (a second simultaneous finger used to be silently
  dropped), the rhythm playfield and every screen's interactive elements sit inside the iOS safe
  area, every hit/tap gets feedback in the right place, and every button on every screen in the
  game measures ≥44 CSS-px at a measured 390px mobile width — audited screen by screen, not
  assumed (§14.1, §14.5, §15.3).
- **Quality bar:** typecheck clean (strict TS), 88/88 tests passing (an exhaustive per-city
  scene-graph reference check, a full sweep of every reachable ending+tags combination, and more —
  not just whatever a bot playtest's random walk happens to exercise), CI green on every push
  (§15.8), a production build that succeeds, and everything below has been verified live in a
  browser — not just read as a diff.

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
  a DOM dependency for that). 88 tests across 14 files.
- **CI**: `.github/workflows/ci.yml` (added §15.8) runs `npm ci`, typecheck, test, and build on
  every push to master and every PR.

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
- **RoutePlan** — `generateRoute()` seed-picks from the city pool (currently all 4, since the
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
  → [if the city has an unplayed minigame — §14.3 — MiniGameScene runs here, once per run]
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
  `stat.harmony>=35`; Berlin: `relationship.jun>=35`) that unlocks a distinct song arrangement —
  a run that never crosses that threshold literally never hears that arrangement.
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

**3 manual save slots** (§15.3, added on top of the above, not replacing it): `saveToSlot`/
`loadFromSlot`/`clearSlot` in `save.ts` write to a separate `tourlife.run.slot1-3` namespace via
the exact same `saveToKey`/`loadFromKey` internals the auto-save above uses (both go through
`isValidRunState`/`migrate()` identically). Title's "Saves" button/picker is the only thing that
reads or writes these — Continue and the rest of the game are entirely unaware slots exist.

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

| City | Words | Locations | Relationship-pool entries | preShowChoices | Minigame | Song |
|---|---|---|---|---|---|---|
| Lisbon | ~843 | 6 | 8 (all 4 bandmates + 2nd Jun arc + Mira letter+why, Theo why+letter, Jun why — full backstory pair for Mira/Theo) | 3 | Soundcheck (timing, painted) | `sailor_lullaby` |
| Tokyo | ~828 | 6 | 8 (all 4 bandmates + 2nd Mira arc + Jun letter, Rowan why+letter — full backstory pair for Rowan) | 3 | Pack the Van (drag, painted) | `neon_rain` |
| Mexico City | ~1,460 | 6 | 7 (all 4 bandmates + 2nd Rowan arc + Theo/Mira backstory) | 3 | Interview (choice, painted) | `callejon_groove` |
| Berlin | ~1,147 | 6 | 7 (all 4 bandmates + 2nd Jun/Mira/Rowan arcs) | 3 | — | `kreuzberg_static` |
| **Total** | **~4,278** | **24** | **30** | **12** | **3** | **4** |

Blueprint target (`DESIGN.md`): ~3,200 words **per city**, 12-16 cities in the pool (player
picks 6-8 per run), a 3-4 hour "every run feels different" promise. **Current content per city
now averages roughly 33% of that target (26-46% range — Mexico City's the deepest, Tokyo the
thinnest), and 4 of 12-16 cities exist.** A run now shows 2 relationship-pool scenes per city
(§15.5, up from 1), so single-run playtime and dialogue volume both roughly doubled from what the
word-count table alone suggests; a run currently plays in ~15-30 minutes depending on how much
dialogue a player lingers on, whether a minigame fires (20-45s each), and how the rhythm songs go
(each song is a real ~55-70 second timer-driven event, not skippable).
This is still the single biggest gap between "how the game feels" (finished, polished, onboarded,
mobile-grade) and "how much game there is" (a meaningful step up from before, still a fraction of
the vision) — see §7 for why it hasn't been closed further and what the options are.

**Content-authoring pipeline is proven, cheap, and needs zero engine changes**: adding a city
means writing `content/cities/<id>.json` to the exact schema `content/schema.ts` enforces
(locations ≥3, relationshipScenePool ≥2, preShowChoices ≥2, every node's `text` ≤40 words,
validated and throwing in dev if violated), a matching `content/songs/<id>.json` (hand-authored
or built via `chartGen.ts`'s `SongConfig`/motif system — see §11.2, and mind the tempo-vs-bar-
count trap §14.4 hit), a generated background (`scripts/process-bg.sh` pipeline — §11.1), and
two lines in `src/game/content.ts` (an import + adding it to the `CITIES`/`SONGS` arrays). Proven
twice now by adding a city after the initial build — Mexico City, then Berlin — in each case
confirmed by `headless_playtest.test.ts` (which iterates `State.data.route` generically) passing
unmodified with no other changes.

**Word-count caveat, important:** the numbers above are *authored* totals, not what a single
playthrough shows. Scene-pool scarcity (§3.3) means a run sees 2 of each city's 7-8 relationship
entries (§15.5 — was 1-2 before this pass) and 2 of 6 locations — real single-run content is
meaningfully less than the table implies, which is a genuine replayability feature, not a
shortfall, but worth knowing when reasoning about "how long is one run" vs. "how much was
actually written."

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

### 7.2 A larger city roster (5th, 6th, up to the blueprint's 12-16)

`DESIGN.md`'s city-pool table names Tokyo/Lisbon/Mexico City/Berlin/Reykjavík/São Paulo/
Melbourne "+ more" as the intended 12-16-city pool, with players picking 6-8 per run. This was
originally a decision to ship with 3 (Lisbon/Tokyo/Mexico City) rather than add a 4th; a later
pass (§14.4) added Berlin as city #4, at roughly two-thirds the word count of the other three and
scoped down from the fuller plan; a same-week follow-up pass (§14.6) deepened the original 3 —
Berlin itself is still at that scoped-down depth, untouched since §14.4. **A 5th+ city is the one
piece of this that's still genuinely unstarted**, and remains a pure scope decision, not a
technical blocker. §6 establishes the authoring pipeline is proven at 4 cities and cheap to extend
(2 lines in `content.ts`, zero engine changes). If you're asked to add another city, the template
to match is Mexico City's or Lisbon/Tokyo's post-§14.6 shape — 6 locations, 7 relationship-pool
entries (including 1-2 gated backstory beats via the node-level `condition`/`fallback` pattern —
see §14.6, and note the `RelationshipScenePoolEntry.condition` schema field is a trap, unread by
`CityScene`), 3 preShowChoices with one storyGate-conditioned arrangement, ~750-1,500 words, a
collaborator NPC + gift, a distinct `CITY_TINTS` entry (4 of the 8 named tints in
`src/art/palette.ts` are still unused: `lavender_dusk`, `rose_gold`, `forest_moss`, `desert_clay`
— `warm_amber`/`teal_pink`/`citrus_bloom`/`midnight_indigo` are taken by Lisbon/Tokyo/Mexico
City/Berlin respectively).

### 7.3 Smaller, lower-stakes deferrals (not decisions, just not done)

- **Real audio files.** Deliberately not pursued — the procedural ambience is chord-driven,
  crossfading, and duckable in a way static files can't replicate without losing per-city
  identity, and would add real payload weight. A single generated Title-theme loop is the one
  place this might be worth reconsidering (see `docs/asset-probes` / the Gemini music-generation
  skill referenced in project memory).
- **CI** — closed, §15.8.
- **Real physical-device touch testing.** All mobile verification this whole project has been
  viewport emulation (measured `getBoundingClientRect()` math, not guessed) — never a real phone
  in hand. `CAPACITOR_PORT.md` (§15.1) exists now; an actual device pass through it is the next
  milestone toward closing this, not just wrapping the build.
- **The `Ambitious` ending tag's route-length condition** (`route.length >= 6`) is currently
  unreachable with only 4 cities in the pool — not a bug, just dead code until city #5+ exists.

---

## 8. Known residual gaps (polish, not architecture)

- **Touch targets** — closed. §14.5 did the full screen-by-screen audit this doc used to flag as
  outstanding (RoutePlan, BandCreator, Hub, Scrapbook, CityScene's location grid and pre-show
  choices, the shared `HelpButton`), measuring every interactive element's real CSS-px footprint
  at 390px width rather than assuming `Button.ts`'s padding alone was enough. If a new screen adds
  a dense button grid, re-derive the same "(raw dim + 16px pad) × 0.5417 ≥ 44" arithmetic and
  measure it live — §14.5 has a cautionary example of a size that looked safe on paper (64px) and
  measured under the floor (43.3 CSS-px) until bumped to 66px.
- **Hold-note visual feel** (the rail growing/shrinking) has been confirmed to render and score
  correctly under a rapid-tap stress test, but has never been watched in slow motion by a human
  to confirm the *visual* growth rate reads well — purely a "nobody's looked yet" gap, not a
  known defect. The close-out pass (§15.8) tried to close this and hit a tooling constraint
  (automation round-trip latency in that session routinely exceeded a full song's length, making
  a specific mid-fall frame unreliable to capture) rather than a code problem — still open.
- **Keyboard input (D/F/J/K)** for the rhythm lanes is implemented and mirrors the pointer path
  closely. §15.8 proved the D lane live with a real physical key press (not a synthetic DOM
  event — those silently no-op against Phaser's `KeyboardManager`, which reads `event.keyCode`,
  a property a JS-constructed `KeyboardEvent` cannot set in a modern browser). F/J/K share the
  identical registration loop and are structurally the same code, but weren't independently
  re-pressed live due to the same latency constraint as the hold-note item above.
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

Don't hand-write the JSON. Add a `SongConfig` entry to `SONG_CONFIGS` in `src/game/chartGen.ts`
(bpm, `chordProgression`, `waveform`, lanes, and per-arrangement `sections: {pattern, bars}[]`
built from the named bar-`PATTERNS` — `intro`, `verse`, `chorus`, `swing`, `rest`, etc., plus
custom patterns of your own if the song needs a distinct feel), then run
`node scripts/generate-charts.mjs` to regenerate `content/songs/<id>.json` from it. This is the
same deterministic generator all four shipped songs go through — it's no longer a one-off
per-song script. `chartGen.test.ts` drift-guards the committed JSON against a fresh generator
run, so any hand-edit to the JSON (or to the config without regenerating) fails CI.

Watch the tempo-vs-bar-count trap: real-time bar duration is `60/bpm*4`, so a fast song needs
proportionally more bars than a slow one to land in the 55-70s window the tests enforce. Berlin's
126bpm `kreuzberg_static` took three rounds of bar-count adjustment to clear the floor — the first
pass came in at 38.8s on one arrangement against a 55s minimum. Don't assume bar counts that
worked for a 92-118bpm song will carry over; check the generated duration and iterate.

### 11.3 Adding a city

Match `content/cities/mexico_city.json`'s structure exactly (see `content/schema.ts`'s `CityDef`
for the authoritative shape): `locations` (≥3, schema minimum; 6 is the established norm post-
§14.6, `CityScene`'s picker grid is already sized for it), `relationshipScenePool` (≥2 minimum;
7 established, including 1-2 gated bandmate-backstory beats via a node-level `condition`/
`fallback` on the scene itself — **not** the `RelationshipScenePoolEntry.condition` field, which
`CityScene.startRelationship()` never reads, so a gate placed there silently never applies),
`preShowChoices` (≥2 minimum; 3 established, with the pattern of one storyGate-conditioned
special arrangement), a `collaborator` NPC + gift, `arrivalSceneId`/`preShowSceneId`/
`afterShowSceneId`/`journalSceneId` each pointing into the `scenes` graph, and every node's `text`
under 40 words (enforced). Consider a flag-gated alternate after-show scene too (§14.6) — reuse an
existing choice flag rather than adding a new one if a natural one already exists. Pick an unused
`tint` from `src/art/palette.ts`'s `CITY_TINTS` (4 of 8 are still unused). Register it with two
lines in `src/game/content.ts` (import + push into `CITIES`/`SONGS`). Generate its background
(§11.1). Run `npm test` when done — `src/tests/content.test.ts` will catch any broken
`next`/`choice`/`fallback` reference before it ships. No engine/TypeScript changes required for
any of this — proven three times now.

### 11.4 Adding portraits (new bandmate, or regenerating existing)

`scripts/generate-portraits.sh` (idempotent), the executable form of `docs/character-sheets.md`
— **keep those two in sync**, identity blocks must be reused verbatim across mood variants or
the character visibly drifts. Generate one base per identity text-to-image, derive the other
moods image-to-image from it. The background **must be vivid green** (`#00FF00`), never gray or
white (see bug #14) — and always open `docs/portrait-contact-sheet.png` and actually look before
trusting a run succeeded; the automated verify gate cannot catch the key eating the subject.

---

## 14. The "best-in-class" pass — mobile feel, VN life, and what's still queued (2026-09-01/02)

A five-workstream plan (`POLISH_BEST_IN_CLASS_PLAN.md`, executable form
`RESUME_PROMPT_BEST_IN_CLASS.md`, both still in the repo root) came out of a direct code-and-
research review that found the rhythm minigame literally couldn't be played with two fingers,
the hit line sat under the iOS home-indicator zone, hit feedback fired in the wrong lane, and
the dialogue box was a static card with no life to it. **All five workstreams (A-E) are done,
verified live, deployed**, plus a same-week follow-up pass (§14.6, "Workstream F" — not part of
the original plan's lettering, but the direct continuation of what §14.4 scoped out) that closed
most of what D left open. This section is the record of what shipped, including where a
workstream (D) was deliberately scoped down rather than fully completed; see §14.4 for exactly
what that means and §14.6 for how much of it is closed now.

### 14.1 Workstream A — mobile rhythm feel (done)

- **Multi-touch enabled**: `input: { activePointers: 4 }` in the `main.ts` Phaser config. Before
  this, Phaser tracked exactly one touch pointer — a second simultaneous finger was silently
  dropped, so any chart with two lanes hit at once was unplayable on a real phone. Verified with
  actual two-finger CDP touch input in a `hasTouch` browser context: both pointers report
  `isDown: true` simultaneously, not just one.
- **Playfield moved into the safe area and widened**: hit line `1100 → 980`, lanes `140px → 165px`
  starting at `x=30` (all now named constants in `const.ts`: `RHYTHM_HIT_LINE_Y`,
  `RHYTHM_LANE_W`, `RHYTHM_LANE_X_START`, `SAFE_BOTTOM_Y=1230`). At the measured 0.5417× phone
  scale the tap zones now end well clear of the iOS home-indicator gesture zone; lanes render at
  89 CSS px wide (were 76). Lead time is now per-difficulty (`RHYTHM_LEAD_MS`: relaxed 1800 /
  standard 1600 / expert 1400) instead of one fixed 1600ms for everyone.
- **Per-lane feedback, and a real bug fixed along the way**: every judgement used to spark at a
  *hardcoded lane-0 x* regardless of which lane was actually hit — on lanes 1-3 this read as "the
  game didn't see my tap" even on a clean hit. Fixed: `applyJudgement` now takes the judged
  note's lane and fires the spark/ring-pulse/lane-flash/floating "Perfect! +100" text there.
  Lane flash respects `noFlash`; floating text respects `reducedMotion` (fades in place instead
  of rising).
- **Results screen gained an S/A/B/C letter-grade plate** (`letterGrade(ratio)` in
  `game/rhythm.ts`, `ratio` added to `PerformanceResult`) — purely presentational, stamps in
  with a tween, never gates anything, same as everything else on that screen.
- **Charts rebuilt from a tested generator**, not hand-typed JSON: `src/game/chartGen.ts` is a
  pure, unit-tested motif system — kicks on the left-hand lanes, snares on the right (two-thumb
  play), offbeats as holds, explicit rest bars every section (Exceed7's "readability over
  density" principle), a same-lane collision guard, holds capped short of the next note in their
  lane. Each song's storyGate-unlocked arrangement uses hand-designed, song-specific patterns
  (Sailor Lullaby's duet: call-and-response phrases; Neon Rain's bass_forward: Rowan's sustained
  bassline; Callejón Groove's duet_percussion: a 3-2 clave feel + chord trades).
  `scripts/generate-charts.mjs` regenerates the committed JSON from the config; `chartGen.test.ts`
  asserts determinism, schema validity, 55-70s duration, real rests, no lane-stacking, **and that
  the committed JSON matches the generator** — a drift guard that immediately caught two
  arrangements ending 0.1s short of the 55s floor before they ever reached a live test.
  Arrangement ids are unchanged (city JSON references them by id, e.g. `'duet_percussion'`), so
  no content files needed edits.
- **The practice pass now runs on the song's real beat grid** (a soft metronome ticks every beat,
  each demo note is spawned `leadMs` early so it lands on a beat) instead of a fixed timer —
  teaches timing feel, not just the gesture.

### 14.2 Workstream B — a VN textbox that feels alive (done)

- **Portrait bob**: `±3px`, synced to the typewriter (stops when text finishes or `skipReadText`
  is on), static under `reducedMotion`.
- **Typewriter tick**: a soft, pitch-jittered sine click roughly every 3 non-space characters
  (not every character — at 45 cps that would buzz), on the SFX bus, added as a new `'typewriter'`
  `SfxName`.
- **A gold advance chevron** pulses once a line finishes and is waiting on a tap; a 2px
  per-bandmate-colored underline bar sits under the nameplate; a soft radial glow (two circles,
  low alpha) sits behind it, tinted the same color. Space bar now mirrors a tap (skip typewriter /
  advance), unbound in `destroy()`.
- **Safe-area layout, not just a vibe**: `PANEL_Y` `740 → 690`, dialogue body `24px → 26px`.
  Choice rows now compute their own height/spacing to fit above `SAFE_BOTTOM_Y` (`renderChoices`
  in `DialogueBox.ts`) instead of assuming a fixed 58px row always fits — verified live: 3
  choices at 62px rows land with their bottom edge well inside the safe line.
- **Two new accessibility fields**, additive within `schemaVersion: 1` (no version bump — see the
  `migrate()` change below): `autoAdvance` (advances a plain, non-choice line ~4s after it
  finishes typing; **never** advances past a choice) and `skipReadText` (renders a line's full
  text immediately, still through the normal advance/choice flow). Both live in Settings as a
  new "Dialogue" row with two side-by-side toggles. `save.ts`'s `migrate()` now backfills any
  accessibility keys missing from an older save with `freshAccessibility()`'s defaults, since
  these were added *within* v1 rather than warranting a schema-version bump — an older save
  loads fine and just gets the new fields at their default (off).
- **Location color grade** (`CityScene.setLocationGrade`): a tinted full-screen overlay (6 named
  palette entries) + re-colored fireflies fades in when a location scene starts and out when it
  ends, so a city's 5 shared-background locations read as distinct places at zero new-asset
  cost. Verified live: overlay fill color and target alpha match the requested grade exactly.

**Both workstreams: typecheck clean, 46/46 tests (7 new — all of `chartGen.test.ts` plus a
`letterGrade` case), production build succeeds, zero console errors across every live check**
(multi-touch proof, a full autoplay-driven rhythm run, the practice pass timed against its own
beat grid, a bandmate portrait line with the glow/chevron/underline visible, a real click on the
new Settings toggle followed by proof the next line rendered instantly, the location-grade
overlay applied and cleared). Commits `ab45c99` (A) and `ebb275c` (B), both deployed —
**https://tour-life-v3.vercel.app** is currently serving commit `ebb275c` (confirmed via the
Vercel API's deployment list, `state: READY`, `target: production`, plus a byte-for-byte
matching build hash between the live bundle and a fresh local build:
`assets/index-WzlF0kXx.js` on both).

**A deploy-CLI gotcha distinct from bug #11, worth recording**: `npx vercel deploy --prod --yes`
returned `{"status":"error","message":"Not authorized"}` immediately (not a `BLOCKED` hang) even
though `vercel whoami` and the linked `.vercel/project.json` were both correct. **The push to
GitHub had already triggered Vercel's own GitHub integration, which built and promoted the exact
same commit to production successfully** — confirmed via `list_deployments` showing a `READY`
deployment for that commit seconds before the CLI's error. Lesson: if the manual CLI deploy
errors right after a `git push`, check whether the GitHub-integration deploy already succeeded
(`list_deployments` or the Vercel dashboard) before assuming the push itself needs redoing — a
manual `vercel deploy` is not the only path to production for a git-connected project, and
racing it against an in-flight GitHub-triggered deploy is a plausible explanation for a same-
commit "not authorized" that has nothing to do with the account or team.

### 14.3 Workstream C — three minigames break up the pure-dialogue flow (done)

`MiniGameDef` (`content/schema.ts`: id/type/introText/outroText/outroTextRough/reward/
roughReward/type-specific fields) + one shared, content-driven `MiniGameScene.ts` switching on
`type`. Pure logic — which minigame is next, the played-flag — lives in `game/minigame.ts`
rather than the scene file, because `MiniGameScene.ts` imports Phaser and can't be pulled into
the no-DOM Vitest environment (same reason `game/rhythm.ts` is split from `ui/RhythmScene.ts`).
`CityScene` inserts the first city minigame not yet flagged played this run between arrival and
the location picker (`nextUnplayedMinigame`), then hands control straight back to `'locations'`
— a city with no `minigames` entry plays exactly as before. **At most one minigame per city per
run**, and the played-flag was verified live to actually prevent a replay (restarting the city
at `'arrival'` after playing it routes straight past, no second offer).

Three types shipped, one per existing city:
- **Soundcheck** (`timing`, Lisbon): a needle sweeps a gauge, tap while it's in the gold zone, 3
  rounds at increasing speed.
- **Pack the Van** (`drag`, Tokyo): 6 items, real Phaser native drag-and-drop (`setInteractive
  ({draggable:true})` + `drag`/`dragend`) into open slots, a 25s countdown.
- **Interview** (`choice`, Mexico City): 3 prompts, 2 options each, a 6.5s soft timer per
  question — neither option is "wrong," just warmer or cooler, and the outcome tier follows the
  majority pick.

**No-fail is structural here too, not just intended, and was proven live rather than assumed**:
every type has a safety timer that advances even with zero input (timing: 3× the sweep duration;
drag: the countdown itself; choice: the per-question timer) and always reaches a real outro +
reward. Verified by deliberately not touching the timing minigame at all (it advanced through
all 3 rounds on the safety timeout alone, reaching the "rough but fine" outro) and by two of
Interview's three questions auto-advancing on their own timers purely from normal tool
round-trip delay during testing — zero console errors either way.

**Deliberately not done this pass**: real Gemini backdrops. `ensureMiniGameBackdrop` in
`sprites.ts` is a code-drawn fallback (warm gradient + scattered gold motes, keyed
`bg_mini_<id>`) that goes through the exact same texture-key seam as every other background —
swapping in painted art later needs only 3 generations + manifest entries, per §11.1, no code
changes. **Update, §14.6:** done in the same-week follow-up pass — all 3 minigames now have real
painted backdrops through this exact seam, exactly as predicted here.

### 14.4 Workstream D — city #4: Berlin (partially done — scoped down, see below)

Full city at the Mexico City template: 5 locations, 5 relationship-pool entries (mira/theo/jun
×2/rowan), 3 preShowChoices with a storyGate-gated duet (`relationship.jun>=35`, unlocking the
`modular_trade` arrangement — matching Lisbon's harmony-gated / Tokyo's relationship-gated
pattern), collaborator NPC Lene (modular synth artist), `midnight_indigo` tint (previously
unused), ambition/experimentation tone per the blueprint's city-pool table. Song
`kreuzberg_static` added as a new `SongConfig` in `chartGen.ts` — **126bpm bars run ~40% shorter
in real time than `sailor_lullaby`'s 92bpm**, an easy miscalculation the drift-guard/duration
tests caught immediately (first pass landed 38-53s, well short of the 55-70s floor; fixed by
adding bars, not by fighting the tempo). Registered with two lines in `game/content.ts` — the
route generator picked up all 4 cities with zero further changes, confirmed live (RoutePlan
screenshot shows all four with room to spare) and by `headless_playtest.test.ts` passing
unmodified. Background generated via the established Gemini pipeline, clean on the first try.

**883 words — a real, structurally complete city, but short of the ~1,200+ target** given
everything else landing in this same pass; stated honestly rather than padded, matching how §6
handles every other city's numbers.

**Explicitly NOT done this pass, still fully scoped in `POLISH_BEST_IN_CLASS_PLAN.md`/
`RESUME_PROMPT_BEST_IN_CLASS.md`:**
- Deepening Lisbon/Tokyo/Mexico City further (+1 location, +2 relationship-pool entries each).
- Bandmate backstory beats ("letter from home" / "why they're here," gated on relationship
  thresholds) across the existing pools.

**Update, §14.6:** both done in the same-week follow-up pass, for the 3 pre-Berlin cities — 6
locations and 7 relationship-pool entries each now, 6 of the 8 backstory beats written. Berlin
itself is still at 5/5 and untouched; see §14.6 for the honest remainder (2 backstory beats still
missing) and §7.2 for the still-open 5th+ city question.

The `route.length >= 6` `Ambitious` ending tag (§4, §7.3) is **still unreachable** — the pool is
now 4 cities, not 6+; it stays dead code until the roster grows further, which is the owner's
call (§7.2).

### 14.5 Workstream E — screen-by-screen iPhone touch-target audit (done)

Extended Workstream B's dialogue/Settings fix to every other screen — RoutePlan, BandCreator,
Hub, Scrapbook (the plan's explicit scope) plus CityScene's location-picker grid and
preShowChoices, which turned out to have the identical gap (found while auditing, not in the
original list, but the same bug class). **Every standalone CTA button and the shared `?` help
button were under the 44 CSS-px floor at 390px width** — measured, not assumed, via
`window.__game.scene.getScene()` + live `getBoundingClientRect()`:

| Screen / element | Was | Now | Measured |
|---|---|---|---|
| RoutePlan "Confirm route" | 56 | 66 (64 measured 43.3 — still short) | 44.4 |
| BandCreator "Hit the road" | 56 | 70 (existing `GRID_ROW_H`) | 46.6 |
| Hub "Travel to X" / "Wrap the tour" | 60 | 66 | 44.4 |
| Hub "Settings" | 50 | 66 | 44.4 |
| Scrapbook "Start a new tour" | 56 | 66 | 44.4 |
| CityScene location-picker grid | 50/60px rows | 70/78px rows | 46.6 |
| CityScene preShowChoices | 60 | 66 | 44.4 |
| Shared `HelpButton` "?" (Hub/City/Rhythm/Scrapbook) | 60 | 66 | 44.4 |

Every fix also re-verified against `SAFE_BOTTOM_Y` (1230) — the tightest is CityScene's 3rd
preShowChoice at bottom=1190, still comfortably clear. Zero console errors across every screen
checked. **The `Confirm route` row is the cautionary example to remember**: 64px measured 43.3
CSS px, one pixel-per-CSS-px short of the 44 floor — don't round a "close enough" number down
without re-measuring live, the margin at this scale factor is thin.

**All three workstreams (C, D, E): typecheck clean, 56/56 tests (10 new for minigames, chartGen
extended for the new song), production build succeeds. Commits `292776f` (E), `bcabe1e` (C),
`05f0587` (D), each independently pushed and confirmed `READY` in production via the Vercel API
before the next commit went out — the live URL was never left pointing at a broken intermediate
state.**

None of C, D, or E touch the reality layer or the broader city-roster question (§7) — those stay
the owner's call, unchanged.

### 14.6 Workstream F — deepening Lisbon/Tokyo/Mexico City, bandmate backstories, minigame art (done)

The three items §14.4 explicitly scoped out of the Berlin pass, done as a follow-up session the
same day. All content-only — zero engine changes, because the engine was already built for this:
`CityScene`'s location grid was already sized and safe-area-checked for 6 locations per city (see
its `LOCATION_GRADES` comment, written during §14.5 anticipating exactly this), and `resolveNode`
already follows a node's `condition`/`fallback` chain (used for Berlin's storyGate arrangement,
now reused for gated story content instead of just gated mechanics).

**Deepening (all 3 pre-Berlin cities → 6 locations, 7 relationship-pool entries each):**
- One new location per city, matching the existing template (an entry node + 2 choices, 2 short
  response nodes): Lisbon's tile painter's workshop, Tokyo's vending-machine alley, Mexico City's
  mid-mural courtyard.
- **Bandmate backstory beats**, 6 of the ideal 8 (`RESUME_PROMPT_BEST_IN_CLASS.md`'s "2 short
  gated scenes per bandmate — letter from home / why they're here") — Mira and Theo each got
  their full pair, Jun and Rowan one each; Jun-why and Rowan-letter are the 2 still open. Gated on
  `relationship.<id>>=40` using the node-level `condition`/`fallback` pattern, **not** the
  `RelationshipScenePoolEntry.condition` field in `content/schema.ts` — that field exists but
  `CityScene.startRelationship()` never reads it (`available[0] ?? pool[0]`, no condition filter
  at all), so a pool-entry-level gate would silently never apply. This was checked against the
  actual selection code before writing a single scene, not assumed from the schema's shape — the
  right layer for this gate is the scene node itself, resolved live when the scene plays (which
  can be well after the run-start pool draw, once relationships have actually moved), with a
  `fallback` to a short "not ready yet" node so an unmet threshold is a different beat, never a
  dead end.
- **One flag-gated alternate after-show scene per city**, reusing an *existing* choice flag rather
  than adding a new one: Lisbon's `found_cassette` (market tape), Tokyo's `fast_load_out` (the
  Pack the Van minigame's own good-outcome reward flag — a minigame result now pays off again
  later in the same city, not just in its own reward), Mexico City's `found_hand_drum` (mercado
  haggle). Same node-level `condition`/`fallback` mechanism as the backstory beats, on the node at
  `afterShowSceneId` itself.
- **Net content added**: Lisbon 513→758 words (+245), Tokyo 498→738 (+240), Mexico City
  1,210→1,460 (+250) — text-only, not counting choice labels. Short of the plan's 800-1,000/city
  target (stated honestly, same as Berlin's word count last pass) but real, tested, gated content,
  not padding. New total across all 4 cities: **~3,839 words**.

**Minigame backdrops**: real Gemini backgrounds for the 3 existing minigames (Soundcheck/Lisbon,
Pack the Van/Tokyo, Interview/Mexico City), closing the one thing §14.3 flagged as deliberately
skipped. `ensureMiniGameBackdrop`'s code-drawn gradient was always meant as a fallback behind the
same `bg_mini_<id>` texture-key seam every other background uses (`withGraphics` early-returns if
the key is already registered) — so this needed zero code changes, only 3 generations (same
style-probe prompt template as the city backgrounds, `process-bg.sh` pipeline unchanged) and 3
manifest entries. `MiniGameScene.ts`'s hardcoded fallback tint (`PALETTE.terracotta`, used only
when no real image loads) was left as-is.

**Verification, beyond typecheck/tests/build**: a standalone Node script walked every
`next`/`choice.next`/`fallback` reference in all 4 cities' scene graphs and confirmed every one
resolves to a real node id — the existing bot playtest only exercises whichever pool entries a
seeded RNG happens to draw, which would not have caught a broken reference in, say, a backstory
beat's fallback branch that a given seed never selects. That check is now a permanent test
(`src/tests/content.test.ts`, 8 new tests) rather than a one-off script. A second script simulated
`resolveNode` with low and high relationship values (and with/without each gating flag) and
confirmed all 6 backstory beats and all 3 afterShow variants actually branch to different nodes
in both directions — condition-gated content that never diverges is a silent bug the schema
validator can't catch (a syntactically valid `condition`+`fallback` pair says nothing about
whether the two branches are actually distinct). All three minigame backdrops, the new 6th
location, and one backstory scene were also confirmed rendering live in a browser, plus a
zero-console-error cold boot of production afterward.

**Still open after this pass** (see §12): Jun's "letter from home" and Rowan's "why they're here"
(the 2 backstory beats not yet written), a 5th+ city, and the Part 3 reality layer — none of which
this pass touched.

---

## 15. The close-out pass — Android-ready, VN QoL, calibration, payoff (2026-09-02)

A second external plan the same day (`POLISH_CLOSE_OUT_PLAN.md`, executable form
`RESUME_PROMPT_CLOSE_OUT.md`, both still in the repo root — again from Jameson's "Hermes (BAIS)"
persona, again spot-checked against the live repo before executing) named 5 remaining weaknesses
and shaped 8 build items around them: Android port readiness, rhythm audio-latency calibration, VN
backlog + save slots, a daily-seed hook + shareable scrapbook export, more per-run variance,
finishing the 2 backstory beats + Berlin depth §14.6 left open, written epilogues, and CI. **All 8
are done.** No new city, no Part 3 reality layer — both stayed exactly the owner's deferred call,
per the plan's own explicit guardrail.

### 15.1 Item 1 — Android port readiness

`CAPACITOR_PORT.md` (new, repo root): the complete wrap runbook for whoever does the actual
port — init/add-android, the build+copy loop, why `vite.config.ts`'s existing `base: './'`
matters for a `file://`-scheme WebView (this was already a deliberate choice — `src/core/assets.ts`
documents the other half of that decision), portrait orientation lock, safe-area (already done,
carries over as-is — the `capacitor-community/safe-area` plugin only if a real device shows
otherwise), storage/audio-unlock (both already handled), haptics (below), and a signing/release
checklist with an explicit honest note that Part 3 is **not** in this build, so the content-rating
questionnaire should reflect an all-ages game.

PWA scaffolding: `public/manifest.webmanifest` + `public/sw.js` (network-first navigation,
cache-first `/assets/`), registered from `src/main.ts` on window load, skipped in DEV. A new
Gemini-generated icon (`public/icons/icon-{192,512}.png}`, a cassette tape with a treble clef,
matching the existing palette) backs both manifest sizes. Every path involved (manifest link,
apple-touch-icon, SW registration, the manifest's own `start_url`/`scope`/icon `src`) is relative,
matching the project's `base: './'` choice rather than introducing absolute paths that only work
at a true domain root.

**Haptics** (the one piece of item 1 that's actual game code, not scaffolding):
`navigator.vibrate?.(15)` on a perfect hit, `(30)` on a miss, gated by a new "Haptics" Settings
toggle (`accessibility.haptics`, defaulted on for an Android user agent, safe no-op everywhere
else — no Capacitor plugin needed, this is the plain Web Vibration API).

Verified: production build served locally (`npm run build && npm run preview`) confirmed
manifest/sw.js/icons all 200 with correct content-type; Service Worker registration confirmed
**actually active** via a Playwright-driven check — the Claude_Browser pane's own sandboxed
context blocks SW registration entirely (same script, same server, registers fine under
Playwright — a real environment restriction of that specific tool, not a code defect, discovered
and worked around rather than assumed away).

### 15.2 Item 2 — Rhythm audio-sync calibration + tap-sound/haptics toggles

Exceed7's rhythm-crash-course finding the plan cited: latency calibration is treated as mandatory
for a serious Android rhythm game, since audio-output lag varies meaningfully per device and an
uncalibrated player just reads the game as "off" with no way to fix it. `accessibility.audioOffsetMs`
(-150..150ms) is applied via `game/rhythm.ts`'s new `adjustedHitMs()` to **both** a falling note's
visual position and its judged hit time — the two always move together, so a calibrated note still
visually lands on the hit line exactly when it's judged on-time, never a mismatch between what a
player sees and what they're scored against. Wired into all 4 of `RhythmScene`'s timing call sites
(fall/judge, hold auto-release, cue banners, tap judging) via one `hitMsFor(t)` helper.

Settings gained an "Audio sync" row: manual -5/+5 buttons, plus a "Re-calibrate" tap-along (6
beats at a fixed 96bpm — deliberately independent of any city's song, since calibration is a
device property, not a song property). The trimmed-mean math (drop the single worst-early and
worst-late tap, clamp to the field's range, round to a 5ms step matching the manual adjuster)
lives in new `game/calibration.ts`, pure and unit-tested, same split as `game/rhythm.ts` vs.
`ui/RhythmScene.ts`. `computeCalibrationOffset` never writes state itself — "Apply" is a separate
explicit step, so a distracted tap-along can't silently overwrite a working setting.

Also added: a **Tap sound** toggle (Exceed7's "fingernail players" who want hit SFX off without
losing music/ambience) and the **Haptics** toggle from §15.1.

Settings' 7-toggle single-column block became a 9-item self-labeled 2-column grid (matching
BandCreator's genre-grid pattern) — adding 2 rows to the old layout would have pushed the column
past `SAFE_BOTTOM_Y` and past the canvas itself; the grid fits 9 in 5 rows instead of 9.

Verified: a Playwright-driven pass drove the full tap-along end to end — 6 synthetic taps at a
consistent +70ms produced "Measured offset: 105ms," Apply wrote it back to state and the Settings
display updated live; the "not enough taps" path was verified separately. The Claude_Browser
pane's render loop was throttled by host-panel visibility during this same check (confirmed via
Phaser's own timer-elapsed state staying frozen, not assumed) — another case of routing around a
tool-specific limitation rather than reporting a false negative.

### 15.3 Item 3 — VN backlog + 3 save slots

**Backlog** (r/visualnovels' most-requested VN QoL feature): `DialogueBox` records every shown
line (speaker + text, capped at 30, session-only) behind a new top-left "≡" button (mirrors
HelpButton's top-right placement and 66px sizing) opening a drag-to-scroll panel. The live dialogue
panel underneath is explicitly hidden while backlog is open — its choice buttons sit past the
backlog overlay's own footprint and bled through behind the Close button otherwise, caught live
during verification, not assumed working from the code.

**Save slots**: `save.ts` gained a parallel 3-slot API (`saveToSlot`/`loadFromSlot`/`clearSlot`,
keyed `tourlife.run.slot1-3`) alongside the existing single auto-save every scene already calls via
`saveRun`/`loadRun` — that API and every call site is untouched, so Continue's behavior for an
existing single-save player doesn't change at all. Title gained a "Saves" button opening a 3-row
picker: each row shows a live summary (band name + "just starting"/"en route (\<city>)"/"Tour
complete", or "Empty"), a Save-here button (opens an overwrite-confirm if occupied, mirroring the
existing New-Run confirm pattern), and a Load button.

Found and fixed alongside: Title's own button heights were still 56px (Workstream E's touch-target
audit never reached Title, since Title didn't exist as a concern until this pass restructured its
Y layout to fit Saves in) — bumped to 66, matching every other screen. "Use this seed" (44) and
"How to Play" (44) are still untouched, deliberately out of scope for this specific commit.

Verified live: empty-state panel, Save writing and refreshing the summary, Load replacing
`State.data` and navigating via the same `resumeTarget` logic Continue uses, and the
overwrite-confirm path — all confirmed via a Playwright pass with zero console errors.

### 15.4 Item 4 — Daily seed on Title + shareable scrapbook export

**Today's Tour**: `game/rng.ts`'s new `dailySeed(date)` is the same word-word-digits format as
`generateSeed` but deterministic (`makeRng`, not `Math.random`) off the UTC calendar date —
`Date#toISOString` is always UTC regardless of the caller's timezone, so this is genuinely one
seed per day worldwide. Title features it as a gold "Today's Tour — \<seed>" button above the
existing "roll your own" path; New Run and a new small "Reroll" button share one row to make room
without growing the column. Both funnel through a new `requestNewRun(seed)`/`pendingSeed` pair so
the SAME overwrite-confirm dialog correctly threads through whichever seed was actually requested,
rather than always starting whatever the custom-seed field happened to hold.

**Scrapbook export**: a "Save tour as image" button. Phaser's `renderer.snapshotArea` reads back
the card region's real rendered pixels — no need to re-implement the card layout on an offscreen
canvas by hand — but the raw snapshot is only as wide as the game's native 720-unit canvas backing
buffer, which came back **640px wide** on a DPR-1 desktop browser in testing, under any reasonable
"shareable image" bar. The snapshot is upscaled onto a fixed 900px-wide canvas before download, so
the exported PNG is always ≥800px wide regardless of the viewing device's pixel ratio.

Verified: the button's daily-seed label matched what `State.data.seed` actually became after
confirming, and navigation landed on BandCreator; the exported PNG decoded to a real 900×788 image
with the ending/tags/route/setlist/souvenirs/relationships text legible.

### 15.5 Item 5 — More per-run variance

- **Two relationship scenes per city, not one.** `scenePool.drawScenePoolFlags` now draws
  `SCENES_PER_CITY` (2, up from 1 — pools are 5-7, real headroom). `CityScene`'s new
  `playNextRelationshipScene()` plays every available entry in a city, in seed-shuffled order,
  before moving to preshow, replacing the old "just the first one" logic.
- **Weather has teeth.** Seed-picked weather (previously only a particle effect + flavor text) now
  applies a small one-time stat delta on arrival — new `game/weather.ts`'s `WEATHER_EFFECTS` map,
  the same "give it a real consequence" move already done for the mid-tour complication in an
  earlier pass.
- **Minigame variance.** Timing minigames get one extra, faster round once harmony crosses 50
  (`game/minigame.ts`'s pure, tested `timingRoundsForHarmony`); drag items and choice questions are
  now shuffled via a seeded RNG (`makeRng(\`${seed}:minigame:${id}\`)`) computed once in `init()`,
  replacing the fixed content-JSON order every run used to see identically.

Also exposes `State` as `window.__state` in DEV alongside the existing `__game`/`__audio` debug
globals — needed to verify the multi-scene sequence without a dev-server dynamic-import artifact
(a separately-imported module instance vs. the one the running game actually uses) producing a
false negative; kept, since it's the same precedented pattern as the other two.

Verified: a live Playwright pass confirmed both drawn relationship-pool entries actually play in
sequence (`relationshipsPlayed` ends up containing both, in the shuffled order) before the scene
proceeds toward preshow.

### 15.6 Item 6 — The last 2 backstory beats + Berlin deepened to parity

The plan named the two missing beats as "Jun's letter from home + Rowan's why they're here" — but
both already existed (added in the §14.6 pass). Checked against the actual content files before
writing anything, same discipline as the `RelationshipScenePoolEntry.condition` check last pass:
the real gap was the *other* type for each — Jun's "why they're here," Rowan's "letter from home."
Added those into Lisbon/Tokyo. **All 8 of the originally-planned bandmate backstory beats now
exist.**

Berlin deepened to match the other 3 cities' post-§14.6 shape (it had been left at its original
scoped-down depth): a 6th location (a stretch of the Wall repainted so many times the point is
that nothing there lasts — fits Berlin's ambition/experimentation tone), 2 new relationship-pool
entries for Mira and Rowan following Berlin's own established ungated "2nd arc" pattern (not a
9th/10th forced "backstory beat" once all 8 already exist elsewhere), and a flag-gated alternate
after-show reusing the existing `found_mystery_record` flag. 883 → 1,147 words, 5→6 locations,
5→7 pool entries.

### 15.7 Item 7 — Written epilogues

New `content/epilogues.ts`: a "Two months later…" paragraph (~150-200 words) per reachable
`(endingId, tags)` combination, not just per ending label — a Community-Minded breakout reads
differently from a solo one. Falls back to a shorter per-ending paragraph for any tag combination
not written (today, only the still-unreachable `route.length>=6` "Ambitious" bonus).

Coverage was scoped by **sweeping the real `generateEnding()`** across a wide stat/relationship/
localLove grid rather than hand-guessing reachable combinations — the sweep found exactly 10
distinct reachable `(id, tags)` pairs (matching the plan's own "~10-14 total entries" target),
and all 10 got bespoke prose; a permanent test (`epilogues.test.ts`) runs that same sweep and
asserts every result is bespoke, not generic — so a future stat-formula change that opens up a
new reachable combination will fail the test until it's given real prose, instead of silently
falling back to a shorter paragraph forever.

Scrapbook gained a "Read the epilogue" toggle (not inline — the card is already dense) opening a
"Two Months Later" panel with the matched text.

### 15.8 Item 8 — CI + final verification

**CI**: `.github/workflows/ci.yml` — `npm ci`, typecheck, test, build, on push to master and every
PR. Confirmed green on the push that added it.

**Final verification, done honestly rather than assumed:**
- **Keyboard (D/F/J/K), never verified before this pass**: a real physical keydown-D event
  (dispatched via Playwright's `page.keyboard.press`, which carries a genuine `keyCode` — Phaser's
  `KeyboardManager` reads `event.keyCode` specifically, and a JS-constructed `KeyboardEvent` cannot
  set that property in a modern browser, so a synthetic dispatch silently no-ops regardless of
  `key`/`code` values set on it; this was confirmed the hard way, not assumed) was proven to
  correctly invoke `attemptHit(0)` on the live Rhythm scene, via an instrumented wrapper around the
  method. F/J/K share the exact same registration loop and were not independently re-confirmed
  live — this session's automation round-trip latency turned out to routinely exceed a full
  55-70s song's length (confirmed by watching `scene.time.now` and the active-scene list jump past
  an entire song between two consecutive tool calls), making a second precisely-timed live press
  impractical to arrange reliably. Code review is the basis for F/J/K, not a live press each.
- **Hold-note rail in slow motion**: **not independently re-verified this pass.** The same
  round-trip-latency issue made landing a screenshot on a specific mid-fall frame unreliable — a
  scene-pause-then-screenshot approach was attempted and didn't hold the frame as intended. This
  stays exactly the "nobody's looked yet, not a known defect" gap §8 already named, now with a
  specific note on why it's still open (a tooling constraint hit during this pass, not lost
  effort) rather than silently re-claimed as done.
- **Cold boot of production**: confirmed zero console errors on a fresh `https://tour-life-v3.
  vercel.app` load, screenshot taken, all 8 items' UI visible and working (Today's Tour, New Run/
  Reroll, Continue, Settings, Tour Gallery, Saves all rendering correctly).
- **Deploy verification**: every one of this pass's 9 commits (items 1 through 8a; item 8b is this
  verification itself) was individually confirmed `READY` in production via the Vercel API before
  the next commit went out, same discipline as every prior pass this project has used.

**What's still open after this pass**: the hold-note slow-motion check (above), the Part 3 reality
layer, and a 5th+ city — none of which this pass touched, all still the owner's call.

---

## 16. The UX/QA fix pass — readability, navigation, cross-platform (2026-09-02)

Three user-reported defects on the live Vercel build, fixed in one pass: (1) low text contrast
across menus/explainers/painted backgrounds, (2) "Continue" appearing to get stuck on some
screens, (3) no documented cross-platform testing standard. No new city, no Part 3, no audio-file
swap, no engine change — a fix-and-polish pass only, same guardrail as §15.

### 16.1 Workstream 1 — readability & contrast audit

`scripts/contrast-audit.mjs` (new, committed with its output at `docs/contrast-audit.md`)
computes real WCAG 2.1 contrast ratios for every text preset against every surface it can
plausibly sit on. The default preset colors (unchanged, still correct for their *original*
intended surfaces) fail badly on several *other* surfaces the same preset also gets used on —
84 of 126 preset×surface pairs in the "BEFORE" table fail. The fix was per-usage, not a blanket
recolor (a `button`-preset-is-always-cream approach would just move the bug elsewhere):

- **`src/ui/Button.ts`**: every button label used to hardcode cream regardless of fill —
  fine on dark fills, illegible on light ones (gold 1.91:1, sky 1.82:1, the disabled gray
  2.93:1). `labelColorForFill()` now computes cream-or-plum per the button's own fill color,
  covering every button in the game (not just today's fills — any future fill gets the same
  treatment automatically). `scripts/contrast-audit.mjs`'s "AFTER" table re-derives this against
  every fill actually used in the game: 8/8 pass.
- **`src/ui/DialogueBox.ts`**: the speaker nameplate and VN backlog panel used each bandmate's
  bright accent color directly as text on the sand dialogue panel — gold 1.57:1, sky 1.50:1,
  terracotta 2.53:1 (only teal scraped by at 3.35:1). This is the single highest-frequency fix in
  the pass (every dialogue line in the game shows a speaker nameplate): darker same-hue variants
  (`BANDMATE_HEX`) keep each character's color identity while clearing 4.5:1 — high enough for
  both the nameplate (bold, 3:1 floor) and the backlog panel (normal-weight, 4.5:1 floor).
  Narrator lines in the backlog also switched cream → plum (was 1.22:1).
- **`src/ui/textStyles.ts`**: new `addTextScrim()` — a night-tinted 0.72-alpha backing for text
  that sits directly on painted/photographic art with nothing else behind it (Title's logo block,
  City's name banner + location-picker header + preshow choice descriptions, MiniGame's title +
  in-round labels). Gold/sky (the h1/h2 defaults) still measure just under 3:1 even on the
  scrim, so every scrimmed text was standardized to cream (5.28:1) rather than darkening the
  scrim further into a heavier-looking bar than intended.
- Several isolated fixes where a preset's default color didn't match its actual local surface:
  `HowToPlayScene`'s page heading (gold → plum, sits on a sand card), `MiniGameScene`'s
  "Question X of Y" (sky → plum, sits on a sand card), `HubScene`'s corkboard "Souvenirs"/"Nothing
  yet"/"+N more" labels (cream/sky → white, sit on a brown corkboard panel), `RhythmScene`'s
  "Miss" judgement popup (softRed → a lighter tint, softRed itself is 2.56:1 on the scene's night
  background).
- `CityScene`'s preshow choice descriptions bumped 13px → 16px alongside their contrast fix (they
  carry real information — what pressing the choice does).
- Screens already using a dark solid background (Hub's bus interior, RoutePlan, Settings,
  BandCreator, Results, Rhythm's HUD, Scrapbook's main card) were checked and found already
  correct — cream/gold/sky all pass comfortably against `PALETTE.night`. Not touched, since
  nothing there was broken.

**Regression coverage**: `src/tests/contrast.test.ts` (5 tests) — locks in the button
auto-contrast algorithm, the bandmate color fix, and the scrim treatment against the real
`PALETTE` values, each paired with a "the original/pre-fix color actually fails" test so a
future accidental revert is caught. `scripts/contrast-audit.mjs` is meant to be re-run (`node
scripts/contrast-audit.mjs`) any time a new text/surface combination is added.

**Partially done, not the full brief**: real screenshots were captured live during Workstream 2's
debugging (Title with the daily-tour/Continue row, Lisbon's city header + location picker,
Settings) and visually confirm the fixes read correctly at a glance — scrimmed text legible over
painted art, button labels legible on every fill, location-picker buttons legible. That is not
the full screen-by-screen PASS/FAIL table at 390×844 with before/after annotations the original
brief's Workstream 1c asked for — RhythmScene, MiniGame's 3 variants, Scrapbook, BandCreator,
HowToPlay, and the Saves/Gallery panels were not individually screenshotted and annotated this
pass. The contrast fixes themselves are grounded in the same WCAG math the audit script computes
(real numbers, not eyeballing) and in source-level identification of the actual surface each text
sits on, which is a stronger basis than eyeballing alone — but a systematic visual walk of every
remaining screen is still open. Treat this as the same kind of honest gap §8/§15.8 already
established the convention for, not a silent claim.

### 16.2 Workstream 2 — navigation / "Continue" stuck-state fix

Investigated every hypothesis the ground truth listed for the reported "Continue gets stuck":

1. **`progress.cityId` pointing at content that no longer exists** — confirmed real.
   `CityScene.init()` calls `getCity(id)`, which **throws** on an unknown id; that throw happens
   inside Phaser's own scene-start dispatch, not synchronously catchable by the click handler —
   a stale/corrupted cityId froze the transition instead of landing anywhere. Fixed: `resumeTarget`
   (moved to the new `src/game/resume.ts` so it's unit-testable without Phaser) now validates via
   `hasCity()` before ever routing to City, falling back to Hub.
2. **`progress.nodeId` values Rhythm/MiniGame/Settings never persist** — investigated, confirmed
   *already* safe: `CityScene.init()` already sanitizes any unrecognized phase to `'arrival'`.
   No change needed.
3. **The floating seed `<input>` overlapping Continue** — ruled out by source inspection (318
   logical units of vertical separation, ~25% of the screen height).
4. **A modal left open across a transition** — ruled out; the Saves-slot Load button already
   calls `panel.destroy()` before `goTo()`.
5. **`isValidRunState`/`loadRun()` on a corrupted save** — confirmed already correct: a save
   failing validation already resolves as "no save" (Continue doesn't render), not partial state.
6. **No escape hatch from City/Rhythm/MiniGame** — confirmed real: only Title and Hub could open
   Settings before this pass. Fixed: `src/ui/MenuButton.ts` (new) adds a small persistent Settings
   button to City and MiniGame (deliberately **not** Rhythm — its lanes already cover most of the
   play area, risking an accidental mid-song pause, and a song is short/bounded and always reaches
   Results on its own). `SettingsScene`'s single "Back" button is now "Back" + "Quit to Title"
   side by side (no added row height); Quit to Title stops (not just leaves paused) whatever scene
   launched it, so that scene's own SHUTDOWN cleanup — un-ducking music, stopping fireflies/rain —
   actually runs instead of leaking a paused scene in the background. The live test suite then
   caught a second real bug in this same fix: `MenuButton` first landed at the exact same
   `(20,20,66,66)` spot `DialogueBox`'s own "≡" backlog toggle already occupies — `CityScene`
   always constructs a `DialogueBox`, so a tap there silently hit the backlog toggle instead of
   opening Settings, every time. `addMenuButton` now takes a `yOffset`; City stacks its button
   below the backlog toggle instead of on top of it.

Full writeup, including exactly what was ruled out and why: `docs/navigation-fixes.md`.

**Regression coverage**: `src/tests/resumeTarget.test.ts` (8 tests, every `ScreenName` value +
the stale-cityId/stale-nodeId edge cases) and `src/tests/saveMigration.test.ts` (5 tests,
exporting `isValidRunState`/`migrate` from `save.ts` for direct testing — its actual IndexedDB
path needs a real `window`, which this project's node-environment vitest config doesn't have).
`e2e/smoke.spec.ts` is the live version of the same claims — see §16.4 for its run status.

### 16.3 Workstream 3 — cross-platform testing standard

`docs/CROSS_PLATFORM_TESTING.md` (new): the behavior contract (one build, one behavior — only
input method/safe-area/audio-unlock-timing/PWA-installability/haptics differ by platform, never
game logic), a standards table with each item's actual verified status (not assumed), and the
3-part testing workflow below.

### 16.4 The testing workflow itself, and its own honest run status

- **`e2e/smoke.spec.ts`** (new) + **`playwright.config.ts`** (new): a device-emulation matrix
  (iPhone 12, iPhone 14, Pixel 7, generic 360×740 Android) covering boot, New Run, the full
  resume-state matrix from §16.2 (every `ScreenName` plus the stale-data edge cases), and
  Settings reachability + Quit to Title. Runs against the dev server, reading scene state back
  via `window.__game`/`__state` (DEV-only) since Phaser draws to one `<canvas>` with no DOM a
  normal Playwright locator can read.
- **`e2e/dist-smoke.spec.ts`** + **`playwright.dist.config.ts`** (new): a lighter check against
  the actual built `dist/` (`vite preview`) — PWA manifest validity, service worker reaching an
  active registration, and the shell (`/` + `/index.html`) being present in its cache after
  activation. This is the "test dist/ before a Capacitor port" step from
  `docs/CROSS_PLATFORM_TESTING.md`.
- Both wired into `.github/workflows/ci.yml` as a separate `e2e-smoke` job (installs
  chromium+webkit, runs both suites, uploads the HTML report as an artifact on failure) so a
  flaky browser-automation run doesn't gate the fast unit-test job.
- **Status**: all 18 `smoke.spec.ts` tests and all 4 `dist-smoke.spec.ts` tests pass, confirmed on
  repeated runs, on the **Pixel 7** profile. Getting there surfaced two real, useful findings, not
  just test-code bugs: (1) `public/sw.js` never actually cached the navigation document anywhere
  — only ever *read* from a cache entry that nothing wrote — so "offline reload" could never have
  worked; fixed by pre-caching the shell on `install` and opportunistically caching the real
  navigate request too (§16.1's sibling fix, same file). (2) the `MenuButton`/`DialogueBox`
  position collision documented in §16.2 item 6. A third thing surfaced along the way that's
  *correct* behavior, not a bug: a fresh browser profile auto-opens the first-time `HowToPlay`
  overlay over Title (`src/core/onboarding.ts`) — the test helpers now account for it, and it has
  its own dedicated test. **What's not confirmed**: the other 3 device profiles (iPhone 12/14,
  generic Android) weren't run to completion locally — this session's sandboxed environment made
  the full 4-device matrix impractically slow, and only Pixel 7 was run to a clean, repeated pass.
  Same test logic/coordinates against the same aspect-ratio-locked canvas, so no device-specific
  reason to expect a different result, but check the first CI run before treating all 4 as
  verified. Also **not** claimed as run: the manual real-device checklist in
  `docs/CROSS_PLATFORM_TESTING.md` — no physical iPhone or Android hardware was available this
  session, consistent with §12 item 3's still-open status. And Playwright's own
  `context.setOffline()` was found to not reliably exercise a service-worker-served offline
  reload in this environment (a Chromium/Playwright quirk, not an app bug) — see
  `docs/CROSS_PLATFORM_TESTING.md`'s note on that for what the dist-smoke test checks instead.

## 12. Prioritized next steps (current, not the stale ordering from earlier handoffs)

The best-in-class pass (§14), the close-out pass (§15), and the UX/QA fix pass (§16) are all now
done — everything any of them named is shipped and live except two items every pass has
deliberately left to the owner: the Part 3 reality layer and a 5th+ city. What's actually left is
short:

1. **The other 3 device profiles of `e2e/smoke.spec.ts` + `e2e/dist-smoke.spec.ts`** (§16.4) —
   all 22 tests pass cleanly (repeated runs) on Pixel 7; iPhone 12, iPhone 14, and the generic
   360×740 Android profile weren't run to completion locally (this session's sandboxed
   environment made the full 4-device matrix impractically slow). Same test logic against the
   same aspect-ratio-locked canvas, so no specific reason to expect a different result — but
   check the first CI run on the PR/push that lands this pass (a normal, non-sandboxed runner)
   before treating all 4 profiles as verified.
2. **Hold-note rail watched in slow motion by a human** (§8, §15.8) — the one verification item
   the close-out pass's own tooling couldn't reliably complete (an automation round-trip-latency
   constraint specific to that session, not a code risk). Structurally proven correct by both a
   rapid-tap stress test (earlier pass) and code review (this pass); just never watched by eyes.
3. **A real physical-device Android *and* iPhone pass** — every touch-target/safe-area/haptics/
   contrast claim in this repo has been verified via viewport emulation or in-browser testing,
   never on real hardware. `docs/CROSS_PLATFORM_TESTING.md`'s manual checklist (§16.3) is written
   and ready to run; nobody's run it on physical devices yet. This is the actual next milestone
   toward "Android-ready," not just the wrap-and-ship mechanics `CAPACITOR_PORT.md` (§15.1) covers.
4. **F/J/K individually re-confirmed with real key presses** (§15.8) — D was proven live; the
   other three lanes share the identical registration loop and weren't independently re-pressed
   due to the same tooling latency issue as item 2. Low risk, just unconfirmed.
5. **The Part 3 reality layer** (§7.1) and **a 5th+ city** (§7.2) remain gated on the owner's own
   decision, on honest terms, across three separate passes now. Don't start either without that.

## 13. Open questions worth asking before assuming

- Is a real Android build (via `CAPACITOR_PORT.md`) actually happening next, or does "Android-
  ready" mean "ready whenever it's decided to happen"? That changes whether item 3 above is the
  next thing to do or just infrastructure waiting to be used.
- If the reality layer is ever revisited, what's the actual tone-dial default the owner wants
  (`DESIGN.md` proposes Warm-by-default, opt-in Raw) — this is a real product decision, not
  something to infer.
- A 5th+ city is now the only thing standing between this game and the `Ambitious` ending tag
  (§7.3) actually being reachable — worth asking directly whether that's worth doing for its own
  sake, independent of the broader "how many cities should this game have" question §7.2 poses.
