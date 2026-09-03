# UX/QA Follow-Up Pass — Before / After

A second pass on top of the initial UX/QA fix pass (`HANDOFF.md` §16), triggered by a live bug
report (screenshots of Mexico City's arrival dialogue, stuck with no way forward) after the first
redeploy. This document is the before/after; `HANDOFF.md` §17 has the full technical writeup.

## The headline bug

**Before**: tapping the dialogue panel to skip a line's typewriter animation — a completely
ordinary move, not an edge case — silently broke progression on any node with either choices or
plain tap-to-advance. `DialogueBox.handleTap()`'s skip-path called `finishTyping()` but never
`afterTypeComplete()`, so a choice node showed full text with **no choice buttons**, and a plain
node showed full text with **no advance chevron** — the exact shape of the live report's
screenshots. This affected every dialogue line in the game, in every city, any time a player
tapped before a line finished typing itself out (long lines especially, since they're the ones
most likely to draw an impatient tap).

**After**: the skip-path runs the identical completion logic the typewriter's own natural
`onComplete` would have. Tapping early now always leaves the dialogue in exactly the state
finishing it naturally would have — choices appear, chevrons arm, the story keeps moving.
Regression-tested deterministically (`e2e/smoke.spec.ts`), not just re-checked once by hand.

## Other real fixes from this same investigation

| Area | Before | After |
|---|---|---|
| Escape hatch coverage | City, MiniGame, Hub, Title had a way to Settings/Quit to Title. BandCreator, RoutePlan, and Rhythm did not — a player who wanted out mid-setup or mid-song had no path back. | All seven screens now open Settings (⚙ top-left, or Hub's existing button) with a working Back / Quit to Title. |
| MenuButton vs. backlog toggle (City) | Both landed at the identical (20,20) spot — DialogueBox's own "≡" backlog toggle silently intercepted every tap meant for the gear icon, so Settings was **unreachable from City** even after the button was added. Caught by the new tap-to-skip fix's sibling test, not assumed working. | Gear icon stacks below the backlog toggle; both are independently tappable and visually distinct (⚙ vs. ≡). |
| Audio after "Quit to Title" | Landing back on Title mid-Rhythm-song left that song's audio playing forever underneath the menu — Title only restarts its own ambience on the session's very first tap. | Quit to Title explicitly stops the music before transitioning. |
| Service worker / offline PWA | `public/sw.js` only ever *read* from a cache entry for the navigation document — nothing ever *wrote* one there, so an offline reload could never have worked, PWA manifest and registration notwithstanding. | The shell (`/` and `/index.html`) is pre-cached on install and opportunistically re-cached on every successful online navigation. |
| WHY_TOUR_BEATS ("why this tour?" picker) | Purely decorative — the choice was stored and never read again anywhere in the game. | The funeral-promise beat now sets a flag that gives Lisbon's journal entry a distinct, grief-specific closing line — real, testable optionality, not just flavor text. |

## Narrative depth

Six existing emotional beats — across all 4 existing cities, all 4 existing bandmates, zero new
characters or locations — were rewritten with a specific psychological framework as literary
subtext (never named directly in the game's own text, which stays in its established terse,
understated voice):

| Beat (city, bandmate/moment) | Framework | What changed |
|---|---|---|
| Rowan feeling unseen (Tokyo) | Attachment theory / caregiving system / interdependence | Added the specific attachment fear underneath the complaint — not the setlist, whether the band would notice the *shape of what's missing*. |
| The rooftop miradouro (Lisbon) | Schema accommodation / self-transcendence / broaden-and-build | Extended the existing "smaller and bigger at once" line into an explicit re-mapping metaphor; the "breathe" outcome now names the attentional widening it produces. |
| Jun's synth-builder night (Berlin) | Reward prediction error / behavioral activation / savoring | Named the surprise explicitly ("not budgeted for") and extended the approach-behavior beat (already replaying the outcome before it happens). |
| Theo's exhaustion (Lisbon) | Threat appraisal / defensive cascade / fear conditioning | The tiredness is now explicitly a trigger tied to a past burnout, not just present fatigue; the "push through" outcome reads as shutdown, not just frustration. |
| Mira's stage-fright (Lisbon) | Self-conscious emotion / social-rank / self-discrepancy | Named the actual-self/ideal-self gap underneath "what if they came for someone else's band" — and the reassurance outcome now names what changed (she stopped deflecting). |
| Lisbon's journal entry, funeral-promise path | Attachment reactivation / meaning reconstruction / continuing bonds | New conditional branch (see above) — addresses someone who can't hear the outcome, and actively re-derives meaning from that rather than resolving it. |

All six respect the game's hard 40-word-per-node pacing budget (`content/schema.ts` — a real
validation rule, not a style guideline; two of the six first drafts exceeded it and were trimmed).

## Testing — what's actually proven now, and how

- **`src/tests/`**: 109 unit tests (was 106) — 3 new, covering the funeral-promise branch's real
  content wiring specifically (not just the generic condition/fallback mechanism, which already
  had coverage).
- **`e2e/smoke.spec.ts`**: the tap-to-skip fix is tested *deterministically* — driving
  `DialogueBox.show()`/`handleTap()` directly rather than racing real typewriter-animation timing,
  after confirming live that this sandboxed environment's frame rendering is unreliable enough
  (a fully synchronous, zero-wait check once observed a ~5-second animation as already 100%
  complete) that timing-based tests here would be flaky by construction, not just occasionally.
- **`e2e/fullrun.spec.ts`** (new): a real, UI-driven walkthrough of one complete city loop — Hub →
  City (arrival → minigame → 2 locations → relationship → preshow choice) → Rhythm (autoplay) →
  Results → City (afterShow → journal) → back to Hub — using actual taps through actual dialogue,
  not the state-layer bypass `headless_playtest.test.ts` uses (which is exactly why that existing
  test never caught the tap-to-skip bug: it never taps anything). This is the direct answer to
  "you missed things previously" — a UI-level full-playthrough check didn't exist before this pass.
- Also found and fixed along the way: Playwright's own click-stability wait could hang
  indefinitely against this canvas-only app in this sandboxed environment (confirmed: one click
  consumed a full 180-second test budget). `e2e/helpers.ts`'s `canvasClick` now clicks with
  `force: true` — the canvas element's own box never moves during gameplay, only its drawn
  content does, so the stability wait was never protecting against anything real.
- Two further bugs in the *test itself*, not the app, surfaced while getting `fullrun.spec.ts`
  running: its setup started Hub directly without stopping Title first, so Title stayed live
  enough to receive some of the test's own later clicks; and the dialogue-walker helper only
  stopped on a scene change, but visiting a City location doesn't change scenes at all — it
  returns to the same CityScene's picker, which hides the dialogue box, so the walker kept
  tapping into the void. Both fixed in `e2e/helpers.ts`/`e2e/fullrun.spec.ts`.

## Honest status

**Clean on Pixel 7**: 109/109 unit tests, all 22 e2e tests in `smoke.spec.ts` + `fullrun.spec.ts`
— including a complete real playthrough with no shortcuts (arrival → minigame → 2 locations →
relationship scenes → preshow → a full autoplayed song → Results → afterShow/journal → back to
Hub) — and all 4 `dist-smoke.spec.ts` tests against the rebuilt production bundle. Typecheck and
production build both clean.

**Not run this pass**: the other 3 CI device profiles (iPhone 12/14, generic Android — only
Pixel 7 confirmed locally) and the manual real-device checklist (no physical hardware available
this session). Check the first CI run on the landing PR/push for the device matrix.
