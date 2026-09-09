# Tour Life: International Dates — Before / After, and the Public-Release Kit
**Date:** 2026-09-08 · **Live:** https://tour-life-v3.vercel.app

Two things in one document: the launch copy for taking this public, and the honest engineering
record of the pass that got it there.

---

# PART ONE — THE PRODUCT

## Product Hunt description

> ### Tour Life: International Dates
> **A cozy rhythm-adventure about an indie band's first world tour — where the towns remember you.**
>
> Pick a genre, name a band, choose why you're touring at all. Then play a seeded route through
> four cities as a playable diary: branching dialogue between shows, hands-on minigames in the
> venue, and a real four-lane rhythm performance on stage every night.
>
> There are no fail states. A missed note doesn't lose you anything — it changes what the night
> was. A rough show doesn't end the run; it becomes the thing a city posts about, and the thing
> you get to answer for when the tour books you back.
>
> Every run ends with a Tour Scrapbook and a written epilogue that references what you actually
> did: the promise you made before the first city, the load-out that went perfectly, the interview
> that didn't, the room you won over on the second try.
>
> No install. No account. Plays in a browser on a phone in about 30 minutes.

**One-liner:** *An indie band's world tour as a playable diary — with no wrong answers and towns
that remember how you did.*

**Taglines:**
- *Play the tour. Live with the reviews.*
- *No wrong notes. Just different stories.*
- *Four cities. One van. Everyone has an opinion.*

---

## How it works

**A run takes ~30 minutes:**

1. **Make the band.** Genre, name, and *why you're touring* — that last one isn't decoration; it
   returns in the opening scene, on the route screen, and in the epilogue.
2. **The night before.** Each of the four bandmates says the thing they're actually nervous about.
3. **Plan the route, and make a promise.** A seeded run through four cities — one booked **twice** —
   and one line about what this tour is *for*, which the ending will answer.
4. **The van.** A short travel beat on the way into every city, led by whichever bandmate the run
   has moved the most.
5. **In each city:**
   - **Arrival** — branching dialogue that sets the night
   - **A minigame** — six types across the game: a timing soundcheck, a drag load-out, an
     interview, a memory/call-and-response check, a two-fader mix hold, or a live radio spot on a
     four-second clock
   - **Two locations** — each a three-beat scene: a choice, what happened, and what it left behind
   - **A relationship scene** — deeper beats unlock as your standing with that person grows
   - **The show** — four-lane rhythm with tap notes, hold notes, and choice cues that let you
     shape the performance rather than only hit it
   - **After** — the comedown, and what the night cost or gave
6. **The return leg.** Late in the tour you go back to a city you've already played — and the game
   opens with **what that town posted about you the first time.** Fans defending you, critics
   counting your mistakes, someone asking whether tonight will be different.
7. **The Tour Scrapbook.** A shareable ending card plus a "Two Months Later" epilogue keyed to your
   ending, your tags, your promise, your minigames, and how the return night compared to the first.

**Accessibility is a shipped feature, not a menu afterthought:** no-fail cozy mode, autoplay,
adjustable timing windows, visual assist, metronome, reduced motion, no-flash, split volumes. The
rhythm score never gates the story — it only changes which story you get.

**Technically:** Vite + TypeScript + Phaser 3. UI code-drawn, audio generated live through the Web
Audio API, content validated JSON, runs reproducible from a seed. Installable as a PWA, playable
offline after one load.

---

## Marketing copy

**Short (social):**
> You're in a band. You have four cities, one van, and no idea what you're doing.
> Nothing you choose is wrong. Everything you choose is remembered.
> Play free in your browser →

**Medium (newsletter / store blurb):**
> Tour Life: International Dates is a cozy rhythm-adventure about an indie band's first world tour.
> Between shows it's a visual novel about four people in a van. On stage it's a real rhythm game.
> And the towns pay attention: play a city badly, and when the tour brings you back, the local
> accounts have already made up their minds — the fans defending you, the critics counting your
> mistakes, and someone who just wants to know if tonight will be different.
>
> No fail states, no punishment, no wrong answers — just a different story every run, and an
> epilogue that remembers which one you lived. About 30 minutes, free, no install.

**Press angle:**
> Most rhythm games punish you for missing. This one writes it down and brings it up later.

---

# PART TWO — BEFORE / AFTER

## The headline

| | Before this pass | After |
|---|---|---|
| Tour length | 4 stops, each city once | 5 stops — one city **booked twice** |
| Does the world react? | No. Cities were stateless. | **Yes.** Each remembers your show, affection, minigame |
| Return visits | Didn't exist | Open with a **social feed** about your first night |
| Dialogue depth | Every scene 1 beat deep | **3 beats** — choice → outcome → reflection (+53 authored) |
| Back button | Built, but could never appear | **Reachable** — chains are finally long enough |
| Minigames | 3 types, 7 total | **6 types, 10 total** |
| Relationship scenes | All equally available | **Arc-gated** — deeper beats unlock with standing |
| Travel between cities | Straight cut, Hub → City | **Van beats**, led by whoever changed most |
| Run intent | None | **A tour promise**, answered in the epilogue |
| Minigame → ending | 5 of 7 reached it | **10 of 10** |
| Epilogue depth | Ending + tags + 1 flourish | + **promise** + **return leg** + minigame flourish |
| Rhythm backdrops | Three stitched bands, hard seams | **Regenerated** as one continuous room |
| Unit tests | 128 | **162** |

## What was built

### 1. The return leg
`generateRoute` books one first-half city a second time, near the end, marked `revisit: true` and
seeded like everything else. **No new art, song, location or dialogue content** — the second night
differs because the town has an opinion now.

### 2. Run memory
`CityMemory` per city: the first show's grade, the town's affection at departure, whether its
minigame went well and which one it was. Additive, backfilled by `migrate()`. A reputation, not a
transcript.

### 3. The social feed
Four posts on arriving somewhere you have played: the opinion the night earned leads, the opposing
voice always appears, a specific callback (your minigame, by name), then a line about tonight.
Seeded per run and city, so a replayed seed reproduces a town's exact reaction.

The no-fail rule extends to reputation: **the worst show still produces someone who is glad they
went.** Critics are dismissive or bored — never cruel.

Researched against how Spider-Man, Ni No Kuni's *Leafbook* and Persona 5 use in-game feeds: they
work when they report the quality of what the player actually did, organically, without reading as
a tooltip. Every post here is selected by a memory; randomness only picks which true thing is said.

### 4. Three beats per scene, and a back button that works
Every location scene was choice → one-line outcome → done. Each outcome now leads to a
**reflection beat** — 53 newly authored, all inside the 40-word budget. This doubles the VN content
and switches on a feature that shipped months ago: `CityScene` clears walk history at every choice,
so the back button needed 2+ nodes *after* a choice to ever appear. Now it does.

### 5. Relationship arcs
Later beats are gated behind standing with that bandmate, evaluated **when the scene is about to
play** rather than at route-draw time — relationships move during a run, so an up-front gate would
judge a number that no longer exists. Opening beats stay ungated; nobody is locked out of a
bandmate entirely.

### 6. Three new minigame types
- **Sequence** ("Modular Check", Berlin) — pads light, you play them back, rounds grow. The only
  one testing *memory*, and call-and-response is how bands actually check a room.
- **Sustain** ("Hold the Mix", Tokyo) — two drifting faders inside a moving zone. The only one
  asking for sustained attention, and the only one using two pointers at once.
- **Pressure** ("Live on Air", Lisbon) — the interview with a visible four-second clock. Silence
  still answers for you; a no-fail game does not get to punish hesitation.

All three are structurally no-fail, like the original three.

### 7. Van beats
A two-beat travel scene into every city. The speaker is **whoever the run has moved furthest** from
their starting standing, with warm and cool variants — so the person with something going on is the
person who talks. Sets no progress and gates nothing, so an interruption still resumes at the Hub.

### 8. Tour promises
One line about what this tour is *for*, chosen at the route screen and answered in the epilogue.
Judged against numbers the player actually moved: relationships and harmony, town affection, or
inspiration.

### 9. The epilogue
Layers up to three earned additions on the base ending, in descending order of how much of the run
they speak for: **the promise**, **the return leg** (`return_redeemed` / `slipped` / `held`), then
the minigame flourish. All ten minigames now award a flag the epilogue can reference.

### 10. The rhythm backdrops — regenerated
Root cause was **the generation prompt**: it asked for "the vertical middle third … darker and
simpler than the top and bottom", and the model painted that literally as three zones joined by
hard seams. Measured seam positions differed per city (tokyo `.321/.679`, berlin `.321/.652`,
lisbon `.268/.487`), so no shared mask could fix them.

The rewritten prompt never mentions thirds, bands, top or bottom — it asks for one continuous room
from one viewpoint, taking its darkness from *depth*. All four regenerated; Tokyo now reads as a
single space: lit stage at the back, haze between, shadowed foreground. The runtime veil dropped
from 0.5 to 0.28, since it existed only to crush seams that no longer exist.

## Bugs the new tests caught before they shipped

**Route lookups assumed city ids were unique.** `route.find(s => s.cityId === id)` resolved to the
*first* booking, so the return leg's `visited` flag landed on the wrong stop and the tour could
never complete. Fixed with `currentStopFor()` using the authoritative `currentCityIndex`.

**`recordShow` mistook a minigame for a show.** A city's minigame always resolves *before* its
show and creates the memory — so the real first show looked like a return leg, on every city.
Fixed with an explicit `firstShowRecorded` marker.

**A test asserted minigame types by array position** and broke when new minigames were inserted.
Rewritten to assert by type across all cities — a better test regardless.

---

# PART THREE — WHAT REMAINS

All six outstanding items from the depth proposal are built: multi-node chains, relationship arcs,
the three new minigame types, van beats, tour promises, and regenerated backdrops.

Honest remainder, small and named:

- **Arc depth is one gate, not three stages.** Later relationship scenes unlock at standing 32.
  The proposal described a three-stage arc per bandmate; this is the mechanism with one stage
  populated. Adding more is now purely content.
- **New minigames are in three cities, not four.** Mexico City still runs the original three
  types — deliberate, so each city keeps a distinct identity.
- **Backdrops: Tokyo verified by eye** and by the same seam measurement that found the original
  problem. The other three came from the identical corrected prompt and load correctly, but were
  not individually eyeballed at full size.

## Verification

- **162/162** unit tests (was 128)
- Full e2e suite across all four device profiles in CI
- New coverage: `src/tests/social.test.ts` (feed determinism, tone balance, return-leg comparison,
  epilogue layering), `src/tests/depth.test.ts` (chains, arc gates, promises, van beats, new
  minigame configs, word budgets), `e2e/return-leg.spec.ts` (feed on return, hand-off to dialogue,
  absent on a first visit)
- Live checks: sequence and sustain minigames rendering, van scene selecting the correct bandmate,
  social feed on a return visit

## A note on how this month went

Four separate "reproductions" this month turned out to be the ~4fps local harness rather than the
game: a frozen render loop, frame-starved timers, a texture race, a leaked scene. The
duplicate-dialogue bug could **only** be reproduced in CI. The real rhythm killer — a Phaser clock
read during `create()`, which made the song clock equal the session clock — hid for weeks because
every test entered rhythm seconds after boot while every real player arrives minutes in.

The lasting fix is in `docs/TESTING_PROCEDURES.md`: gameplay-mechanic changes require real-input
e2e, and timing claims are validated in CI rather than locally. That rule is why this pass's bugs
were caught before they reached a player.
