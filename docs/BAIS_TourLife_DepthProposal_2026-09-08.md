# Tour Life: International Dates — Depth & Polish Proposal
**Date:** 2026-09-08 · **Baseline:** `a29b45e`, live, CI green (272 passed) · **Status:** proposal, nothing built

Written after a full end-to-end playthrough succeeded. Every item below is grounded in systems
that already exist in this repo — the recurring theme is that this game has more machinery than
it currently uses. Several "new features" here are really **content that switches on code already
shipped**.

Constraints respected throughout: no new cities, no Part 3 reality layer, no new engines,
additive save schema only, accessibility and no-fail intact.

Each item carries **Effort** (S/M/L), **Risk**, and what it reuses.

---

## 0. The three cheapest wins (read this section if you read nothing else)

| | What | Why it's nearly free |
|---|---|---|
| 1 | **Author multi-node dialogue chains** | The back button, the walk-history stack, and `DialogueNode.next` all shipped and work — but **no city has a single node-to-node chain**, so the back button can never appear and every scene is one line deep. Adding `next` links is pure content. |
| 2 | **Minigame outcomes feed the epilogue** | `generateEnding()` already keys epilogues on `(endingId, tags)`. Minigames already set flags. They just don't set flags the ending reads. |
| 3 | **Van scenes between cities** | `DialogueBox` + a `SceneGraph` is the entire requirement. `OpeningScene` is a 62-line worked example of exactly this pattern. |

---

## 1. Length and depth without new cities

### 1a. Second visits — the same city, later in the tour · **M · low risk**
The route generator already picks a seeded sequence of stops. Today each city appears once.
Allow a city to appear **twice**, with the second visit drawing from a different pool.

Everything needed exists: `relationshipScenePool` with per-entry availability flags,
`locations[]` with `LOCATIONS_TO_VISIT = 2`, and `evaluateCondition` for flag gating. A second
visit sets `visited_<city>` and unlocks entries gated on it.

**Why it's the strongest length lever:** it multiplies run length by reusing every painted
backdrop, song, and location you already have. A 4-stop tour becomes a 6–7 stop tour with zero
new art.

**Narrative bonus:** returning somewhere is inherently story-shaped — "the venue that went badly
the first time" is free drama.

### 1b. Travel beats between stops · **S · very low risk**
A 2–4 line van scene between cities: who's driving, what's playing, what nobody's saying.
Reuses `DialogueBox` exactly as `OpeningScene` does.

Pull the speaker from whichever bandmate's relationship changed most since the last stop — the
data is already in `State.data.relationships`. That makes the beat *reactive* rather than filler.

**Adds:** ~45 seconds per stop, 3–5 minutes per run, and the connective tissue the tour currently
lacks between "Results" and the next city.

### 1c. Tour promises — a goal you pick and the epilogue remembers · **M · low risk**
At RoutePlan, choose one promise: *"Get Jun's song into a setlist." · "Nobody plays hurt." ·
"We come home with more than we left with."*

Stored as a flag; checked at ending time; changes which epilogue paragraph you get. This gives
the run a spine — right now the route is a sequence, not an arc.

Reuses: flags, `content/epilogues.ts`'s `(endingId, tags)` keying, RoutePlan's existing UI.

### 1d. Relationship arcs with stages · **M · medium risk (content volume)**
Each bandmate currently has pool entries that fire semi-independently. Gate them into a
**three-beat arc** — early / middle / resolution — using relationship thresholds that already
exist. Rowan at 10 says something different from Rowan at 40.

**Risk noted honestly:** this is the largest writing task in the document. Four bandmates × three
beats × meaningful variation. It's the highest-value item for emotional depth and the one most
likely to stall on content, not code.

---

## 2. Harder minigames with real epilogue weight

### The structural fix first · **S · low risk**
Minigames currently grant small stat nudges and a `minigamePlayedFlag`. **Nothing they do reaches
the ending.** The fix is one line of content per minigame: award a *narrative* flag on the good
outcome (`tight_band`, `jun_trusted_you`, `never_dropped_a_load_in`) and let
`content/epilogues.ts` key on it.

Do this before building any new minigame. It converts all seven existing ones from flavor into
consequence, immediately.

### New types worth building

**Sequence / call-and-response · M · low risk**
Four pads light in a pattern; play it back. Length grows each round. Genuinely harder than
anything currently in the game, and it's *musically* apt for a soundcheck. Reuses the lane
textures and SFX already in `RhythmScene`.
*Epilogue hook:* clearing the long pattern → "the band that could hear each other."

**Mix balance / sustain · M · medium risk**
Two faders drift; hold both inside a moving target zone for 20 seconds. Uses the same pointer-drag
plumbing as Pack the Van, but demands sustained attention instead of a single correct drop —
a different and harder skill.
*Epilogue hook:* a clean mix → the "record they're proudest of" ending gets a specific line.
*Risk:* two simultaneous drags need multi-touch, which `activePointers: 4` already enables, but it
needs a real-device pass.

**Interview under pressure · S · low risk**
The existing `choice` type plus a visible timer, where *not answering* is itself an answer.
Cheapest new "hard" mode in the list — it's a variant, not a new engine.
*Epilogue hook:* dodging every question vs. over-sharing produces different press outcomes.

**Load-out under weather · S · low risk**
Pack the Van, but Berlin rain makes chips slip a few pixels on drop. One modifier on a shipped
minigame; weather already exists per route stop (`WEATHER_EFFECTS`).

### Difficulty that scales with the tour · **S · low risk**
`timingRoundsForHarmony()` already scales rounds by band harmony. Extend the same idea to stop
index: city four's soundcheck is tighter than city one's. Difficulty curve for one number.

---

## 3. Visual novel polish and story

### 3a. Multi-node scenes (activates the dormant back button) · **S · content only**
Covered in §0 but it belongs here too. Today every location scene is: one choice → one closing
line → done. Two or three linked beats per location would double VN time, give scenes a shape
(setup → turn → landing), and make the **already-built back button actually appear**.

This is the single highest polish-per-effort item in the document.

### 3b. Callbacks to earlier choices · **M · low risk**
Flags are set everywhere and read almost nowhere outside gating. A line in city three that
references what you did in city one is the cheapest possible "this game is paying attention"
signal. `evaluateCondition` already supports it — this is writing, not engineering.

### 3c. Give the crowd names · **S · low risk**
Five painted crowd members per city already exist as distinct assets (`crowd_<city>_m1..m5`).
Right now they're wallpaper. Let one recur — the same face in the front row two cities running,
mentioned once in dialogue. Enormous character return on assets already paid for.

### 3d. Portrait expressions on emotional beats · **S · low risk**
The mood system (`inspired` / `worried` / `tense`) is wired and used sparsely. Auditing existing
dialogue for lines where the portrait should change is free — the art exists.

### 3e. Epilogue specificity · **M · low risk**
The "Two Months Later" screen is the best writing in the game. It currently keys on ending id +
tags. Fold in **two concrete run details** — the city where the crowd sang along, the promise you
kept or didn't. Same template, dramatically more personal.

---

## 4. Keeping it working while it grows

This section is the one I'd argue hardest for, given this month's history.

**Content assertions, not vibes.** Every new `next` pointer, arrangement id, minigame id and flag
should be validated in `content.test.ts` at load. The rhythm outage traced back to content and
code drifting apart with nothing checking the seam.

**Real-input e2e per mechanic — already the rule.** `docs/TESTING_PROCEDURES.md` now requires it.
Any new minigame ships with a test that drives its actual gesture. Non-negotiable given a fully
broken drag mechanic once shipped green.

**Assume the harness lies about timing.** Four separate false results this month came from the
~4fps local harness: a stuck-overlay that was a frozen loop, a practice-pass stall that was frame
starvation, a texture race from starting scenes early, and a leaked Title scene. The duplicate-text
bug could *only* be reproduced in CI. New timing-sensitive tests should assert against the scene's
own clock and be validated in CI, not locally.

**Additive schema only.** Optional fields with graceful fallback — the pattern used for
`dialogueNodeId`, `locationsVisited`, and minigame music. Older saves keep working, every time.

**One system per pass.** Every serious outage this month came from a pass that touched a shared
layer. The stable months were the ones that added content behind existing switches.

---

## 5. Suggested order

| Phase | Items | Rationale |
|---|---|---|
| **1** | §0 all three: multi-node chains, minigame→epilogue flags, van beats | Pure content + one line per minigame. Activates dormant systems. Lowest risk in the document. |
| **2** | Second visits (1a), tour promises (1c), difficulty curve (2) | Multiplies run length on existing art; gives the run an arc. |
| **3** | Sequence minigame, interview-under-pressure, weather load-out | Two are variants of shipped types; one is genuinely new but self-contained. |
| **4** | Relationship arcs (1d), epilogue specificity (3e), callbacks (3b) | The deep writing pass, once the structure is proven. |
| **5** | Mix-balance minigame, crowd characters | Highest risk / most polish-dependent. Last on purpose. |

---

## 6. Known art defect (separate from the above)

The four `bg_rhythm_<city>` backdrops are **three stacked bands with hard horizontal seams** — a
sharp stage, a blurry washed middle, and a separate floor-and-crowd shot. Measured brightness
discontinuities as image-height fractions:

| City | Seams |
|---|---|
| tokyo | .321, .679 |
| berlin | .321, .652 |
| lisbon | .268, .487 |
| mexico_city | negligible |

Mitigated in code (`veilStageBackdrop()`) by compositing the whole backdrop toward night-navy,
which scales any brightness step down by `(1 - alpha)` regardless of where it sits, and gives
every city the legibility floor the art was supposed to provide.

**This is mitigation, not a cure.** The real fix is regenerating the four backdrops as single
coherent images — one room, one viewpoint, deliberately dark through the middle third rather than
blurred. That's an asset task with the existing image-generation pipeline, and worth doing before
any marketing screenshots.

The same class of defect is worth checking on the other painted sets before they're relied on.

---

## 7. What I would not do

- **The Part 3 reality layer.** Designed, deferred, and correctly so. It changes the game's tone
  from cozy to attritional. Everything above adds depth *within* the cozy frame.
- **A fifth city.** New art, new song, new chart, four new location scenes — the most expensive
  possible way to add the length that §1a delivers from what's already built.
- **Re-adding themed transitions.** They were the origin or neighbour of every regression for
  weeks. If they return, they return as an isolated feature with their own real-input tests.
