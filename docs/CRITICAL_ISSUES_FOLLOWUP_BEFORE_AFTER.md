# Critical Issues Follow-Up — Before / After

Triggered by a live production report of three issues making the game feel broken: rhythm/
minigame transitions "skipping" gameplay entirely, VN dialogue text repeating, and the game
canvas rendering off-center instead of centered. Each is verified with live evidence below, not
assumed from a plausible-sounding theory — two of the three initial hypotheses (machine timing
for the "skip," a live stuck progress pointer for the "repeat") turned out to be wrong on closer
inspection, in favor of more specific, confirmed root causes.

## Issue 1 — Rhythm/minigame "skips gameplay entirely"

**Diagnosis**: this matches, precisely, a crash already found and fixed two commits prior
(`e55455e`, from this same engagement's own verification of an earlier pass): `transition.ts`'s
completion timer and the themed overlay's own tweens were scheduled for the identical duration,
so destroying the overlay could race a tween's final update on the same tick — an uncaught
exception thrown from inside Phaser's own `TweenManager.step()`, confirmed to recur every frame
afterward, silently freezing the scene forever. From a player's seat, mid-transition, this looks
exactly like the game "skipped" past what should have been playable content.

**Verified fixed, not just theorized**: a fresh, fully-instrumented diagnostic trace (real
Playwright browser, `page.on('pageerror')` capturing anything Phaser throws) run against the
current, already-deployed code — a genuine first-time player, tutorial practice pass, into a
real song, 57+ seconds of live gameplay, zero errors, zero premature scene change. New permanent
regression coverage: `critical-issues-followup.spec.ts`'s no-skip test asserts a real song takes
meaningfully longer than an instant to reach Results (Berlin's song runs ~58-61s per its own
chart data; the test's floor is 20s) and that a real timing score was recorded — **passing**.

## Issue 2 — VN text repeating

**Diagnosis, confirmed by direct trace, not the initially-suspected "stuck progress pointer"**:
only the *phase* (`arrival`/`preshow`/`afterShow`/`journal`) was ever persisted to
`Progress.nodeId` — never the *specific dialogue node* within it. Any interruption (tab close,
crash, refresh) partway through one of those phases' dialogue resumed the player at that phase's
very first line, forcing them to re-read (and re-choose through) everything already seen. Checked
and ruled out the alternative theory that a minigame/rhythm *return* re-shows an already-seen
node — traced every `returnPhase`/handoff in `CityScene.ts` and confirmed each always advances to
the correct next phase; that path was already correct.

**Fix** (`src/core/state.ts`, `src/game/resume.ts`, `src/ui/CityScene.ts`):
- `Progress` gains an optional `dialogueNodeId` field — additive, so an older save without it
  just falls back to the pre-existing "start of phase" behavior.
- `CityScene.ts`'s `walk()` now persists the exact node on every step, not just once per phase.
- `consumeResumeNode()` uses a saved `dialogueNodeId` as the phase's starting node exactly once,
  then clears it — so a later phase reached through normal forward play (not a resume) never
  accidentally reuses a stale id left over from an earlier phase's resume.

**Verified live, twice**: first via direct DOM/state inspection (advance two dialogue steps
including a choice, reload, resume through the real `loadRun → resumeTarget → scene.start` path,
confirm the exact second line shows — not the first line replayed). Then codified as
`critical-issues-followup.spec.ts`'s resume test, which does the same thing end-to-end and
asserts the resumed text contains "parking attendant" (the second line) and does **not** contain
"van dies in traffic" (the first, already-seen line) — **passing**.

**Backlog verified separately, not touched**: `DialogueBox.ts`'s existing "≡" toggle (top-left,
every dialogue-bearing scene) already shows the last 30 spoken lines with speaker colors and
drag-to-scroll — confirmed present and correctly wired; this pass didn't need to add it.

**Scoped out, on purpose**: an interactive rollback/"back" button (re-render the previous node
without re-applying its effects, blocked past irreversible points like a choice or a minigame
outcome) was in the original ask. Not built this pass — it needs a real per-node irreversibility
audit across all 4 cities' content to get "blocked past a choice" right everywhere, and rushing
that risks a worse bug than the one it would fix. The resume-node fix above closes the concrete,
verified repeat cause; the rollback UI is a genuinely separate feature worth its own focused pass.

## Issue 3 — Canvas rendering off-center

**Root cause, confirmed live at 1366×768**: `src/main.ts`'s Phaser scale config used
`autoCenter: Phaser.Scale.CENTER_BOTH`, which sets an inline `margin-left`/`margin-top` on the
canvas to center it within its parent. `index.html`'s `#app` is *also* a flex container
(`display:flex; align-items:center; justify-content:center`), needed regardless for the
safe-area-inset padding around the canvas. The two centering mechanisms compounded: the flexbox
centered the canvas's larger effective margin-box, then Phaser's own margin pushed the visible
content further right again. Measured: canvas rendered at `x=700.5` instead of the mathematically
correct `x=467` (`(1366-432)/2`) — read directly via `getBoundingClientRect()` and the canvas's
own inline style (`margin-left: 467px`, applied on top of an already-centered flex position).

**Fix**: `autoCenter: Phaser.Scale.NO_CENTER` — one centering mechanism only, left entirely to the
CSS flexbox that was already correctly sized and positioned.

**Verified**: same live measurement after the fix — canvas `x=467`, `right=899`, no inline
margin — exactly centered in the 1366px viewport. Screenshot confirms symmetric navy padding on
both sides (previously all on the left). New permanent regression coverage:
`critical-issues-followup.spec.ts`'s centering test asserts `|canvasCenter - viewportCenter| <= 2px`
on both axes — **passing**.

**Android port**: the same web content (including `index.html`'s CSS) runs unmodified inside a
Capacitor WebView — this fix applies identically there and doesn't change anything about the
port's readiness. `NO_CENTER` + a correctly-sized flex parent is Phaser's own documented pattern
for exactly this setup; the previous `CENTER_BOTH` choice was the actual bug, not something the
Android port needs to work around separately.

## New regression tests — `e2e/critical-issues-followup.spec.ts` (3/3 passing)

One test per issue above, each asserting the *specific* root cause rather than a generic smoke
check: the exact-node resume, the real-duration rhythm no-skip floor, and the 2px centering
tolerance. Plus 2 new unit tests in `resumeTarget.test.ts` covering `dialogueNodeId` threading.

## Testing

- **Unit**: 126/126 (was 124 — +2 `resumeTarget.test.ts` dialogueNodeId tests).
- **`critical-issues-followup.spec.ts`** (new): 3/3.
- **Full local e2e suite** (all 6 spec files, `--project="Pixel 7" --workers=1`): see the commit's
  own CI confirmation for the authoritative multi-device number — this doc is written before that
  full run completes; the exact count is in the delivered final report.

## Guardrails respected

No new cities, no Part 3 reality layer, no new systems (the resume-node fix extends the existing
`Progress`/save schema additively; no new persistence mechanism). Accessibility/no-fail untouched.
Constants stayed in `src/const.ts`. The rollback/back-button feature was deliberately deferred
rather than rushed — see Issue 2's "scoped out" note above.

## The honest remainder

- The interactive rollback ("back") button — deferred, as explained above.
- A narrower, lower-likelihood version of the same resume-repeat mechanism can still occur for the
  `locations`/`relationship` phases specifically: `CityScene.ts`'s `locationsVisited`/
  `relationshipsPlayed` tracking is run-scoped (reset in `init()`), not persisted, so an
  interruption *between* two locations (or two relationship-pool entries) resumes the picker
  without memory of what was already visited in that phase. Lower priority than the linear-walk
  fix above (arrival/preshow/afterShow/journal cover the bulk of a city's dialogue content, and
  the window for hitting this narrower case is smaller), but real — flagged here, not silently
  dropped, for a future pass if it's reported.
- Real iPhone/Android hardware testing remains on the owner's checklist, unchanged from every
  prior pass's own honest-remainder section.
