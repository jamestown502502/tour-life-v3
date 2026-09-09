# Pre-Public Close-Out — Execution Plan
**Date:** 2026-09-09 · **Against:** `BAIS_TourLife_CloseOut_PrePublic_v2_2026-09-09.md` · **Base:** `813bd88`

The close-out doc is sound. This is the plan to execute it, with the A1 audit **already done** so the
scope is fact rather than suspicion — that audit corrected the doc in two places, and turned up one
issue the doc doesn't mention.

---

## A1 — Background audit: DONE (ground truth)

Method: every `src/ui/*Scene.ts` checked for `addCoverBackground` (a real painted asset) versus a
bare `add.rectangle(0, 0, W, …)` fill.

| Scene | Painted background today | What it shows | What it needs |
|---|---|---|---|
| Title | ✅ `bg_title` | Menu, seed entry | — |
| City | ✅ `bg_city_<id>` | VN dialogue, pickers | — |
| Hub | ✅ `bg_hub` | Map, route, souvenirs | — |
| MiniGame | ✅ `bg_mini_<id>` | All 6 minigame types | — |
| Rhythm | ✅ `bg_rhythm_<id>` | The show | — |
| **Results** | ✅ reuses `bg_rhythm_<id>` | Grade plate | — **(doc listed this as suspect bare — it isn't)** |
| **Opening** | ❌ flat navy | "The night before", 4 cast beats | **New backdrop** — van/rehearsal room at dusk |
| **BandCreator** | ❌ flat navy | Genre, name, why-tour | **New backdrop** — rehearsal space, gear against a wall |
| **RoutePlan** | ❌ flat navy | Route list, tour promise | **New backdrop** — map/corkboard table |
| **Scrapbook** | ❌ flat navy | Ending card + "Two Months Later" | **New backdrop** — quiet window, rain, warm light |
| **Van** | ❌ flat navy | Travel beats | **New backdrop** — van interior, motorway at night |
| HowToPlay | ❌ opaque navy | Instructions overlay | **Dim treatment** (see finding below) |
| Settings | ❌ opaque navy | Settings overlay | **Dim treatment** (see finding below) |

**Also checked:** the return-leg social feed is a panel drawn over `CityScene`, which already has a
painted background and is dimmed at 0.82 — it needs nothing.

**Result: 5 new backdrops, not the doc's longer suspect list.**

### Finding the doc doesn't cover
`Settings` and `HowToPlay` are launched with `scene.launch` — they are genuinely overlays, so the
doc's "overlays may dim the scene behind them" rule applies. **But both currently draw an OPAQUE
full-screen navy rectangle**, which hides the scene behind and produces exactly the barren look the
doc is trying to eliminate. So they need a small **code** change (translucent fill + the existing
scrim pattern), not an asset. That is cheaper than generating two backdrops and matches the
industry-standard treatment the doc asks for.

---

## Sequencing, and why

**Part A first, Part B second, and not interleaved.**

Part A is assets plus one small overlay change: it cannot break gameplay, and its failure mode is a
missing texture, which already degrades gracefully. Part B touches `RhythmScene` — the system that
produced almost every outage this month, including the stale-Clock bug that made the song clock
equal the session clock. Landing them together would make any rhythm regression ambiguous between
"the new audio path" and "the new art". Separate commits, separate CI runs, separate verification.

---

## Part A — No barren screens

| Step | Work | Verify |
|---|---|---|
| A2.1 | Add 5 prompts to `scripts/generate-backgrounds.sh` using the corrected style block (the one that fixed the rhythm seams: one continuous scene, one viewpoint, **never** "thirds/bands/top/bottom") | Script runs, 5 files land in `public/assets/img/` |
| A2.2 | `process-bg.sh` → 9:16 WebP; add `{key,file}` to `manifest.json`; load via `BootScene` | `manifest.json` valid; BootScene logs no MISSING textures |
| A2.3 | Wire each scene: `addCoverBackground` + `applyVignette`, replacing the flat rect; add `addTextScrim` where text sits directly on art | Typecheck; text legible in screenshots |
| A2.4 | Settings + HowToPlay: translucent fill so the scene behind reads through | Screenshot over Hub and over City |
| A3 | Screenshot all 13 scenes at 390×844 and desktop; fresh-load console check | No bare navy anywhere; zero missing-texture warnings; screenshots in `docs/polish-before-after/` |

**Risk:** low. Worst case a backdrop looks wrong and gets regenerated, or a file is missing and the
code-drawn fallback takes over.

**Guard against the known failure:** the seam bug came from a prompt asking for a dark middle
*third*. Every new prompt describes one room with natural depth. I will measure row-brightness
discontinuities on all 5 the same way I did for the rhythm backdrops, rather than eyeballing.

---

## Part B — Two songs per city

Confirmed available: `generate_music.mjs` at `~/.claude/skills/user/game-music-generator/scripts/`,
and `public/audio/title_theme.mp3` proves the self-hosted-audio-with-procedural-fallback pattern
(`BootScene` already falls back when an audio file fails to load).

Current shape: `CityDef.songId` is **singular**; charts are code-generated from four `SongConfig`
entries in `src/game/chartGen.ts`.

| Step | Work | Verify |
|---|---|---|
| B1 | `CityDef` gains `songs: [a, b]` (additive; `songId` kept as fallback for old saves). Seed picks the first-visit song; **return leg forced to the other** | `songVariety.test.ts` |
| B2 | Generate 4 tracks with `--model pro` (55–70s needs pro; `clip` caps at 30s). Key from Windows *user* env, not the shell | Files land in `public/audio/`, durations measured |
| B3 | 4 new `SongConfig` entries whose bpm × bars match **the generated track's real duration** — generate first, then set the config | Chart duration within 2s of track length |
| B4 | `SongDef.audioFile?`; `RhythmScene` plays it at `startTime`, procedural stays fallback | All-miss no-fail run still reaches Results |
| B5 | Surface song names: RoutePlan, Results, Scrapbook setlist | Screenshots |
| B6 | Tests: every city ≥2 songs; first-visit ≠ return-leg; seed affects the opener; fallback chain (missing audio → other song → procedural) | Unit + e2e green |

**Risk: high — this is the most-bugged system in the project.** Specific things that must not regress:

- `startTime` must keep reading `this.game.loop.time`, **not** `this.time.now`. That single line was
  the rhythm killer; a Clock read inside `create()` is stale and makes the song clock the session clock.
- `songStarted` guard stays — a song that never started still must not be able to finish itself.
- `audioOffsetMs` latency calibration must still apply to hit judging.
- The all-miss no-fail run must still reach Results. **Re-verified after every change in this part.**

**The rule this changes, deliberately:** `CLAUDE.md` says *"ALL audio via Web Audio API. No audio
files."* The title theme was already a documented exception; four backing tracks make it a policy.
Part of this work is **updating that rule in CLAUDE.md** rather than leaving the codebase contradicting
its own charter. Flagging because it's a real architectural change, not a content addition — you own
the call, and the r/rhythmgames variety argument supports it.

---

## Part C — Close-out gate (unchanged from the doc)

1. Tag `release-candidate` after A and B. Freeze: only fixes to the new art/audio and blocker bugs.
2. Eyeball lisbon / mexico_city / berlin rhythm backdrops at full size (Tokyo confirmed).
3. Themed-transition revert: grep `transition: 'card'|'lights'|'drive'`, `buildThemedOverlay`,
   `TransitionType` — expect zero.
4. Per-pillar verification with a screenshot and one-line result each.
5. Launch link: 200 + title, OG tags + og:image 200, theme-color, apple-touch-icon,
   manifest 200, `sw.js` CACHE_NAME current, fresh-profile console clean, scrapbook PNG export.
6. `docs/REAL_DEVICE_TESTING.md` + `docs/FRESH_EYES_PLAYTEST.md` (reward participation, never
   positivity) → `PLAYTEST_TRIAGE.md`.
7. `RELEASE_GATE.md` with the one-line **READY TO SHARE: yes/no** + URL.

---

## Effort and honest caveats

| Part | Effort | Risk |
|---|---|---|
| A — 5 backdrops + 2 overlay fixes | Medium (mostly generation + wiring) | Low |
| B — 4 tracks, 4 charts, audio path | Large | **High** — touches RhythmScene |
| C — gate, docs, verification | Medium | Low, but gated on your device + testers |

**Two things only you can do**, and the gate can't close without them: the real-device pass on your
own iPhone and an Android, and 3–5 fresh-eyes testers. Everything else I can complete and evidence.

**The one I'd push back on slightly:** Part B's tracks are the single largest quality upgrade *and*
the largest regression risk in the project. I'd rather ship Part A and the release gate first, get
the game publicly shareable, and land Part B as the first post-launch update with its own CI run and
real-device pass. If you want it before public, I'll do it — but sequenced strictly after A, never
alongside.
