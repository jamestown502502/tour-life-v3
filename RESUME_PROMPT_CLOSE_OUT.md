# RESUME PROMPT — Tour Life v3: Final Close-Out (Android-Ready, VN QoL, Calibration, Payoff)

**Paste this to Claude Code at the start of the next session.** Read `HANDOFF.md`, `DESIGN.md`, `CLAUDE.md`, and `POLISH_CLOSE_OUT_PLAN.md` in the repo root first. This is the final close-out pass: **no new cities, no reality layer** — everything here polishes what exists and makes the game Android-ready. Eight items, in order, each with done-when gates. Verify each before moving on.

---

```text
You are doing the FINAL CLOSE-OUT pass on "Tour Life: International Dates" (tour-life-v3, Vite + TS strict + Phaser 3.90, 4 cities, 64/64 tests). The game is web-complete and mobile-grade. This pass: Android port readiness, rhythm calibration, VN quality-of-life, returning-player hooks, more per-run variance, finishing the content tail, narrative payoff for endings, and CI. NO new cities. NO Part 3 reality layer (deferred by owner). No audio-file swap (procedural stays).

HARD RULES (from CLAUDE.md + HANDOFF.md bug ledger):
- Constants only in src/const.ts. Any new array/Map/Set Scene field MUST reset in init() (bug #10). Any scene creating a DialogueBox un-ducks music in its own SHUTDOWN (bug #12). Never reintroduce fillGradientStyle inside a cached-texture callback (bug #8). Never use the RelationshipScenePoolEntry.condition schema field for gating — CityScene never reads it; use node-level condition/fallback (per handoff §7.2/§11.3/§14.6).
- Content schema changes additive + validated; dialogue nodes <=40 words (enforced). Save schema: additive fields within v1, backfill via save.ts migrate() (the established pattern).
- No-fail is structural: after ANY rhythm change, re-verify the all-miss run still reaches Results. All 8 accessibility + 2 dialogue toggles intact.
- Touch-first everywhere; keyboard optional. Match existing style; surgical changes.

ITEM 1 — ANDROID PORT READINESS.
 1a. Write CAPACITOR_PORT.md at repo root: complete wrap runbook for the freelancer — npm i @capacitor/core @capacitor/cli; npx cap init (appId com.bennettaisolutions.tourlife, appName "Tour Life"); set webDir "dist" in capacitor.config.ts; npx cap add android; the build+copy loop (npm run build && npx cap copy && npx cap sync); orientation lock portrait (android:screenOrientation="portrait" in AndroidManifest); safe-area handling (edge-to-edge + env(safe-area-inset-*) already in CSS — note the capacitor-community/safe-area plugin as fallback for old WebViews); storage (IndexedDB persists in WebView; localStorage fallback retained); audio unlock (WebView requires a user gesture — already handled by Title's first-tap unlock; document it); haptics via plugin OR navigator.vibrate; signing/release (keystore, gradle assembleRelease, Play Console checklist incl. content rating for a cozy game with no mature content — the reality layer is NOT in this build, say so honestly).
 1b. PWA scaffolding in public/: manifest.webmanifest (name "Tour Life: International Dates", short_name "Tour Life", display standalone, orientation portrait, icons: generate ONE 512x512 PNG via the Gemini pipeline or a simple canvas-drawn icon committed to public/icons/icon-512.png + 192 variant), and a minimal sw.js (cache-first for hashed assets in /assets/, network-first for index.html, skipWaiting+claim). Register in src/main.ts boot. Keep it tiny and correct — no framework.
 1c. Haptics: navigator.vibrate?.(15) on perfect hit, (30) on miss, gated by a new Settings toggle "Haptics" (default ON on Android via UA check / Capacitor.isNativePlatform when available, OFF elsewhere). Wire into RhythmScene.applyJudgement.
 DONE-WHEN: CAPACITOR_PORT.md complete; manifest + sw registered (verify in browser network tab: manifest fetched, SW active); vibrate fires in an Android-emulated/UA-checked context; build green.

ITEM 2 — RHYTHM LATENCY CALIBRATION + TAP-SOUND TOGGLE (Exceed7: calibration is mandatory for Android).
 2a. Add audioOffsetMs (default 0, -150..+150 step 5) to accessibility in state.ts, additive within v1, backfilled by save.ts migrate() (same pattern as the dialogue toggles). Settings gains an "Audio sync" row: -/+ buttons (step 5) + "Re-calibrate" button.
 2b. Apply in RhythmScene: effective hit time = startTime + note.t*1000 - audioOffsetMs (positive = audio arrives late, judge notes earlier). Apply the same offset to hold-end and cue timings. Judgement feedback text unchanged.
 2c. Calibration flow: reuse the practice-pass machinery as a tap-along — 6 metronome beats, player taps along, measure mean delta (exclude min/max), show "+N ms", "Apply" writes audioOffsetMs; "Skip" keeps current. Reachable from Settings AND auto-offered once (persistent onboarding flag) after the first song if the player's miss rate > 40%.
 2d. Tap-sound toggle in Settings (default on): when off, hit SFX (tap/perfect/good/ok/miss) are muted during rhythm; music/ambience unaffected.
 DONE-WHEN: unit test proves judgeHit delta shifts by offset (a pattern judged at offset 0 vs +100 differs as expected); calibration writes state; all-miss run still completes (no-fail intact).

ITEM 3 — VN QOL: BACKLOG + SAVE SLOTS (r/visualnovels consensus: backlog and save slots are must-haves).
 3a. Backlog: BacklogPanel component — hold a small "Backlog" button (or long-press the dialogue panel) to show the last ~30 lines (speaker colored per BANDMATE_HEX + text, scrollable), dismiss on release/tap. DialogueBox.show() appends every line to a session-only array. Not persisted to save. Works at 390px width, respects safe area.
 3b. Save slots: extend save.ts to 3 named slots (tourlife.run.1..3) + keep the auto slot (tourlife.run) for Continue. Title gains "Saves": a 3-slot picker (each: Save / Load / overwrite-confirm). Save from Hub or any phase-transition as today (auto slot unchanged); manual Save copies current state into a chosen slot. Load validates via isValidRunState, falls back gracefully. Older single-save still migrates into auto.
 DONE-WHEN: backlog opens/scrolls/dismisses in a live scene; 3 slots save/load/overwrite independently; old save loads; typecheck+tests green.

ITEM 4 — RETURNING PLAYER: DAILY SEED + SHAREABLE SCRAPBOOK.
 4a. Seed of the day: derive a daily seed deterministically from UTC date (e.g. hashStringToSeed('daily:' + dateStr)) — stable all day, new each day. Title shows a primary "Today's Tour — <seed>" button (starts New Run with that seed) above the existing seed line. Reproducible: same UTC date -> same seed.
 4b. Scrapbook export: "Save tour as image" button — render the scrapbook card contents (ending label + tags, route chain, setlist, souvenir list, relationships) to an offscreen Phaser Graphics/container at 900px wide, canvas.toDataURL('image/png'), trigger download (a.href = dataURL, a.download). Web + Android WebView both support it.
 DONE-WHEN: daily seed reproducible across reloads; export produces a real downloadable PNG >= 800px wide in a live browser test.

ITEM 5 — MORE PER-RUN VARIANCE (no new content volumes — same pools, more shown).
 5a. Two relationship scenes per city per run: scenePool.drawScenePoolFlags draws 2 (pools are 7 — headroom exists); CityScene plays the second flagged scene after the first (phase 'relationship' runs twice when a second is available). Update the headless playtest expectation if it asserts one.
 5b. Weather has teeth: seeded per-city weather applies a small stat delta on arrival (map in CityScene or route.ts: soft_rain -> energy -2, inspiration +1; golden_hour -> harmony +2; teal night -> inspiration +2; add per-weather entries for the pools used). Flavor text unchanged; deltas shown once in the arrival line.
 5c. Minigame variance: Soundcheck rounds = 3 + (harmony >= 50 ? 1 : 0); Pack the Van item order seed-derived (use the run seed namespace 'packvan'); Interview question order shuffled per seed.
 DONE-WHEN: two seeds diverge in relationship-scene count AND weather delta; content.test.ts scene-graph integrity still passes; tests green.

ITEM 6 — FINISH THE CONTENT TAIL (no new cities).
 6a. Jun's "letter from home" + Rowan's "why they're here" backstory beats, into Lisbon/Tokyo pools, node-level condition (relationship.<id>>=40) + fallback pattern (NOT the pool-entry condition field).
 6b. Deepen Berlin to parity: +1 location (6), +2 relationship-pool entries (7), +1 flag-gated alternate after-show (reuse an existing Berlin choice flag), ~1,000+ words total. Content-only.
 DONE-WHEN: npm test green (content.test.ts validates all references); Berlin depth == peers; all 8 backstory beats exist.

ITEM 7 — ENDINGS GET A WRITTEN PAYOFF.
 7a. Epilogue flavor: a new content file content/epilogues.ts (typed in schema) mapping ending id + tag-set to 3-4 short paragraphs (~150-200 words). After the Scrapbook card, an "Epilogue" page renders the matched prose (fallback: a generic per-ending paragraph if a tag combo lacks a bespoke one). Pure content + one Scrapbook screen section; no new systems.
 7b. Author all 6 endings x the distinct tag-sets actually reachable (keep it ~10-14 total entries, honest quality over exhaustive coverage; fallback handles the rest).
 DONE-WHEN: every reachable ending+tags renders distinct prose; a bright run (Found Family/Beloved Small) reads emotionally different from a weary run (Quiet Ending); tests green.

ITEM 8 — CI + FINAL VERIFICATION.
 8a. .github/workflows/ci.yml: on push + PR -> npm ci, npm run typecheck, npm test, npm run build. Green on this push.
 8b. Final verification pass (live, Playwright, NOT the Claude_Browser pane): keyboard D/F/J/K real key presses on the rhythm scene (never verified before — report result honestly); hold-note rail watched in slow-motion (report visual feel); cold boot of production build, zero console errors; then deploy via git push (Vercel auto-deploys — do NOT run a manual vercel deploy that races it; if the GitHub integration is slow, confirm via list_deployments before touching the CLI) and curl the live URL: expect 200 + title "Tour Life: International Dates".
 DONE-WHEN: CI green on this push; keyboard + hold-rail reported with evidence (screenshot/console); live URL verified.

FINISH with: files changed, new tests + count, per-item done-when evidence, keyboard/hold-rail verification results, deploy verification, and the honest list of anything you could NOT verify (report, don't claim). State explicitly that the reality layer and 5th+ city remain deferred by the owner.
```
