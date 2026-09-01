# Tour Life: International Dates — Handoff Document

**Written:** 2026-09-01, by Claude (Sonnet 5), for whichever agent picks this up next.
**Read this before touching code.** It tells you what's real, what's simplified on purpose,
what's actually broken, and what to do first. `DESIGN.md` (the original blueprint) is the
*aspirational* spec — this file is the *as-built* truth layered on top of it. Where they
disagree, trust this file for current state, but treat `DESIGN.md` as the target to keep
building toward.

---

## 0. TL;DR

A cozy rhythm-adventure browser game. Vite + TypeScript + Phaser 3, zero external assets (all
art code-drawn, all audio Web Audio synthesis). One complete vertical slice exists: Title →
Band Creator → seeded Route → Hub → **two fully playable cities** (Lisbon, Tokyo) each with
dialogue, exploration, a relationship scene, a rhythm performance, and an after-show →
Scrapbook with a generated ending. Save/resume, 8 accessibility settings, seeded RNG, and
meta-progression all work. 29/29 tests pass, typecheck is clean, and it's deployed and
publicly live.

**What it is NOT yet:** the 3-4 hour "every run unique" promise from the blueprint. This build
is an engine-complete, content-thin proof of the loop — think "the game boots and one full
lap works," not "the game is done." The two cities are ~460 words of prose each, versus the
blueprint's ~3,200-word-per-city target (see §7). There are 2 cities, not 12-16. The "reality
layer" (Part 3 of the blueprint) — Wellbeing/Groundedness/Vices/Body-wear/Return Home epilogue
— does not exist in code at all; it was deferred by explicit user decision before this build
started (see §9).

**Live:** https://tour-life-v3.vercel.app
**Repo:** https://github.com/jamestown502502/tour-life-v3 (private, owner `jamestown502502`)
**Vercel project:** `tour-life-v3` under org `team_umNzYj4aX78WbIgY1mj5wNNy` (project id
`prj_icJ8x5VqVsxc9U25QzPYMfF8qKEn`)

---

## 1. How to run this

```bash
cd tour-life-v3
npm install
npm run dev        # Vite dev server on http://localhost:5183
npm run typecheck  # tsc --noEmit, strict mode, should be silent
npm test           # vitest run — 29 tests, ~5 test files
npm run build      # tsc && vite build -> dist/
```

A launch.json entry already exists at the workspace root
(`C:\Users\Jbthi\Claude Cowork\.claude\launch.json`, entry name `"tour-life-v3"`) using the
8.3 short path `C:\Users\Jbthi\CLAUDE~2\TOUR-L~1` — **this project's dev server MUST be
launched via that short path**, not the long path, or Vite's `fs.strict` allowlist rejects it.
This is why `vite.config.ts` has `server: { fs: { strict: false } }` — it's a workaround for
the same underlying issue, kept as defense in depth. If you move this repo, regenerate the
short path and update `launch.json` (`(New-Object -ComObject Scripting.FileSystemObject).GetFolder($path).ShortPath`
in PowerShell).

**Deploy:** `npx --yes vercel@latest deploy --prod --yes --name tour-life-v3` from the repo
root. Already authenticated as `jmbenn02-5865`. The stable alias
`https://tour-life-v3.vercel.app` auto-repoints to whatever you deploy — hand that URL to the
user, not the per-deploy hash URL. This project did **not** get SSO-protected on creation
(unlike most past projects in this portfolio) — verified with a plain `curl` returning HTTP 200
with real game HTML, no login redirect. If a future deploy somehow enables protection, see the
`game-dev-deploy-pipeline` memory for the token-based fix.

**Git:** local identity was set explicitly for this repo (`git config user.name "Jameson
Bennett"` / `user.email "jmbenn02@icloud.com"`) because no global git identity exists in this
environment. If you're a fresh agent in a fresh checkout, you may need to set this again.

---

## 2. Tech stack (decided, don't relitigate without reason)

- **Vite 6 + TypeScript 5 (strict) + Phaser 3.90.** No React, no Next.js — this is a canvas
  game with a couple of real HTML `<input>` overlays for text entry, nothing that benefits
  from a component framework.
- **All art is code-drawn**: `Phaser.GameObjects.Graphics` → `generateTexture()`. Zero image
  files anywhere in the repo. See `src/art/sprites.ts`.
- **All audio is Web Audio API synthesis**: oscillators and filtered noise, no audio files.
  See `src/core/audio.ts`.
- **Content is JSON** in `/content`, validated at load against hand-written structural checks
  in `content/schema.ts` (not a JSON-Schema library — see §4.3 for why).
- **State is a module-singleton class** (`src/core/state.ts`'s `State` export), mutated
  in-place, not an immutable/Redux-style store. Matches the pattern used in this portfolio's
  other shipped games (`leaves-of-deceit`, `crash-course-semester-zero`).
- **Save is IndexedDB with a localStorage fallback**, schema-versioned (`schemaVersion: 1`),
  validated on load, with a (currently no-op, since v1 is the only version) migration hook.
- **Tests are Vitest**, pure-logic only — no DOM/canvas testing (see §10 for why headless
  Phaser testing wasn't attempted).

**Why not the more advanced `threejs-*` skill pipeline?** This portfolio has a second,
more advanced Three.js/WebGL skill set installed but never used on a shipped game. It was not
used here either — Tour Life is 2D and Phaser/Canvas is the right tool, matching every other
shipped game in this portfolio. Don't switch engines without being asked.

---

## 3. Repo map (every file, what it's for)

```
tour-life-v3/
├─ DESIGN.md          The original blueprint (Parts 1-3), copied in verbatim. Read for vision/
│                      target scope. Its own numbering (§15.x etc.) is referenced throughout
│                      this codebase's comments and this handoff.
├─ CLAUDE.md           Short project rules, auto-loaded by Claude Code in this repo.
├─ HANDOFF.md          This file.
├─ index.html          Single entry point. Sets up #app div, safe-area CSS, mounts main.ts.
├─ vite.config.ts       Dev server port 5183, fs.strict off (8.3 short path), vitest config block.
├─ vercel.json          {"framework": null, buildCommand, outputDirectory: "dist"} — static build.
├─ tsconfig.json         strict:true, target ES2020, includes vitest/globals + vite/client types.
│
├─ content/
│  ├─ schema.ts        TypeScript types for all content (DialogueNode, CityDef, SongDef, etc.)
│  │                    PLUS runtime validators (validateCity, validateSong, assertValid).
│  │                    No JSON-Schema library — hand-rolled structural checks. See §4.3.
│  ├─ bands.ts          Static data: 4 bandmates (Mira/Theo/Jun/Rowan), 4 genres, 4 "why this
│  │                    tour" beats. Used by BandCreatorScene.
│  ├─ cities/lisbon.json    Fully authored city #1. See §7 for what "fully authored" means here.
│  ├─ cities/tokyo.json     Fully authored city #2.
│  ├─ songs/sailor_lullaby.json   Lisbon's song, 3 arrangements (acoustic/full_band/duet).
│  └─ songs/neon_rain.json        Tokyo's song, 3 arrangements (tight/loose/bass_forward).
│
├─ src/
│  ├─ main.ts           Boots Phaser.Game, registers all 9 scenes, Scale.FIT config.
│  │                     Exposes `window.__game` in DEV only (see §11 — genuinely useful,
│  │                     dead-code-eliminated in production builds, don't remove without reason).
│  ├─ const.ts           W=720, H=1280 (portrait mobile-first canvas), PALETTE (both numeric
│  │                     and hex-string forms), rhythm timing windows, typewriter speed, save key.
│  │                     RULE (from CLAUDE.md): constants live ONLY here, never import from
│  │                     main.ts (that was the old Tour Life build's circular-dep bug class).
│  │
│  ├─ core/             Engine-level systems, no game-specific content knowledge.
│  │  ├─ rng.ts          mulberry32 seeded PRNG + a hashStringToSeed function + generateSeed()
│  │                     (produces "word-word-###" seeds like "lantern-42"). RNG interface:
│  │                     next(), int(min,maxExclusive), pick(arr), shuffle(arr), chance(p).
│  │  ├─ state.ts        RunState type (the full save shape) + the `State` singleton class with
│  │                     mutation helpers (applyStatDeltas, applyRelationshipDeltas, addFlag,
│  │                     hasFlag, addItem, appendLog, setProgress). See §4.2 for the shape.
│  │  ├─ save.ts         saveRun/loadRun/clearSave/hasSave. IndexedDB primary, localStorage
│  │                     fallback, structural validation on load (isValidRunState), a migrate()
│  │                     function that's currently a no-op passthrough (only v1 exists).
│  │  └─ audio.ts        AudioSystem class (exported singleton `audio`). Gesture-gated
│  │                     (`.unlock()` called on first pointerdown in TitleScene). 4 mix buses
│  │                     (master/music/sfx/metronome). `playSfx(name)` for one-shot oscillator/
│  │                     noise recipes, `playAmbience(chord, bpm)` for a looping pad,
│  │                     `duckMusic(bool)` for dialogue ducking, `crowdSwell()` for rhythm cues.
│  │
│  ├─ game/             Game-specific logic. Pure functions/classes, no Phaser dependency
│  │  │                 except where noted — this is what's unit-tested.
│  │  ├─ content.ts      Imports the 4 JSON files, runs them through schema.ts validators at
│  │                     MODULE LOAD TIME (throws in dev if invalid, warns in prod), exports
│  │                     CITIES[], SONGS[], getCity(id), getSong(id).
│  │  ├─ condition.ts    The mini condition-expression language for gating dialogue nodes/
│  │                     choices/preShowChoices. Grammar: terms joined by `&&`.
│  │                       stat.<key><op><number>          e.g. "stat.harmony>=30"
│  │                       relationship.<bandmateId><op><number>
│  │                       localLove.<cityId><op><number>
│  │                       flag:<name>  or  !flag:<name>   (flag names may contain `:` and `-`)
│  │                     No `eval()` — hand-parsed via regex. evaluateCondition(expr, ctx).
│  │  ├─ dialogue.ts     The node-graph walker: resolveNode (follows condition/fallback
│  │                     chains), visibleChoices (filters by condition), applyChoice (mutates
│  │                     State, returns next node id), advanceTarget (reads .next on a
│  │                     choiceless node). ~70 lines, matches the blueprint's spec almost
│  │                     exactly. THIS is the reusable core — CityScene.walk() is a thin
│  │                     wrapper that also drives the DialogueBox UI.
│  │  ├─ route.ts        generateRoute(rng, cityPool) → picks 6-8 cities (or the whole pool,
│  │                     if smaller — true today with only 2 cities), seed-draws a weather
│  │                     value per city from that city's weather[] array, and a mid-tour
│  │                     complication from MID_TOUR_COMPLICATIONS (6 options). NOTE: the
│  │                     complication is currently pure flavor text shown once on the Route
│  │                     Plan screen — nothing mechanical consumes it (see §8).
│  │  ├─ scenePool.ts    drawScenePoolFlags(rng, city) — the "scarcity" system. Draws 1-2 of a
│  │                     city's relationship-scene pool as "available this run" and returns
│  │                     `avail_<sceneId>` flags to set on State. This is genuinely
│  │                     under-tested against the full 2-3-scene-pool design (each of our 2
│  │                     cities only has exactly 3 pool entries, so the "1-2 of 3" scarcity
│  │                     is real but shallow).
│  │  ├─ rhythm.ts       The rhythm engine's PURE logic (no Phaser): effectiveWindows(mode,
│  │                     wiggleRoom), judgeHit(deltaMs, windows), scoreForHit(judgement,
│  │                     combo, easyScoring), comboMultiplier(combo) [caps at combo 50, 2x],
│  │                     pickArrangement(song, storyFlags) [flag convention:
│  │                     `arrangement_<id>` unlocks a non-default arrangement — THIS is the
│  │                     "story flag mutates the chart" mechanism, proven by
│  │                     rhythm.test.ts], buildPerformanceResult(judgements,
│  │                     expressionChoices, ctx) → PerformanceResult {timingScore, grade,
│  │                     expressionChoices, crowdConnection, unlockedFlags}.
│  │                     IMPORTANT: the grade-threshold math was buggy once already this
│  │                     session (see §11, bug #3) — maxPossible must be computed as the sum
│  │                     of `scoreForHit('perfect', i, false)` per hit index, NOT
│  │                     `length * 100 * comboMultiplier(length)` (that formula assumes every
│  │                     hit already sits at the final capped multiplier, which is
│  │                     unreachable). If you touch scoring, re-run rhythm.test.ts.
│  │  ├─ endings.ts      generateEnding(state) → scores 6 candidate endings (found_family_tour,
│  │                     breakout_circuit, live_album, beloved_small_tour, next_chapter,
│  │                     quiet_ending) against avgLocalLove/avgRelationship/harmony/funds/
│  │                     inspiration, picks the highest-scoring one, adds up to 4 tags from
│  │                     {Tender, Restless, Electric, Community-Minded, Ambitious, Weathered}.
│  │                     Deterministic given the final RunState.
│  │  └─ meta.ts         completeRun(meta, entry) — pure, additive-only. Unlocks 1 genre
│  │                     (punk, then jazz_pop) and 1 décor item per completed run, from small
│  │                     hardcoded pools (UNLOCKABLE_GENRES, UNLOCKABLE_DECOR — only 2 and 4
│  │                     entries respectively; will need expanding as content grows).
│  │
│  ├─ art/               Code-drawn visuals.
│  │  ├─ palette.ts       Re-exports PALETTE/PALETTE_HEX from const.ts + CITY_TINTS map
│  │                      (warm_amber, teal_pink — only 2 tints exist, one per current city;
│  │                      adding a 3rd city needs a 3rd tint here).
│  │  ├─ sprites.ts        ensureXBackground/ensurePortrait/ensureLaneTextures/etc. functions.
│  │                      Each caches its generated texture by key (`textures.exists(key)`
│  │                      check) so calling them repeatedly across scenes is cheap. Portrait
│  │                      generation is genuinely simple (a tinted circle + mood-based
│  │                      mouth/eyes) — matches the blueprint's "code-drawn, no files" spec but
│  │                      is visually minimal; a real art pass (§9) would replace this.
│  │  └─ effects.ts        Juice: spawnPerfectSpark, comboPop, hitstop, shake, flash,
│  │                      spawnRain, spawnConfetti. ALL gated behind
│  │                      `State.data.accessibility.reducedMotion` /`.noFlash` where
│  │                      applicable — this is how those two accessibility toggles are
│  │                      actually implemented (not a separate code path, just early-returns
│  │                      here).
│  │
│  ├─ ui/                Phaser Scene classes + reusable UI components. NOT unit-tested
│  │  │                  (Phaser needs a real canvas) — verified by hand in-browser this
│  │  │                  session, see §11.
│  │  ├─ Button.ts         createButton(scene,x,y,w,h,label,onClick,opts) factory. Handles
│  │                      hover tint + `audio.playSfx('tap')` + `audio.playSfx('menuHover')`.
│  │  ├─ DialogueBox.ts    The reusable typewriter+choices panel. KEY DESIGN POINT: tap-to-
│  │                      skip-typewriter uses a SEPARATE hit zone (`skipZone`, covers the
│  │                      panel area) from choice buttons (rendered below the panel, only
│  │                      after typewriter completes) — this was a known bug class from a
│  │                      past project (an impatient tap accidentally firing a choice) and is
│  │                      deliberately avoided. `PANEL_Y = 740` (see §11 bug #2 for why that
│  │                      exact number matters — don't move it lower without checking 3-4
│  │                      choice rows still fit above y=1280). Has a `setVisible(bool)` method
│  │                      used by CityScene to hide the panel during non-dialogue picker UI.
│  │  ├─ Title/BandCreator/RoutePlan/Hub/City/Rhythm/Results/Scrapbook/SettingsScene.ts
│  │                      One file per screen. See §5 for the full state-machine flow and
│  │                      each scene's data contract (what it expects in `init(data)`).
│  │  ├─ htmlOverlay.ts    createFloatingInput(gameX, gameY, widthPx, placeholder) — a REAL
│  │                      `<input>` appended to `document.body`, positioned by polling
│  │                      `canvas.getBoundingClientRect()` (both on a resize listener AND a
│  │                      250ms setInterval fallback, since Scale.FIT reflows don't always
│  │                      fire a resize event). THIS REPLACES Phaser's own `scene.add.dom()`
│  │                      plugin, which was tried first and found to mis-position elements
│  │                      under Scale.FIT (confirmed by directly comparing
│  │                      canvas.getBoundingClientRect() against the DOM element's — see §11
│  │                      bug #1). Do not switch back to `scene.add.dom()` without re-
│  │                      verifying that Phaser bug is actually fixed in whatever Phaser
│  │                      version you're on.
│  │  └─ transition.ts     goTo(scene, key, data) — 250ms fade-to-navy then `scene.scene.
│  │                      start(key, data)`. fadeIn(scene) for the reverse. Every scene
│  │                      transition in the game goes through this.
│  │
│  └─ tests/             Vitest. `npm test` runs all of these.
│     ├─ rng.test.ts             Determinism, bounds, shuffle correctness, seed format.
│     ├─ dialogue.test.ts        Condition-gated node/choice visibility, fallback chains,
│     │                          applyChoice mutation.
│     ├─ route.test.ts           Full-pool-inclusion (2-city case), weather validity, 6-8
│     │                          sampling from a larger mock pool, determinism, empty-pool throw.
│     ├─ rhythm.test.ts          Window/scoring accessibility composition, arrangement
│     │                          selection + fallback, buildPerformanceResult sanity
│     │                          (added this session after finding the grade-threshold bug).
│     └─ headless_playtest.test.ts   Walks the ENTIRE golden path at the state/logic layer
│                                    (no Phaser/canvas) for a full seed: both cities, all
│                                    phases, rhythm via buildPerformanceResult. 3 scenarios:
│                                    normal run, "miss every note" run (proves no-fail mode
│                                    has no code path that can fail), and a two-seed
│                                    divergence check. This is the closest thing to an
│                                    automated bot playtest that exists — it does NOT drive
│                                    real Phaser scenes/rendering, only the underlying logic.
```

---

## 4. Core systems, in more depth

### 4.1 Seeded RNG

`mulberry32` seeded via a simple string hash (`hashStringToSeed`). One `RNG` instance is
typically created per *purpose* with a composite seed string, e.g.
`` `${State.data.seed}:route` `` for route generation and `` `${State.data.seed}:${city.id}:pool` ``
for that city's scene-pool draw — this namespacing is what lets multiple independent seeded
draws happen from one run seed without them correlating. If you add a new seeded system,
follow this `seed:purpose` convention.

### 4.2 RunState shape (src/core/state.ts)

```ts
{
  schemaVersion: 1,
  seed: string,
  band: { name, genre, whyTour, members: BandmateId[] },
  stats: { energy, harmony, inspiration, funds },   // energy/harmony/inspiration clamp 0-100,
                                                      // funds clamps at >=0 only, no upper cap
  localLove: Record<cityId, number>,                 // 0-100 per city
  relationships: Record<BandmateId, number>,         // -50..100
  flags: string[],                                   // arbitrary strings, see condition.ts
  inventory: Item[],                                 // { id, name, description, cityId? }
  route: CityStop[],                                 // { cityId, visited, weather? }
  log: string[],                                     // one-time-event dedup (e.g. cassette pickup)
  currentCityIndex: number,
  midTourComplication: string,                       // flavor only, see route.ts note above
  progress: { screen, cityId?, nodeId? },             // resume position, see §5 resume table
  meta: { completedRuns, unlockedGenres, unlockedDecor, runHistory },
  accessibility: { visualAssist, audioAssist, wiggleRoom, easyScoring, rhythmMode,
                   autoplay, noFailCozyMode, reducedMotion, noFlash, volumes },
}
```

Note there is **no Wellbeing/Groundedness/vice-ledger/body-wear field** — those are Part 3
(reality layer) fields from the blueprint and don't exist here. `schemaVersion` will need to
bump to 2 with a real migration function when that phase starts (see §9).

### 4.3 Why hand-rolled content validation instead of a JSON-Schema library

The blueprint says "validate every content file at load (dev assert + runtime console
warning)" without mandating a specific tool. Given only 4 content files exist and the schema
is simple, `content/schema.ts` implements `validateCity`/`validateSong` as plain structural
checks (type checks, array-length minimums, a 40-word-per-node pacing check). This keeps the
dependency count at zero. **If content authoring scales to 12-16 cities, revisit this** — a
real JSON-Schema validator (ajv or similar) would give better error messages and might be
worth the dependency at that point. Not urgent at 2 cities.

### 4.4 Rhythm engine — accessibility composition, precisely

- `wiggleRoom` widens the perfect/good/ok windows by 1.3x. Does NOT touch scoring.
- `easyScoring` changes the points table (good: 60→85, ok: 30→70). Does NOT touch windows.
- `rhythmMode` (relaxed/standard/expert) scales windows by 1.5x/1.0x/0.7x.
- These three compose multiplicatively for windows (`effectiveWindows(mode, wiggleRoom)`),
  independently for scoring — this composition is exactly what `rhythm.test.ts` checks and is
  the one place a future change is most likely to silently break the accessibility spec.
- `autoplay` and `noFailCozyMode` are NOT scoring modifiers — `autoplay` is implemented
  directly in `RhythmScene.update()` (auto-judges 'perfect' the instant a note crosses its hit
  time), and `noFailCozyMode` isn't really a togglable feature at all: **there is no fail code
  path anywhere in the state machine.** Missing every note in a song still produces a
  `PerformanceResult` and still transitions to Results → after-show → journal → Hub. This was
  verified both by a unit test (`headless_playtest.test.ts`'s "miss everything" case) AND
  organically in the live browser session (see §11) — the rhythm scene was left running
  untouched for over a minute of real time and correctly auto-missed the entire song and
  reached Results with a "Rough night" outcome, no crash, no stuck state.

---

## 5. Scene flow / state machine

```
Title ─(New Run)→ BandCreator ─(Hit the road)→ RoutePlan ─(Confirm route)→ Hub
                                                                             │
                              ┌──────────────────────────────────────────────┘
                              │ (Travel to <city>)
                              ▼
                            City [phase: arrival]
                              │ (walk arrival scene graph to a leaf)
                              ▼
                            City [phase: locations]  ←──┐ (repeat until 2 of N visited)
                              │ (pick a location, walk its mini-scene)──┘
                              ▼
                            City [phase: relationship]  (1 scene drawn from the pool)
                              │
                              ▼
                            City [phase: preshow]  (walk preShowSceneId, then show
                              │                      preShowChoices buttons — NOT part of
                              │                      the dialogue graph, a separate UI step)
                              ▼ (goTo, new scene instance)
                            Rhythm  (cityId passed in data)
                              │ (song plays out / auto-misses / player taps)
                              ▼ (goTo, new scene instance)
                            Results  (PerformanceResult passed in data)
                              │ (Continue)
                              ▼ (goTo City again, phase: 'afterShow' — CityScene.init()
                              │  re-fetches the city by id, resets locationsVisited to empty,
                              │  jumps straight to the afterShow branch of the switch)
                            City [phase: afterShow]
                              │
                              ▼
                            City [phase: journal]
                              │ (finishCity(): awards collaborator gift item, marks route
                              │  stop visited, currentCityIndex++, saves, goTo Hub)
                              ▼
                            Hub  ←── loops back here after every city ──────────────┐
                              │                                                     │
                              │ (Travel to <next city>) ─────────────────────────────┘
                              │
                              │ (once route.length reached: "Wrap the tour" button appears
                              │  instead — HubScene.wrapTour() calls generateEnding +
                              │  completeRun, saves, goTo Scrapbook)
                              ▼
                            Scrapbook
                              │ (Start a new tour: clearSave() + goTo Title)
                              ▼
                            Title
```

**Settings** is an overlay scene, launched via `this.scene.launch('Settings', {returnTo})` +
`this.scene.pause()` from Title or Hub, not part of the main flow above. It calls
`this.scene.stop()` + `this.scene.resume(returnTo)` on its own Back button.

### Resume (save/Continue) mapping — `TitleScene.resumeTarget(progress)`

| `progress.screen` | Resume target |
|---|---|
| `title` | Title |
| `bandCreator` | BandCreator |
| `routePlan` | RoutePlan |
| `city` (with cityId) | City, `{cityId, phase: progress.nodeId}` — `CityScene.init()` sanitizes an unrecognized/missing phase (e.g. the transient `'preshow-done'` value that's set right before handing off to Rhythm) back to `'arrival'` |
| `hub` / `rhythm` / `results` / `settings` | Hub (Rhythm/Results need live in-flight data — `PerformanceContext`, remaining notes, etc. — that is deliberately NOT persisted, so the safest resume is the Hub, which just re-shows the "Travel to X" button for the same city) |
| `scrapbook` | Scrapbook (falls back to regenerating the ending from current state if `endingId`/`tags` weren't passed as scene data — see `ScrapbookScene.init()`) |

`saveRun(State.data)` is called at the top of every phase transition in CityScene, at every
scene-entry point in Hub/RoutePlan/BandCreator, and at the end of Rhythm — i.e. "autosave
after every scene" from the blueprint's DoD is satisfied at phase granularity, not
node-by-node-within-a-dialogue-graph granularity. A player who closes the tab mid-dialogue-node
resumes at the start of that phase (e.g. the start of the relationship scene), not at the exact
node they were on. This was a deliberate simplification, not an oversight — flag it if the
user wants finer-grained resume.

---

## 6. Content authoring — how to add city #3

This is the reusable pipeline the blueprint's §15.11 asked for. Steps:

1. Copy `content/cities/lisbon.json` as a template. Fields: `id, name, tone, weather[],
   tempo, tint` (must be `'warm_amber'` or `'teal_pink'` — **add a new tint to
   `src/art/palette.ts`'s `CITY_TINTS` and to the type union in `content/schema.ts`'s
   `CityDef.tint` if you want a genuinely new palette; reusing an existing tint is also fine
   for pacing/budget reasons**), `locations[]` (need >= 3, each needs `id/name/sound/sceneId`),
   `arrivalSceneId`, `preShowSceneId`, `relationshipScenePool[]` (need >= 2, each
   `{id, bandmate, sceneId, condition?}`), `collaborator {npcName, role, gift}`,
   `preShowChoices[]` (need >= 2, each `{id, label, description, arrangementId, effects?,
   condition?}`), `songId`, `storyGate?` (documentation only unless you also wire a condition
   on a preShowChoice — see Lisbon's `duet_with_ines` for the pattern), `afterShowSceneId`,
   `journalSceneId`, `scenes` (the node graph — every id referenced above must exist as a key
   here, and every node needs `id` matching its own key, `speaker`, `text`).
2. Author the actual dialogue nodes. Keep every node's text under 40 words —
   `validateCity`'s `validateSceneGraph` will hard-fail (throws in dev) if you exceed it. This
   enforces the blueprint's 80-Days pacing rule structurally, not just as a guideline.
3. Write a song JSON in `content/songs/`. **Don't hand-type note arrays** — see
   `gen_charts.mjs`-style generation (the actual generator script used for Lisbon/Tokyo's
   charts was a scratch file, not committed to the repo; regenerate the pattern rather than
   hunting for it). The pattern: pick a bpm, a bar count, and write a small function that
   places notes on a beat grid per arrangement style (sparse/acoustic, dense/full-band,
   call-and-response/duet, etc.), then `JSON.stringify` the result. `validateSong` requires
   `id, bpm>0, lanes>=1`, `arrangements[]` with `>=1` entry, each arrangement needs a non-empty
   `notes[]` where every note has `t, l, type`.
4. Register the new city + song in `src/game/content.ts` (import, validate, add to `CITIES`/
   `SONGS` arrays).
5. `npm run typecheck && npm test` — the existing `route.test.ts` doesn't hardcode "2 cities"
   anywhere load-bearing (it tests the *behavior* of a 2-or-fewer pool vs a 12-entry mock
   pool), so adding a 3rd real city shouldn't break anything, but re-run to confirm.
6. Playtest that city alone: you can jump directly to it via the browser console trick in
   §11 (`window.__game.scene.start('City', {cityId: 'newcity'})`) rather than replaying the
   whole route each time — this is genuinely the fastest iteration loop, use it.
7. **No engine changes should be required** for a content-only city addition. If you find
   yourself needing to touch `CityScene.ts` to add a city, something about the template
   assumption has broken — that's worth flagging, not silently working around.

---

## 7. Content depth — the actual numbers vs. the blueprint's target

| Metric | Blueprint target (§3, §15.3) | Actual, this build |
|---|---|---|
| Cities in pool | 12-16 | **2** |
| Cities per run | 6-8 | 2 (both, since pool = 2) |
| Prose words per city | ~3,200 | **~460** (Lisbon: 462, Tokyo: 458 — measured directly from the JSON, summing `text` + choice `label` word counts across all 30 nodes in each city) |
| Full-run read length | ~24-28K words | **~1,000-1,500 words** (arrival + 2 locations + 1 relationship scene + preshow + afterShow + journal, per city, x2 cities) |
| Run playtime | 3-4 hours | **~10-15 minutes** realistically, most of that being the two ~60-second rhythm songs |
| Relationship scene pool per city | 2-3 scenes, 1-2 drawn | 3 scenes, 1-2 drawn (mechanically correct, just a small pool) |
| Song length | ~3 min per performance | **~55-65 seconds** per arrangement (see table below) |

Song chart stats (all in `content/songs/`):

| Song | Arrangement | Notes | Cues | ~Duration |
|---|---|---|---|---|
| sailor_lullaby (Lisbon, 92bpm) | acoustic (default) | 54 | 2 | 63s |
| | full_band | 150 | 3 | 62s |
| | duet | 96 | 2 | 62s |
| neon_rain (Tokyo, 118bpm) | tight (default) | 224 | 3 | 57s |
| | loose | 84 | 2 | 56s |
| | bass_forward | 84 | 2 | 56s |

**Bottom line: this build is roughly 15% of the target content depth**, concentrated entirely
in "prove the engine works end to end," not "deliver the 3-hour promise." This is expected and
correct for a first vertical slice, but don't let anyone (including a future you) mistake the
current build for content-complete.

---

## 8. Deliberate scope cuts and simplifications (not bugs — don't "fix" without asking)

- **`midTourComplication` is flavor-only.** It's seed-drawn, shown once as a line of red text
  on the Route Plan screen, and stored on `State.data.midTourComplication`, but nothing reads
  it back. The blueprint's "mid-tour turning point" as a distinct story beat/screen does not
  exist — with only 2 cities, "mid-tour" and "the whole tour" are the same thing, so this was
  cut rather than built as a stub. Revisit once there are enough cities that a real midpoint
  exists.
- **No Finale/TurningPoint screens.** Same reasoning — the golden path per DESIGN.md §15.15
  item 3 is Title→BandCreator→Route→Hub→Lisbon→Rhythm→Results→Scrapbook, and that's exactly
  what exists. The last city in the route IS the finale, mechanically (Hub shows "Wrap the
  tour" instead of "Travel to X" once `route.length` is reached).
- **Hold notes and choice-type notes don't have distinct input handling.** The rhythm chart
  schema supports `type: 'tap' | 'hold' | 'choice'`, and each renders with a visually distinct
  texture (`ensureLaneTextures` in sprites.ts), but `RhythmScene.attemptHit()` judges all three
  types identically (a single tap at the hit time). A true hold mechanic (press-and-release
  duration scoring) is not implemented — `dur` on hold notes is currently cosmetic (affects
  the sprite, not scoring). If "hold" gameplay matters, this needs real work in
  `RhythmScene.ts`'s pointer handling (track pointerup, not just pointerdown, per lane).
- **ChartCue "choice cues" are a screen-wide tap banner, not a per-lane note.** The blueprint
  describes choice-cues (pull_back/build/invite_crowd/improvise/spotlight_bandmate) somewhat
  ambiguously between "a note type" and "a narrative moment." This build treats them as
  narrative moments: a banner appears across all lanes for ~1.4s around the cue's timestamp,
  one tap anywhere resolves it into `expressionChoices`. This is simpler than gating them to a
  specific lane/timing window and was a judgment call, not directly specified.
- **`resolveNode`'s condition/fallback requirement throws (not warns) if a conditioned node
  has no fallback.** This is intentional — a content author who forgets a `fallback` on a
  conditioned node has a broken story graph, and failing loud in dev is better than a silent
  dead-end. If you see this exception while authoring, add a `fallback`, don't catch/suppress it.
- **Meta-progression pools are tiny** (`UNLOCKABLE_GENRES` has 2 entries, `UNLOCKABLE_DECOR`
  has 4). `completeRun()` unlocks one of each per finished run, so a 3rd completed run has
  nothing left to unlock from either pool — it'll just no-op past that point (the `.find()`
  calls return `undefined` and nothing gets pushed). Not a crash, just an exhausted pool.
  Expand these lists before doing serious playtesting of repeat runs.

---

## 9. Explicitly deferred: the Part 3 "reality layer"

Per the user's decision at the start of this build (a direct question was asked and answered
before any code was written): **Wellbeing, Groundedness, the Vices ledger, Body-wear flags,
The Rush/dip mechanic, the road-between-shows scenes, the Return Home epilogue, the tone dial
(Warm/Raw), and the content-warning card — none of this exists in code.** `RunState` has no
fields for it. `DESIGN.md`'s Part 3 (§18-24) and validation-checklist items 21-26 are the spec
for this phase; treat them as not-yet-started, not as broken.

Rationale given at build time: ship and validate the cozy core loop first; this content
carries real store-policy weight (drug references, an explicit power-dynamic-with-an-
intoxicated-fan scene, mature themes) for something headed toward public web + eventual
Android release, and deserves its own scoped decision about tone/rating posture rather than
being bundled in by default.

**If asked to build this next:** re-read DESIGN.md §18-24 in full first. Key implementation
notes already anticipated in the current architecture: `RunState.stats` would need 2 more slow
background fields (Wellbeing, Groundedness) per §20.1's "keep it human-scale, 2 new tracks";
`schemaVersion` bumps to 2 with a real migrate() function (the hook already exists in
`save.ts`, currently a passthrough); the vice ledger and body-wear flags are natural fits for
the existing `flags: string[]` + a new small `Record` on RunState, following the same additive
pattern as `localLove`/`relationships`. The Return Home epilogue is a new screen/scene
(`ReturnHomeScene.ts`) inserted between Scrapbook and Title in the flow. **Confirm the tone
dial (Warm/Raw) and content-warning-card UX with the user before writing any of the explicit
Raw-tone scene content** — that's a content decision, not an engineering one.

---

## 10. What was and wasn't verified this session

**Verified via automated tests (29/29 passing, run `npm test`):** RNG determinism/bounds,
dialogue condition/fallback/choice-effect logic, route generation validity across pool sizes,
rhythm window/scoring accessibility composition, arrangement flag-based selection, the full
golden-path logic (both cities, normal + all-miss runs, two-seed divergence).

**Verified by hand in a live browser this session** (Playwright MCP, not the in-app Browser
pane — see §11 for why): Title screen render + seed entry + New Run + New Seed + Continue +
Tour Gallery; BandCreator (name input, genre/why-tour selection, "Hit the road"); RoutePlan
(route display, weather, complication text, Confirm); Hub (stat bars, Travel button, Settings
launch); City scene's arrival dialogue, location picker (2-of-4 flow), relationship scene
(portrait rendering confirmed with mood-based face), pre-show choice buttons including the
conditional 3rd option (`stat.harmony>=30` gate, confirmed both hidden and shown depending on
state); live Rhythm gameplay (lanes render, notes fall, real taps register and update score/
crowd meter — confirmed with an actual tap sequence, not just the auto-timeout path); Results
screen (grade text, timing score, crowd connection); Settings screen (all 7 toggles + rhythm
mode cycle + 4 volume sliders); Scrapbook (ending label, tags, route, setlist, souvenirs,
relationship summary); save/resume via Continue (after the bug fix in §11).

**NOT verified this session, worth doing before calling this "done done":**
- The full Tokyo city end-to-end (Lisbon was walked completely through Results; Tokyo was only
  confirmed to render its arrival scene, not walked through location-picking/relationship/
  preshow/rhythm/results/afterShow/journal live in-browser — though it IS covered by the
  headless bot playtest at the logic layer).
- Mobile/touch viewport behavior (`resize_window` to a phone preset was never actually run
  against this game this session — the safe-area CSS and Scale.FIT config are in place per
  spec but unverified visually at a narrow viewport).
- Reduced-motion and no-flash toggles' actual visual effect (the gating code exists in
  `effects.ts` and is straightforward, but wasn't screenshotted before/after toggling).
- The exact hold-note and choice-cue-note visual/feel in a real playthrough (only tap notes
  were actually tapped during live verification).
- Keyboard input (D/F/J/K lane bindings exist in `RhythmScene.create()` but were never
  pressed during this session's browser testing, only pointer/touch was exercised).
- A true "reload mid-run and resume with IndexedDB actually persisting across a real browser
  restart" check — save/resume was verified across a `page.navigate()` reload within the same
  Playwright session, which does exercise IndexedDB correctly, but wasn't tested across e.g. a
  completely fresh incognito-style session boundary.

**Why no headless Phaser/canvas test exists:** Phaser needs a real rendering context; jsdom
doesn't provide one, and setting up a full canvas mock was judged not worth it for a 2-scene-
type vertical slice. The `headless_playtest.test.ts` name is slightly misleading — it's a
headless test of the *game logic*, not of Phaser scenes. If this project grows a CI pipeline,
Playwright-driven browser tests (following the exact pattern used for live verification this
session) are the right tool for actual UI/render regression testing, not Vitest+jsdom.

---

## 11. Bugs found and fixed this session (context so they don't come back)

1. **Phaser's `scene.add.dom()` mis-positions elements under `Scale.FIT`.** Confirmed by
   directly comparing `canvas.getBoundingClientRect()` against the DOM input's own rect — they
   didn't match (the DOM container's own transform math drifted from the canvas's actual
   screen position). Fixed by replacing it entirely with `src/ui/htmlOverlay.ts`'s
   `createFloatingInput`, which polls the canvas's real bounding rect instead of trusting
   Phaser's DOM plugin transform. Affects: the seed-entry input on Title, the band-name input
   on BandCreator. **If you ever see a text input rendering in the wrong place again, this is
   the first thing to suspect** — don't add more DOM-plugin elements without re-verifying the
   underlying Phaser bug is fixed.

2. **`DialogueBox`'s choice buttons could render below the visible canvas.** The panel was
   originally positioned at `PANEL_Y = 900` (out of a 1280-tall canvas), leaving only 80px
   before the bottom edge — nowhere near enough for 3 choice rows at ~54px each. Caught by
   watching Tokyo's 3-choice arrival node overflow off-screen in a live screenshot. Fixed by
   moving `PANEL_Y` to `740`, and separately by having `DialogueBox.setVisible(false)` /
   `CityScene` hide the panel entirely during the location-picker and pre-show-choice UI
   phases (which render their own buttons in that same vertical space) so there's no risk of
   the two UI layers overlapping regardless of exact Y values. **If you change `PANEL_Y`,
   check that `panel.y + panel.height(300) + 10 + 4*54 <= 1280`** (4 rows = the max choice
   count seen in authored content so far).

3. **A truly flawless rhythm performance could not reach the 'perfect' grade.**
   `buildPerformanceResult`'s `maxPossible` was computed as
   `judgements.length * 100 * comboMultiplier(judgements.length)` — this assumes every single
   hit already sits at the FINAL capped combo multiplier, which is only true for the very last
   hit, not the ramp-up before it. For a real 54-note chart, even an all-perfect run only
   reached ratio ≈0.77 (grade 'good'), never 'perfect'. Caught by a new unit test in
   `rhythm.test.ts` ("a run of all-perfect hits scores higher than a run of all-miss hits" —
   the test asserted `.toBe('perfect')` and failed with `'good'`). Fixed by computing
   `maxPossible` as the actual achievable sum: `judgements.reduce((sum, _, i) => sum +
   scoreForHit('perfect', i, false), 0)`.

4. **"Continue" (resume from save) crashed with `unknown city "undefined"`.** `TitleScene`'s
   old `screenToSceneKey()` mapped `progress.screen: 'city'` → the string `'City'` but never
   passed `progress.cityId` as scene data, so `CityScene.init()` called `getCity(undefined)`
   and threw. Caught via `browser_console_messages` showing a real (non-favicon) error after
   clicking Continue. Fixed by replacing `screenToSceneKey` with `resumeTarget(progress)`,
   which returns both a scene key AND the right data payload per screen (see the resume table
   in §5), and by having `CityScene.init()` defensively sanitize an invalid/missing `phase`
   value back to `'arrival'` rather than trusting it blindly.

---

## 12. Environment gotchas (specific to this dev setup, not the game itself)

- **The in-app "Browser pane" (Claude_Browser MCP tools) does not run `requestAnimationFrame`
  reliably for this kind of game.** Confirmed directly: a camera fade-out's `once('camerafadeoutcomplete', …)` 
  callback never fired even after a 500ms wait, while the exact same code in a
  Playwright-driven browser tab worked immediately. This matches a documented pattern for
  Phaser/canvas games in this environment (the pane doesn't composite reliably when not the
  actively-focused tab, and RAF-driven tweens stall). **Use the Playwright MCP tools
  (`mcp__playwright__*`) for any interactive testing of this game, not the Browser pane
  tools.** Screenshots alone can look fine in either; it's specifically time-based
  updates (fades, tweens, the rhythm chart clock) that stall in the pane.

- **Editing source files while a Playwright tab has the dev server open triggers a full page
  reload** (Vite's dev-server HMR client does `location.reload()` for changes it can't hot-
  apply), which silently resets the running game back to the Title screen. If a live-testing
  session suddenly appears to "jump back to Title" for no reason, check whether you edited any
  source file in the last few seconds before checking again — it's very likely just this, not
  a game bug. Confirmed as the explanation for one apparently-mysterious jump this session
  (initially suspected as a real bug, investigated at length, ultimately attributed to this).

- **Real wall-clock time keeps passing between tool calls**, and Phaser's internal clock
  (`scene.time.now`) is tied to real elapsed time, not to how much time you *intended* to
  pass via `waitForTimeout()`. A rhythm song "playing" while several tool round-trips and your
  own reasoning happen in between will genuinely finish in real time — don't be surprised if a
  ~60-second chart has already ended and moved to Results by the time you check back after
  what felt like "a couple of `waitForTimeout(1500)` calls." This is expected engine behavior,
  not a bug, and was actually a nice organic proof that the no-fail path works correctly under
  real conditions.

- **`window.__game` is exposed in dev builds** (`if (import.meta.env.DEV) (window as any)
  .__game = game;` in `main.ts`) specifically so a future agent can jump directly to any scene
  for fast iteration: `window.__game.scene.start('City', {cityId: 'tokyo'})`,
  `window.__game.scene.stop('SomeOtherActiveScene')` (note: calling `.start()` on the
  **global** `game.scene` manager, as opposed to `this.scene.start()` from *inside* a running
  scene, does NOT automatically stop whatever scene was previously active — you may end up
  with multiple scenes simultaneously active/rendering on top of each other; explicitly
  `.stop()` the old one first if you see stacked/overlapping UI). This hook is dead-code-
  eliminated in production builds by Vite's static replacement of `import.meta.env.DEV` —
  it's not shipped, don't worry about removing it before deploying.

- **The 8.3 short-path requirement** for this repo's dev server (see §1) is specific to this
  machine's Vite `fs.strict` allowlist behavior when the project lives under a long path with
  spaces (`C:\Users\Jbthi\Claude Cowork\...`). If this repo is ever cloned somewhere without
  spaces in the path, this workaround becomes unnecessary but harmless.

- **No global git identity exists on this machine.** `git config user.name`/`user.email` had
  to be set locally in this repo before the first commit would succeed. If you're bootstrapping
  a fresh clone, you may hit the same issue.

- **`window.__audio` is exposed in dev builds** alongside `window.__game` (same DEV-gated,
  prod-stripped pattern, added in main.ts during the audio polish pass) — e.g.
  `window.__audio.isUnlocked()`, `window.__audio['musicGain'].gain.value` (reading the private
  gain nodes directly is how a real audio-ducking bug got caught and confirmed fixed this
  session — see the Phase F polish commit). Useful any time you need to verify the audio graph
  is actually doing what the code claims, since you can't "hear" a Playwright session.

- **Vercel CLI deploys can silently pile up in a `BLOCKED` state with the local process just
  hanging on "Building…" forever, if the git commit author's email isn't a verified email on
  the GitHub account connected to the Vercel Hobby team.** This is NOT a build failure — the
  build never even starts (`get_deployment_build_logs` returns zero events), and the CLI gives
  no useful error; it just hangs past any reasonable timeout. The actual cause only shows up if
  you fetch the deployment's raw JSON directly (CLI's own `status`/`inspect` output just says
  `UNKNOWN`): `readyStateReason: "The Deployment was blocked because there was no git user
  associated with the commit."` Root cause here specifically: the repo's git commits were
  authored as `Jameson Bennett <jmbenn02@icloud.com>` (matching the user's stated real
  identity), but the Vercel Hobby team is owned by an account tied to a *different* email
  (`jmbenn02@gmail.com` / GitHub `jamestown502502`) — per Vercel's own docs
  (vercel.com/docs/deployments/troubleshoot-project-collaboration#account-configuration), a
  Hobby team requires the commit author to match the team owner's connected git identity, no
  exceptions, and there's no project setting to disable this check. Fixed by setting this
  repo's *local* git config (not global — don't change authorship for other projects) to a
  GitHub-verified noreply address tied to the connected account:
  `git config user.email "<github-user-id>+<github-username>@users.noreply.github.com"` (get
  the numeric id via `gh api user --jq .id`) — that address is guaranteed verified for that
  exact GitHub account by construction, sidestepping any ambiguity about which of the user's
  several real email addresses GitHub or Vercel actually has on file. If this bites again:
  check `get_deployment_build_logs` first (zero events = never started, not a real build
  failure), then fetch the deployment's raw JSON via `GET /v13/deployments/{id}` for
  `readyStateReason` rather than trusting the CLI's summary output, which hides it entirely.
  The four deployments this produced while diagnosing are permanently stuck `BLOCKED` — the
  Cancel Deployment API refuses them (`400`, they're apparently not in a cancelable state) —
  harmless clutter in the deployment list, but expect them to still be there.

---

## 13. Prioritized next steps

Roughly in the order they'd naturally come up, not a rigid must-follow sequence — use judgment
based on what the user actually asks for next.

1. **Author more relationship-scene-pool depth for the existing 2 cities** before adding new
   cities — right now each city's pool is exactly 3 entries (the minimum the schema allows),
   so the "scarcity" replay hook is real but barely felt. Bringing each pool to 4-5 entries
   with 2 drawn per run would meaningfully increase perceived replay variety without touching
   any code.
2. **City #3+ via the pipeline in §6.** Each new city is a content-only change if the pipeline
   holds — treat any need to touch engine code as a signal the template has a gap worth fixing
   generally, not city-specifically.
3. **Decide and implement real hold-note scoring** if the rhythm feel needs to differentiate
   from all-taps (currently cosmetic-only, see §8).
4. **A real asset pass** (Gemini backgrounds/portraits, Lyria music, ElevenLabs SFX) per the
   blueprint's §15.17 post-build roadmap — this project's sibling game-dev skills
   (`threejs-image-generator`'s 2D-capable Gemini pipeline, `game-music-generator-skill`,
   `game-image-generator-skill`) are the established, verified tools for this in this
   portfolio; alpha-verify every generated sprite (a past project in this portfolio shipped a
   fully-failed chroma-key that was marked "cosmetic only" and missed — don't repeat that).
5. **Part 3 reality layer** — only after an explicit go-ahead and the tone-dial/content-
   warning UX decisions are made with the user (see §9).
6. **Mobile/Capacitor readiness check** — the architecture was designed touch-first from day
   one per the blueprint (Scale.FIT, safe-area CSS, pointer-based input throughout), but this
   was never actually verified at a narrow mobile viewport this session (see §10). Worth a
   `resize_window({preset:'mobile'})` pass before assuming it's actually fine.
7. **CI** — if this becomes a recurring multi-session project, wiring `npm run typecheck &&
   npm test` into a GitHub Action would catch regressions automatically; nothing like that
   exists yet.

## 14. Open questions to ask the user, not assume

- Is the ~15%-of-target content depth acceptable to share/demo as-is, or does more content
  need to land before showing anyone outside this conversation?
- Priority order between "more cities" vs. "deeper existing cities" vs. "real assets" vs. "the
  reality layer" — §13 is one reasonable ordering, not the only defensible one.
- Whether the current minimal portrait art (a tinted circle with a mood-based mouth) is
  acceptable placeholder quality or should be prioritized for a real art pass sooner than the
  rest of the post-build roadmap.
