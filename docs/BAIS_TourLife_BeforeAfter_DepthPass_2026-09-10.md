# Tour Life — Depth Pass

**Before / after: narrative depth, dynamic endings, minigame impact, UI and rhythm integration**
Date: 2026-09-10 · Live: https://tour-life-v3.vercel.app

---

## 1. BANDMATE DEPTH

### The mechanical reason they felt dry

Each bandmate is introduced with a stated want — Mira wants recognition, Theo wants rest, Jun wants
sonic experimentation, Rowan wants to be seen. The run tracks a standing with each. And then:

- Relationship scenes were gated **only** on that standing number
- So any scene could surface at any point in the tour
- Nothing escalated, and **nothing ever resolved**
- The ending said what happened to the *band* and never to the four of them

A want that never escalates and never gets answered is a premise, not a story. However good each
individual scene is, the shape was vignettes.

### After: three stages

`src/game/arc.ts` introduces the shape most character writing actually uses:

| Stage | What it is | When |
|---|---|---|
| **Setup** | You meet the want | Default |
| **Strain** | The tour presses on it — this is where it costs something | After one scene with them |
| **Resolution** | The want is answered, one way or the other | Two-plus scenes **and** past the route midpoint |

Resolution requires **both** conditions, not either. Spend every scene on Theo and you still do not
get his payoff in the first city. Ignore Jun entirely and the finale does not hand you one for free.

**Derived, not stored.** The stage is a function of what the run has actually done — scenes had with
that person, position on the route, standing. No save-schema change, it cannot desync from the run,
and a save written before arcs existed reads as setup for everyone, which is where they would have
been anyway.

**Backwards compatible.** A pool entry with no `arcStage` is stage-agnostic and always eligible, so
all 30 existing scenes behave exactly as before. An entry authored for a stage plays at that stage
*or later* — a strain beat missed in Tokyo can still land in Lisbon. The one thing that never
happens is a resolution arriving before its setup.

### Four resolution beats, one per bandmate

Each is a two-node chain that **branches on standing**, using the same condition/fallback machinery
the journals already use — so the same beat lands warm or cool depending on how the tour went.

> **Theo (Berlin):** *"I worked out what I actually want. It is not a bigger room. It is one night
> where nobody needs anything from me."*
> — warm: *"You already gave me a couple of those. You probably did not notice. I did."*
> — cool: *"Anyway,"* he says, and picks the sticks back up before anyone has to answer.

Jun's lands in Tokyo, Mira's in Lisbon, Rowan's in Mexico City — so a player who follows one person
gets their payoff wherever that person's story peaks.

---

## 2. DYNAMIC ENDINGS

### Before

Six endings, scored from stats, each with a written epilogue keyed to ending + tags, plus a promise
paragraph, a return-leg callback and one minigame callback. Genuinely good prose — about the band.

**Four people you spent a whole tour managing walked off the last page unaccounted for.**

### After: the ending closes on each of them

`content/codas.ts` gives every bandmate three closing variants, chosen by their final standing:

| Variant | Meaning |
|---|---|
| **Fulfilled** | The tour gave them what they came for |
| **Unresolved** | It neither delivered nor took it away |
| **Denied** | It did not happen, and they know it |

> **Rowan, fulfilled:** *Somebody writes about Rowan specifically — one line, in one review, about
> the bass — and Rowan pretends not to have read it while being able to quote it exactly.*
>
> **Rowan, denied:** *Rowan goes unmentioned in every write-up of the tour, including the good ones.
> They say it does not matter. They keep the one photo where they are clearly, unmistakably in the
> frame.*

**No coda scolds the player.** A game with no fail states should not grow one in its final
paragraph. A test asserts this directly — it fails on "you failed", "your fault", "you should have",
"because of you".

### The arithmetic of variety

| | Before | After |
|---|---|---|
| Endings | 6 | 6 |
| Closing paragraphs per ending | 1 (plus callbacks) | **81** |

Four bandmates times three outcomes is 3⁴ = 81 distinct closing paragraphs, **per ending**, before
the promise line, return-leg callback and minigame callback are layered on. A test enumerates all
81 and asserts they are distinct.

This is deliberately not a seventh ending. Variety in an ending comes from it being *yours*, not
from there being more of them on a list.

---

## 3. MINIGAMES: HOW THEY IMPACT THE STORY

### Before

**Ten minigames. Three of them changed nothing at all.**

The sequence, sustain and pressure types set reward flags `modular_locked_in`, `mix_held_steady` and
`radio_quick_witted` on a clean run — and **nothing anywhere read them**. Acing them moved a stat
and vanished. Outcomes were also **binary**: pass or rough, so a competent player saw the same line
in every city.

### After

**Twelve minigames across eight types**, every one of them landing somewhere:

| Minigame | City | Type | What it changes |
|---|---|---|---|
| Modular Check | Berlin | sequence | Gated journal entry · epilogue callback |
| Synth Check | Berlin | timing | Gated dialogue · journal · epilogue |
| Mix Hold | Tokyo | sustain | Gated journal entry · epilogue callback |
| Pack the Van | Tokyo | drag | Gated dialogue · epilogue |
| Soundcheck | Tokyo | timing | Gated dialogue · journal · epilogue |
| Live Radio | Lisbon | pressure | Gated journal entry · epilogue callback |
| Soundcheck | Lisbon | timing | Gated dialogue · journal · epilogue |
| Load-In | Lisbon | drag | Gated dialogue · epilogue |
| **Tune by Ear** | Lisbon | **interval** | **Journal · epilogue · two flag tiers** |
| Interview | Mexico City | choice | Gated dialogue · epilogue |
| Radio Call-in | Mexico City | choice | Gated dialogue · epilogue |
| **Find the Clave** | Mexico City | **clave** | **Journal · epilogue · two flag tiers** |

Every outcome also feeds the **social feed** on the return leg and the **city memory** the town
keeps of you.

**A test now enforces this as a property**, not as twelve special cases: every reward flag any
minigame can set must be read by something. A minigame added later with a dead flag fails a test
instead of shipping silently. It has already caught four flags — including both of the new ones,
before they could ship inert.

### Three outcome tiers, not two

Every minigame gained a **flawless-run** line, so acing one reads differently from scraping through.
And the three soundchecks — previously identical three-round exercises with the same gold zone — are
now structurally different tasks: Berlin 4 rounds at zone 120, Tokyo 2 rounds at 96, Lisbon 5 rounds
at 168.

### The two new ones teach something real

Music-education research is consistent that what works is **multimodal and immediate** — hear it,
see it, answer, and be told *why* straight away — not a quiz with a score at the end.

**Tune by Ear** (Lisbon): the house has no tuner. Two notes play; you name the interval. Every
answer names what it actually was and anchors it to something physical — *"a fifth: the gap between
two open guitar strings."* A wrong answer still teaches; it just does not score. The ladder runs
from octave and unison up to the major/minor third distinction, which is the skill that matters.

**Find the Clave** (Mexico City): a percussionist taps a pattern on a doorframe. You pick the
matching notation from three rows of dots. Teaches the 3-2 son clave, its 2-3 inversion, rumba clave
and straight four — the backbone of most Latin popular music.

**The theory is tested for correctness**, because teaching wrong music is worse than teaching none.
Interval names are checked against real semitone counts; clave patterns against real stroke
placements. **It immediately caught an error of mine** — the "2-3 son clave" had its bars the wrong
way round, three strokes then two instead of two then three.

---

## 4. UI & VISUALS

### RoutePlan: reported three times, and the test was the reason

You flagged the route screen as hard to read three separate times while the contrast suite reported
12 of 12 passing. Both were true, for two compounding reasons.

**The scene had zero scrims.** Not one, anywhere in the file. Title, seed, the why-tour line, the
whole route list and the promise heading all drew directly onto a painted map — lit desk, pale
paper, a mug.

**The suite could not see it.** RoutePlan returns *early* behind an onboarding dialogue on a first
run, and the test profile had never cleared that flag. Every run measured the overlay's two lines
and reported a pass. A scene with a first-run gate needs the gate cleared, or the measurement is of
the gate.

With the real screen finally under measurement:

| Label | Before | Floor | After |
|---|---|---|---|
| "The opener — get your legs under you." | 2.99:1 | 4.5 | pass |
| "The one that matters." | 2.80:1 | 4.5 | pass |
| "What is this tour for?" | 2.43:1 | 3.0 | pass |
| 5th city row on a long route | 4.46:1 | 4.5 | pass |

### The contrast suite was measuring against the wrong standard

It used a **3.0:1** floor throughout. That is the WCAG AA threshold for **large text only** — 18pt
and up, or 14pt bold. Normal-weight body text requires **4.5:1**. Most of what you were squinting at
is small text sitting between 3 and 4.5: technically passing a bar that did not apply to it.

Each label's floor now comes from its own font size and weight.

| Label | Measured | Needed |
|---|---|---|
| "Reroll" | 3.13:1 | 4.5 |
| "drums" (band creator) | 3.45:1 | 4.5 |
| "Save tour as image" | 3.46:1 | 4.5 |
| "How to Play" | 3.71:1 | 4.5 |
| "One last shot before day jobs win." | 3.83:1 | 4.5 |

**The fix went into the fill, not the label.** Buttons already picked the better of cream or plum for
their caption; measured across the palette that is not enough — terracotta tops out at **3.35:1**,
teal at **4.07** and softRed at **3.78** whichever caption colour you choose, and those three fills
carry most of the game's buttons. Each is now darkened by the smallest step that clears the floor,
preserving the hue: teal needs 93%, softRed 90%, terracotta 79%. Computed, not hand-tuned.

One detail worth recording: targeting exactly 4.5 left every button landing at 4.2–4.4 once
rendered. A button is not a flat rectangle — its baked texture carries a bevel highlight along the
top edge, and the sweep measures the *worst* pixel behind the label, which is that highlight. The
target is 5.0; the half-point is what the bevel costs.

### Faces that match the writing

Your Mira screenshot was **authored correctly** and the renderer was **showing the authored mood**.
The art is genuinely distinct. The problem was that the palette was too coarse for the prose.

*"Her smile flickers, just slightly, before she catches it and buries it back in the noise of the
street, out of long habit."* — that is wistful and guarded. The nearest available face was `tense`,
which paints an angry frown and fights the line.

| | Before | After |
|---|---|---|
| Expressions per bandmate | 4 | **6** (added *wistful*, *tired*) |
| Painted portraits | 16 | **24** |

Seven authored moods were also re-assigned where they fought their line — including the exact node
from your screenshot, `tense` → `wistful`.

**And the inference was made honest.** The keyword classifier scored that line `happy` off the word
"smile" while it described suppressing one. Blanket-raising the confidence threshold was the wrong
correction — it silenced genuinely worried lines too. The fix is narrower and matches the actual
failure: when a positive cue appears alongside language of catching, burying or fading, the positive
reading is discarded rather than trusted. Those lines are wistful, and wistful is now a face a
writer can author rather than a thing a regex has to guess.

### Other UI fixes this pass

- **Modular Check was unplayable.** Pads drew at alpha 0.45 on painted art — over Berlin's dark wall
  the terracotta and plum pads were invisible until they flashed, so a memory game asked you to tap
  back a sequence on buttons you could not see. Now opaque with cream outlines.
- **Pre-show choices collided.** Row pitch 82 with each description's scrim centred 76 below its
  button meant every description ran **11px into the next button**. Pitch is now 104.
- **Results screen** got a scrim; it had never been in the contrast sweep at all.
- **Floating text inputs** are now torn down atomically with their scene. The old pattern appended
  the element and registered its cleanup on the next line; anything that stopped the scene in
  between left a real DOM input floating over the game forever.

---

## 5. RHYTHM GAME

### The grade ceiling, solved

Your screenshots settled it with arithmetic:

| City | Notes | Missed | Ratio | Grade |
|---|---|---|---|---|
| Tokyo | 137 | 52 (38%) | 0.411 | C |
| Berlin | 125 | 44 (35%) | 0.462 | C |

Berlin was **four good hits** from a B. But 35–40% missed is not a threshold problem.

**The game only ever listened to one finger.** Phaser tracks a single touch by default and nothing
in this project ever called `input.addPointer`. Every chart contains chords — two notes on the same
beat in different lanes, 3 to 14 groups per arrangement — and **every one of those second notes was
physically unhittable**.

**The difficulty selector never said it was one.** "Play it tight and precise" is not a stylistic
preference; on Tokyo it is 137 notes at 2.43/sec against 77 at 1.35. Each choice now shows its own
density — `Demanding · 137 notes` — derived from the chart so it cannot drift.

**Result, from your next run:** Lisbon, 67 of 85 landed, 18 missed. Miss rate **21%**, ratio 0.559,
**grade B**.

### Integration polish this pass

The town already remembered your first night and the social feed already used it — but the one
screen where the comparison actually lands, the moment you finish the second show, said nothing.
Results now closes the loop: *"Better than your first night in Berlin."*

Plus, from the previous pass: the full judgement breakdown (`67 of 85 notes landed · Perfect 28 ·
Good 26 · Close 13 · Missed 18`) instead of a bare letter, and a **full combo** named outright.

---

## 6. HOW A PLAYTHROUGH WORKS NOW

```
Seeded route through the city pool
   ↓
Each city:  van beat (carries the last city's result)
            arrival · locations · TWO relationship beats, arc-staged
            minigame (12 across 8 types, all with 3 outcome tiers)
            pre-show choice — now shows its own chart density
            the show — real recorded audio, all 8 songs
            results — breakdown, full-combo, return-leg comparison
   ↓
Return leg: the OTHER song, a town that remembers, a social feed that reflects it
   ↓
Ending: 1 of 6, plus promise, plus return-leg callback, plus minigame callback,
        plus FOUR personal codas — 81 closing combinations per ending
```

**What differs between two playthroughs**

| Axis | Variety |
|---|---|
| Route | Seeded draw from the city pool |
| Songs | 2 per city; the return leg always plays the other |
| Relationship scenes | 2 of 7–8 per city, drawn **unseen-first across runs** |
| Arc stages | Who you invest in decides whose story resolves |
| Minigame outcomes | 3 tiers each, feeding journals, social and epilogue |
| Ending | 6, times 81 coda combinations |
| Unlocks | 6 genres and 10 decor items across runs |

Everything is seeded, so a shared seed reproduces the whole tour exactly.

---

## Verification

- **214/214 unit tests** (was 199), `tsc --noEmit` clean
- New suites: `arcsAndCodas.test.ts` (15), `musicTheory.test.ts` (7), `minigameImpact.test.ts` (3)
- Contrast: every scene at **size-aware WCAG AA floors**, measured from real rendered pixels
- Full e2e suite on Pixel 7 before deploy; CI across four device profiles after

---

## Still open, honestly

| Gap | Why |
|---|---|
| Arc resolution beats are one per bandmate, not one per city | Four payoffs is the shape; sixteen would be a writing project, not an engineering one. |
| Codas key off standing alone, not standing plus arc outcome | Standing is the signal the player actually feels. Layering arc outcome on top is a refinement, not a fix. |
| `wistful` and `tired` are authorable but not inferred | Deliberate — they are exactly the registers a keyword classifier reads backwards. |
| Real-device pass and fresh-eyes playtest | **Owner.** Every serious bug this month was found by a person opening the link, not by a green suite. |

---

## Sources

- [uTheory — teaching music theory and ear training](https://info.utheory.com/tag/pedagogy/)
- [Theta Music Trainer — ear training and theory games](https://trainer.thetamusic.com/en/content/music-training-games)
- [Rhythm game charting and difficulty curves](https://rhythm-games.com/guides/rhythm-game-charting-level-design)
- [Butterfly Soup — not your average visual novel](https://intermittentmechanism.blog/2020/05/28/butterfly-soup-not-your-average-visual-novel/)
- [How Disco Elysium may help you write better characters](https://medium.com/@octoslender/how-disco-elysium-may-help-you-write-better-characters-24c3e1815839)
- [Roguelikes and narrative design with Greg Kasavin](https://www.gamedeveloper.com/design/roguelikes-and-narrative-design-with-i-hades-i-creative-director-greg-kasavin)
