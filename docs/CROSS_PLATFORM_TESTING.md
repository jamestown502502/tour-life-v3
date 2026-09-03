# Cross-Platform Testing — Tour Life v3

Written for Workstream 3 of the UX/QA fix pass, answering: how should the app behave across
desktop web, iPhone, and Android via the Vercel link, before a Capacitor port — and what's the
recommended testing workflow.

## Behavior contract

The game is **one build, one behavior**, across desktop web, iOS Safari, Android Chrome, and (in
the future) a Capacitor WebView wrapper. The only things that are allowed to differ by platform:

- **Input method** — pointer taps vs. mouse clicks. The game is touch-first; keyboard (D/F/J/K in
  Rhythm, Space to advance dialogue) is an optional bonus input, never required.
- **Safe-area insets** — `viewport-fit=cover` + `env(safe-area-inset-*)` (`index.html`) account
  for iOS notches/home-indicator and Android gesture-nav bars.
- **Audio-unlock timing** — every mobile browser requires a user gesture before `AudioContext`
  can play; `audio.unlock()` fires on the first `pointerdown`/`keydown` (`src/core/audio.ts`).
  Desktop doesn't need this but the same code path runs there too — no branch on it.
- **PWA installability** — "Add to Home Screen" is an iOS/Android browser affordance; the
  manifest/service worker (`public/manifest.webmanifest`, `public/sw.js`) are the same file
  either way, the OS just does something with them.
- **Haptics** — `navigator.vibrate()` is Android-only (`AccessibilitySettings.haptics` defaults
  true only when `/Android/i.test(navigator.userAgent)`); the setting itself is visible and
  toggleable everywhere, it's just a no-op where the API doesn't exist.

Everything else — game logic, content, scoring, save data, accessibility settings, story
branching — is identical. **No platform-conditional game logic exists or should be added.** If a
platform ever needs different game behavior (not just different input/chrome), that's a signal
the underlying mechanic needs to be redesigned to be platform-agnostic, not branched.

## Standards, with current status (verified during this pass, not assumed)

| Standard | Status | Where |
|---|---|---|
| `viewport-fit=cover` + safe-area insets | ✅ Verified in source | `index.html`, CSS |
| `Scale.FIT` at a fixed 720×1280 logical canvas | ✅ Verified in source | `src/main.ts` game config |
| Multi-touch (`activePointers: 4`) | ✅ Verified in source | `src/main.ts` game config |
| Audio unlock on first gesture | ✅ Verified in source | `src/core/audio.ts` |
| Touch targets ≥44 CSS px | ✅ Verified — measured live at 390px width in the prior close-out pass (see `HANDOFF.md` §8); this pass's new buttons (Menu, Quit to Title) sized to the same 66px/145px-wide convention | `src/ui/Button.ts`, `src/ui/MenuButton.ts` |
| IndexedDB save + localStorage fallback | ✅ Verified in source, and exercised by `src/tests/saveMigration.test.ts` | `src/core/save.ts` |
| PWA manifest + service worker registered (production build only) | ✅ Verified via `e2e/dist-smoke.spec.ts` against the actual built `dist/` | `public/manifest.webmanifest`, `public/sw.js` |
| Service worker actually caches the app shell (prerequisite for offline reload) | ✅ Verified via `e2e/dist-smoke.spec.ts` | `public/sw.js` |
| Offline reload itself (real network cut, not just cache population) | ⚠️ **Not verified via Playwright this pass** — see the note under "production-build check" below; use the manual checklist's Airplane Mode step | — |
| Fonts loaded before Phaser boots | ✅ Verified in source (CSS Font Loading API gate) | `src/main.ts` |
| Text contrast (WCAG AA) across menu/explainer/painted-background screens | ✅ Verified via `scripts/contrast-audit.mjs` + `src/tests/contrast.test.ts` (this pass's Workstream 1); not every screen individually screenshotted — see `HANDOFF.md` §16.1's honest gap note | see `docs/contrast-audit.md` |
| Every `progress.screen` resume path lands on a playable scene | ✅ Verified live — `e2e/smoke.spec.ts`'s full resume-state matrix (13 cases) passes on Pixel 7, plus `src/tests/resumeTarget.test.ts` (8 unit tests). iPhone 12/14 and generic-Android profiles not run to completion locally; check CI. | `src/game/resume.ts` |
| Real iPhone/Android hardware (actual device, not emulation) | ⚠️ **Not verified this pass** — every check above ran in Playwright's device *emulation* (viewport + UA + touch simulation) or the in-session browser pane, not physical hardware. See the manual checklist below. | — |

## CI device-matrix PASS table (Final Polish pass, 2026-09-02)

Closed the one item `CROSS_PLATFORM_TESTING.md` had flagged as unrun: the full 4-profile CI
matrix, watched on its first real run rather than assumed green. Commit `21c53d1` (the UX/QA
follow-up pass that fixed the tap-to-skip bug) triggered CI run
[`33707063110`](https://github.com/jamestown502502/tour-life-v3/actions/runs/33707063110) on
push to `master` — the actual first execution of this workflow's e2e-smoke job.

| Device profile | `npx playwright test` (22 tests each) | `--config=playwright.dist.config.ts` |
|---|---|---|
| iPhone 12 | ✅ PASS (22/22) | — (dist config runs one profile only, see below) |
| iPhone 14 | ✅ PASS (22/22) | — |
| Pixel 7 | ✅ PASS (22/22) | ✅ PASS (4/4) |
| Android 360×740 | ✅ PASS (22/22) | — |

- `build-and-test` job: ✅ PASS (36s).
- `e2e-smoke` job, `npx playwright test` step: **88 passed, 0 failed** (24.0m) — 22 tests ×
  4 profiles, confirmed via the raw step log (`iPhone 12`/`iPhone 14`/`Pixel 7`/`Android`
  each appear exactly 22 times, zero `failed`/`✘` lines).
- `e2e-smoke` job, `--config=playwright.dist.config.ts` step: **4 passed, 0 failed** (22.6s) —
  this config only defines a single `Pixel 7 (production build)` project (see
  `playwright.dist.config.ts`), so there's no per-profile matrix on this side; it's the
  production-bundle check from Testing workflow §2 above.
- No profile failed, so there was nothing to fix and re-run — the DONE-WHEN bar ("don't mark a
  profile green without a green run") is met by an actual green run, not an assumption.

**Local second source of truth**: a full 4-profile parallel run was attempted twice on this
machine and both times failed on resource-starvation grounds (a `<canvas>` locator timing out at
10s on even the simplest tests — this machine is the owner's own live desktop, not an isolated
runner; full detail in `docs/release-readiness.md`'s Item 1). A serial, isolated Pixel-7-only
run of the same suites was fully clean: `smoke.spec.ts` + `fullrun.spec.ts` 22/22,
`--config=playwright.dist.config.ts` 4/4. That's the genuine local confirmation this pass has;
CI's matrix above remains the actual multi-profile proof.

## Testing workflow

### 1. Automated: Playwright device-emulation matrix (CI, every push/PR)

`e2e/smoke.spec.ts`, run via `playwright.config.ts` at 4 device profiles — iPhone 12, iPhone 14,
Pixel 7, and a generic 360×740 Android viewport:

```bash
npx playwright test
```

Covers: boot with no console errors, New Run reaching BandCreator, the full resume-state matrix
(every `progress.screen` value, plus the specific stale-cityId/stale-nodeId edge cases the fix
pass hardened `resumeTarget` against), and Settings being reachable (with a working Back / Quit
to Title) from every screen that has it wired up.

Runs against the **dev server**, not the built `dist/` — it relies on `window.__game`/`__state`
(exposed only in `import.meta.env.DEV`, see `src/main.ts`) to read back which scene actually
ended up active, since Phaser draws to a single `<canvas>` and there's no DOM for a normal
Playwright locator to read text from.

**Not yet covered by this suite** (honest gaps, not silently skipped): the full city dialogue
loop, a full rhythm song play-through, a full minigame play-through, save-slot save/load, and
scrapbook image export. These all involve either lengthy real-time content walks or a download
the automated harness can't verify end-to-end in the time budget this pass had. They're exercised
by unit tests instead where the underlying logic is unit-testable (`src/tests/rhythm.test.ts`,
`minigame.test.ts`, `epilogues.test.ts`, etc.) — see the manual checklist below for the actual
play-through pass.

### 2. Automated: production-build check (CI, before any Capacitor port)

`e2e/dist-smoke.spec.ts`, run via `playwright.dist.config.ts` against `vite preview` (the real
built `dist/`, not source):

```bash
npx playwright test --config=playwright.dist.config.ts
```

Covers what only exists in a production build: PWA manifest validity, service worker reaching an
active registration, and the shell (`/` and `/index.html`) actually being present in the SW's
cache after activation — the state that has to be true before an offline reload can possibly
work.

**Known tooling limitation, not an app bug**: this suite does NOT use
`context.setOffline(true)` + `page.reload()` to test the offline path end-to-end. Confirmed live
during this pass: Playwright's CDP-based offline emulation blocks a page's `fetch()` from ever
reaching the service worker's fetch handler at all (`"Failed to fetch"`, no request visible to
the SW), even once the shell is provably cached — a documented Chromium/Playwright quirk in how
offline emulation interacts with SW interception, unrelated to `public/sw.js`'s own logic. The
cache-population check above is what's actually deterministic and provable through Playwright;
"does a real offline reload work" is covered by the manual checklist's Airplane Mode step
instead, which isn't subject to this limitation.

### 3. Manual: real-device checklist (copy-paste, run before each release / after any UI change)

Run on an actual iPhone (Safari) and an actual Android phone (Chrome) via the live Vercel link —
emulation covers viewport/touch/UA but not real GPU rendering, real audio latency, or real
gesture-nav chrome:

- [ ] Load the Vercel URL fresh (not from a bookmark) — boots to Title within a few seconds,
      no visible layout break, safe-area insets look correct (no content under the notch/home
      indicator/gesture bar).
- [ ] Tap New Run → complete BandCreator → RoutePlan → Hub — every button responds to the first
      tap, no double-tap-required buttons, no dead zones.
- [ ] Play through one full city (arrival → a minigame if one triggers → both location visits →
      relationship scene → preshow choice) — dialogue advances on tap, choices are tappable,
      text is legible against its background at a glance without squinting.
- [ ] Play one full rhythm song, including at least one hold note and one choice cue — audio
      plays after the very first tap (no silent song), taps register on-beat, no lane
      consistently misses valid taps.
- [ ] Background the browser tab mid-song (switch apps, lock the phone) and return — the game
      doesn't crash or show a black screen.
- [ ] Reach Results → Hub → eventually Scrapbook — tap "Save tour as image" and confirm a
      shareable image actually appears/downloads.
- [ ] Open Settings from Title, Hub, and mid-city (the new Menu button, Workstream 2) — every
      toggle responds, Back returns to exactly where you were, Quit to Title actually reaches
      Title.
- [ ] Force-quit and relaunch the browser, then tap Continue — resumes to a playable screen, not
      a blank/frozen one.
- [ ] "Add to Home Screen" (iOS Safari share sheet / Android Chrome menu) — installs, launches
      standalone, the icon isn't a broken image.
- [ ] Turn on Airplane Mode after the first successful load, then reload — the app shell still
      loads (service worker cache).

Log the result of this checklist (pass/fail per line, device + OS version) alongside the release
it was run for — this doc doesn't track history, HANDOFF.md's changelog does.

## Before a Capacitor port specifically

Run both automated suites (`npx playwright test` and
`npx playwright test --config=playwright.dist.config.ts`) against the **built `dist/`** one more
time immediately before wrapping — `CAPACITOR_PORT.md` already covers the WebView-specific
concerns (relative `base: './'` paths, portrait lock, storage/audio-unlock already being handled).
The dist-smoke suite's offline-reload check is the closest current proxy for how a Capacitor
WebView actually serves the app (a local scheme, not a real network fetch) — treat a failure
there as a hard blocker for the port, not a "fix it later."
