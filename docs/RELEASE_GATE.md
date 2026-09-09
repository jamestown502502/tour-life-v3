# Release Gate — Tour Life: International Dates

Every line must be green before the URL is shared publicly. Items marked **owner** cannot be
automated and are the two genuine gaps in this project's verification.

**Live:** https://tour-life-v3.vercel.app
**Release candidate:** Part A `e2cd345` · Part B `197ce8d` · post-deploy regression pass (2026-09-09)

> **The freeze was lifted once, deliberately.** The candidate shipped, was played on real browsers,
> and failed: no boot on Edge, a slow blank boot on Chrome, and — once a stale-manifest bug was
> fixed — labels that turned out to have been authored against flat fallback backgrounds all along.
> Gates 18–22 below are that pass. This is exactly the outcome gates 15–16 exist to produce, arriving
> the hard way instead.

---

## Automated — evidence, not opinion

| # | Gate | Status | Evidence |
|---|---|---|---|
| 1 | Unit tests green | ✅ | **194/194** (was 128 at the start of this pass); `tsc --noEmit` clean |
| 2 | Full e2e suite green, all 4 device profiles | ✅ | CI `34378844886` (regression pass, 1h37m) and `34381965080` (first-run fix, 1h58m) both **green** across all four profiles |
| 3 | A1 background audit complete | ✅ | Table in `BAIS_TourLife_CloseOutPlan_2026-09-09.md`; corrected the brief twice |
| 4 | No barren screens | ✅ | All 10 full-screen scenes render their painted texture — `e2e/no-barren-screens.spec.ts` |
| 5 | Overlays dim rather than hide | ✅ | Settings 0.82, HowToPlay 0.78 (were 0.98 / 0.85) |
| 6 | Backdrops seam-free — **measured** | ✅ | New scenes 4.2–10.2; rhythm 3.4–9.5; broken original was **53.2** |
| 7 | Rhythm backdrops eyeballed (close-out C2) | ✅ | All four measured; Tokyo also inspected at full size |
| 8 | Two songs per city | ✅ | 8 songs, 4 cities × 2 — `songVariety.test.ts` |
| 8b | **Every** song has a real recorded track | ✅ | Was 4 of 8 — the four originals fell back to the oscillator bed. Now 8 of 8, whole soundtrack 6.6MB → **6.47MB** (192→96 kbps) — `soundtrack.test.ts` |
| 9 | Return leg never replays the first night | ✅ | Live: Hallenbad 71 notes → Kreuzberg Static 84 notes |
| 10 | Backing tracks with procedural fallback | ✅ | All 8 fetched on a live cold load, zero failed requests; fallback still asserted per song (progression + tempo + waveform) |
| 11 | Themed transitions fully reverted | ✅ | grep for `transition:'card'/'lights'/'drive'`, `buildThemedOverlay`, `TransitionType` → **0 hits**; `transition.ts` is 50 lines |
| 12 | No-fail intact after RhythmScene changes | ✅ | All-miss run still reaches Results — `verification.spec.ts` 12/12 |
| 13 | Launch link | ✅ | root **200**, og-image **200**, manifest **200**, `sw.js` serving `tourlife-v3` |
| 14 | Clock fix not regressed | ✅ | `startTime = this.game.loop.time + 1200` verified present; audio scheduled on the AudioContext clock, never a scene timer |
| 18 | Boots on Microsoft Edge | ✅ | Built `dist` driven in Edge at 412x915: Title reached, zero console errors, zero failed requests. Was an indefinite blank screen. |
| 19 | Loading screen while assets load | ✅ | `BootScene.buildLoadingScreen()` — title, progress bar, percentage. Boot payload 15.4MB → 9.6MB (backing tracks deferred to a post-Title loader pass) |
| 20 | Asset manifest never served stale | ✅ | `manifest.json` network-first in `public/sw.js`; `CACHE_NAME` bumped to `tourlife-v4` to evict every pinned v3 copy |
| 21 | Every label legible on its real backdrop | ✅ | `e2e/text-legibility.spec.ts` — WCAG contrast from actual rendered pixels, 3.0:1 minimum, **12 checks** over 9 scenes + 3 minigames (Results added after it shipped unreadable) |
| 22 | All 10 minigames have painted art | ✅ | The three new types were shipped without backdrops; generated, measured seam-free, 1440x2560 |
| 23 | First-run overlay dims the painted title, not a blank screen | ✅ | `e2e/first-run-title.spec.ts` — backdrop standard deviation, measured below the card. Was **0.00** (flat) on the live deploy; live now **2.49** in Edge and Chrome |
| 24 | The letter grade is reachable by an ordinary player | ✅ | Autoplay proves the pipeline (ratio **1.0**, top grade). Landing every note as `good` scored 0.60 against a 0.70 floor for B — C was the *ceiling*, not a bad night. Thresholds recalibrated; `rhythm.test.ts` asserts the intent, not the numbers |
| 25 | A score is explainable, not just a letter | ✅ | Results reports the judgement breakdown — a ratio cannot distinguish "hit everything late" from "missed half the chart", and those need opposite fixes |
| 26 | No scene inherits the previous screen's music | ✅ | Six scenes set no bed at all (Van, Results, Scrapbook, RoutePlan, BandCreator, Opening); Hub played one fixed default regardless of destination. `src/game/ambience.ts` — seeded, so a replayed seed reproduces the soundtrack |
| 27 | A replay draws material the player has not seen | ✅ | Draws were seeded per run with no memory *across* runs. Unseen-first now, recorded on display not on draw — `runVariety.test.ts` |
| 28 | Minigames give real feedback, not a text label | ✅ | `MiniGameScene` imported **none** of the effect helpers `RhythmScene` uses. Ring pulse / spark + hitstop / shake, all reduced-motion safe |
| 29 | Characters' faces match their lines | ✅ | 108 of 503 nodes author a mood; the fallback was a flat `'happy'`, so the cast smiled through 79% of every conversation. `mood.ts` + `mood.test.ts` |

### The Actions billing block, and how it was cleared

Two commits mid-pass could not produce CI e2e evidence: the account had spent 100% of its included
Actions minutes, because the four-profile matrix costs ~110 minutes per push and a day of work
exhausted the 2,000-minute monthly allowance. GitHub refused to start the job.

**Resolved by making the repository public**, which is the free answer — public repos get unlimited
standard-runner minutes. No subscription was needed, and a subscription would have been the wrong
purchase anyway: GitHub Pro adds 1,000 minutes, which at this suite's cost is nine more runs.

Before recommending it, all 80 commits were scanned: no `.env`, key, credential or `.pem` file ever
committed, no key-shaped strings anywhere in history, and `.env` already gitignored.

One cost fix remains **unapplied**: cutting the per-push matrix to a single profile (~110 min → ~28)
with the full four running nightly and on `workflow_dispatch`. It is written but unpushed — the
OAuth token in use lacks the `workflow` scope required to modify `.github/workflows/`. It matters
much less now that minutes are free.

## Owner — the two gaps no test can close

| # | Gate | Status | Document |
|---|---|---|---|
| 15 | Real-device pass, iPhone + Android | ⬜ **owner** | `docs/REAL_DEVICE_TESTING.md` |
| 16 | Fresh-eyes playtest, 3–5 blind testers | ⬜ **owner** | `docs/FRESH_EYES_PLAYTEST.md` |
| 17 | Blockers from 15–16 fixed | ⬜ | `PLAYTEST_TRIAGE.md` (create when 16 returns) |

**Why these matter more than the twenty-nine above.** This project has now produced four separate
"reproductions" that turned out to be the ~4fps test harness rather than the game, and its worst
bug — a song that ended before it began — hid for weeks because every test entered the rhythm scene
seconds after boot while every real player arrives minutes in. Automated green is necessary and has
never been sufficient here.

---

## Freeze

In effect from `197ce8d`. Allowed before public: fixes to the new backdrops or songs, and blockers
from gates 15–16. Not allowed: new content, new systems, themed transitions.

---

## Honest deferred list

Written down rather than quietly dropped. Each with why.

| Deferred | Why |
|---|---|
| Relationship arcs are one gate, not three stages | The mechanism ships and works (later beats unlock at standing 32). Three-stage arcs per bandmate are a writing task, not an engineering one. |
| New minigame types are in 3 cities, not 4 | Deliberate — Mexico City keeps the original three so each city retains an identity. |
| Part 3 reality layer (Wellbeing / Vices / Body-wear) | Designed and explicitly deferred in `CLAUDE.md`. It changes the game's tone from cozy to attritional; that is a direction decision, not a gap. |
| A fifth city | The most expensive way to add length. Second visits already extend a run using existing art. |
| Themed transitions | Reverted after being the origin or neighbour of every regression for weeks. They return only as an isolated feature with their own real-input tests, if ever. |
| Only Tokyo's regenerated backdrop eyeballed at full size | The other three were measured for seams (3.4–9.5) and load correctly, but not visually inspected one by one. |
| Whether "Rough night" means missed notes or imprecise ones | **Open.** Autoplay proves the pipeline works, so the sub-0.30 result reported live is either genuine misses or a device-latency problem. The new judgement breakdown answers it on the next real run rather than by guessing. |
| Portrait mood inference is a heuristic, not comprehension | Accepted. It replaces a fixed smile, which is a lower bar than being right every time. Authoring moods on the remaining 395 nodes is the better long-term fix. |
| Per-push CI matrix reduction | Written, unpushed — the token lacks `workflow` scope. Low priority now that public repos have free minutes. |

---

## Verdict

**READY TO SHARE: not yet** — https://tour-life-v3.vercel.app

Twenty-seven of thirty gates are green with evidence. The three open ones are gates 15–17: the
real-device pass and the fresh-eyes playtest, plus fixing whatever they surface. Those are yours to
run, and they are the two checks this project's history says matter most.

Flip this line to **READY TO SHARE: yes** once 15–17 are green. Nothing else is blocking.
