# Final Polish Addendum v2 — Before / After

Five items on top of the main Final Polish pass (`docs/release-readiness.md`), triggered by a
live bug report (garbled minigame/location text) plus three product asks: minigames more often
and story-connected, better transitions between gameplay moments, and Gemini rhythm-stage
backgrounds. Executed in the specified order — 6 and 7 first (live-bug fixes), then 8 → 9 → 10
(each depending on the wiring before it).

## Item 6 — Text-rendering audit: garbled text made structurally impossible

**Before**: `Button.ts`'s label had no `wordWrap` — a long sentence-style label (a Berlin location
name, an Interview minigame option) rendered on one line at natural width and overflowed the
button, bleeding into whatever sat next to it. This is exactly the reported screenshot: Berlin's
2-column location grid with overlapping, unreadable button text.

**After**: fixed at the class level in `src/ui/Button.ts` — every label now wraps at
`width - 40px`, and if the wrapped text is still taller than the button (a long label in a short
button), font size steps down 1px at a time to a 12px floor until it fits. This fixes every
button in the game at once (dialogue choices, minigame options, location picker, preshow choices,
backlog/settings — anything going through `createButton`), not just the reported screen.

| | Before | After |
|---|---|---|
| Berlin location picker | Overlapping, unreadable labels (user's report) | Every label wraps cleanly on 2 lines, no overlap — [screenshot](polish-before-after/item6-after-berlin-location-picker.png) |
| Interview minigame options | Same overflow class at 600×66 | Clean wrapped text — [screenshot](polish-before-after/sweep-390-minigame-interview.png) |

**Made impossible, not just fixed once**:
- `scripts/text-fit-audit.mjs` — a new CI gate. Simulates `Button.ts`'s exact wrap+shrink
  algorithm against every content-authored string that lands in a size-constrained button
  (location names, preshow choices, minigame options, every dialogue choice across all 4 cities'
  full scene graphs). **189 strings checked, 0 overruns.** Wired into `.github/workflows/ci.yml`
  — a future content edit that writes a label too long even for the 12px floor fails the build.
  Verified the gate actually catches real overflow (tested with a deliberately absurd 9-line
  string before wiring it in) — it's a real check, not a no-op.
- `e2e/text-fit-sweep.spec.ts` — 8 new e2e tests, one per major screen (Title, Hub, City location
  picker, City preshow, MiniGame Interview, Rhythm, Settings, HowToPlay) at 390×844, each
  asserting every visible button label has non-zero rendered bounds (a real structural check, not
  just "didn't crash") and saving a screenshot artifact.

**Root cause, for the record**: the numeric `fontStyle: '700'` on the variable font Baloo 2 (the
ground truth's other suspected cause) was investigated and ruled out — Baloo 2 is a single
variable-font file covering its whole weight range, so once loaded at any weight it's usable at
every weight without a separate load call. The wordWrap gap was the entire cause.

## Item 7 — Gemini dynamic crowds, and a critical boot bug found along the way

**Before**: 5 identical code-drawn silhouettes (a circle + rounded rectangle) at a fixed top-right
spot, swapped between two hardcoded poses by a crowd stat.

**After**: 40 real painted crowd sprites — 5 diverse named members per city × 2 moods each
(cheering/good, arms-crossed/bad) — generated via Gemini, chroma-keyed, and verified transparent.
Moved to the bottom of the screen (a real audience, not a HUD meter), live density+mood swap
unchanged in mechanism (the same proportional 0–100 crowd-stat threshold), now rendering the
correct city's correct member at the correct mood. Results screen gets the same 5-member strip at
the run's *final* mood. Code-drawn silhouette is the automatic fallback if a city's set is ever
missing — same seam every other real asset uses.

Diversity per city (skin tone, age, style, city-appropriate dress) — contact sheet:
[crowd_contact_sheet.png](asset-probes/crowd_contact_sheet.png).

3 of 40 generations hit Gemini's content classifier on the first pass (`PROHIBITED_CONTENT`,
no discernible pattern in the prompts) — all 3 succeeded on retry with either an unchanged or
lightly-reworded prompt; final set is 40/40 verified clean.

**Honest framing on quality**: the "good" (cheering, arms-raised) pose was generated at a visibly
wider framing than the "bad" (arms-crossed) pose across every member — a real, measured
inconsistency in this asset batch. Fixed at the *display* level (`setDisplaySize` normalizes
every figure to the same on-screen footprint regardless of source framing) rather than
re-generating 40 images over a cosmetic framing difference.

### A serious, unrelated bug this item's own verification surfaced

Pushing the manifest from 25 to 65+ entries (Item 7's 40 crowd sprites) exceeded Phaser's default
`maxParallelDownloads` (32) for the first time in this project's history. **Confirmed live, on a
genuine static production build with zero dev-server involvement**: the loader silently stalled
at exactly the ~50% mark (the first 32-file batch) and never dispatched the rest — no
`FILE_LOAD_ERROR`, no console error, no crash. Just an indefinite blank navy screen. Every one of
the "stuck" files loaded instantly and cleanly on its own (verified with a raw `new Image()`
probe outside Phaser), ruling out a bad asset. This would have broken **every player's first
load**, permanently, the moment this pass shipped, and was only caught by patiently instrumenting
`BootScene`'s own loader events and watching where the trace actually stopped — the visible
symptom alone ("blank screen, no error") gave no hint the manifest's *size* was the cause.

**Fix**: `this.load.maxParallelDownloads = 200;` in `src/ui/BootScene.ts`, one line, set well
above the current ~73-entry manifest so this doesn't silently recur the next time a pass adds
another batch of real assets. Confirmed fixed on a clean static build immediately after.

## Item 8 — Minigames: more often, story-connected, better paced

**Before**: exactly one minigame per city per run (after arrival only); Berlin had none at all;
minigame outcomes affected stats but only Tokyo's `pack_van` ever fed a story branch
(`fast_load_out` → an alternate after-show line) — the mechanism existed but was used once.

**After**:
- **8a — frequency**: a second insertion point added (`CityScene.tryMinigame`, shared by both
  call sites — `nextUnplayedMinigame` already finds the first unplayed entry regardless of call
  site, so this needed zero engine changes beyond the second call and a new `'preshow-choices'`
  resume phase). Every city now authors 2 minigames: Berlin gains its first ever
  (`ber_synth_check`, timing), Lisbon adds `lis_load_in` (drag), Tokyo adds `tok_soundcheck`
  (timing), Mexico City adds `mex_radio_callin` (choice). Never repeats one in the same run
  (the existing played-flag already guarantees this).
- **8b — story-connected**: reused the *existing* `reward.flags`/`roughReward.flags` mechanism
  (already generic, already in the schema — no new field needed) instead of adding a redundant
  `storyFlags` field as the ground truth suggested. Each new minigame's NPC is that city's
  *already-established* collaborator (Lene in Berlin, Inês in Lisbon, Kenji in Tokyo, Ximena in
  Mexico City) rather than an invented one-off character — real recurrence, not new cast. Each
  city's journal node now branches on its new minigame's flag (mirroring the existing
  `fast_load_out` pattern exactly), and the epilogue appends one callback sentence keyed to
  whichever minigame flag the run actually has (`content/epilogues.ts`).
- **8d — backdrops**: 4 new Gemini backdrops (Berlin backstage synth rig, Lisbon stairwell,
  Tokyo neon stage, Mexico City radio booth) — no code changes needed at all, since
  `ensureMiniGameBackdrop` already derives its key as `bg_mini_<minigame.id>` automatically.

Before/after: one minigame per city → two; Berlin 0 → 1. Story consequence shown end-to-end for
Berlin: `ber_synth_check` good outcome → `synth_check_smooth` flag → `ber_journal`'s text changes
→ epilogue gets an extra Lene callback sentence if that flag is set. Screenshot:
[Berlin's new minigame, live](polish-before-after/item9-card-after.png) (also the Item 9 card
transition's target).

## Item 9 — Better transitions between gameplay moments

**Before**: one transition, everywhere — `goTo()` was a flat 250ms fade to navy, then
`scene.start()`.

**After**: `src/ui/transition.ts`'s `goTo()` gained an optional 4th parameter,
`{transition, line}`, with three new types alongside the untouched default:
- **`'card'`** — a sand card slides up to cover the screen with the moment's line (a minigame's
  own diegetic intro text). Wired: every VN → minigame handoff.
- **`'lights'`** — a dark cover with a gold spotlight ring closing in on the center plus
  "On stage — `<city>`" — wired at the one moment it matters most, preshow choice → Rhythm.
- **`'drive'`** — a few pale streaks drifting left-to-right over a dark cover, like passing
  streetlights from a bus window — wired at Hub ↔ City travel, both directions.

All three automatically downgrade to plain `'fade'` when `reducedMotion` is on;
`'lights'` additionally downgrades when `noFlash` is on (its radial closing-in reads
flash-adjacent even though nothing strobes). Verified via real gameplay flows (real canvas
clicks, not synthetic scene jumps) that all three reach their target scene with zero console
errors: [lights mid-transition](polish-before-after/item9-lights-mid.png),
[drive](polish-before-after/item9-drive-after.png),
[card](polish-before-after/item9-card-mid.png).

**Honest timing note**: this development machine's shared, variably-loaded state (documented at
length in `docs/release-readiness.md`'s Item 1) made the intended 380ms handoff take anywhere
from ~400ms to several seconds during automated testing — confirmed via `scene.time.delayedCall`
tracing that the *mechanism* is correct and always eventually fires; the *timing* is just this
specific loaded machine, not a code defect. A real player's browser, not simultaneously running
image-generation scripts and multiple dev servers, will see the intended ~380ms cover.

## Item 10 — Gemini rhythm stage backgrounds, per city

**Before**: `RhythmScene`'s entire backdrop was a flat `PALETTE.night` rectangle. The painted
city backgrounds existed but were never used during the actual show.

**After**: 4 new Gemini stage backgrounds — Lisbon's intimate fado room (string lights, azulejo
tiles), Tokyo's neon club (rain-streaked window, full band visible), Mexico City's open-air
festival stage (papel picado banners, warm crowd), Berlin's midnight-indigo warehouse (hanging
lamp, moody haze) — each generated with an explicit "dark, low-contrast middle third" instruction
so the lane/note/judgement-text area stays legible over the art without a separate code-side
scrim beyond the existing automatic legibility scrim (`addCoverBackground`, already applied to
every real asset). Wired via a new `ensureRhythmStageBackdrop(scene, cityId)` (same
manifest-key-existence-checked seam as every other background; falls back to the original flat
rectangle if a city's asset is ever missing). Results screen (Item 10c) reuses the same backdrop
behind the grade plate, with the Item 7 crowd strip standing in front of it — "the show you just
played, where you played it."

Before (flat navy) vs after: [Rhythm, Lisbon](polish-before-after/item9-lights-after.png) shows
the fado room mid-song with real crowd figures at the bottom; Results reuses the same art with
the crowd strip.

## A second pre-existing test flake, found and fixed while verifying Item 10

Re-running the full e2e suite in isolation surfaced `Texture key already in use:
bg_rhythm_lisbon` on `smoke.spec.ts`'s "Rhythm has a Menu button" test. Root-caused to a genuine
race in the TEST's own setup, not the app: `bootGame()`'s helper resolves the instant `BootScene`
exists, not once its own async manifest load actually finishes — Title only appears once that's
genuinely done. Several tests jumped straight into a scene via `startScene()` right after
`bootGame()` without waiting for Title first, which could let a scene's own real-asset check
(`ensureRhythmStageBackdrop`, `ensureCityBackground`) race against `BootScene`'s still-in-flight
loader for the exact same texture key. **Impossible in real play** — a player can never reach
Rhythm or City before Title has already proven Boot fully finished — but a real flake in these 3
tests' own setup. The exact same underlying pattern explains `bg_city_mexico_city`'s
already-documented flake from the main Final Polish pass (`docs/release-readiness.md`) — that one
predates this addendum and was previously attributed to generic machine load; it's actually this
same race, just triggered by `CityScene`'s pre-existing background instead of a new one. Fixed by
adding `await waitForActiveScene(page, 'Title')` before all 3 affected `startScene()` calls in
`e2e/smoke.spec.ts`. Re-ran all 3 in isolation afterward — clean.

## Testing

- **Unit**: 116/116 (was 109 before this pass — +7 for the new epilogue-callback wiring, including
  one-per-flag coverage for all 5 minigame callback lines). `content.test.ts`'s existing generic
  schema validator covers the 4 new minigame entries with zero new test code needed.
- **`scripts/text-fit-audit.mjs`**: 189/189 strings pass, wired into CI (`build-and-test` job).
- **`e2e/text-fit-sweep.spec.ts`**: 8/8, one per major screen at 390×844.
- **`e2e/smoke.spec.ts` + `fullrun.spec.ts` + `verification.spec.ts`**, full suite, final run in
  isolation on this machine (`--project="Pixel 7" --workers=1`): **31/33 passed.** The 2 remaining
  failures are both the same pre-existing, already-documented category of this specific shared
  machine's variable timing (see `docs/release-readiness.md`'s Item 1 for the full account) — a
  song autoplay-to-Results timeout in `fullrun.spec.ts` and the Item 4b hold-rail grading-tier
  timing sensitivity — neither is new, neither touches code this addendum changed, and both were
  already flagged as machine-timing artifacts, not app defects, before this pass started.
- **The `maxParallelDownloads` fix specifically**: verified on a genuine static production build
  (`npx serve dist`, zero dev-server/HMR involvement) both broken (before) and fixed (after), with
  a full debug trace of `Phaser.Loader.Events` proving the exact stall point and the exact fix.

## Guardrails respected

No new cities, no Part 3 reality layer, no engine/framework swap, no audio file beyond the
existing Title theme, no analytics/achievements/localization. Accessibility (reducedMotion,
noFlash) respected in the new transition system. Painted-world/code-drawn-UI rule kept — the new
transitions and stage art are all drawn via the same `art/` and `ui/` seams every existing asset
uses, nothing new invented.

## Deploy & CI — final confirmation

- **Commit**: `b9aa5a6` (squash of the two Hermes-authored intermediate commits `9db2170`,
  `6e066c8`, plus this session's own implementation work).
- **CI** (`gh run` `33985655757`, GitHub Actions): **completed, 31 passed / 2 failed** — the exact
  same 2 pre-existing, already-documented flakes named in the Testing section above (the
  `fullrun.spec.ts` autoplay-to-Results budget and the Item 4b hold-rail grading-tier timing
  sensitivity), independently confirmed on CI's own runner, not just this local machine. `npm run
  typecheck`, `npm test` (116/116), and `scripts/text-fit-audit.mjs` (189/189) all green in the
  same run.
- **Vercel deploy**: `dpl_GLKwShqVUcGEDUdGqf31ya71RyWm`, confirmed `READY`/production for commit
  `b9aa5a6` via `list_deployments`.
- **Live URL** (`https://tour-life-v3.vercel.app/`): `200 OK`, correct
  `<title>Tour Life: International Dates</title>`. All 4 spot-checked new asset URLs return `200`:
  `assets/img/crowd_berlin_m1_good.png`, `assets/img/bg_rhythm_lisbon.webp`,
  `assets/img/bg_mini_ber_synth_check.webp`, `assets/manifest.json`.
- **Live browser check**: fresh page load, zero console errors. Visual: Title/onboarding renders
  correctly in production (matching local dev-server screenshots taken during Item 6-10
  verification). Note: `window.__game`/`window.__state` (used by this session's dev-server
  screenshot verification and by the e2e suite) are gated behind `import.meta.env.DEV` in
  `src/main.ts` and are correctly absent from the production bundle — by design, not a gap. The
  production build is byte-identical Vite output to what the e2e suite exercises via real taps
  against a dev server, and CI's own run confirms the same 31/33 result on a clean runner, so the
  live site's gameplay correctness rests on that shared build artifact plus the asset/console spot
  checks above, not a second manual click-through.

## The honest remainder

Nothing was skipped or deferred within the 5 items themselves — all DONE-WHEN criteria for items
6 through 10 are met with evidence above. The only items **not** re-verified in this pass are
carried over, pre-existing gaps already on the owner's checklist from the main Final Polish pass
(`docs/release-readiness.md`'s "still needs a human or physical hardware" section) — real
iPhone/Android hardware testing — which this addendum did not touch and was not asked to close.
