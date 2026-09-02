# Tour Life v3 — Final Close-Out: Strengths, Weaknesses & the Last Polish Pass

**Date:** 2026-09-02
**Author:** Hermes (BAIS)
**Repo:** tour-life-v3 (jamestown502502) — HEAD `fe4c7e4`, clean tree, 4 cities, 64/64 tests
**Constraint honored:** no new cities. Everything here deepens/polishes what exists.
**Research:** 12 web/social/YouTube sources (cited inline) — final insights applied.

---

## Part 1 — Where you're strongest (verified against the repo + handoff v3)

1. **Engineering discipline — genuinely best-in-class.** Texture-key asset seam with code-drawn fallback, seeded RNG with namespaced purposes, JSON-only content pipeline proven at 4 cities with zero engine changes, a drift-guarded chart generator, no-fail made *structural* (proven by test, not intention), and a 17-bug ledger written as regression prevention. This is the rarest strength in indie game dev.
2. **Mobile-grade feel — done, not claimed.** Multi-touch (`activePointers: 4`), safe-area layout (`SAFE_BOTTOM_Y`), the full 44px screen-by-screen touch audit with measured numbers, per-lane feedback. Most cozy indie games never get here.
3. **Onboarding + accessibility.** 8 accessibility settings + 2 dialogue QoL toggles, practice pass on the real beat grid, diegetic Sol intro, two deliberately-separate flag systems. Best-in-class cozy practice.
4. **Variety mechanics that actually work.** Scene-pool scarcity (7-entry pools, 1-2 drawn), storyGate arrangements, minigame no-fail timers, meta-progression, seed replay. The *replayability architecture* is done.
5. **Minigames.** Three types (timing/drag/choice), painted backdrops, flag-gated, structurally no-fail — sparse and thematic per the QTE research.

## Part 2 — Where you're weakest (honest, ordered)

| # | Weakness | Evidence | Why it matters |
|---|---|---|---|
| 1 | **Android port: zero scaffolding** | `capacitor.config.*` absent, no PWA manifest/SW, no haptics, no latency calibration — confirmed on disk | "Ready for Android port" is the explicit goal; the *game* is ready, the *port package* is not |
| 2 | **Rhythm has no latency calibration** | No offset setting anywhere; timing is pure `this.time.now` | Exceed7's crash course: *"Including the calibration in your option screen is a must if you care about Android at all"* — Android audio latency varies per device; without it, expert players feel off and quit |
| 3 | **VN QoL: no backlog, no save slots** | Single save; no dialogue history | r/visualnovels' most-upvoted QoL thread: *"backlog is just a must have… I also like having lots of save slots"* — the two features the genre community considers table stakes |
| 4 | **Endings are scorecard, not story** | Handoff v3 §4 admits it: 6 buckets + tags, no written epilogue | The blueprint's promise is "every run leaves a small piece of your heart"; the payoff currently reads like a stats screen |
| 5 | **Content: Berlin shallow, 2 backstory beats missing** | Berlin 5/5/883w vs 6/7/1,200+ for the others; Jun's letter + Rowan's why unwritten | The two honest gaps the handoff itself flags; both are finishing-what's-built, not scope creep |
| 6 | **Returning-player ceiling** | Meta pools exhaust in ~16 runs; no daily hook; scrapbook isn't shareable | GameRefinery's retention research: returning players need *something to look forward to* — the daily-seed system exists but isn't featured, and the ending can't be exported |
| 7 | **No CI; keyboard + real-device unverified** | No GitHub Action; handoff §8 | For a "complete" game, a green-on-push gate and one human pass on hardware close the trust gap |

## Part 3 — Final insights from research (what shaped this plan)

1. **Exceed7 rhythm crash course** — latency calibration is *mandatory* for Android; also: a **tap-sound on/off toggle** ("fingernail players" turn it off), and *"base your game on your own float, not audio time"* (already true — Phaser clock, good). → Items 2.
2. **r/visualnovels QoL consensus** — backlog + save slots are the must-haves; auto/skip already exist. → Item 3.
3. **GameRefinery onboarding/retention series** — first-impression + daily reasons to return. The game already has a "Today's tour: <seed>" line — make it the hook: a **featured seed-of-the-day** (one tap to play it) + a **shareable scrapbook export** (canvas → PNG) turns the ending into free marketing. → Item 6.
4. **Bugnet + Rhythm Quest devlog** — charts must match the music's feel (already done via motif charts); *"small and finished beats big and abandoned"* — this close-out is exactly that move.
5. **Will Shen / The Narrative Dept (pacing)** — design dictates pacing; minigames already break text flow correctly; keep them sparse, don't add more.
6. **Capacitor v8 + safe-area plugin** — webDir=dist, haptics via plugin or `navigator.vibrate()` (works in Android WebView), edge-to-edge handling. → Item 1.

---

## Part 4 — The close-out plan (8 items, in build order)

### 1. Android port readiness (the explicit ask)
- **`CAPACITOR_PORT.md` runbook** in repo root: exact wrap steps (install `@capacitor/core/cli`, `npx cap init`, `webDir: "dist"`, `npx cap add android`, build+copy loop), plugins (Haptics for perfect-hit buzz, Safe-Area if needed), orientation lock to portrait, `android:screenOrientation="portrait"`, storage notes (IndexedDB persists in WebView; keep the localStorage fallback), the audio-unlock gesture requirement in WebView, and the signing/release checklist for the freelancer.
- **PWA scaffolding** (works on web AND is the install path): `public/manifest.webmanifest` (name, icons from a generated 512 icon, `display: standalone`, `orientation: portrait`) + a minimal service worker for offline/caching (`public/sw.js`, registered in `main.ts`). Self-contained, no build tooling.
- **Haptics**: `navigator.vibrate?.(15)` on perfect hit / `(30)` on miss, gated by a Settings toggle (default on for Android WebView via `Capacitor.isNativePlatform()`-style check or UA; default off elsewhere). Cheap, big feel win.
- **Done-when**: runbook exists; PWA installable (Lighthouse-ish check); vibrate fires on perfect in an Android-emulated context; `npm run build` → `dist/` unchanged behavior.

### 2. Rhythm: latency calibration + tap-sound toggle
- Add `audioOffsetMs` (default 0, range −150..+150, step 5) to accessibility/state (additive, migrate-backfilled like the dialogue toggles).
- `RhythmScene` applies it: `hitMs = startTime + note.t*1000 - offsetMs` (a positive offset means "audio arrives late — judge notes earlier"), and the practice pass becomes the calibration scene: 6 beats, tap along, show measured average delta, then "Apply" sets the offset. Reuses the existing demo machinery.
- Settings gains "Audio sync" row with −/+ buttons + a "Re-calibrate" button (launches the same tap-along).
- **Tap-sound toggle** in Settings (Exceed7's fingernail players): on by default.
- **Done-when**: offset shifts judgement demonstrably (test: a fixed delta pattern judged differently at offset ±100); calibration writes state; tests green.

### 3. VN QoL: backlog + save slots
- **Backlog**: `BacklogPanel` (hold a "Backlog" button or swipe down on the dialogue panel) shows the last ~30 spoken lines (speaker + text, scrollable), closes on release/tap. Lines appended in `DialogueBox.show()`; persisted only in memory per session (not saved — cheap and standard).
- **Save slots**: extend save to 3 slots (`tourlife.run.1..3`, keep `tourlife.run` as the auto/continue slot + migrate loader). Title's Continue loads the auto slot; a "Saves" button opens a 3-slot picker (save/load/overwrite-confirm). Keep `isValidRunState` gating.
- **Done-when**: backlog shows and scrolls in a live dialogue scene; 3 slots save/load/overwrite independently; older single-save still loads (migration).

### 4. Returning player: daily seed + shareable scrapbook
- **Seed of the day**: Title features "Today's Tour — <seed>" as a primary-styled button that starts a run with the day-seeded seed (deterministic from UTC date). The existing seed line becomes the sub-label. One tap to a fresh unique run every day.
- **Scrapbook export**: a "Save tour as image" button on Scrapbook that renders the current card to a canvas and exports PNG via `canvas.toDataURL` → download (web) — the shareable ending (tags, route, grade) becomes free marketing.
- **Done-when**: daily seed is reproducible (same UTC date → same seed); export produces a real PNG file ≥800px wide.

### 5. Unique playthroughs boost (no new cities — more variance per run)
- **Two relationship scenes per city** instead of one: `scenePool.drawScenePoolFlags` draws 2 (pools are 7 — headroom exists); `CityScene` plays the second after the first if flagged. Same scarcity machinery, double the per-run relationship content.
- **Weather has teeth**: each city's seeded weather applies a small stat delta on arrival (e.g. `soft_rain` −2 energy +1 inspiration, `golden_hour` +2 harmony) — flavor becomes choice-relevant, seed-driven.
- **Minigame variance**: timing minigame rounds +1 at higher Harmony; drag minigame items shuffle per seed (already RNG-based — make the shuffle seed-derived).
- **Done-when**: two seeds diverge in relationship-scene count AND weather deltas; content tests (scene-graph integrity) still pass with 2-draw.

### 6. Finish what's built: 2 backstory beats + Berlin deepening
- Jun's "letter from home" + Rowan's "why they're here" (node-level `condition`/`fallback` pattern, gated `relationship.<id>>=40` — **not** the unread `RelationshipScenePoolEntry.condition` field) into Lisbon/Tokyo pools.
- Berlin → 6 locations, 7 pool entries, 1 flag-gated alternate after-show, target ~1,000+ words. All content-only; `content.test.ts` will validate.
- **Done-when**: `npm test` green; Berlin depth ≈ peers; the 8/8 backstory beats exist.

### 7. Endings: written payoff without the reality layer
- **Epilogue flavor system**: for each of the 6 endings × 4 tag-sets, 3–4 short written paragraphs (~150-200 words each) rendered after the Scrapbook card ("Two months later…") — narrative payoff from the tracked tags/route, no new systems, pure content. Gives the run a *story* ending, not just a label.
- **Done-when**: every ending+tag combination renders distinct prose; a bright run and a weary run read differently.

### 8. CI + final verification gate
- **GitHub Action** `.github/workflows/ci.yml`: on push/PR → `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. Green-on-push.
- **Final pass**: keyboard D/F/J/K real-press test; hold-note slow-motion visual check; one cold-boot production pass; deploy via git push (Vercel auto-deploy), curl 200 + title check.
- **Done-when**: action green on this push; the two never-verified items are verified and reported.

---

## Part 5 — Guardrails (unchanged)

- **No new cities.** No 5th city, no reality layer (still the owner's deferred decision, unchanged), no audio-file swap (procedural stays; optional Title theme still optional).
- Painted world + code-drawn UI; all 8 accessibility settings + 2 QoL toggles intact; no-fail structural everywhere (re-verify all-miss path after the calibration change).
- Content schema changes additive; save migration backfills; bug-class rules (init() resets, SHUTDOWN un-duck, no `fillGradientStyle` in cached textures) honored.

## Part 6 — Bottom line

**Strongest:** engineering, mobile-grade feel, onboarding/accessibility, replay architecture.
**Weakest:** the port package (zero scaffolding), rhythm calibration, VN QoL (backlog/slots), narrative payoff, and the honest content tail (Berlin + 2 beats). This close-out turns the weakest five into the strongest five — every item maps to a research-backed best practice, nothing adds a city, and the result is a game that's web-complete AND Android-ready. Resume prompt in `RESUME_PROMPT_CLOSE_OUT.md`.
