# Tour Life: International Dates — Refined Build Blueprint (v3)

**Date:** 2026-09-01
**Owner:** BAIS (Jameson Bennett)
**Status:** Ready for Claude Code rebuild — fresh repo, fresh code
**Read this first:** This is the refinement of the v2 concept into a buildable blueprint. It keeps the cozy rhythm-adventure vision, hardens the "3-hour unique run" promise with content math, adds research-backed polish (80 Days text pacing, Melatonin accessibility), and maps every decision to the verified toolchain in `gamedevelopmentcapabilities.md`.

---

## 1. Why we're starting over — what the old build tells us

The previous attempt (in `OneDrive\Desktop\Tour Life\tour-life.zip`) was **syntax-clean and deploy-ready** — `node --check` passed on every file, no circular deps, working rhythm engine (4-lane `D F J K`, 50/100/160ms windows), hub, save system, audio. **The code was never the problem.**

| | Old build | v3 target |
|---|---|---|
| Cities | 1 (Tokyo) | 12–16 pool, 6–8 per run |
| Endings | 2 | 6+ generated ending labels |
| Route choice | none — fixed linear | seeded, player-picked |
| Run time | ~20 min | 3–4 hours |
| Replay | none | seed + scene pool + relationship arcs |

**Lesson:** the failure mode of this project is *content depth*, not engineering. So v3's #1 architectural priority is a **content pipeline that lets Claude Code author city chapters fast** — everything else serves that.

---

## 2. Research-backed design pillars

Six pillars, each grounded in what the research turned up. These are *refinements* of the v2 concept, not changes to its soul.

### Pillar 1 — 80 Days text pacing (the biggest single upgrade)

80 Days (inkle) is the genre's gold standard for "every run unique" — 500K words, 150 cities, "thousands of routes," each journey different. Its lead designer credits the win to **text pacing**, not scope:

> "Rather than throwing walls of text… the pattern is much more conversational: you say something, the game says something back, then you say something." — Jon Ingold

**Apply this directly:** every dialogue exchange is 1–3 short lines (≤ ~40 words), player taps to advance, choices come in small escalating sequences ("Approach the guy → Go closer → Talk to him") instead of big menu dumps. This makes the game feel light on mobile and increases perceived agency — both core cozy pillars.

**Second 80 Days insight — "chunks of story you might only catch because you went a certain way."** Favor *scarcity* over *volume*: write scene variants that only trigger under specific route + band-state conditions. Players replay because they know they missed something, not because content is endless.

### Pillar 2 — Melatonin-style accessibility (cozy = inclusive, and it's cheap)

Melatonin's accessibility menu turned a critic's "frustrating" into "genuinely enjoyed." Four settings, all trivial to implement, all mandatory for v3:

| Setting | What it does |
|---|---|
| **Visual assist** | Persistent timing ring/note-track (like practice mode, always on) |
| **Audio assist** | Metronome during gameplay |
| **Wiggle room** | Widens the perfect-hit timing window |
| **Easy scoring** | Penalizes early/late hits less (doesn't change perfect window) |

Plus: separate music/SFX/metronome volume sliders, disable camera shake, disable screen flash, photosensitivity warning. And per the v2 concept: **relaxed/standard/expert modes, autoplay, and no fail-state in cozy mode — rhythm score never gates story progress.**

### Pillar 3 — Cozy visual & audio grammar (from Kitfox/Epic/Wholesome research)

Cozy = **safety, abundance, softness** (Rachel Kowert). Concrete rules for Tour Life:
- **Warm, low-contrast palette**; cohesive color harmony per city (per Outbound dev: "visual harmony contributes a lot to the cozy feeling")
- **Soft shapes, no harsh detail**; illustrated location cards instead of explorable 3D
- **Audio is diegetic** — ambient sounds tied to visible sources (city ambience, bus radio, venue crowd), reinforcing "you're there"
- **No extrinsic-reward traps** — decoration/souvenirs are for *expression*, never a compulsory min/max loop

### Pillar 4 — Expressive rhythm, not a Rock Band clone

The genre's narrative-adjacent hits (Sayonara Wild Hearts, Hi-Fi Rush, Everhood) prove rhythm + story sells — but reviewers dinged Sayonara for unreadable note cues. So: **crisp, readable notes + choice-cues (pull back / build / invite crowd / improvise)**, 3 input types (tap, hold/swipe, choice-cue). Story choices literally alter the chart (recorded street percussion → new drum layer; acoustic venue → fewer, slower notes).

### Pillar 5 — Trade-offs, not failures

Every imperfect choice produces a different *story*, never a worse score. A wrong turn = a memorable side quest. A missed rehearsal = a looser, beloved show. This is the v2 concept's core — keep it verbatim.

### Pillar 6 — The Tour Scrapbook as the replay hook

Shareable ending artifact: route map, souvenirs, setlists, relationship montage, ending label + tags (*Tender, Restless, Electric, Community-Minded, Ambitious*). The hook is "what would this band become if I toured differently?" — not "higher money."

---

## 3. The 3-hour run: content math (verified against VN word-count data)

Visual-novel density data: readers absorb roughly **7,500 words/hour at ~125 WPM** with text + art + choices; typical VN budgeting is ~10K words per 1–3 hours.

**Target: ~3.5 hours per run.** Budget:

| Segment | Time | Content |
|---|---:|---|
| Opening / band setup | 15 min | ~1,800 words, band creator, why-this-tour beat |
| Per city stop (×6–8) | 20–25 min each | ~3,200 words + 1 rhythm performance (~3 min) |
| Mid-tour turning point | 25 min | Conflict/opportunity beat, routes from story flags |
| Final city + show | 35 min | Payoff, climactic performance |
| Epilogue / scrapbook | 12 min | Ending generator + shareable album |

**Per-run text ≈ 24–28K words read.** To make every run unique you author **~3× that** in the content pool (scene variants, alternate routes, bandmate arcs) — roughly **70–90K authored words** across 12–16 cities. That is an order of magnitude smaller than 80 Days (500K) and *is* achievable with a templated city JSON structure + Claude Code authoring (see §7 pipeline).

**Per-city chapter structure (the reusable template):** arrival scene → free-time choice (pick 2 of 3–4 locations) → relationship scene (1 of a 2–3 scene pool) → pre-show decision → rhythm performance → after-show reflection → journal/scrapbook beat. Same skeleton everywhere; content varies by seed + flags.

---

## 4. Replayability systems (controlled randomness, not noise)

From the research: *pure procedural generation does NOT increase replayability* (r/gamedesign consensus) — authored variety does. Tour Life uses:

1. **Seeded RNG** — one seed per run drives: route availability, weather/mood modifiers, promoter requests, scene-pool draws, merch trends, recurring fan, mid-tour complication. Deterministic per seed → shareable runs.
2. **Route choice** — 12–16 city pool, player picks 6–8; each city has an emotional tone, local collaborator NPC, unique musical motif, and a story gate based on band state.
3. **Scene pools** — each city has 2 "always" scenes (arrival, pre-show) + 2–3 relationship/free-time scenes of which 1–2 appear, gated on flags.
4. **Bandmate arcs** — 4 members, each with multiple resolutions that aren't just "max affection" (per v2 matrix: Mira, Theo, Jun, Rowan).
5. **Song arrangement mutations** — story flags swap chart layers, tempo, note density.
6. **Ending generator** — 6+ outcomes from tracked variables (harmony, funds, local love, creative risk, rest vs burnout, route, key choices, performance style).
7. **Meta-progression** — completed tours unlock new band histories, genres, décor, memory cards, personal goals. No player is ever weakened on a fresh run.

---

## 5. Tech stack (decided — with the reasoning you asked for)

**Chosen: Vite + TypeScript + Phaser 3, static build on Vercel. No Next.js, no React.**

| Decision | Choice | Why |
|---|---|---|
| Framework | **Vite + TS (vanilla/Phaser)** | It's a canvas game with DOM dialogue overlay — React adds a runtime for zero benefit; Vite gives instant HMR for fast Claude Code iteration |
| Engine | **Phaser 3** (canvas) | Proven in this portfolio (old Tour Life rhythm engine, rhythm.js is directly reusable); capabilities doc's default web pipeline |
| State | **Zustand-style singleton** (persistent state manager pattern from capabilities §3) | Reuse the proven localStorage-persisted state shape |
| Save | **IndexedDB via a small wrapper** (localStorage fallback) | Android WebView + Capacitor persistence; localStorage is more likely to be cleared; schema-versioned + validated |
| Dialogue | **JSON node-graph engine** (from capabilities §3 — ~70 lines, proven) | Data-driven, Claude Code authors city JSON fast |
| Deployment | **Vercel static** (`vercel deploy --prod`) | Static output, no serverless needed; see §8 for the SSO/framework gotchas |
| Android later | **Capacitor** (freelancer step, out of scope here) | Design touch-first from day 1 so the wrap is trivial (see §6) |

*Why not Next.js:* it's the "Vercel default," but this game needs zero SSR/SEO/serverless — Next adds build complexity and a larger attack surface for a fully client-side game. If you ever want SEO landing pages, add a separate Next site later. **Start simple (Vite); convert to Next only if a concrete need appears** — which is also the r/reactjs consensus.

**Note on porting:** keep everything client-side, no auth, no server calls, assets bundled — then Capacitor wrap is copy-paste (see §6). The freelancer does the APK; we hand them a clean static build + the Phaser-to-Capacitor checklist.

---

## 6. Android-port readiness (design in now, build later)

From the official Phaser Capacitor tutorial + known WebView pitfalls:

- **Scale.FIT + devicePixelRatio** sizing from day 1 (hardcoded desktop pixels = broken mobile)
- **Touch-first input everywhere** — `pointerup`/`pointerdown`, drag support; keyboard is a bonus, never required (the old build's D/F/J/K was desktop-only)
- **Safe areas** — `viewport-fit=cover` + `env(safe-area-inset-*)` padding (notch/Dynamic Island)
- **Capacitor.isNativePlatform()** branch for platform-specific instructions/haptics
- **Known WebView traps to test for when the freelancer wraps it:** white screens / texture-render failures, orientation locks, asset-path resolution (use relative paths), audio unlock behind a user gesture
- **LocalStorage → IndexedDB wrapper** (see §5) so saves survive WebView

---

## 7. Claude Code build plan (vertical slice first — never "international open world")

Follow the v2 concept's own advice: **one polished 30–45 min city proves the loop; cities come only after the content pipeline is fast.** Build order for Claude Code, one task per session:

1. **Scaffold** — Vite + TS + Phaser; `core/ game/ entities/ systems/ assets/ ui/ tests/` structure (per bais-game-pipeline skill)
2. **State model** — seeded RNG, stats (Energy/Harmony/Inspiration/Funds/LocalLove), relationship map, story flags, completed-events log; schema-versioned IndexedDB save
3. **Dialogue engine** — JSON node-graph reader (speaker, portrait, text, choices, conditions, triggerEvent) + unit tests for choice effects & conditional visibility
4. **One-city vertical slice** — Lisbon (per v2 example): 3 locations, 1 relationship conflict, 2 pre-show choices, 1 song with 2–3 arrangements, rhythm performance, 3 after-show outcomes, 1 scrapbook page
5. **Travel hub + scrapbook** — bus/hotel hub, décor, journal, scrapbook with shareable end card
6. **Rhythm engine port** — reuse the proven 4-lane timing engine, add touch + the 3 input types + choice-cues + Melatonin-style accessibility settings
7. **Connect** — pre-show choices mutate the chart; performance results write flags back
8. **Content pipeline** — a `content/schema.ts` JSON schema + a Claude-authored city authoring template; validate all JSON before it touches state
9. **Seed + replay systems** — route generation, scene pools, ending generator
10. **Meta-progression** — unlocks across runs

**Per-step done-when:** typecheck clean → bot playtest (no softlocks) → alpha-verify any sprite → JSON-schema validated → mobile-checked (touch + safe area).

**Give Claude small tasks exactly like the v2 doc's example prompt** ("Build one feature only…", with requirements, constraints, tests, and a "explain what changed" close).

---

## 8. Deployment & release checklist (Vercel gotchas — verified in this portfolio)

1. **New Vercel project defaults to SSO-protected** — a "successful" deploy that 302s to a login page for anyone but you has bitten this portfolio before. Flip protection off / verify with an incognito curl.
2. **Framework preset** — if Vercel guesses a framework, force `vercel.json`: `{"framework": null, "buildCommand": "npm run build", "outputDirectory": "dist"}`.
3. **Static output** — confirm `dist/` artifacts exist on disk + exit code 0 *before* claiming success; then curl the live URL (a green build ≠ working page; asset-path/encoding/gzip mismatches have silently failed deploys here).
4. **Re-check `vercel whoami`** fresh at deploy time.
5. Git push triggers auto-deploy if wired; otherwise `vercel deploy --prod --yes --name tour-life`.

---

## 9. Asset pipeline (mapped to verified tools — nothing new to install)

Per `gamedevelopmentcapabilities.md` §2, all credentials verified live (Gemini/Tripo/ElevenLabs SET):

| Asset | Tool | Notes |
|---|---|---|
| City backgrounds, title art | Gemini `generate_image.py` (2K) | one warm-palette image per city + hub |
| Character portraits (transparent) | `generate_sprite.mjs` + **verify** step | one portrait per character per major mood; alpha-verify every sprite (a prior game shipped a failed chroma-key) |
| Music | Lyria `generate_music.mjs` — `clip` for ambient city/hub loops, `pro` for gig tracks | 1 track per song arrangement; city motif = unique sound palette |
| SFX | ElevenLabs `threejs_audio_asset.py sfx` | tap/perfect/good/miss hits, UI blips, crowd ambience |
| Voice (optional) | Gemini TTS (multi-speaker in one call) | behind a user-gesture gate; never ship the key client-side — Vercel serverless proxy if needed |

**DoD gates (from bais-game-pipeline skill, non-negotiable):** every voice line in manifest & playback-verified · music present OR SFX gap stated out loud · gesture gate wired · JSON-schema on all generated data · save schema versioned+validated · no "cosmetic" claim without a measurement.

---

## 10. Marketing angle (social = where this genre lives)

Research: cozy games are on an "unstoppable rise" (Guardian, 2025); TikTok cozy-gaming creators and Wholesome Games (1.5M+ copies, and they explicitly partner with small teams) are the natural audience. **Songs of Glimmerwick** (music-themed cozy) and *vinyl-collecting / instrument* trends on IG/TikTok show the clip-able beats:

- **Performance hit-feedback clips** — the "perfect hit" moment is inherently short-form viral (per capabilities §4 trend note)
- **Scrapbook reveal content** — "your tour was defined by: Electric" ending cards are shareable
- **Cozy "slow TV" ambience** — bus hub with city rain + radio = TikTok ambient clips
- **Bandmate relationship moments** — emotional dialogue clips
- **The honesty angle (core differentiator)** — "the truth behind the romance": clips contrasting stage euphoria with the 3 AM void; the Return Home epilogue lands as shareable emotional content. This separates the game from every other cozy title and is prime TikTok/IG material.
- Target: TikTok + IG Reels + YouTube Shorts (matches BAIS channels); Pinterest for the scrapbook/aesthetic angle; X for dev-log threads. Wholesome Games showcase submission once playable.

---

## 11. What stays from v2 (don't rebuild these decisions)

- Mobile-first cozy backstage life-sim fantasy ("a playable tour diary")
- Dual loop: narrative visual-novel + expressive rhythm performance
- 5 soft resources (Energy/Harmony/Inspiration/Funds/Local Love)
- Band relationship matrix with multi-resolution arcs (Mira/Theo/Jun/Rowan)
- 12–16 city pool (Tokyo/Lisbon/Mexico City/Berlin/Reykjavík/São Paulo/Melbourne + more), each with tone, collaborator NPC, musical motif, story gate
- No harsh fail states; accessibility from first build
- Single-player, saveable, content-driven; no multiplayer/licensed music in v1

---

## 12. Immediate next steps

1. **Create fresh GitHub repo** (`tour-life-v3`), clone, commit this blueprint as `DESIGN.md` + the v2 concept doc as `CONCEPT.md`
2. **Hand Claude Code task #1** — scaffold Vite+TS+Phaser with the state model + seeded RNG (small, testable, per §7)
3. **Build the one-city Lisbon slice**, playtest the 30–45 min emotional loop *before* authoring more cities
4. Deploy the slice to Vercel (static), verify the live URL with the §8 checklist
5. Then scale content through the pipeline city-by-city
6. When content hits ~3.5h: hand the static build + Capacitor checklist to the freelancer for Android

**Success criteria for v3:** a complete 3–4 hour run with a unique route, unique scrapbook, and an emotionally distinct ending — verified by actually playing it through, twice, with different seeds.

---

# Part 2 — One-Shot Build Package

This part turns the blueprint into a handoff Jameson can drop on Claude Code: a Product Hunt listing (marketing copy), a paste-ready build prompt, and a full PRD the prompt points at. The PRD is the executable spec — build in its order, self-verify against its checklist.

---

## 13. Product Hunt listing (marketing copy)

**Name:** Tour Life: International Dates
**Tagline:** A cozy rhythm-adventure where an indie band's world tour becomes your playable diary — every run a different tour, a different band, a different scrapbook.
**Category:** Games › Indie / Narrative
**Platforms:** Web (browser), Android coming soon
**Pricing:** Free on web

### Short description
Guide an indie band through an international tour in a cozy rhythm-adventure that plays like a tour diary. No harsh fail states: every imperfect choice produces a different story, not a worse score. Choose your route, shape the setlist, live the bus, and end the season with a shareable scrapbook of the tour you actually made.

### Long description
You are the newly appointed creative director of an indie band on its first international circuit. Each run is one complete tour season — 6–8 dates chosen from a pool of cities, each with its own emotional tone, local collaborator, and musical identity. Between cities you live in the tour bus: brew tea for a bandmate, hang souvenirs, curate playlists, write in your journal. On stage, performances are shaped by everything you did before — explore a night market and street percussion appears in the chorus; support the drummer through a hard night and their solo opens up.

**How it works**
- **Choose your route** — a fresh, seed-driven set of available dates every run; no two tours visit the same cities the same way.
- **Live the backstage life** — soft resources (Energy, Harmony, Inspiration, Funds, Local Love) trade off against each other; nothing is ever a game-over.
- **Shape the show** — story choices mutate the rhythm chart: arrangement, tempo, note density, even the encore.
- **Read the band** — four bandmates with arcs that resolve several different ways, none of which is "max affection."
- **Collect the tour** — every run ends in a shareable Tour Scrapbook: route map, souvenirs, setlists, relationship montage, and an ending label (*Tender, Restless, Electric, Community-Minded, Ambitious*).

**Why it's different**
Cozy games and rhythm games rarely meet. Tour Life makes the rhythm *expressive* rather than reflex-based: how you play reflects how you toured, and accessibility options (visual assist, metronome, wiggle room, easy scoring, autoplay, no-fail mode) mean the story is never locked behind timing skill.

It is also honest. Beneath the cozy surface, the road's real cost — burnout, the uppers-and-downers cycle, the post-tour crash — is carried into the story and the ending, gently, never as punishment. The industry romanticizes the grind; Tour Life lovingly refuses to.

**Made for** players who loved *80 Days*, *Melatonin*, *Coffee Talk*, and any night they spent curled up with *Stardew Valley* — on a phone, a tablet, or a laptop.

---

## 14. One-Shot Build Prompt (paste this to Claude Code)

```text
You are building "Tour Life: International Dates" — a cozy rhythm-adventure web game
where an indie band tours the world and every run is a different tour.

The attached markdown file (this one) is the full PRD. Follow it section by section.
Build the ENTIRE game in one continuous effort, in the numbered implementation order
of PRD §"Implementation order". Do not ask questions — make reasonable design decisions
consistent with the PRD and note them in your final report.

HARD RULES:
- Stack: Vite + TypeScript + Phaser 3. No React, no Next.js. Strict TS ("strict": true).
- All visuals are CODE-DRAWN: Phaser Graphics + generateTexture(). No external image
  or sprite files. Exact palettes in PRD §"Art specs".
- All audio is Web Audio API synthesis. No audio files. Recipes in PRD §"Audio specs".
- All game content (cities, dialogue, songs, bandmates) lives in /content as JSON,
  validated against content/schema.ts at load (dev assert + runtime console warning).
- Save to IndexedDB with localStorage fallback, schemaVersion v1, validated on load.
- Seeded RNG (mulberry32). Every run must be reproducible from a seed string shown
  on the title screen.
- Touch-first: pointer/tap works for every interaction; keyboard is an optional bonus.
  Phaser Scale.FIT + devicePixelRatio sizing; safe-area insets respected.
- Ship the accessibility settings from PRD §"Accessibility": visual assist, audio
  assist (metronome), wiggle room, easy scoring, autoplay, no-fail cozy mode, separate
  music/SFX/metronome volumes, reduced motion, no-flash.
- Write unit tests (vitest) for: dialogue choice effects, conditional node visibility,
  seeded RNG determinism, route generation validity.
- Write a headless bot playtest that walks the golden path
  (Title -> Band Creator -> Route -> Hub -> Lisbon city -> Rhythm -> Results -> Scrapbook)
  and reports no softlocks.
- Write CLAUDE.md at repo root with the project conventions from PRD §"CLAUDE.md".
- Run the ENTIRE validation checklist (PRD §"Validation checklist") before finishing
  and report pass/fail per item. Do not claim done on "it compiles" — exercise the loop.

Author TWO fully-authored cities (Lisbon, Tokyo) per the PRD's representative content —
enough scenes, choices and arrangements to make the slice a complete ~45-60 minute tour.
Wire the full architecture so adding more cities is a content-only task.

Finish by listing: changed files, how to run (dev/build/test), deploy steps, and what
remains on the post-build roadmap (PRD §"Post-build roadmap").
```

---

## 15. Full Product Requirements Document (PRD)

### 15.1 Deliverable scope — what this build produces

**One-shot target:** a complete, playable, deployable web game with the full architecture and every system wired, containing **two fully-authored cities (Lisbon, Tokyo)** as a vertical slice, plus the content pipeline, seeding, meta-progression, and ending systems that make it scale to the 12–16 city / 6–8 city-per-run / ~3-hour design.

**What you actually get at the end of this build:** a ~45–60 minute complete emotional loop (tour of 1–2 seeded dates), fully functional systems, Vercel-deployable, Android-ready. **Content depth (the 3-hour promise) grows by authoring city JSON through the pipeline (§15.11)** — the engine is finished here; the content is additive.

**Non-goals for this build:** multiplayer/social, licensed music, explorable 3D, native Android wrap (Capacitor — later freelancer step; code is touch-first so the wrap is mechanical), accounts/serverless, procedural dialogue (no unedited AI-generated lines).

### 15.2 Concept

**Elevator pitch:** A cozy, replayable backstage-and-onstage life sim. Players guide an indie band through an international tour circuit — forming memories, maintaining band harmony, and shaping performances through narrative choices rather than reflex mastery. Each complete run is one tour season; every run produces a different route, a different band story, and a different scrapbook.

**Design DNA (borrowed mechanics):**
| Reference | What we borrow |
|---|---|
| 80 Days (inkle) | Replayable branching travel narrative; short conversational text pacing; scarce "only-if-you-went-this-way" story chunks |
| Melatonin | Rhythm accessibility menu (visual assist, metronome, wiggle room, easy scoring) |
| Sayonara Wild Hearts / Hi-Fi Rush | Expressive rhythm — the performance IS the story moment, not a score gate |
| Coffee Talk | Soft, low-stakes conversations that drive character beats |
| Animal Crossing / Stardew | No-fail cozy hub (the bus), decoration for expression not numbers |

**Fantasy statement:** *"Can you create a meaningful touring life, make music with people you love, and leave a small piece of your heart in every city?"* — a playable tour diary, not a management spreadsheet.

**Design pillar (all decisions trace here):** *Every imperfect choice should produce a different story, not merely a worse score.*

### 15.3 Run structure & content budget

A "playthrough" = one complete tour season. Target 3–4 hours; this build delivers the loop with 2 cities (~45–60 min).

| Segment | Time | Content this build |
|---|---:|---|
| Opening / band setup | 15 min | Band creator (name, genre, why-this-tour beat) |
| Each tour stop | 20–25 min | Arrival → explore → relationship → pre-show → rhythm → after-show → journal (per-city template §15.11) |
| Mid-tour turning point | 20 min | Conflict/opportunity beat, forks on story flags |
| Final city + show | 35 min | Payoff + climactic performance |
| Epilogue / scrapbook | 12 min | Ending generator + shareable tour album |

**Text budget:** ~3,200 words read per city stop; ~24–28K words per full run; author ~3× that across the pool so runs differ (~70–90K total at full content — an order of magnitude under 80 Days' 500K, achievable via the template pipeline).

### 15.4 Systems

**15.4.1 Persistent state (source of truth)**
```ts
type RunState = {
  seed: string;
  band: { name: string; genre: string; members: BandmateId[] };
  stats: { energy: number; harmony: number; inspiration: number; funds: number }; // 0..100, funds int
  localLove: Record<string, number>;            // per cityId 0..100
  relationships: Record<BandmateId, number>;    // -50..100
  flags: string[];                              // story flags
  inventory: Item[];                            // souvenirs, gifts, keepsakes
  route: CityStop[];                            // generated tour
  log: string[];                                // completed event/scene ids
  currentCityIndex: number;
  meta: MetaProgress;                           // cross-run unlocks
  schemaVersion: 1;
};
```
- **RNG:** mulberry32 seeded from a run seed string (title screen generates + displays it; player can enter a seed to replay a run).
- **Save:** IndexedDB (key `tourlife.run`), localStorage fallback; autosave after every scene + every rhythm result; validated against schema on load with a migration hook for `schemaVersion`.

**15.4.2 Resources (soft, never fail)**
| Resource | Raised by | Low = different story, not failure |
|---|---|---|
| Energy | Rest, good food, short travel | Rhythm note windows tighten, fewer exploration options |
| Harmony | Honest talks, shared activities, fair choices | Tense dialogue, less coordinated charts |
| Inspiration | Explore, collect sounds, meet locals | Fewer arrangement options at pre-show |
| Funds | Tickets, merch, sponsors | Limits travel/gear choices |
| Local Love (per city) | Respectful cultural choices, side quests, collabs | Smaller crowds, never a hard fail |
| Wellbeing (slow, background) | Real food, sleep, calls home, journaling | Weariness *flavor*, body-wear accrual (never failure) — see Part 3 §20.1 |
| Groundedness (slow, background) | Calls home, quiet rituals, healthy relationships | Vulnerability to vice scenes + epilogue detachment — see Part 3 §20.1 |

**15.4.3 Relationship matrix**
- Four bandmates: **Mira** (vocals — wants recognition, fears commercial), **Theo** (drums — burned out), **Jun** (guitar/producer — wants sonic experimentation), **Rowan** (bass — feels unseen, practical).
- Affinity −50..100; dialogue choices shift trust, who joins side quests, which song versions open, which travel-day conversations occur, and which ending montage plays.
- Each arc resolves several ways; "max affection" is explicitly not the only good result.

**15.4.4 Dialogue engine (proven pattern, ~70 lines)**
- JSON node graph: `{id, speaker, portrait, text, choices[], condition, triggerEvent}`.
- Choices apply stat deltas / set flags; nodes gate on `condition` with fallback; `triggerEvent` hands off to rhythm or scene transition.
- **Pacing rule (80 Days):** every node is 1–3 short lines (≤40 words). Prefer small escalating choice sequences ("Approach him → Go closer → Talk") over big menu dumps.
- Typewriter (~45 chars/s), tap-to-advance, **click-to-skip-typewriter must be separate from choice-button clicks** (known bug class).
- Unit-tested: choice effects + conditional visibility.

**15.4.5 Route generation (seeded)**
- From city pool (v1: 2), pick 6–8 dates (v1: all in pool) with constraints (region spread, story-gate prerequisites).
- Seed also drives: weather/mood modifiers per city, promoter requests, scene-pool draws, merch trends, which recurring fan follows, and a mid-tour complication (pool of ~6).

**15.4.6 Scene pools (scarcity, not volume)**
- Per city: 2 always-scenes (arrival, pre-show) + 2–3 relationship/free-time scenes drawn from a gated pool (1–2 appear per run). Players replay to catch the ones they missed.

**15.4.7 Rhythm engine (proven lane pattern)**
- 4 lanes; notes `{time, lane, type: tap|hold|choice}`; chart JSON per song.
- Timing windows: perfect 50ms / good 100ms / ok 160ms (relaxed +50%, expert −30%).
- Scoring: perfect 100×combo, good 60, ok 30, miss 0; combo multiplier; final grade + crowd/energy delta.
- **Choice cues:** at charted moments pick one of *pull back / build / invite crowd / improvise / spotlight bandmate* — each shifts crowd mood and the post-show scene (never a fail).
- Interface: story builds `PerformanceContext` → rhythm returns `PerformanceResult` (timingScore, expressionChoices, crowdConnection, unlockedFlags) → flags feed back into scenes. **Rhythm score never gates narrative content.**

**15.4.8 Ending generator**
Tracked inputs: harmony, funds, localLove avg, creative risk, rest vs burnout, route, key choices, performance style. Outputs 6 endings (*Beloved Small Tour, Breakout Circuit, Live Album, Found Family Tour, Quiet Ending, Next Chapter*) + 4–6 tags (*Tender, Restless, Electric, Community-Minded, Ambitious, Weathered*) → scrapbook card. Each ending also feeds **The Return Home epilogue** (Part 3 §20.5): a six-months-later second act where Wellbeing, Groundedness, the vice ledger, and body wear decide how the player and each bandmate land (Thriving / Healing / Coasting / Quiet danger).

**15.4.9 Meta-progression (unlocks, never weakens a fresh run)**
New band histories, genres (dream pop, indie rock, electronic, folk, punk, jazz-pop), bus décor/instruments/outfits/song skins, travel routes, personal goals (tour sustainably, small venues only, live album, reconnect with an old bandmate), memory cards that flavor future dialogue, and a run-history gallery of prior scrapbooks.

### 15.5 Screens & flow

State machine (transitions via 250ms fade):
`Title → BandCreator → RoutePlan → Hub ⇄ CityChapter → Rhythm → Results → (next CityChapter) → TurningPoint → Finale → Epilogue/Scrapbook → ReturnHome → MetaGallery`

Travel days between cities are **Dead Time** beats (Part 3 §21) — muted, slower, where the deepest dialogue and the vice temptations live.

| Screen | Contents | Input |
|---|---|---|
| Title | logo, seed display, New Run / Continue / Settings / Gallery | tap/key |
| Band Creator | band name, genre, why-this-tour beat, member intros | text + taps |
| Route Plan | seeded map of available dates, pick route | tap |
| Hub (bus) | décor grid, journal, playlists, gifts, souvenirs, travel, phone (call home) | tap, drag |
| Dead Time (travel) | muted bus/van scenes, deep dialogue, rest/diet/vice micro-choices | tap |
| Return Home | six-months-later epilogue, per-bandmate landings, final scrapbook | tap |
| City Chapter | dialogue nodes, location cards, relationship scenes, pre-show choices | tap |
| Rhythm | lane play, choice cues, crowd meter | touch/key |
| Results | grade, crowd reaction, flag changes, after-show scene | tap |
| Settings | rhythm mode, timing, volumes, assist toggles, reduced motion | tap |
| Scrapbook | route map, souvenirs, setlists, montage, ending card, share copy | tap |

### 15.6 Representative content (build these for real)

**Lisbon city chapter (authored fully — this is your authoring example):**
```json
{
  "id": "lisbon", "name": "Lisbon", "tone": "nostalgia_and_wandering",
  "weather": ["soft_rain", "golden_hour"], "tempo": 92,
  "locations": [
    { "id": "fado_house", "name": "A small fado house", "sound": "acoustic_guitar" },
    { "id": "record_shop", "name": "A dusty record shop", "sound": "vinyl_crackle" },
    { "id": "miradouro", "name": "The rooftop miradouro", "sound": "wind_and_trams" },
    { "id": "waterfront", "name": "The night market", "sound": "crowd_and_bells" }
  ],
  "relationshipScene": "mira_low_confidence",
  "collaborator": { "npc": "Ines", "role": "fado singer", "gift": "fado_phrase" },
  "preShowChoices": ["acoustic_set", "crowd_pleaser"],
  "song": "sailor_lullaby",
  "storyGate": { "condition": "harmony >= 30", "unlock": "duet_arrangement" }
}
```

**Dialogue node (pacing example — note short lines, escalating choices):**
```json
{ "id": "lis_arrival", "speaker": "Mira", "portrait": "mira_worried",
  "text": "The train smelled like sardines and regret.",
  "choices": [
    { "label": "Lighten the mood", "next": "lis_arrive_joke", "effects": { "harmony": 2 } },
    { "label": "Ask what's wrong", "next": "lis_arrive_deep", "effects": { "harmony": 5 }, "flags": ["mira_confides"] },
    { "label": "Just unload the gear", "next": "lis_arrive_gear", "effects": { "energy": -3 } }
  ] }
```

**Rhythm chart (Lisbon, 92 BPM → beat 0.652s, 8th 0.326s):**
```json
{ "songId": "sailor_lullaby", "bpm": 92, "lanes": 4,
  "notes": [
    { "t": 0.0, "l": 0, "type": "tap" }, { "t": 0.326, "l": 2, "type": "tap" },
    { "t": 0.652, "l": 1, "type": "hold", "dur": 0.5 }, { "t": 1.63, "l": 3, "type": "tap" }
  ],
  "cues": [ { "t": 12.0, "type": "invite_crowd" } ] }
```

**Arrangement mutation examples (flags → chart changes):** explored night market → hand-drum layer on chorus; supported Theo → looser windows on his solo; acoustic venue → fewer/slower notes + call-and-response; Ines collab → distinct instrumental break + new score category; skipped rest for promo → higher note density + fatigue animation.

### 15.7 Accessibility (all four Melatonin options + cozy defaults)

Visual assist (persistent timing ring / note track) · audio assist (metronome) · wiggle room (widens perfect window) · easy scoring (less penalty for early/late; perfect window unchanged) · relaxed/standard/expert modes · autoplay/assisted mode · no-fail cozy mode (score never blocks story) · separate music/SFX/metronome volumes · disable camera shake · disable screen flash + photosensitivity warning · high-contrast note skins · reduced motion · **tone dial (Warm/Raw) + first-launch content-warning card** (substance use, exploitation, mental health — re-openable from Settings, spoiler-safe; see Part 3 §18).

### 15.8 Polish & game-feel (exact values)

- Input latency ≤100ms end-to-end.
- Note hit feedback: perfect spark = 8 particles, gold `#D9A441`, radial burst 120px/s, fade 0.35s, size 2–4px; hitstop 30ms on perfect; screen shake trauma² (4px on perfect cluster, 8px on miss streak).
- Combo pop: scale 1 → 1.15 over 80ms ease-out, gold text.
- Dialogue: 45 chars/s typewriter; 250ms fades between screens; choice highlight on hover.
- Weather: rain = 40 drops, 2px, fall 140px/s, opacity 0.3; golden hour = warm color-graded overlay.
- Ending: confetti = 60 rects, palette colors, fall 90px/s, rotation 1.5rad/s, 3s.
- Audio: master/music/SFX/metronome buses; duck music −6dB during dialogue; everything behind a first-gesture unlock.

### 15.9 Art specs (code-drawn — no files)

Canvas via Phaser `Scale.FIT` at `W×H = 720×1280` (portrait, mobile-first) × devicePixelRatio. Palette (single source in `src/art/palette.ts`):

| Name | Hex | Use |
|---|---|---|
| Cream | `#F5EBDD` | background base |
| Sand | `#E8D5B7` | panels, cards |
| Terracotta | `#C4704F` | hot accent, low-energy |
| Teal | `#3E7C7B` | calm accent, positive |
| Plum | `#4A2C40` | dark text, bus interior |
| Gold | `#D9A441` | perfect hits, highlights |
| Night | `#2B3A55` | night scenes, route map |
| Sky | `#8FB7C9` | daylight, moods |
| SoftRed | `#C94F4F` | warnings, lows |

City tint overlays: Lisbon = warm amber, Tokyo = teal/pink. Draw with `Graphics` + `generateTexture()` and reuse: title BG (layered gradient + silhouette skyline), city BG (tint variant + weather layer), bus hub (plum interior, window to weather), dialogue panel (sand card, plum text), portraits (mood → palette swap on shared feature template: one portrait per bandmate per mood — worried/happy/tense/inspired), rhythm lanes/notes (teal lanes, gold perfect, white notes, high-contrast skin variant), scrapbook card (route line, stamps). Soft rounded shapes; no harsh outlines.

### 15.10 Audio specs (Web Audio API synthesis — no files)

**Music (procedural, per city tone):**
- Lisbon: Am7→Fmaj7→Cmaj7→G6, 92 BPM, triangle lead + sine bass (flowing, "nostalgia").
- Tokyo: Am→F→C→G, 118 BPM, square lead + 16th-note hats (precision).
- Bus ambience: Cmaj9 pad + filtered rain noise, low gain.
- Gig layers: kick = sine 60Hz thump on beat; snare = bandpass noise burst; bass line + lead per arrangement; crowd swell = filtered noise 0.8s on choice cues.

**SFX (oscillator recipes):**

| Event | Recipe |
|---|---|
| tap blip | square 220→330Hz, 40ms, gain 0.15 |
| perfect | sine 880→1320Hz 80ms 0.25 + sine 1760Hz 60ms |
| good | square 660Hz 60ms 0.18 |
| ok | triangle 440Hz 50ms 0.12 |
| miss | sine 110Hz 100ms 0.12 (low thud) |
| choice confirm | triangle 440+660Hz (2 osc) 90ms 0.18 |
| menu hover | sine 520Hz 30ms 0.06 |
| pickup / journal | sine 660→990Hz 70ms 0.14 |
| metronome | square 1000Hz 20ms 0.10 (accent 1200Hz) |

Voice (optional later): Gemini TTS manifest behind the gesture gate; never ship the API key client-side. Deferred to the post-build roadmap.

### 15.11 Content pipeline (how the game grows to 12–16 cities)

- `content/schema.ts` defines TypeScript types + JSON Schema; **validate every content file at load** (dev assert + runtime console warning).
- **City authoring template** (one JSON file per city, plus optional art tint): id, name, tone, weather pool, tempo, 3–4 locations, 2–3 gated relationship scenes, 1 collaborator NPC + gift, 2–3 pre-show choices, 1 song + arrangement variants, 1 story gate, scrapbook entries, word budget ~3,200.
- **Add-a-city checklist for Claude/Jameson:** copy template → author scenes → wire arrangement mutations → run `validate` → playtest that city alone. No engine changes required.
- **Scarcity rule:** each city exposes more content than a run can show (2 of 4 locations, 1–2 of 3 scenes) so replays differ.

### 15.12 File structure & architecture

```
tour-life-v3/
├─ index.html · vite.config.ts · tsconfig.json · vercel.json · package.json · CLAUDE.md
├─ content/
│  ├─ schema.ts
│  ├─ bands.ts
│  ├─ cities/lisbon.json · cities/tokyo.json
│  └─ songs/sailor_lullaby.json · songs/neon_rain.json
└─ src/
   ├─ main.ts                 (boot + state machine)
   ├─ const.ts                (W, H, palette refs, timing constants)
   ├─ core/  rng.ts · state.ts · save.ts · audio.ts · validate.ts
   ├─ game/  route.ts · scenes.ts · dialogue.ts · rhythm.ts · endings.ts · meta.ts
   ├─ ui/    title.ts · creator.ts · hub.ts · city.ts · rhythm_scene.ts
   │         results.ts · scrapbook.ts · settings.ts · transition.ts
   ├─ art/   palette.ts · sprites.ts · effects.ts
   └─ tests/ dialogue.test.ts · rng.test.ts · route.test.ts · headless_playtest.ts
```

**Data flow:** `scenes` build `PerformanceContext {cityId, venueType, songId, arrangement, bandHarmony, energy, audienceMood, storyFlags}` → `rhythm.play(ctx)` → `PerformanceResult {timingScore, expressionChoices, crowdConnection, unlockedFlags}` → flags/effects back into scenes + scrapbook. Modules never import across layers sideways (the old circular-import bug class: geometry/constants come from `const.ts`, never from `main.ts`).

### 15.13 Implementation order (build in this exact sequence)

1. Scaffold Vite + strict TS + Phaser; `const.ts` (W/H/palette/timing) — prevents circular deps. *Done when:* dev server runs, blank canvas.
2. Core foundations: seeded RNG, state manager, IndexedDB save, Web Audio system with gesture gate. *Done when:* rng/state/save/audio tests pass.
3. `content/schema.ts` + validate; author `bands.ts`. *Done when:* content validates.
4. Dialogue engine + unit tests. *Done when:* dialogue tests pass.
5. Author Lisbon + Tokyo city JSON (full scenes per §15.6) + songs/charts. *Done when:* JSON validates, charts parse.
6. Screens in dependency order: Title → BandCreator → RoutePlan → Hub → CityChapter → Rhythm → Results → Scrapbook → Settings. *Done when:* golden path navigates end-to-end.
7. Rhythm scene: lanes, timing, scoring, choice cues, accessibility toggles, autoplay/no-fail. *Done when:* bot playtest passes a full song.
8. Wire story↔rhythm (PerformanceContext/Result), arrangement mutations, after-show scenes. *Done when:* a story flag provably changes a chart.
8b. **The reality layer (Part 3):** Wellbeing + Groundedness tracks, the Vices ledger, body-wear flags, The Rush/dip, the road-between-the-shows scenes (§21), and The Return Home epilogue (§20.5); tone dial + content-warning card. *Done when:* a vice choice provably raises Energy and accrues debt; a heavy run provably yields a different Return Home than a bright run.
9. Route generation + scene pools + mid-tour complication + endings + meta-progression. *Done when:* two different seeds produce different routes/scenes/endings.
10. Full validation checklist (§15.15) + Vercel deploy + live-URL verify.

### 15.14 CLAUDE.md (include verbatim at repo root)

```markdown
# Tour Life — Build Rules
- Stack: Vite + TypeScript (strict) + Phaser 3. No React/Next.
- ALL art code-drawn via Graphics + generateTexture (src/art). No image files.
- ALL audio via Web Audio API (src/core/audio.ts). No audio files.
- Content = JSON in /content, validated against schema.ts at load.
- Constants (W/H/palette/timing) ONLY in src/const.ts. Never import from main.ts (circular deps).
- Save: IndexedDB + localStorage fallback, schemaVersion v1, validated on load.
- Seeded RNG (mulberry32) — runs reproducible from seed string.
- Touch-first: every interaction works by pointer/tap; keyboard optional.
- Rhythm score NEVER gates story. No-fail cozy mode is a shipped feature.
- Accessibility: visual assist, metronome, wiggle room, easy scoring, autoplay, no-fail,
  volume splits, reduced motion, no-flash. Non-negotiable.
- Changes: one system at a time; run tests + bot playtest; keep schemaVersion migration path.
- DoD: typecheck clean · tests green · bot playtest no softlocks · content validates ·
  save schema validated · golden path exercised · live deploy verified.
```

### 15.15 Validation checklist (self-verify ALL — report pass/fail per item)

1. `tsc --noEmit` clean (strict).
2. `vitest run` green (dialogue, rng determinism, route validity).
3. Headless bot playtest: Title → Band Creator → Route → Hub → Lisbon → Rhythm → Results → Scrapbook, no softlocks.
4. Two different seeds → different route/scene-draw/ending (observed, not assumed).
5. Same seed → identical run (reproducible).
6. Every content JSON validates against schema; no untyped fields.
7. All 4 bandmates render with ≥3 mood portraits; portraits mood-swap in dialogue.
8. All 4 accessibility toggles functional in a live rhythm scene; autoplay completes a song with a score.
9. No-fail mode: deliberately missing every note still reaches after-show scene.
10. Touch input works for: advance dialogue, choices, hub decorate, rhythm taps/holds, settings.
11. Safe-area + Scale.FIT: renders correctly at phone portrait, tablet, desktop; no cutoff.
12. Save: autosave after scene + rhythm; reload resumes at correct state; schema validated.
13. Music present (procedural) + SFX on every interaction; gesture gate wired (audio starts after first tap).
14. Arrangement mutation proven: a story flag changes a chart (test asserts chart differs).
15. Ending generator produces ≥4 distinct labeled endings across test seeds; tags set.
16. Scrapbook shows route, ≥1 souvenir, setlist, ending label + tags.
17. Meta: completing a run records a run-summary; ≥1 unlock available on next New Run.
18. Reduced motion + no-flash toggles disable shake/particles/flash.
19. Title screen shows the run seed; seed entry reproduces a prior run.
20. Vercel deploy green AND live URL curl returns 200 with the game HTML (not a login redirect).
21. Wellbeing + Groundedness tracks exist, persist, and influence scenes/endings (observed across two seeds).
22. Vices ledger: choosing a stimulant raises Energy and accrues stimulantDebt; choosing a depressant aids sleep and accrues Haze; the epilogue shows the why-it-happened context.
23. Body wear: at least one flag acquires in a vice-heavy test run and mechanically alters a chart (test asserts window/density difference).
24. Tone dial: a Warm run contains no explicit substance/exploitation wording; a Raw run does. Content-warning card shows on first launch and is re-openable.
25. The dip: a high-Rush show is followed by a temptation scene; a low-Rush run is not (spawned from contrast, never from nowhere).
26. Return Home epilogue: two runs with different ledgers produce different per-bandmate landings (Thriving/Healing/Coasting/Quiet danger); heavy endings render without confetti and without moralizing.

### 15.16 Deployment (Vercel)

```json
// vercel.json
{ "framework": null, "buildCommand": "npm run build", "outputDirectory": "dist" }
```
1. `npm run build` — confirm `dist/` exists and exit code 0.
2. `vercel deploy --prod --yes --name tour-life-v3` (re-run `vercel whoami` first).
3. **Flip SSO protection off** on the new project (new Vercel projects default to SSO — silent 302-login failures have hit this portfolio before).
4. Verify the live URL itself with a curl/incognito check — a green build is not a working page.

### 15.17 Post-build roadmap

1. **Asset pass** — swap code-drawn art for Gemini/Lyria/ElevenLabs generated assets (backgrounds, portraits, music tracks, SFX) via the verified commands in `gamedevelopmentcapabilities.md`; alpha-verify every sprite; keep code-drawn as fallback.
2. **Author remaining cities** through the pipeline (12–16 pool) — target ~70–90K authored words.
3. **Playtest two full seeded runs** against the §15.3 budget; tune per-city word counts to hit 3–4h.
4. **Voice pass** (optional) — Gemini TTS manifest behind gesture gate.
5. **Capacitor handoff** — hand the freelancer the static build + the Phaser-to-Capacitor checklist from Part 1 §6.
6. **Marketing** — clip hit-feedback moments, scrapbook reveals, ambience (Part 1 §10); submit to Wholesome Games once playable.

---

# Part 3 — The Marathon: the honest cost of the road

*Directive: touring is a psychological and physical marathon disguised as an endless party. The contrast between the dopamine rush of the stage and the grueling reality of travel is the engine of burnout and addiction. Add this to the gameplay with polish — keep everything, enhance.*

---

## 18. Design thesis — coziness can hold darkness

Two facts from research make this addition safe:

- **Coziness is a flavor, not a content limit** (Kitfox, "Designing for Coziness"): "coziness is an adjective… a flavor that can be applied to any type of game." Darkness *outside* the cozy space is what gives warmth its meaning (cold rain against a warm window). The best cozy games use stillness as depth.
- **The cozy audience actively wants emotional weight** — r/CozyGamers returns to one request again and again: "cozy games that made you cry." Spiritfarer — a cozy management game about dying, grief, and letting go — is the community's most-recommended emotional game, praised precisely *because* its warm mechanics hold heartbreaking themes. Night in the Woods and What Remains of Edith Finch are the same appetite in narrative form.

**The rule that keeps it cozy:** *the reality layer changes the story, never the ability to finish the tour.* No game-over, no "you let them down" verdict, no moralizing. The dark truths appear as gently-written narrative scenes, as systemic costs that *accrue* (vice debt, body wear), and as the epilogue — what the road leaves behind. Every choice stays "a different story," now with real emotional stakes: the tour finally *costs* something, and the player watches what it costs.

**The game's point of view (and its marketing hook):** *the industry romanticizes the grind; the game lovingly refuses to.* The cozy surface is the fantasy; the reality layer is the truth quietly revealed. That honesty is the differentiator — nobody else in the cozy space is doing this, and the honest band-life sims that exist are all high-pressure management games.

**Tone control — "how raw do you want the road?"** (first-launch, opt-in, spoiler-safe — per Access-Ability and the NEON content-warning research: games are uniquely able to give *informed* opt-in, warnings are an accessibility feature, and they should be delivered gently):

- **Warm (default):** the reality layer is allusive — exhaustion, whispers of vice, implied consequences, the epilogue speaking in metaphor. No substance names, no exploitation shown.
- **Raw:** explicit scenes — the green room deal, the 3 AM pill bottle, the fan power dynamic, the crash epilogue in plain terms.
- A **content-warning card** on first launch (substance use, exploitation, mental health) that can be re-opened from Settings any time, without spoiling anything.

---

## 19. Reality layer → mechanic map (the twelve points)

Each reality from the directive becomes a concrete mechanic:

| The reality | What it becomes in the game |
|---|---|
| **Dopamine peak** — stage rush like nothing else | **The Rush** — a transient post-show stat; the stage renders euphoric (saturated gold, crowd swell, heavy juice). The contrast IS the design: the higher the high, the flatter the void that follows. |
| **Trench camaraderie** — trauma-bonded loyalty | **Shared-hardship scenes** — van breakdowns, lost gear, a terrible show survived together. Bond bandmates fast and hard — including both the healthy loyalty and the unhealthy "we enable each other" version. |
| **Suspended reality** — bills vanish | The bus is the cozy home *because* the real world disappeared. The fantasy is literally "your only job is the next city." Written into the opening (why this tour matters) and the epilogue (what you return to). |
| **Crushing claustrophobia** — rolling submarine | **Bus micro-choices** — privacy, bunk order, who gets the window seat, the smell, the 2 AM snoring. Small kindnesses in tight spaces = Harmony + Groundedness. |
| **"Hurry up and wait"** — 2h of high, 22h of void | **Dead Time** — travel days are deliberately muted (desaturated, low-pass audio, slow pace) and are where the *deepest* dialogue lives (80 Days: conversations happen in the quiet). Choices: sleep / eat / rehearse / call home / wander / the temptations. |
| **Biological toll** — gas-station diet, no sleep, baby-wipe showers | **Diet & rest micro-decisions** + flavor text; skip rest too much and Energy windows tighten (existing system), plus **Body wear** flags begin accruing. |
| **The uppers/downers cycle** | **The Vices system** (core new mechanic, §20). Stimulants buy Energy for a 9 PM show and accrue Withdrawal debt; depressants buy sleep on a shaking bus and accrue Haze. Functional addiction is modeled as a slow ledger, never a cutscene moral. |
| **Tour bubble & promiscuity** — detached moral compass | **Ethics/loyalty beats** — the tour-bubble "detached moral compass." Moments where the player chooses kind / complicit / exploitative, including the taboo power dynamic with an intoxicated or vulnerable fan. No lecture — the story simply remembers, and relationships + endings respond. |
| **Parasitic enablers** — sycophants, dealers, hangers-on | **Backstage NPCs** — hangers-on, dealers, sycophants (the AI-fill NPC pattern for minor ones). A **Backstage Trust** read on every backstage: who actually looks out for the band vs. who feeds the party. |
| **Post-tour crash** — the silence after the screams | **The Return Home epilogue** (§20.5) — the ending generator's new second act: six months later, each bandmate's landing is computed from the whole run. |
| **Physical destruction** — tinnitus, cords, spine | **Body wear flags** per bandmate — acquired, shown subtly in portraits, and they *surface*: vocal strain narrows Mira's chart windows; tinnitus drifts Theo's quiet conversations. Gentle, honest, never punishing. |
| **The industry romanticizes the grind** | The game's stance — the cozy aesthetic is the romance; the reality layer is the quiet truth; the epilogue is where the two meet. |

---

## 20. System spec — the reality tracks

### 20.1 New resources (keep it human-scale — two background tracks, no new spreadsheets)

- **Wellbeing** (0–100, slow): what the tour costs emotionally and physically. Raised by real food, sleep, calls home, journaling, kind choices. Lowered by vice debt, missed rest, harsh travel. *Low is flavor, not failure:* muted palette, softer dialogue, more weariness portraits. Feeds the epilogue and Body wear.
- **Groundedness** (0–100): connection to home and self — the antidote to the bubble. Raised by calls home, journaling, quiet rituals, healthy relationships, remembering why the tour matters. *Low* = vulnerability: vice temptations appear more often, detachment in the epilogue. This is the player's real "health bar" — and it never ends the game; it shapes the story.

Total tracks: Energy, Harmony, Inspiration, Funds, Local Love, Wellbeing, Groundedness = 7. Two are slow background tracks; the active choice surface stays the original five.

### 20.2 The Vices ledger

- Per bandmate + player: `{ stimulantDebt, depressantDebt, contexts: string[] }` — every vice event is logged with its story context, so the epilogue can reference *why* it happened.
- **Choice framing is non-judgmental:** each vice is offered as a *trade* — a visible short-term benefit against a cost that surfaces later. The player is never scolded; the cost simply appears where the player can see it had consequences.
- **The cycle modeled:** exhausted before a show → stimulant choice (buy Energy now, +Withdrawal) → wired after the show → depressant choice (buy sleep now, +Haze). Stack either ledger and the epilogue shows functional addiction — or the player breaks the cycle and the game shows that instead. Both are valid, distinct stories.
- **Vice catalog (scaled, gated by tone):** coffee (small stim, tiny debt) · energy drinks (medium stim) · "something stronger" (large stim — Raw only, or flagged) · beer/wine (sleep aid, Haze) · sedatives (large depressant — Raw only). Warm tone keeps everything allusive ("something to take the edge off").

### 20.3 Body wear flags (per bandmate)

`tinnitus | vocalStrain | backNeck | exhaustion`. Sources: vice-debt thresholds, repeated missed rest, repeated harsh travel. Effects are gentle and mechanical: **vocalStrain** = −10% perfect window on that member's parts; **exhaustion** = −10% note density on their segments + weariness portraits; **tinnitus** = a faint ringing bed in their ambient-heavy scenes. Each flag also appears in the epilogue.

### 20.4 The Rush and the dip

After a performance: `Rush = f(timingScore, crowd, expressionChoices)`. High Rush → euphoric after-show scene options. Rush decays across the travel day, and the **dip** (Rush < 15 after a high show) is where temptation scenes spawn — never from nowhere, always from the contrast the player just felt. This is the "perfect storm" modeled as a system.

### 20.5 The Return Home epilogue (the ending generator's second act)

Six months after the final show. Each bandmate (and the player) gets a landing computed from the run's ledger:

- **Thriving** — high Groundedness, low vice debt, strong relationships: found their next thing.
- **Healing** — some cost, but a support network (healthy relationships) caught them; a slow, warm recovery montage.
- **Coasting** — mid debt, low connection: drifting, "fine," ambiguous.
- **Quiet danger** — high vice debt, low Groundedness, low support: the crash, rendered *gently and honestly* (Warm = metaphor; Raw = plain). Never framed as player failure — "this is where the road left them," and the player sees the exact choices that led there, without judgment.

This is what makes the reality layer *meaningful*: the tour's true ending is not the last show — it is the silence afterward, and the game finally tells the truth the industry hides.

---

## 21. New content — the road between the shows (representative)

Eight authored scenes (across both cities + bus, each with word budgets; gated on flags/stats; each writes different flags → different charts, dialogues, endings):

1. **The call home** — Groundedness beat, warm tones; unlocks the phone in the hub.
2. **3 AM bus conversation** — Theo's burnout beat; trench bond or enabling.
3. **The green room** — backstage NPC + enabler; a Backstage Trust decision (Raw: the explicit deal).
4. **The post-show dip** — Rush crash; the temptation scene spawn point.
5. **The van argument** — Harmony + trauma-bond; who says what matters.
6. **The rider negotiation** — Funds vs. vice exposure; the promoter's "generosity" has a price.
7. **The quiet morning ritual** — tea, journal, stretch; the cozy antidote (Wellbeing + Groundedness).
8. **The power dynamic** — tour-bubble ethics beat; kind / complicit / exploitative; relationship + epilogue consequences (Raw: explicit).

---

## 22. Polish — render the contrast (exact values)

- **Stage:** gold wash overlay (alpha 0.15), crowd-roar swell (bandpassed noise, 0.8s attack), vignette lift, hit juice unchanged (§15.8). Rush = brief saturation boost (+20% sat, 2s decay).
- **Travel/bus:** desaturated teal-plum grade (sat −25%, alpha 0.10), low-passed ambient (filter ~1200Hz), rain/buzz bed; particles at 40% opacity.
- **The dip:** after a big show, the first travel scene plays slightly dimmed (0.9 brightness, 1.5s ease) — the player *feels* the flatness without the text having to say it.
- **Epilogue:** slow crossfades; no confetti on heavy endings (confetti only on genuinely bright runs); the Return Home montage uses the weather system (grey rain → clearing light as landings resolve). Reduced-motion and no-flash toggles apply to all of this.

---

## 23. Integrations map (what changes in Part 2)

| Section | Change |
|---|---|
| §15.4.2 Resources | Add Wellbeing + Groundedness rows (see §20.1) |
| §15.4.3 Relationships | Add trauma-bonding events + enabling outcomes |
| §15.4.8 Endings | Add The Return Home epilogue as the second act |
| §15.5 Screens | Hub gains Dead Time beats; add Return Home epilogue screen |
| §15.6 Content | Add the §21 road scenes + vice/ethics nodes |
| §15.7 Accessibility | Add tone dial (Warm/Raw) + first-launch content-warning card (re-openable in Settings) |
| §15.13 Implementation | New step between 8 and 9: build the reality layer |
| §15.15 Checklist | New items 21–26 |
| §13 Product Hunt | Add the honesty hook to "Why it's different" |
| §10 Marketing | Add "the truth behind the romance" as a core angle |

---

## 24. Research grounding

- **Spiritfarer** — cozy management about death and grief; the community's canonical "cozy that breaks your heart"; proves warm mechanics + heavy themes = beloved, not discordant. (r/CozyGamers, multiple threads; hercozygaming, "7 Poignant Games Like Spiritfarer".)
- **r/CozyGamers** — "cozy games that made you cry" is a recurring, heavily-answered request (Spiritfarer, Night in the Woods, Edith Finch, Lost Records: Bloom & Rage, Pine Hearts). The audience wants emotional depth and recommends games *for* it.
- **Kitfox, "Designing for Coziness"** — coziness is a flavor applicable to any genre; darkness outside the cozy space is what makes warmth meaningful; cozy mechanics are opt-in and non-compulsory — matching our "low is flavor, never failure."
- **Indie tour-sim competition (validation)** — "90s rock band life simulator — your drummer is drunk and the gig is in two hours — no health bar" (IndieGameJoe, X) and "Rock Band Simulator: every day is unstable by design" (Instagram) confirm appetite for honest band-road life sims. Our difference: cozy + expressive rhythm + emotional gentleness instead of pressure.
- **Content warnings** — Access-Ability ("Video Games Needs to Put More Effort Into Content and Trigger Warnings") and the NEON typology / BMC systematic review: games are uniquely placed to offer *opt-in, spoiler-safe* warnings; warnings are an accessibility feature; deliver gently (the review notes warnings can raise anxiety — so we default to Warm, warn softly, never force).
