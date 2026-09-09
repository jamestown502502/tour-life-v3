# Tour Life: International Dates — Pre-Public Close-Out (v2)

**Date:** 2026-09-09 · **Live:** https://tour-life-v3.vercel.app
**This version leads with two new workstreams** (no barren screens; two songs per city), then keeps the full pre-public close-out from v1 (polish insights, real-device + fresh-eyes protocols, release gate).

---

## Part A — No Barren Screens: background audit + Gemini backdrops for every scene

**The problem:** some scenes render without a real background — the intro, the epilogue, and others — leaving them bare on the plain navy. Research backs this as a real quality gap: visual-novel art direction is *cohesion* (Ari Made's "100 VNs" review: UI, character art and backgrounds must read as one world), and a barren screen breaks that contract exactly at the moments players linger on (intro, epilogue, Results). Every screen should feel like part of the same painted world.

### A1 — Audit every scene (ground truth first)

Walk every scene class in `src/ui/` and record whether it has a full painted background today:

- **Known to have one:** Title (`bg_title`), City (`bg_city_<id>`), Hub (`bg_hub`), Rhythm (`bg_rhythm_<id>`), MiniGame (`bg_mini_<id>`).
- **Suspect bare (verify each with a screenshot):** BandCreator (night-before scene), RoutePlan (route screen), Results (grade plate), Scrapbook + Epilogue ("Two Months Later" page), HowToPlay, Settings overlay, Saves/Gallery panels, the van-travel beats, the return-leg social feed, and the opening scene.
- **Output:** a table — scene / has-background? / what it shows today / what it needs.

### A2 — Generate what's missing (the rule: no screen is barren)

- **Rule:** every full-screen scene renders a painted Gemini background. Overlay scenes and panels (Settings, Saves, modals) may sit over a dimmed version of the underlying scene's background — that's the industry standard for overlays; only genuinely standalone screens need their own asset.
- **Generate via the established pipeline** (the "new correct way" — HANDOFF §11.1): `generate_image.py --resolution 2K` with the style block from `docs/asset-probes/lisbon_bg_probe.png` (soft gouache, cozy, city palette, portrait 9:16, no text) + a per-scene description; then `scripts/process-bg.sh` (6% inset crop, 9:16 normalize, WebP q82); then add `{key, file}` to `public/assets/manifest.json`; load through `BootScene`. **Code-drawn fallback stays** — a missing file degrades, never crashes (the resilience rule).
- **Backdrops to generate** (final list from the A1 audit; expect roughly): intro/night-before (bus dusk interior), route/promise (map room with a corkboard), Results (backstage/curtain), epilogue ("Two Months Later" — a quiet home window, rain, warm light), plus any bare screen the audit finds.
- Wire each into its scene with `addCoverBackground` + `applyVignette`; verify text legibility over the new art (scrim where needed).

### A3 — Verify

- Screenshot every scene at 390×844 and desktop; a "barren screen" check: no scene shows bare navy behind its content.
- Fresh-load console: zero missing-texture warnings (BootScene already lists MISSING textures loudly).
- **Done when:** the audit table shows every scene with a background or a deliberate dimmed-overlay treatment; screenshots committed to `docs/polish-before-after/`.

---

## Part B — Two Songs per City: Gemini tracks, first-visit vs return-leg variety

**The problem:** the game plays essentially the same song over and over — every city has one song, so a full run hears the same 4 tracks, and the return leg plays the same song as the first night. Research backs the fix: r/rhythmgames ("DO NOT repeat the same songs… add variety in your gameplay") treats setlist variety as genre-core; Indie Games Clinic's "Balancing Repetition and Variation" warns that habituation — the "same song for breakfast, lunch, and dinner" effect — is exactly what makes repetition feel stale, and to be generous with variety within a coherent world. This also upgrades the return leg (already built): the second night in a city now plays a *different song* — the town remembers you, and your setlist changes too.

### B1 — Two songs per city (design)

- Each city gets a **second song** — a distinct `content/songs/<city>_<n>.json` with its own bpm, chord progression, waveform, and chart (via a new `SongConfig` entry in `chartGen.ts`, matching the city's tone but clearly different in tempo/energy: e.g. Lisbon's second song a faster, fuller band cut; Tokyo's second a slower, sparse one; Mexico City's second a different groove; Berlin's second a colder ambient piece).
- **Pick logic — guaranteed variety per run:** each city's JSON gains `songs: [songA, songB]` (additive, validated). First visit plays a song selected by the run seed (so different runs may open a city with a different song); the **return leg always plays the OTHER song** — the second night is never the same song as the first night of that city. Fallback: if a song's audio file is missing, fall back to the other song, then to procedural ambience — never crash.
- Surface the choice everywhere it matters: RoutePlan ("tonight: <song>"), Results (song name on the grade plate), Scrapbook setlist (which songs actually played, in order), and the epilogue (the return-night song referenced).

### B2 — Generate the tracks (Gemini/Lyria, the verified pipeline)

- `generate_music.mjs --model pro` (pro = up to 184s with structure; these songs are 55–70s, so `clip`'s 30s is too short). Per-city prompt: genre/energy/chord feel matching the city's tint and the first song's identity, so the pair reads as the same band's two sides. Self-host into `public/audio/` (the title theme already lives there — same pattern).
- **Key gotcha (documented):** the API key lives in the Windows *user* env, not the shell — load via `KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')")` and pass `--api-key "$KEY"`; native Windows paths for native tools.

### B3 — Wire into the rhythm engine (carefully — this touches the game's most-bugged system)

- `SongDef` gains an optional `audioFile?: string` (additive schema). 
- **Chart must match the track:** the new `SongConfig` bpm/bar count must produce a chart whose duration lands in the 55–70s window the tests enforce, matching the generated track's actual length (generate the track first, then set the chart config to its tempo/duration — mind the documented tempo-vs-bar-count trap).
- **RhythmScene:** when `audioFile` is present, load the audio (BootScene), schedule it to start precisely at `startTime` (which must keep the fixed `this.game.loop.time` clock read — the recent Clock fix must not regress), and use it as the backing track instead of procedural ambience; **procedural ambience stays as the fallback** when the file is missing. Latency calibration's `audioOffsetMs` applies to hit times regardless; the tap-sound toggle still works; the all-miss no-fail run still reaches Results.
- **Done when:** every city has 2 songs; the return leg plays a different song than the first visit (proven by a test); a full run has 8 distinct song plays (4 first visits + 4 return legs, no repeat within a city); charts match track durations; fallback verified; all tests green.

### B4 — Variety regression tests

- `src/tests/songVariety.test.ts`: every city has ≥2 songs; first-visit vs return-leg picks differ; the seed affects which song opens a city; the fallback chain works (audio missing → other song → procedural).
- e2e: a full run plays ≥2 distinct songs per city; the return leg's rhythm scene uses the other song.
- **Done when:** tests green — the "same song over and over" complaint is structurally impossible.

---

## Part C — The Pre-Public Close-Out (kept from v1, freeze adjusted)

### C1 — Feature freeze (adjusted)

After Parts A and B ship, tag the current HEAD `release-candidate`. From then on, the only allowed changes before public: fixes to the new backgrounds/songs the audit or tests reveal, and blocker bugs from the real-device/fresh-eyes passes. **Parts A and B are the last content additions before public.**

### C2 — Remaining verifications (from v1, unchanged)

- **Eyeball the 3 unexamined rhythm backdrops** (lisbon, mexico_city, berlin) at full size — one continuous room per city, no hard seams (Tokyo confirmed). Regenerate via the corrected prompt if any show seams; screenshot all 4.
- **Themed-transition revert complete:** grep for `transition: 'card'/'lights'/'drive'`, `buildThemedOverlay`, `TransitionType` across `src/` — zero remnants (plain 250ms fade only).
- **Per-pillar verification** (screenshot + one-line result each): FTUE (first 60s reads intentional); VN (back button reachable in real play, restores prior line without re-applying effects; backlog; auto/skip sane); minigames (all 6 types, intro line teaches the mechanic); rhythm (latency calibration + tap-sound toggle functional; a real song ≥20s with real hits); transitions (plain fade at every seam, smooth on an emulated mid phone); accessibility (all toggles visibly work; contrast spot-check).
- **Launch link:** curl 200 + title; OG tags present and og:image 200s; theme-color; apple-touch-icon; manifest.webmanifest 200; sw.js serving the current CACHE_NAME; fresh-profile run console-clean; scrapbook PNG export works.

### C3 — The two gaps no automated test can close (from v1)

- **`docs/REAL_DEVICE_TESTING.md`** — the owner's structured pass on their iPhone + one Android (mid-range if possible): full run, all 6 minigames, rhythm AFTER latency calibration, PWA install, offline reload, share-preview, scrapbook export, console check. PASS/FAIL columns, ~2 pages.
- **`docs/FRESH_EYES_PLAYTEST.md`** — 3–5 blind testers, 5 structured questions (first-60s impression; stuck / wanted a back; wanted-to-do-but-couldn't; rhythm fairness + which minigame confused you; would-you-play-again/share — yes/maybe/no + why). **Reward participation, never positivity.** Triage blockers-to-fix vs non-blockers-to-log (`PLAYTEST_TRIAGE.md`).

### C4 — Release gate (`RELEASE_GATE.md`)

Must be fully green before the URL is shared publicly: CI green on release-candidate · A1–A3 barren-screen audit complete (no bare scenes) · B1–B4 two-songs-per-city complete (return leg plays a different song) · backdrops eyeballed · REAL_DEVICE_TESTING done · FRESH_EYES triage done, blockers fixed · launch link verified · freeze in effect · the honest deferred list (arc stages, 4th-city minigame types, Part 3 reality layer, 5th+ city — each with why). Final verdict, one line: **"READY TO SHARE: yes/no"** + URL.

---

## Part D — Research Grounding (new items; prior citations unchanged)

- **r/rhythmgames** ("How do people even process what's going on…"): *"DO NOT repeat the same songs, add variety in your gameplay"* — setlist variety is genre-core; the same chart on repeat is the fastest way to lose a rhythm player.
- **Indie Games Clinic / cobble.games** ("Balancing Repetition and Variation in Game Design"): repetition builds the confidence loop; variety sustains interest and prevents stagnation — *"be generous with variety"* within a coherent world. Habituation is precisely the player-reported boredom.
- **Ari Made ("I played over 100 visual novels…")**: art direction = cohesion across UI, character art, and backgrounds; a barren screen breaks that. Every screen should read as the same world.

---

## Guardrails

No new systems (song variety = additive schema + content + one RhythmScene audio path; backgrounds = assets + manifest), no Part 3 reality layer, no themed transitions, accessibility + no-fail intact (**re-verify the all-miss run after ANY RhythmScene change — the song/audio change touches RhythmScene**), painted-world/code-drawn-UI rule, constants in `src/const.ts`, scene array/Map/Set fields reset in `init()`, DialogueBox scenes un-duck in SHUTDOWN, no `fillGradientStyle` in cached textures, dialogue nodes ≤40 words, additive save schema only, evidence-first (every claim: screenshot/console/test). **New CACHE_NAME consideration:** new assets ship under the same manifest path — the SW's stale-while-revalidate already refreshes non-hashed files, so no SW change needed, but confirm the live load picks up the new manifest (fresh load, all tabs closed).
