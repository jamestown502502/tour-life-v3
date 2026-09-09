# Tour Life: International Dates — Best-in-Class Pass

**Before / after, with the gaps named honestly**
Date: 2026-09-09 · Live: https://tour-life-v3.vercel.app · Repo: public

---

## How this pass was scoped

Every item below is either a defect reported from live play or a gap **measured** in the codebase.
Nothing here was added because it sounded like polish. Where a feature already existed, that is said
plainly rather than re-announced — the rhythm scene already had hitstop, screen shake, sparks, ring
pulses, lane flashes, a combo counter and judgement popups, and the dialogue system already had a
backlog and auto-advance. Re-listing those as new work would be padding.

---

## PART ONE — THE THREE PILLARS

### Visual novel: the cast stopped smiling through everything

**Before.** Sixteen portraits are painted — four bandmates times happy / worried / tense /
inspired — and `DialogueNode.portrait` has always supported choosing one per line. But only
**108 of 503 dialogue nodes** author a mood, and the fallback was `mood ?? 'happy'`.

So for **79% of every conversation the cast smiled**: through the argument about the setlist,
through a bandmate admitting their hands shake, through the night the room did not fill. The
expressive art existed and went unused — and worse, the wrong expression actively fought the line
it was attached to.

**After.** `src/game/mood.ts` infers a mood from the line itself when the writer did not specify
one. An authored `portrait` always wins. It is scored rather than first-match, so a line hitting two
cue sets lands on whichever is better represented, and ties break toward the calmer read — a line
with no emotional signal stays neutral rather than inventing drama.

It is presentational only: it never gates, scores or branches anything. The bar it has to clear is
not "always right", it is "better than smiling through everything". 503 of 503 lines now carry a
face chosen for them, instead of 108.

### Rhythm: the achievement players chase left no trace

**Before.** The combo counter tracked an unbroken run live and then threw it away at the end. A
player who landed an entire chart without dropping a note got the same results screen as one who
missed a third of it, minus some points.

Separately, and worse: the letter grade was effectively unreachable. See Part Two.

**After.** A full combo is named outright on the results screen, and results now report the whole
judgement breakdown — `47 of 60 notes landed · Perfect 12 · Good 30 · Close 9 · Missed 6` — rather
than a single letter. That second change is not decoration; it is what turns "why am I scoring
badly?" into an answerable question instead of a guess.

### Minigames: they had no feedback vocabulary at all

**Before.** `RhythmScene` imports `spawnPerfectSpark`, `comboPop`, `hitstop`, `shake` and
`spawnRingPulse`. `MiniGameScene` imported **none of them**. Six of the game's interaction types
confirmed themselves by changing a text label. That is the reason they read as flat next to the
rhythm sections — not the art, not the instructions.

**After.** The same vocabulary, applied where the moments actually are: a ring pulse when a dragged
chip seats into its slot, a spark plus 40ms of hitstop when a memory sequence is recalled correctly,
a short shake when it is not. Every one of these no-ops under reduced motion, which is how they were
already written.

---

## PART TWO — THE DEFECTS

### "Why always C?"

The scoring pipeline was **proved correct before anything was changed**: autoplay, which judges
every note at delta 0, returns ratio **1.0** and the top grade.

The thresholds were the bug. The ratio is measured against a run where *every* note is `perfect`
(100 points), while `good` is worth 60. So a player who landed **every single note** in the good
window scored 0.60 — and the floor for a B was 0.70. **C was not an occasional bad night. It was the
ceiling** for anyone not hitting the 50ms perfect window nearly every time.

In a game whose stated premise is that there are no wrong answers and no fail states, the letter was
the one place still quietly telling players they were bad at it.

| | Before | After |
|---|---|---|
| S | at least 0.95 | at least 0.90 |
| A | at least 0.85 | at least 0.72 |
| B | at least 0.70 | at least 0.50 |
| Every note landed as `good` | **C** | **B** |

**Still open, and stated as open:** the screenshot that prompted this said *"Rough night"*, which is
the sub-0.30 band — worse than landing every note as `ok`. That is consistent with notes being
missed outright rather than hit imprecisely, and the two need opposite fixes. The new breakdown is
what will settle it on the next run.

### "The audio is the same every city and every scenario"

Two separate causes, and the bigger one was not about the notes.

**Six scenes never set a bed at all.** Only City, Hub, MiniGame, Rhythm and Title ever called
`playAmbience`. Van, Results, Scrapbook, RoutePlan, BandCreator and Opening inherited whatever was
already playing and let it loop on — so long stretches of a run were literally still playing the
previous screen's music. The Hub then played one fixed default no matter which city the bus was
heading toward.

`src/game/ambience.ts` now derives a bed from the song a city is actually playing on this visit —
the logic CityScene already had, shared rather than duplicated — so a city's identity follows the
player: the bus toward it (0.34x tempo), the show, the room after it (0.45x). Pure and seeded, so a
replayed seed reproduces the soundtrack exactly as it already reproduced the route.

**And half the songs had no music.** Part B generated four tracks and attached them to each city's
*second* song. The four originals — the ones a first visit is most likely to open with — were never
given any, and fell back to the procedural oscillator bed.

| | Before | After |
|---|---|---|
| Songs with a real recorded track | 4 of 8 | **8 of 8** |
| Total soundtrack size | 6.6 MB | **6.47 MB** |
| Bitrate | 192 kbps | 96 kbps |

The soundtrack **doubled while getting slightly smaller**. Nine tracks at 192 kbps would have been
over 12 MB of background download on a phone; these are ambient beds played under gameplay, not a
listening record. Each new track was prompted at its song's exact authored BPM, so it lands on the
existing chart rather than needing the chart rewritten.

The procedural bed is not dead code: RhythmScene still falls back to it whenever a track has not
finished downloading (they load in the background, after Title) or fails to decode. A test asserts
every song keeps the chord progression, tempo and waveform that bed needs.

### The Results screen was unreadable

Same root cause as the band creator: it draws onto the city's rhythm-stage art — neon signage, stage
wash — but every line on it was authored while a stale asset manifest meant the flat code-drawn
fallback was what actually rendered. It had never been in the contrast sweep. It is now; 12 scenes
are measured.

---

## PART THREE — "EVERY PLAYTHROUGH SHOULD FEEL UNIQUE"

### Cross-run freshness

**Before.** Scene draws were seeded *per run* but had no memory *across* runs. Each city exposes
7–8 relationship scenes and a run shows 2, drawn fresh from the whole pool every time — so a player
replaying could be handed the same two Berlin scenes three runs running and correctly conclude the
game had nothing new.

**After.** Scenes the player has never seen are drawn first; already-seen ones are only reached once
a city's fresh material is spent. 30 scenes with 2 shown per city visit is real headroom. Recorded
on **display**, not on draw, so a run abandoned before reaching a city does not burn that city's
unseen material. Still fully seeded — a replayed seed on a fresh profile reproduces exactly.

This is Supergiant's principle from *Hades*, at this game's scale: their conversation system holds a
bucket of candidate lines filtered by conditions and deliberately avoids repeating any until the
unused ones are spent, because hitting repeated dialogue is the moment a game stops feeling alive.

### The stops now connect

**Before.** The van opened on the same generic motorway image whether the last city was a triumph or
a disaster. The tour read as a list of separate cities rather than one continuous trip.

**After.** A carry line, keyed to how the previous city's show actually went:

> *"Nobody has brought up Berlin. The not-bringing-it-up is taking a lot of effort."*

Only shown when there is a previous stop with a real show behind it, so the first leg is unchanged.
The van already chose its speaker reactively — whichever bandmate has moved most since the last stop
— and this extends that principle backward to the city itself.

---

## PART FOUR — WHAT IS STILL OPEN

Written down rather than quietly dropped.

| Gap | Status |
|---|---|
| Whether "Rough night" means missed notes or imprecise ones | **Open.** The new breakdown answers it on the next run. |
| Mood inference is a heuristic, not comprehension | Accepted. It replaces a fixed smile, which is a lower bar than being right every time. Authoring moods on the remaining 395 nodes stays the better long-term fix. |
| Full combo is recognised at Results, not celebrated mid-song | Deliberate — a mid-song celebration competes with the chart for attention. |
| New minigame types are in three cities, not four | Deliberate — Mexico City keeps the original three so each city retains an identity. |
| Relationship arcs are one gate, not three stages | The mechanism ships and works; three stages per bandmate is a writing task. |
| Part 3 reality layer | Explicitly deferred in `CLAUDE.md`. A tone decision, not a gap. |
| Real-device pass and fresh-eyes playtest | **Owner.** See `RELEASE_GATE.md` gates 15–17. Every serious bug this month was found by a person opening the link, not by a green suite. |

---

## Sources

- [Roguelikes and narrative design with Hades' Greg Kasavin](https://www.gamedeveloper.com/design/roguelikes-and-narrative-design-with-i-hades-i-creative-director-greg-kasavin)
- [How Supergiant weaves narrative rewards into Hades' cycle of perpetual death](https://www.gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death)
- [Juice in Game Design: Making Your Games Feel Amazing](https://www.bloodmooninteractive.com/articles/juice.html)
- [The "Juice" Problem: How Exaggerated Feedback is Harming Game Design](https://www.wayline.io/blog/the-juice-problem-how-exaggerated-feedback-is-harming-game-design)
- [Weaving Narratives into Procedural Worlds](https://www.gamedeveloper.com/design/weaving-narratives-into-procedural-worlds)
