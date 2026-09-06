# Testing Procedures — Tour Life v3

How this project catches (and, this pass, missed and then caught) regressions before they reach
production. Written after a live bug report — rhythm/minigames appearing to skip gameplay, VN
text repeating, the canvas rendering off-center — got through despite a green CI run, so this
also documents *why* that happened and what closes the gap, not just what the stack looks like.

## The stack, as of this pass

| Layer | Command | What it covers |
|---|---|---|
| Unit (Vitest) | `npm test` | Pure logic: RNG, chart generation, dialogue graph resolution, save migration, `resumeTarget`, content-schema validation, epilogue text, route framing. No Phaser, no DOM — fast (~6s of actual test time). **126/126** as of this pass. |
| Type check | `npm run typecheck` | `tsc --noEmit`, strict mode. Catches the class of bug a runtime test won't (a renamed field, a wrong data shape passed between scenes). |
| Text-fit audit | `node scripts/text-fit-audit.mjs` | Simulates `Button.ts`'s wrap/shrink/grow logic against every content-authored label across all 4 cities — a CI-gating check that a future content edit can't silently write a label too long for its button. **189/189**. |
| E2E (Playwright) | `npx playwright test` | Real browser, real clicks, real Phaser scene transitions — `window.__game`/`__state` (dev-only) drive setup and read scene state back. 6 spec files today (see below), run across a 4-device matrix in CI (iPhone 12, iPhone 14, Pixel 7, a generic 360×740 Android profile). |
| Dist smoke | `dist-smoke.spec.ts` + `playwright.dist.config.ts` | The same suite's lighter cousin, against the actual production build (`vite build` + `vite preview`), not the dev server — catches a bundling-specific bug the dev-server suite can't. |

### The e2e spec files and what each actually proves

- **`smoke.spec.ts`** — boot (first-time vs. returning player), every `progress.screen` value
  resumes to a playable scene, Settings reachable from every screen, tap-to-skip-typewriter
  doesn't soft-lock.
- **`fullrun.spec.ts`** — the golden path: one complete real city loop, Hub → arrival → 2
  minigames → 2 locations → relationship scenes → preshow → a full rhythm song → Results →
  afterShow → journal → back to Hub, driven by real taps, not synthetic scene jumps. This is the
  test most likely to catch "the game doesn't actually work end to end," and it's exactly the one
  whose own two bugs (a missing check for Addendum v2's second minigame insertion point, a stale
  button coordinate) were found and fixed *this pass* — see the honest note below.
- **`verification.spec.ts`** — specific claims that needed real dispatched-input proof, not
  code-read assumption: all 4 keyboard lanes (not just D), the hold-note rail's render/start/
  release mechanism, the cold-boot-into-Rhythm audio guard.
- **`text-fit-sweep.spec.ts`** — 8 screens at 390×844, asserting every visible label has real
  non-zero rendered bounds.
- **`stuck-screen-hardening.spec.ts`** — a deterministic double-tap race test (two real clicks on
  a transitioned button must fire the transition exactly once) and one test per `CityPhase`
  resume point.
- **`critical-issues-followup.spec.ts`** (new this pass) — three targeted regression guards, one
  per reported issue: VN resume lands on the exact saved dialogue node (not a phase-start
  replay); a rhythm song takes a real, non-instant amount of time to reach Results; the canvas is
  centered within 2px of the viewport center.

## How to read a CI run

Every push/PR runs two jobs (`.github/workflows/ci.yml`):
1. **`build-and-test`** — `npm ci && npm run typecheck && npm test && npm run build`. If this is
   red, something doesn't compile or a unit test broke — look here first, it's the fastest signal.
2. **`e2e-smoke`** — installs Chromium + WebKit, runs the full Playwright suite across all 4
   device profiles, then the dist-config pass. A single failing test names its exact
   `[Profile] › file:line › test name` — if the SAME test fails on all 4 profiles with the same
   error, it's almost certainly a real, device-independent bug; if it fails on only one or two
   with a timing-flavored message, treat it as a candidate for the sandbox-timing note below
   *only after* confirming (not assuming) it doesn't reproduce with a fresh, isolated run.

## What actually let three real bugs through a green-looking history

This is the part worth being honest about, since it's the direct answer to "how do we stop this
reaching production":

1. **A crash inside Phaser's own `TweenManager.step()`** (a completion timer and its own tween
   sharing an exact duration, so destroying the tween's target could race its final update) —
   `fullrun.spec.ts` existed and *should* have caught this, but had two of its own bugs (see
   above) that made it fail earlier in the flow, for a different, already-half-understood reason,
   before it ever reached the code path that actually crashed. **The lesson**: a failing test's
   own failure point matters — this pass initially raised a timeout three times (5s → 15s → 60s)
   assuming the failure was slowness, before checking `page.on('pageerror')` and finding the real
   exception. If a longer wait doesn't change the outcome at all, that's a stronger signal than
   the timeout number itself — stop guessing and look for the actual error.
2. **VN text repeating on resume** — no existing test exercised "close the tab mid-dialogue,
   reopen, resume" for content beyond the very first node of a phase; `smoke.spec.ts`'s resume
   tests seed a save directly at each phase's *start*, which is exactly the one case that was
   already correct. The gap: an assertion needs to walk forward a step or two *before* asserting
   resume behavior, not just assert resume from where the game itself would naturally start.
3. **The canvas rendering off-center** — nothing in the suite ever asserted a layout/geometry
   property; every existing e2e test drives interaction through logical (720×1280) coordinates
   translated against the canvas's own `getBoundingClientRect()`, which is correct regardless of
   where on screen the canvas happens to sit — so a real, visible centering bug was invisible to
   every test that existed, by construction. `critical-issues-followup.spec.ts`'s centering test
   closes this specific gap; the general lesson is that click-coordinate correctness and visual
   layout correctness are different properties, and only the suite tested the first one.

## Sandbox-specific limitations and the deterministic strategies that work around them

This machine's shared, variably-loaded state means `scene.time.delayedCall`/tween timing can be
dramatically slower than real time under load (confirmed repeatedly, always eventually correct —
a timing-precision issue, not a mechanism-correctness one). What actually works reliably here:

- **`force: true` on every canvas click** (`e2e/helpers.ts`'s `canvasClick`) — skips Playwright's
  default "wait for stable bounding box" check, which never protects against anything real for a
  canvas element (only its drawn *content* changes, not its box) and can otherwise stall for a
  test's entire budget under this sandbox's slower rendering.
- **Polling with `waitForCondition`/`waitForActiveScene`, never a fixed `waitForTimeout` as the
  only gate** — a fixed sleep is a race against whatever this run's own CPU/IO contention happens
  to be; a poll converges as soon as the real condition is true and still has a bounded ceiling.
- **Driving game logic directly via `window.__state`/`window.__game`** (dev-only, exposed in
  `main.ts`) for setup that isn't the thing under test — e.g. seeding a run's flags/route directly
  instead of clicking through BandCreator/RoutePlan's own forms for a test that's actually about
  City/Rhythm content.
- **No hard sleeps as a correctness mechanism** — every wait in this suite is either a poll with a
  real exit condition, or a documented, deliberately generous ceiling for something whose *own*
  real duration is known (e.g. Berlin's song is ~58-61s; `critical-issues-followup.spec.ts`'s
  no-skip test waits up to 100s for Results, but asserts elapsed time was still >20s — a floor,
  not a fixed sleep).
- **When a generous timeout increase changes nothing**, that's data, not noise — see the crash
  investigation above. A frozen tween's radius doesn't move between a 15s check and a 60s check;
  a merely-slow one does.

## What automation cannot catch (and what covers it instead)

- **Visual garble/layout-eyeball issues** — the class of bug behind the *original* Item 6 report
  (a label overlapping its neighbor) isn't something a bounds-check alone proves absent; the
  `docs/polish-before-after/` screenshot artifacts from `text-fit-sweep.spec.ts` are the actual
  evidence a human (or a future pass) can eyeball, alongside the numeric audit.
- **Real device feel** — haptics, actual touch latency, PWA install behavior, physical keyboard
  presses, the hold-note rail's felt timing on a real phone's actual frame pacing. None of this
  runs in CI. `docs/CROSS_PLATFORM_TESTING.md`'s manual checklist is the owner's own pass for
  this — still needed, still not automatable with what this project has.
- **Whether a fix for a live report is the RIGHT fix, not just a plausible one** — this pass's own
  history is the case study: the first hypothesis for the rhythm "skip" report (machine timing)
  and the first hypothesis for the text-repeat report ("a stuck progress pointer") were both
  wrong on closer inspection, in favor of more specific, verified root causes. Automation proves a
  fix works; it doesn't generate the right hypothesis for what to fix.

## Still manual, on the owner's checklist

- Real iPhone + Android hardware pass (`docs/CROSS_PLATFORM_TESTING.md`) — nothing in any pass to
  date has run on physical hardware, only emulation/this session's own browser tooling.
- Physical key-press feel for the 4 rhythm lanes (D/F/J/K) — `verification.spec.ts` proves the
  *mechanism* with real dispatched `keyboard.press`, not the felt timing on a real keyboard.
- The hold-note rail's grading-tier precision under real timing — `src/tests/rhythm.test.ts`
  covers the grading *logic* deterministically; `verification.spec.ts`'s Item 4b remains a known,
  already-documented flake on this specific shared machine (real-dispatch-latency vs. the grading
  window's margin), not a mechanism defect.

## Rule: gameplay mechanics need REAL-INPUT e2e coverage (added after the drag/rhythm regressions)

The live-regression pass of 2026-09-06 started from a genuinely uncomfortable fact: **CI was fully
green while drag-and-drop was broken in every drag minigame in the game.** Not flaky-green —
legitimately green, on the full 4-device matrix.

The reason is simple and worth stating plainly: *nothing in the suite had ever performed a drag.*
Minigame coverage clicked buttons and asserted outcomes; the closest thing to drag coverage
(`playAnyPendingMinigame`) taps a fixed coordinate and rides the no-fail safety timer, which
"passes" whether or not a single item was ever placed. A bug living entirely in the
pointer-to-placement path was therefore invisible to a green suite, by construction.

**The rule:** a change to a gameplay MECHANIC (drag, tap-to-hit, hold, a hit-test, a drop target,
a hit area) requires an e2e test that drives the mechanic through **real input** —
`page.mouse.down/move/up`, `keyboard.press`, `canvasClick` — and asserts the resulting **game
state**. Logic-bypass tests (calling the scene's own methods, seeding state, asserting a
resume target) remain correct and valuable for state/routing logic. They are not evidence that
a mechanic works. `e2e/drag.spec.ts` is the reference shape.

Corollary worth internalising: **the drop target must be asserted against what the player can
see.** The drag bug was a mismatch between a slot's visible bounds and the region that accepted a
drop; only a test aiming at the slot's *visible centre* could have caught it.

### The harness is not a device — four false positives from one pass

Timing- and GPU-sensitive claims made against this environment are unreliable in BOTH directions.
In a single pass, four separate "reproductions" turned out to be artifacts:

1. **Hidden browser pane** — `requestAnimationFrame` is throttled when the pane is hidden, so
   Phaser's loop had stepped **zero frames**. Every scene looks frozen; a stuck transition overlay
   appeared to be a real input-blocker leak.
2. **~4 FPS rendering** (software WebGL, "GPU stall due to ReadPixels") — Phaser's `Clock`
   advances timer events by the **clamped frame delta**, not wall-clock, so at 4fps timers ran at
   ~6% speed (measured: 150ms of timer time per 2333ms real). Anything built on `delayedCall`
   looks hung.
3. **Texture-key collision** — starting a scene by hand before BootScene's loader finishes lets a
   code-drawn fallback generate into a key the loader is about to add. Never happens in a natural
   boot-to-play flow.
4. **A leaked Title scene** — `helpers.startScene` uses the **SceneManager**, which (unlike every
   real transition in `transition.ts`) does not stop the calling scene. Title stayed alive,
   rendering its UI and its floating seed-input DOM element over whatever was started next, which
   read convincingly as "stray elements appearing over gameplay".

Practical guards, all applied in `drag.spec.ts` / `rhythm-entry.spec.ts` / `no-leftover-overlay.spec.ts`:

- Measure elapsed time with the **scene's own clock** or an in-page `requestAnimationFrame` poll —
  never a count of `waitForTimeout` iterations, since each `page.evaluate` costs a round-trip and
  wall-clock loop counts badly understate real elapsed time.
- Wait for `Title` to be active (boot finished) **and stop it** before starting a scene by hand.
- Before calling a timing symptom a bug, check the frame rate (`game.loop.actualFps`) and compare
  against the content's real duration (e.g. every song chart is 56-62s; a finish at ~62s is
  correct, one at 3s is the bug).
- Keep gestures cheap: every `mouse.move` is a round-trip, and an over-sampled drag can consume
  more of an in-game timer than a real player ever would.

### Transition-leak assertion pattern (for any future transition work)

`goTo()` creates a full-screen interactive blocker at depth 1000 plus, for themed types, an
overlay container at depth 500. If either outlives its transition, Phaser's `topOnly` hit-testing
routes every tap to the leftover object and the screen underneath is permanently dead. Any change
to `transition.ts` should keep `no-leftover-overlay.spec.ts` green: after every transition, assert
no object at depth >= 500 with `input.enabled` remains alive on any active scene.
