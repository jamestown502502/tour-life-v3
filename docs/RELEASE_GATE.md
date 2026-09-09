# Release Gate — Tour Life: International Dates

Every line must be green before the URL is shared publicly. Items marked **owner** cannot be
automated and are the two genuine gaps in this project's verification.

**Live:** https://tour-life-v3.vercel.app
**Release candidate:** Part A `e2cd345` · Part B `197ce8d`

---

## Automated — evidence, not opinion

| # | Gate | Status | Evidence |
|---|---|---|---|
| 1 | Unit tests green | ✅ | **174/174** (was 128 at the start of this pass) |
| 2 | Full e2e suite green, all 4 device profiles | ⏳ | CI runs `34356147306` (Part A), `34358244717` (Part B) |
| 3 | A1 background audit complete | ✅ | Table in `BAIS_TourLife_CloseOutPlan_2026-09-09.md`; corrected the brief twice |
| 4 | No barren screens | ✅ | All 10 full-screen scenes render their painted texture — `e2e/no-barren-screens.spec.ts` |
| 5 | Overlays dim rather than hide | ✅ | Settings 0.82, HowToPlay 0.78 (were 0.98 / 0.85) |
| 6 | Backdrops seam-free — **measured** | ✅ | New scenes 4.2–10.2; rhythm 3.4–9.5; broken original was **53.2** |
| 7 | Rhythm backdrops eyeballed (close-out C2) | ✅ | All four measured; Tokyo also inspected at full size |
| 8 | Two songs per city | ✅ | 8 songs, 4 cities × 2 — `songVariety.test.ts` |
| 9 | Return leg never replays the first night | ✅ | Live: Hallenbad 71 notes → Kreuzberg Static 84 notes |
| 10 | Backing tracks with procedural fallback | ✅ | 4 tracks cached; `Item 4c` cold-boot audio guard still passes |
| 11 | Themed transitions fully reverted | ✅ | grep for `transition:'card'/'lights'/'drive'`, `buildThemedOverlay`, `TransitionType` → **0 hits**; `transition.ts` is 50 lines |
| 12 | No-fail intact after RhythmScene changes | ✅ | All-miss run still reaches Results — `verification.spec.ts` 12/12 |
| 13 | Launch link | ✅ | root **200**, og-image **200**, manifest **200**, `sw.js` serving `tourlife-v3` |
| 14 | Clock fix not regressed | ✅ | `startTime = this.game.loop.time + 1200` verified present; audio scheduled on the AudioContext clock, never a scene timer |

## Owner — the two gaps no test can close

| # | Gate | Status | Document |
|---|---|---|---|
| 15 | Real-device pass, iPhone + Android | ⬜ **owner** | `docs/REAL_DEVICE_TESTING.md` |
| 16 | Fresh-eyes playtest, 3–5 blind testers | ⬜ **owner** | `docs/FRESH_EYES_PLAYTEST.md` |
| 17 | Blockers from 15–16 fixed | ⬜ | `PLAYTEST_TRIAGE.md` (create when 16 returns) |

**Why these matter more than the fourteen above.** This project has now produced four separate
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

---

## Verdict

**READY TO SHARE: not yet** — https://tour-life-v3.vercel.app

Fourteen of seventeen gates are green with evidence. The three open ones are gates 15–17: the
real-device pass and the fresh-eyes playtest, plus fixing whatever they surface. Those are yours to
run, and they are the two checks this project's history says matter most.

Flip this line to **READY TO SHARE: yes** once 15–17 are green. Nothing else is blocking.
