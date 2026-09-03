# RESUME PROMPT — Tour Life v3: Final Polish & Release-Readiness Pass

**Paste this to Claude Code at the start of the next session.** Read `HANDOFF.md`, `CLAUDE.md`, `DESIGN.md`, `docs/CROSS_PLATFORM_TESTING.md`, and `UX_QA_FOLLOWUP_BEFORE_AFTER.md` first. This is the FINAL POLISH pass — it closes every remaining verification gap, adds the one audio asset worth having, tightens load/share polish, and produces the release checklist. **No new cities, no Part 3 reality layer, no new systems, no engine changes.** Everything here is finishing + proving.

---

```text
You are doing the FINAL POLISH + RELEASE-READINESS pass on "Tour Life: International Dates" (tour-life-v3, Vite + TS strict + Phaser 3.90, 4 cities, ~109 unit + 22 e2e + 4 dist tests). The game is functionally complete and the UX/QA follow-up (commit 21c53d1) fixed the real stuck-dialogue bug. This pass closes the remaining verification gaps, adds the one audio asset worth making real, tightens load/share polish, and writes the release checklist. Work in order; prove each item with evidence; report honestly.

GROUND TRUTH (verified against the repo):
- CI (.github/workflows/ci.yml) has build-and-test + an e2e-smoke job with the full device matrix (iPhone 12/14, Pixel 7, generic 360x740 Android via playwright.config.ts + a dist config for the built bundle). Only Pixel 7 was confirmed locally; the matrix runs on push/PR — its first real run is THIS pass's first task.
- No title theme exists (public/audio is absent). The procedural ambience is complete and stays; a single Lyria title loop is the one real-audio asset the design has always allowed (DESIGN.md §15.17, HANDOFF §7.3).
- The production bundle is a single ~1.7MB index-*.js chunk (Phaser + game). Backgrounds are WebP (60-340KB each) served from public/ -> dist/. No code-splitting, no gzip report, no OG/meta tags beyond the basics (check index.html), no apple-touch-icon, no theme-color.
- HANDOFF.md §8 still lists open verification: keyboard F/J/K not physically pressed (D was proven; F/J/K share identical code paths), hold-note rail never watched in slow motion, cold-boot-into-Rhythm audio path unexercised. The manual real-device checklist exists (docs/CROSS_PLATFORM_TESTING.md) but no hardware has run it.
- The `Ambitious` ending tag (route.length >= 6) is unreachable with a 4-city pool — dead code, documented. Do NOT lower the threshold to force it (that changes the design); leave it, note it in the release doc.
- Content depth: a full run is ~15-25 min vs the blueprint's 3-4h promise. This is the owner's scope decision, NOT this pass's job. State it once in the release doc, do not attempt to fix it here.

ITEM 1 — PROVE THE PLATFORM MATRIX (highest value; closes the cross-platform story).
 1a. Watch the first CI e2e-smoke run on this push (and any PR). If any of the 4 device profiles fails, fix the failure (platform-specific timing, safe-area, touch-target, or viewport-dependent layout), re-run, and record the result in docs/CROSS_PLATFORM_TESTING.md with a per-profile PASS table. Do NOT skip profiles or mark them green without a green run.
 1b. Locally, run the matrix once too (npx playwright test and --config=playwright.dist.config.ts at the 4 viewports) so CI results have a second source of truth.
 DONE-WHEN: all 4 profiles green in CI AND locally; per-profile table in the doc with dates/commit; any failure's fix has a test.

ITEM 2 — THE TITLE THEME (the one audio asset worth making real).
 2a. Generate a ~30s cozy title loop via C:/Users/Jbthi/.claude/skills/user/game-music-generator/scripts/generate_music.mjs --model clip --prompt "<cozy, warm, soft-gouache folk-pop instrumental, music-box piano + light acoustic guitar, gentle, ~90bpm, warm and nostalgic>" --filename public/audio/title_theme.mp3 (key from Windows user env: KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')") — pass --api-key "$KEY" or export it; native Windows paths, not MSYS).
 2b. Wire it: load the mp3 via BootScene (this.load.audio, manifest-independent — audio is NOT in the image manifest), and play it on Title's first-gesture unlock INSTEAD of the procedural default ambience (stop the procedural bed when the theme starts; keep duckMusic behavior working with the theme — DialogueBox ducking already targets the music gain node, verify it applies). Settings' music volume slider must control it (route through the music bus). Rhythm/City/Hub keep their procedural ambience — only Title gets the theme.
 2c. Keep the procedural DEFAULT_AMBIENCE as fallback if the file fails to load (same pattern as texture fallbacks — never break the game for a missing asset).
 DONE-WHEN: title theme audibly plays after first tap, ducks during any Title dialogue/modal, volume slider controls it, procedural ambience untouched elsewhere, no console errors, no asset-load crash if the file is missing.

ITEM 3 — LOAD & SHARE POLISH.
 3a. Code-split the vendor chunk: move Phaser into its own chunk (manualChunks in vite.config.ts or import('phaser') lazy) so the game shell loads fast and Phaser caches separately. Measure before/after with a gzip report (npx vite build --report or compute gzip sizes) and record in docs/release-readiness.md: total gzip KB, first-load JS, count of requests. Target: initial JS meaningfully smaller than the current single 1.7MB chunk.
 3b. Preload the first city background (or title bg) via <link rel="preload" as="image"> in index.html so the first paint isn't waiting on a late image request.
 3c. Share/metadata polish in index.html: <title> already correct — add meta description, Open Graph tags (og:title, og:description, og:image pointing at a committed share image — reuse the title bg or scrapbook export style), twitter:card, theme-color, and an apple-touch-icon (reuse the existing app icon at 180x180). Also confirm the PWA manifest's icons include maskable + apple-touch sizes.
 DONE-WHEN: gzip report in docs/release-readiness.md shows the before/after; OG/meta tags verified in the live page source; preload present; theme-color/apple-touch-icon present.

ITEM 4 — CLOSE THE LAST "NEVER VERIFIED" ITEMS (HANDOFF §8), with evidence.
 4a. Keyboard: physically dispatch real keydown/keyup for F, J, K (and D again) via Playwright keyboard.press on the Rhythm scene with a live chart; assert hits register (score changes / judgement text appears) for each lane. F/J/K share code with D but prove it, don't assume it. Report per-key PASS/FAIL.
 4b. Hold-note rail: play a song with holds in slow motion (playwright clock or a slowed chart in dev), screenshot the rail mid-hold at 2-3 moments, confirm the rail grows from the head at the right rate and the hold grades correctly on release. Screenshot evidence to docs/polish-before-after/.
 4c. Cold-boot-into-Rhythm: load the built dist directly into the Rhythm scene (window.__game or a deep link in dev) without Title's unlock, confirm playAmbience no-ops gracefully (guard exists) and the song still plays/judges after a later unlock. Document the result.
 DONE-WHEN: per-key evidence table, hold-rail screenshots, cold-boot result — all recorded in docs/release-readiness.md; nothing silently claimed.

ITEM 5 — RELEASE CHECKLIST + THE HONEST END STATE.
 5a. Write docs/release-readiness.md — the single "is this done?" doc, containing:
    - The platform matrix PASS table (Item 1), the verification log (Item 4), the gzip/load numbers (Item 3).
    - The RELEASE CHECKLIST: (1) CI green on the release commit; (2) all 4 viewport profiles green; (3) real-device manual pass on ONE iPhone + ONE Android via the Vercel link (from docs/CROSS_PLATFORM_TESTING.md — the owner's 10-minute checklist: safe-area visuals, audio unlock, touch feel, haptics toggle, PWA install, offline reload, scrapbook export); (4) Capacitor wrap per CAPACITOR_PORT.md; (5) Play Console listing with the honest content rating (cozy, no mature content — the reality layer is not in this build).
    - The HONEST END STATE: what is verified vs what still needs a human/hardware; the content-depth scope note (run ~15-25 min vs 3-4h blueprint — owner's decision, not a defect); the still-deferred items (Part 3 reality layer, 5th+ city, Ambitious tag unreachable) — each with why.
 5b. Do NOT add analytics, achievements, leaderboards, localization, or any new system. This is a finish-and-prove pass.
 DONE-WHEN: docs/release-readiness.md complete and honest; everything it claims has an evidence trail in the repo.

FINAL VERIFY & SHIP:
 1. npm run typecheck && npm test — green (all existing + any new tests from Items 1/4 fixes).
 2. npx playwright test + --config=playwright.dist.config.ts — green at all 4 profiles.
 3. Deploy via git push (Vercel auto-deploys; confirm via list_deployments if unsure — do NOT race with a manual vercel deploy). curl live URL: 200 + title "Tour Life: International Dates". Confirm the OG/meta tags and theme-color in the live HTML; confirm the title theme file 200s.
 4. Zero console errors in a fresh-load pass of the live URL.

GUARDRAILS:
- No new cities, no Part 3 reality layer, no new systems, no engine/framework changes, no audio swap beyond the Title theme (Item 2).
- Accessibility + no-fail guarantees intact (re-verify the all-miss rhythm run after ANY RhythmScene change). Painted-world/code-drawn-UI rule kept.
- Match existing style; surgical changes; constants in src/const.ts; any new Scene array/Map/Set field resets in init(); any scene with a DialogueBox un-ducks music in its SHUTDOWN; never reintroduce fillGradientStyle in cached textures; node text stays <=40 words.
- Every claim needs evidence (screenshot, console log, CI link, gzip numbers). Anything unverifiable (real hardware) goes on the owner's checklist, not in the "verified" column.

FINISH with: files changed, per-item evidence (CI matrix table, title-theme wiring, gzip before/after, keyboard table, hold-rail screenshots, cold-boot result), release-readiness doc path, deploy verification, and the honest end-state list. State explicitly what still requires a human/device.
```
