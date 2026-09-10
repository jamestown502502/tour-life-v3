# Tour Life — Playtest Fix Pass

**Before / after, driven by your screenshots**
Date: 2026-09-09 · Live: https://tour-life-v3.vercel.app

---

## The screenshots settled the biggest open question

The results screens carried the judgement breakdown added last pass, and that turned "why always
C?" from a guess into arithmetic:

| City | Notes | Missed | Ratio | Grade |
|---|---|---|---|---|
| Tokyo | 137 | 52 (38%) | 0.411 | C |
| Berlin | 125 | 44 (35%) | 0.462 | C |
| Lisbon | 85 | 81 (95%) | 0.038 | C |

**Berlin was four good hits from a B.** But 35–40% of notes missed is not a threshold problem, and
no further recalibration would have been honest. Something was making notes unhittable.

### Cause 1 — the game only ever listened to one finger

`Phaser` tracks a single touch by default. It creates a mouse pointer and `pointer1`, and nothing
in this project ever called `input.addPointer`.

Every chart contains chords — two notes on the same beat in different lanes. Between 3 and 14
groups per arrangement. **Every one of those second notes was physically unhittable**: the second
finger's `pointerdown` was never dispatched, and the note it was aimed at could only ever be judged
a miss.

Fixed. And the hold-release had to be guarded in the same change: `pointerup` previously called
`releaseAllHolds()` unconditionally, which with multi-touch enabled would drop a hold the *other*
thumb was still pressing every time the tapping thumb lifted — the fix would have created a new bug.

### Cause 2 — the difficulty selector never says it is one

You picked **"Play it tight and precise"** in both Tokyo and Berlin. That is not a stylistic
preference. It is the difficulty setting:

| Choice | Tokyo chart |
|---|---|
| Play it tight and precise | **137 notes, 2.43/sec** |
| Let it breathe and improvise | 77 notes, 1.35/sec |

The game never said so. Note density is the standard way rhythm games express difficulty, so each
pre-show choice now shows its own — `Demanding · 137 notes` / `Gentle · 77 notes` — derived from
the chart itself so it can never drift from the real numbers.

The descriptions were also colliding: the row pitch was 82px with each description's scrim centred
76px below its button, so every description ran **11px into the next button**. That is the cramped
stack in your screenshot. Pitch is now 104.

### About Lisbon

95% missed with only 4 notes registering at all is not a difficulty curve — it looks like a run
that was left sitting. I am not going to invent a bug to explain it. If it happens again on a run
you actively played, that is a real signal and worth telling me.

---

## The Modular Check was unplayable, and your screenshot showed it

Your Berlin screenshot shows two visible pads. There are supposed to be four.

The pads were drawn at **alpha 0.45** on painted art. Over Berlin's dark blue wall, the terracotta
and plum pads were effectively invisible until they flashed — so a memory game asked you to tap
back a sequence on buttons you could not see.

Now opaque with a cream outline, so all four read at rest on any backdrop, with the flash to full
brightness still carrying the cue.

---

## "Feels like I get the same result every time"

Accurate, and worse than it looked.

**Before:** every minigame outcome was **binary** — pass or rough. The three soundchecks were also
structurally identical: three rounds each, windows of 2.0/1.5/1.1, 2.1/1.6/1.2 and 2.2/1.7/1.3, and
the same gold zone. One minigame reskinned three times, with two possible endings each.

**After:**

| | Before | After |
|---|---|---|
| Outcome tiers | 2 (pass / rough) | **3** (flawless / pass / rough) |
| Berlin soundcheck | 3 rounds, zone 140 | **4 rounds**, zone 120 |
| Tokyo soundcheck | 3 rounds, zone 140 | **2 rounds**, zone 96 |
| Lisbon soundcheck | 3 rounds, zone 140 | **5 rounds**, zone 168 |

Every minigame gained a flawless-run line, so acing one reads differently from scraping through.
Berlin's is a short, tight gauntlet; Tokyo's is two narrow chances; Lisbon's is five forgiving ones
that close down.

---

## Minigames now actually change the story

You asked me to check whether they dynamically affect the story. Three of the ten did not.

The sequence, sustain and pressure types — the three added most recently — set reward flags
`modular_locked_in`, `mix_held_steady` and `radio_quick_witted` on a clean run, and **nothing
anywhere read them.** Acing them moved a stat and then vanished.

Each now has:
- a **gated journal entry** in its city, inserted into the existing condition/fallback chain, so
  the run's own writing reflects what you did
- an **epilogue callback**, placed above the older ones because they are the payoffs a returning
  player has never seen

And `src/tests/minigameImpact.test.ts` asserts the property rather than the three cases: every
reward flag any minigame can set must be read by something. A minigame added later with a dead flag
now fails a test instead of shipping silently.

The social feed already read minigame outcomes — that part was working, and I left it alone.

---

## Legibility: the test was measuring against the wrong standard

The contrast suite passed 12 of 12 while you were telling me text was hard to read. Both were true.

The suite used a **3.0:1** floor. That is the WCAG AA threshold for **large text only** — 18pt and
up, or 14pt bold. Normal-weight body text requires **4.5:1**. Most of the labels you were squinting
at are small, and were sitting between 3 and 4.5: technically passing a bar that did not apply to
them.

Each label's floor is now chosen from its own font size and weight. At the correct bar, real
failures appeared immediately:

| | Measured | Needed |
|---|---|---|
| "Reroll" | 3.13:1 | 4.5 |
| "drums" (band creator) | 3.45:1 | 4.5 |
| "How to Play" | 3.71:1 | 4.5 |
| "One last shot before day jobs win." | 3.83:1 | 4.5 |
| "Save tour as image" | 3.46:1 | 4.5 |

### The fix went into the fill, not the label

Buttons already picked the better of cream or plum for their caption. Measured across the palette,
that is not enough: **terracotta tops out at 3.35:1, teal at 4.07 and softRed at 3.78** no matter
which label colour is chosen. Those three fills carry most of the game's buttons.

So the fill moves. Each is darkened by the smallest step that clears the floor, preserving the hue
rather than swapping colours — teal needs 93%, softRed 90%, terracotta 79%. Computed, not
hand-tuned, so a colour added later is held to the same standard automatically.

One detail worth recording: targeting exactly 4.5 left every button landing at 4.2–4.4 once
rendered. A button is not a flat rectangle — its baked texture carries a bevel highlight along the
top edge, and the sweep measures the *worst* pixel behind the label, which is that highlight. The
target is 5.0; the half-point is what the bevel costs.

The band creator's cast labels also moved from 13px dim sky to 14px cream on a denser scrim.

**12 of 12 scenes now pass at the correct floor.**

---

## What I deliberately did not change

- **The letter thresholds.** They were recalibrated last pass and were not the problem here. Moving
  them again to make a 0.462 into a B would have been hiding the miss rate rather than fixing it.
- **The social feed.** You said it works and looks good, and it already reads minigame outcomes.
- **Chart note counts.** The charts are not too dense in themselves — they were unhittable because
  of the pointer bug and unlabelled because of the difficulty disclosure. Both are fixed. If the
  density still reads as too high on a real device after multi-touch lands, that is a tuning
  conversation worth having with fresh numbers rather than a guess now.

---

## Two bugs this pass caught in its own fixes

Recorded because both would have reached you, and one of them was worse than the bug it replaced.

**The multi-touch guard stalled the practice pass.** Enabling two fingers needed a guard so lifting
one thumb does not drop a hold the other is still pressing. The first version checked
`pointers.some(p => p.isDown)` — which includes the pointer *being released*. That reads true
forever, `releaseAllHolds()` never ran, a hold note was never finalised, and the first rhythm
section hung with `tutorialActive` stuck true. A guard added to protect a fix had broken more than
the fix repaired. Caught by the suite before deploy; it now excludes the releasing pointer.

**Five specs clicked the pre-show buttons at a hardcoded `y=993`,** with a comment naming the
literal in `CityScene.ts`. Moving that row broke all five at once — clicking empty background and
timing out, which reads exactly like a gameplay regression and was not one. The choice container is
now named and tests resolve the button from the live scene, so layout can move freely.

A third round of failures turned out to be neither: two Playwright suites had been left running
against the same dev server and were starving each other. That is the same trap this project has
hit repeatedly — a contended harness looks identical to a broken game.

---

## Verification

- **197/197 unit tests** (was 194), `tsc --noEmit` clean
- **86/86 end-to-end** on Pixel 7
- Contrast: 12 of 12 scenes at size-aware WCAG AA floors, measured from real rendered pixels
- **Live, cold cache, fresh profile:** Edge 25.3s and Chrome 26.7s to playable, **zero console
  errors, zero failed requests, all 9 audio files fetched** in both
- Deployed bundle hash confirmed identical to the local build

---

## Sources

- [Rhythm Game Charting & Level Design: BPM, Patterns, Difficulty Curves](https://rhythm-games.com/guides/rhythm-game-charting-level-design)
- [Melatonin Nails Music Rhythm Accessibility](https://access-ability.uk/2023/01/20/melatonin-nails-music-rhythm-accessibility-access-ability/)
- [Feel the Rhythm: A Blind-Accessible Rhythm Game](https://dl.acm.org/doi/10.1145/3651278)
