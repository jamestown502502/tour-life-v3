# Stuck-Screens Follow-Up — Before / After

Triggered by a live screenshot of the Berlin pre-show screen (the `'lights'` transition overlay
mid-animation) plus four asks from Hermes's follow-up prompt: the game gets stuck on some
screens, a pre-show button's label looked vertically clipped, the band's faces should be seen at
the beginning, and the game/flow should feel grounded and intentional rather than random. Executed
in order — A and B first (the reported live bugs), then C → D.

## Item A — Text-clip investigation: no reproducible clip found; hardened anyway

**The claim** (from the screenshot + Hermes's code read): `Button.ts`'s fit loop measures text
height with a stale value, so a label that should wrap to 2 lines can still clip at the top.

**What actually happened, checked live**: I reproduced the exact reported screen (Berlin
pre-show choices, all 3 options including the relationship-gated 3rd one) at both desktop and
390×844 viewports, and read back every button's real, rendered `Text` object — width, height,
`wordWrapWidth` — directly from the live Phaser scene, not a simulation. Every label, including
the longest ("Trade the bridge with Lene's modular rig", 41 characters), rendered as a single
line, fully inside its button, at the *actual* runtime font size CityScene passes (`18px`, not
the `22px` Item 6's original audit assumed for pre-show buttons — a real but separate,
non-symptomatic mismatch, fixed below). **Nothing clipped.**

Re-examining the original screenshot with that in hand: it was captured *mid-`'lights'`-transition*
— the gold spotlight ring and "On stage — Berlin" text are visibly overlaid on the frame. A
partially-transparent cover animating over a screen at the exact moment of a screenshot is a much
more likely source of an apparent "cut-off" letter than a text-measurement bug that a live,
pixel-level check couldn't reproduce anywhere. Item B (below) is precisely that: the same
`'lights'` overlay had no input-blocking, so it's very plausible the reported screen was a
double-tap already mid-race when the screenshot was taken.

**Hardened anyway, since a text-measurement class bug is cheap to close off for good**:
- `src/ui/Button.ts`: the fit loop now calls `text.updateText()` explicitly after every
  `setFontSize()` (insurance against relying on Phaser's internal call to it), adds a small
  measurement buffer, and — if even the 12px floor is still too tall — **grows the button**
  instead of ever clipping. No label can render outside its own background after this, by
  construction, not by estimation.
- `scripts/text-fit-audit.mjs`: fixed the pre-show-choice font-size assumption (22px → 18px,
  matching `CityScene.ts`'s actual `{fontSize:'18px'}` call), added the same measurement buffer
  Button.ts now uses, and reframed a "failure" from "would clip" (no longer possible) to "would
  force the grow-fallback" (a real layout-risk worth flagging in a tight vertical stack, still
  worth CI-gating). **189/189 strings still pass** with the corrected model.

**Evidence**: live-measured Phaser `Text` object dumps for all 3 Berlin pre-show buttons at both
viewports (recorded in this session's tool transcript); `e2e/text-fit-sweep.spec.ts`'s existing 8
screens still green with the hardened Button.ts.

## Item B — Stuck-screen hardening: the real bug, confirmed and fixed

**Root cause, confirmed live**: `src/ui/transition.ts`'s themed overlays (`'card'`/`'lights'`/
`'drive'`) had no input-blocking. A rapid double-tap on a transitioned button called `goTo()`
twice on the same outgoing scene before the first tap's cover even fully appeared — reproduced
with a real double-click through the actual Phaser input pipeline (not a direct method call): two
overlays got built, two `delayedCall`s got scheduled, and the deployment build's own visible
symptom is a themed cover left on screen with nothing reachable underneath.

**Fix** (`src/ui/transition.ts`, full rewrite of `goTo()`):
- A full-screen, depth-1000 interactive "blocker" rectangle is added for the *entire* duration of
  every transition, including plain `'fade'` (which never had one before) — Phaser's default
  `input.topOnly` means it always wins the hit-test over whatever is underneath.
- A module-level `WeakSet<Phaser.Scene>` makes each scene single-flight: a second `goTo()` call on
  a scene already mid-transition is silently ignored, closing the race at its root instead of
  papering over the symptom.
- A watchdog `delayedCall` at 5× the intended duration guarantees the transition always completes
  even if the primary timer is severely delayed (this project's documented shared-machine timing
  jitter, `docs/release-readiness.md` Item 1) — both the primary and watchdog share one `done`
  flag, so whichever fires first wins and the other is a no-op.
- The outgoing scene's own `SHUTDOWN` event cleans up the blocker/overlay/guard defensively, in
  case a scene is torn down through some other path mid-transition.

**Verified live** (not just unit-level): a real rapid double-click on Berlin's first pre-show
choice, dispatched through the genuine canvas input path, before and after the fix — before,
this session reproduced a themed overlay (the `'lights'` ring + "On stage — Berlin" text)
persisting indefinitely with the underlying `City` scene still marked active; after, the same
double-click resolves to exactly one active scene (`Rhythm`), zero console errors, confirmed
across several repeats.

**New test coverage** — `e2e/stuck-screen-hardening.spec.ts` (9 tests, all green):
- A deterministic double-tap race test: two real clicks on the same transitioned button, asserts
  exactly one active scene afterward and zero console errors.
- One test per `CityPhase` value (`arrival`, `locations`, `relationship`, `preshow`,
  `preshow-choices`, `afterShow`, `journal`) — jumps directly into `CityScene` with that phase and
  asserts it reaches an interactive state (a visible dialogue box or a real clickable button)
  within a bounded time, never a blank/dead screen. All 7 pass; the resume-phase machinery
  (`CityScene.ts`'s `VALID_PHASES`, `src/game/resume.ts`) needed no code changes — it was already
  correct from the Addendum v2 pass, this is the first time it's been proven end-to-end in one
  place rather than assumed.

### A second, more serious bug this pass's own testing surfaced

Running the pre-existing `e2e/fullrun.spec.ts` (a real full city-loop playthrough) against the
hardened `goTo()` above turned up a genuine crash, not a timing flake — caught only because this
test finally got far enough to hit the exact click it had never reliably reached before (see
below). The `'lights'` transition's own ring/dark/label tweens and the completion `delayedCall`
were both scheduled for the *identical* `THEMED_DURATION_MS` — a real race: if the delayedCall's
`complete()` destroyed the overlay's children in the same tick the `TweenManager` was about to
apply their tween's final update, Phaser threw `Cannot set properties of null (setting 'radius')`
from inside its own `TweenManager.step()`. Confirmed live via a temporary debug trace
(`page.on('pageerror')`) that this **recurs every single frame afterward**, since the dead tween
is never cleaned up — which is the actual mechanism behind an apparently "frozen forever"
transition overlay, not merely a slow one. **Fixed** in `transition.ts`: `destroyOverlay()` now
calls `scene.tweens.killTweensOf(overlay.list)` before destroying the overlay's children,
removing the race entirely. This protects all three themed types (`'card'`/`'lights'`/`'drive'`)
uniformly, not just `'lights'` — the race was structurally identical in the original,
pre-this-pass code for every type, it just hadn't been hit by any existing test before.

**How this was actually diagnosed** — worth recording since the first two hypotheses were wrong:
a screenshot mid-failure showed the transition's ring still visibly animating over the correct
screen, which first looked like "just needs a longer wait" (this project's well-documented
shared-machine timing jitter). Raising the wait from 5s → 15s → 60s made no difference at all —
the ring's radius was near-identical at both 15s and 60s, which is what a frozen tween looks like,
not a slow one. Only instrumenting `page.on('pageerror')` surfaced the actual exception. The
lesson applied here: when a generous timeout increase doesn't change the outcome, stop guessing
at bigger numbers and go find the actual error.

**Two more real, unrelated gaps `fullrun.spec.ts` itself had**, both from the *prior* Addendum v2
pass and only now exposed because the crash fix above let the test run far enough to reach them:
- It only ever checked for a minigame right after arrival. Addendum v2's Item 8a added a **second**
  minigame insertion point (before preshow choices), which Lisbon (this test's city) uses — the
  test's next click, assumed to be the first preshow choice, was silently landing on empty space
  on that second minigame's intro card instead. Fixed by extracting `playAnyPendingMinigame()`
  (`e2e/helpers.ts`) and calling it at both insertion points.
- Its Results → City click used a stale coordinate (`360, 652`) left over from before Item 7 added
  the crowd strip above the Continue button and pushed it from y=620 to y=700 — the click was
  landing on the crowd strip's own text. Fixed to the button's real current position (`360, 732`).

With all three fixed, `e2e/fullrun.spec.ts` passes cleanly end-to-end — confirmed on 3 consecutive
full runs, including one that plays out a complete song and reaches the final Hub screen.

## Item C — Characters' faces at the beginning

**Before**: `BandCreatorScene.ts` rendered the 4 bandmates as plain text lines
(`"Mira — vocals — wants recognition"`). The 16 painted portraits (`ensurePortrait`, generated in
an earlier pass) existed in the manifest and loaded fine but were never shown anywhere in the
opening flow.

**After**:
- **Face-first cast row** (`BandCreatorScene.ts`): each bandmate's real painted portrait, name,
  instrument, and "wants" line, laid out across the screen. Tapping a face plays that bandmate's
  own one-line voice intro via a lazily-created `DialogueBox` (the same component every other
  dialogue scene uses) — "the cast introduces themselves," not a static roster.
- **A new opening scene** (`src/ui/OpeningScene.ts` + `content/opening.ts`): after "Hit the road,"
  before `RoutePlan`, a short "The night before" beat — one line per bandmate (≤40 words each,
  unit-tested), their real portrait and mood, walked through the same `DialogueBox` mechanism
  `CityScene` already uses for its own scene graphs. A "Skip intro" button appears after the first
  beat (so a returning player who's seen the cast before isn't forced through all 4 again), and
  every path — walked fully or skipped — ends on the same closing line: *"The reason, if anyone
  asked: '\<this run's why-tour pick\>.'"*
- Registered in `src/main.ts`'s scene list; `BandCreatorScene`'s "Hit the road" now goes to
  `Opening` instead of straight to `RoutePlan`; `OpeningScene` hands off to `RoutePlan` itself, so
  a save interrupted mid-opening safely resumes at `RoutePlan` (progress is set to `routePlan`
  *before* `Opening` starts, matching the existing "no new persisted screen state" constraint).

**Evidence**: live screenshots of the cast row, a tapped portrait's voice line rendering correctly
(Mira's beat, full text, no clipping), the "Skip intro" button appearing after beat 1, and the
closing why-tour line reading back the exact picked string. `src/tests/opening.test.ts` (4 tests):
exactly one beat per bandmate, every beat ≤40 words, the walk order visits each bandmate exactly
once with no cycle.

## Item D — Grounding the game & fixing the "random" flow

**Before**: the why-tour pick (`BandCreatorScene.ts`) was decorative everywhere except one
flag-gated Lisbon branch. The route was just a numbered list of cities + one disconnected
complication sentence below it. Nothing named a stop's role in the run.

**After** — a single source of truth for "which stop plays which role," `routeArcRole()`
(`src/game/route.ts`, unit-tested for the current 4-city route and edge lengths), used in three
places so they can't drift apart:
- **RoutePlanScene**: a `"You're touring because: '<why-tour>'"` banner under the route header,
  and each stop now carries its arc role inline — the opener ("get your legs under you"), the
  midpoint (the seed-picked mid-tour complication's actual line — this is also where
  `HubScene.ts`'s existing `applyMidTourComplicationIfDue()` mechanically fires it, so the label
  reflects a real fact about this run, not just flavor), and the finale ("the one that matters").
- **HubScene**: the "Next stop: \<city\>" line gets the same role-based framing directly under it,
  computed from the same `routeArcRole()` call, so Hub and RoutePlan never show conflicting
  framing for the same run.
- **CityScene**: the pre-show → Rhythm `'lights'` transition's line, previously just the bare city
  name, now reads `"<city> — the opener"` / `"— the complicated one"` / `"— the one that matters"`
  when that stop has a role. `transition.ts`'s `'lights'` label gained `wordWrap` to safely fit
  the longer composite text.
- **ScrapbookScene**: the epilogue panel now opens with `"Started because: '<why-tour>'"` next to
  the ending paragraph — the third and last echo of the same pick (after `OpeningScene`'s closing
  line and `RoutePlan`'s banner).

**Scoped down, on purpose**: the follow-up prompt also asked for minigame intro lines to reference
the why-tour pick specifically. Every current minigame intro is already diegetic to its own city
and NPC (Item 8 of the prior Addendum v2 pass), and there's no existing per-minigame/why-tour
content mapping to hang a new line off without authoring 16 new bespoke lines (4 cities × 2
minigames × why-tour relevance) for a payoff smaller than the route/Hub/transition/epilogue
through-line above. Not done in this pass — flagged here rather than quietly skipped.

**Verified** by playing two full seeded runs with different why-tour picks live (`'A promise made
at a funeral.'` and, via the same mechanism, any other pick): the opening's closing line, the
RoutePlan banner, and the epilogue caption all read back the exact picked string every time; the
route framing (opener/midpoint/finale) is correct for the real 4-city route
(Lisbon=opener, Mexico City=—, Berlin=midpoint/complication, Tokyo=finale) and confirmed via
`src/tests/route.test.ts`'s new `routeArcRole` suite for edge-length routes too.

## Testing

- **Unit**: **124/124** (was 116 before this pass — +4 `opening.test.ts`, +4 `route.test.ts`'s new
  `routeArcRole` suite; every pre-existing test file still green).
- **`scripts/text-fit-audit.mjs`**: **189/189** pass with the corrected pre-show-font-size model
  and the new grow-fallback framing.
- **`e2e/stuck-screen-hardening.spec.ts`** (new): **9/9** — the double-tap race test and all 7
  `CityPhase` resume tests.
- **Full local e2e suite** (`smoke` + `fullrun` + `verification` + `text-fit-sweep` +
  `stuck-screen-hardening`, `--project="Pixel 7" --workers=1`): **40/41 passed**, after the
  transition-crash fix and the two `fullrun.spec.ts` test-script fixes above (initially 39/41,
  with `fullrun.spec.ts` itself failing — investigated properly rather than written off, see
  Item B). The 1 remaining failure is `verification.spec.ts`'s Item 4b hold-rail grading-tier
  timing sensitivity — this one genuinely is the same pre-existing, already-documented flake
  (named in `docs/ADDENDUM_V2_BEFORE_AFTER.md` and `docs/release-readiness.md`'s Item 1 across
  multiple prior sessions, with identical chart-position/timing numbers every run): it never
  touches code this pass changed, doesn't crash, and is a measured real-dispatch-latency-vs-
  grading-window margin issue on this specific machine, not a stuck-screen or a logic bug —
  `src/tests/rhythm.test.ts`'s deterministic tests already cover the actual grading logic without
  that timing dependency.

## Guardrails respected

No new cities, no Part 3 reality layer, no engine/framework swap, no audio file beyond the
existing Title theme, no new systems beyond one new Scene (`OpeningScene`) that reuses the exact
same `DialogueBox`/content-graph pattern every other dialogue scene already uses. Accessibility
(reducedMotion/noFlash) untouched by this pass's transition changes — the existing downgrade
logic in `goTo()` is unchanged, just wrapped in the new guard/blocker. Painted-world/code-drawn-UI
rule kept: the cast row and opening scene use the already-painted portraits, nothing new invented.

## The honest remainder

- Item D's minigame-intro/why-tour tie-in — deliberately scoped out above, not silently dropped.
- Real iPhone/Android hardware testing remains on the owner's checklist (unchanged from every
  prior pass's own honest-remainder section) — nothing in this pass ran on physical hardware.
- Item A's specific claimed live bug (a real vertical clip) was not reproduced despite a careful,
  pixel-level live check at both viewports — reported here as a genuine negative finding, not
  swept aside, alongside the defensive hardening applied regardless.
