# Navigation / "Continue" Fix Pass — Tour Life v3

Workstream 2 of the UX/QA fix pass, investigating the reported "'Continue' buttons are failing,
causing the application to get stuck on certain screens."

## What was checked, and what it found

Per the ground truth handed to this pass, `TitleScene.resumeTarget(progress)` (moved to
`src/game/resume.ts` during this fix so it can be unit-tested — see below) is the single function
every "Continue" entry point (the Title Continue button, and the 3 manual save-slot Load buttons)
routes through: it turns a saved `Progress` into a scene + data to start.

### 1. `progress.cityId` pointing at unknown content — CONFIRMED real bug, fixed

`resumeTarget`'s `'city'` case used to hand `progress.cityId` straight to `CityScene`, whose
`init()` calls `getCity(id)` — and `getCity` **throws** on an unknown id (`src/game/content.ts`).
A save carrying a stale or corrupted `cityId` (hand-edited storage, or — looking forward — a
future content update that renames/removes a city a save still references) would throw
synchronously during Phaser's scene-start machinery, which is **not** reliably catchable by a
try/catch around the click handler (the throw happens inside Phaser's own internal dispatch, on
its own turn of the loop, not synchronously re-thrown to the caller). The practical result matches
the reported symptom exactly: tap Continue, the screen fades but never finishes landing anywhere
playable.

**Fix**: `resumeTarget` now validates the cityId against real content (`hasCity()`, added to
`src/game/content.ts`) *before* ever routing to City, falling back to Hub instead. The throw can
no longer happen from this path. Covered by `src/tests/resumeTarget.test.ts`'s
`'city + an unknown/stale cityId ... falls back to Hub'` case and
`e2e/smoke.spec.ts`'s matching resume-matrix case.

### 2. `progress.nodeId` values Rhythm/MiniGame/Settings never write — investigated, confirmed already safe

`MiniGameScene`, `RhythmScene`, and `SettingsScene` never call `State.setProgress()` — so if the
app closes mid-minigame or mid-song, `progress` still holds whatever `CityScene` last set before
handing off (e.g. `{screen:'city', nodeId:'preshow-done'}` right before Rhythm starts).
`'preshow-done'` isn't a real `CityPhase`. This turned out to be **already handled correctly**:
`CityScene.init()` sanitizes any `phase` not in `VALID_PHASES` to `'arrival'`
(`src/ui/CityScene.ts`) — a mildly redundant replay of the arrival dialogue, not a freeze.
Confirmed by `resumeTarget`'s own case for this (`'city, mid-transition-to-Rhythm nodeId'`) and
by `e2e/smoke.spec.ts`'s matching live case. **No change made here** — it already worked.

### 3. The floating seed `<input>` overlapping Continue's hit area — ruled out by source inspection

`TitleScene.buildSeedEntry` places the real DOM `<input>` at logical y=950; the Continue button
sits at a fixed logical y=632 (see `TitleScene.ts`'s own comment on `continueY` — its position
doesn't shift based on which buttons above it actually render). That's 318 logical units of
vertical separation on a 1280-tall canvas — proportionally about 25% of the screen height — far
too large a gap to plausibly close at any real device's scale factor. Ruled out without needing
per-device pixel measurement; not re-litigated live.

### 4. A modal left open across a scene transition — ruled out by source inspection

The Title Continue button isn't reachable from inside any modal (it's a top-level Title button).
The Saves-slot picker's Load button *is* inside a modal, and already calls `panel.destroy()`
*before* `goTo(...)` (`TitleScene.ts`, `buildSavesPanel`'s `loadBtn` handler) — confirmed correct,
no change needed.

### 5. `isValidRunState` / `loadRun()` on a structurally-invalid save — confirmed already correct

`loadFromKey` (`src/core/save.ts`) only returns a save that passes both `migrate()` and
`isValidRunState()`; anything else falls through to `null`, and `hasSave()` is exactly
`(await loadRun()) !== null` — so a corrupted save already means "no save" (Continue doesn't even
render) rather than a partial/broken resume. Confirmed correct via `src/tests/saveMigration.test.ts`
(exporting `isValidRunState`/`migrate` from `save.ts` for direct testing — the actual IndexedDB
code path can't run in this project's node-environment test config, see that file's header).
**No change made here** — it already worked.

### 6. No escape hatch from City/Rhythm/MiniGame — CONFIRMED real gap, fixed

Before this pass, only Title and Hub could open Settings (`this.scene.launch('Settings', ...)`)
— City, Rhythm, and MiniGame had **no way back to the menu at all**. Combined with items 1/2
above, if a player ever did land somewhere broken, there was no way out short of clearing browser
storage. This matches the fix pass's own guardrail ("always-reachable escape on every resumable
screen").

**Fix**:
- `src/ui/MenuButton.ts` (new) — a small persistent top-left button opening Settings, added to
  `CityScene` and `MiniGameScene`.
- **Deliberately not added to RhythmScene** — its lanes' tap zones already cover most of the play
  area, so a new persistent tap target there risks an accidental mid-song pause; a song is also
  always short and bounded, reaching Results on its own even under no-fail/autoplay, unlike
  City's open-ended dialogue phases. This is a scope decision, not an oversight.
- `SettingsScene.ts`'s single centered "Back" button is now two buttons on the same row (no
  height added, so no risk of pushing past `SAFE_BOTTOM_Y`): "Back" (resumes whatever launched
  Settings, unchanged) and "Quit to Title" (stops that scene — so its own `SHUTDOWN` cleanup
  actually runs: un-ducking music, stopping fireflies/rain particles — instead of leaking a
  paused scene in the background forever — then transitions to Title).
- **A second real bug caught by the live suite, not by inspection**: `CityScene` always
  constructs a `DialogueBox`, whose own top-left "≡" backlog toggle sits at the exact same
  `(20,20,66,66)` spot `MenuButton` first used — so a tap there always hit whichever button was
  added later in the display list, and Settings was silently unreachable from City every time
  (confirmed live: the tap toggled the — empty — backlog panel instead, no scene change).
  `addMenuButton` now takes an optional `yOffset`; `CityScene` passes `76` to stack its button
  below the backlog toggle instead of on top of it. `MiniGameScene` never constructs a
  `DialogueBox`, so it has no such collision and uses the default position.

Covered by `e2e/smoke.spec.ts`'s two Settings-reachability tests (Hub round-trip, and City's new
Menu button + Quit to Title).

## Regression tests added

- `src/tests/resumeTarget.test.ts` (8 tests) — every `ScreenName` resolves to a real scene key; an
  unrecognized future value falls back to Hub; the specific stale-cityId and stale-nodeId cases
  above.
- `src/tests/saveMigration.test.ts` (5 tests) — fresh save round-trips; an old save missing
  fields added within schemaVersion 1 is backfilled and still validates; a mismatched
  schemaVersion is rejected; a structurally-corrupt save fails validation (which is what makes
  `loadRun()` treat it as "no save"); a plain garbage blob fails outright.
- `e2e/smoke.spec.ts` — the live, device-emulated version of the same claims (see
  `docs/CROSS_PLATFORM_TESTING.md`), run at 4 device profiles in CI.

All added to `.github/workflows/ci.yml`.

## Live verification status

The Playwright device-matrix suite (`e2e/smoke.spec.ts` + `e2e/dist-smoke.spec.ts`) is the
live-verification mechanism for this workstream. **Status**: all 18 `smoke.spec.ts` tests and all
4 `dist-smoke.spec.ts` tests pass cleanly on the **Pixel 7** profile, run repeatedly to confirm
(not a one-off) — this includes the full resume-state matrix (every `progress.screen` value plus
the stale-cityId/stale-nodeId edge cases) and both Settings-reachability tests (Hub round-trip,
City's Menu button + Quit to Title). Getting there required two real fixes the suite itself
caught, not just test-code bugs: the DialogueBox/MenuButton position collision documented above,
and (during earlier debugging) confirming a fresh browser profile auto-opens the first-time
HowToPlay overlay over Title — correct, intentional behavior the test helpers now account for.

**What's not yet confirmed**: this session's sandboxed environment made running the full 4-device
matrix (iPhone 12, iPhone 14, Pixel 7, generic 360×740 Android) impractically slow — only Pixel 7
was run to a clean, repeated pass locally. The other 3 device profiles use the identical test
logic/coordinates against the same aspect-ratio-locked `Scale.FIT` canvas, so there's no
device-specific reason to expect a different result, but that's an expectation, not a confirmed
result — check the first CI run on the PR/push that lands this pass (a normal, non-sandboxed
GitHub Actions runner) before treating all 4 profiles as verified.
