# RESUME PROMPT — Tour Life v3: Share-Ready Finale (green CI, small remainders, redeploy, share checklist)

**Paste this ONCE — it is the final prompt of this engagement.** The game is functionally complete and live (a8e8db9). This pass: make CI fully green, close the two small honest remainders, run the share-readiness gate, redeploy, and hand Jameson a friends-and-family checklist. Keep it surgical — owner is at 31% session budget; do not gold-plate.

---

```text
Final pass on "Tour Life: International Dates" (tour-life-v3). The critical issues are fixed
and live. This pass makes the game SHARE-READY: fully green CI, two small remainder fixes,
a share-readiness verification, and a redeploy. NO new cities, NO Part 3 reality layer, NO
new systems, NO audio changes (title theme already shipped). Evidence-first; keep it tight.

VERIFIED STATE (do not re-check): HEAD a8e8db9 live; title theme public/audio/title_theme.mp3
exists; OG/meta/theme-color/apple-touch-icon present in index.html; code-split landed
(index-*.js + phaser-*.js vendor chunk); PWA manifest icons 192+512; CI matrix runs on push
(unit + e2e at 4 device profiles); last CI was 172 passed / 3 failed — all 3 = the SAME
timing flake in e2e/verification.spec.ts Item 4b ("hold-note rail renders and grades
correctly"), one per device profile, unrelated to gameplay.

ITEM 1 — MAKE CI FULLY GREEN (fix the 4b hold-note flake, the only failing test).
 Root cause class (known): the test asserts on real-time visual state (mid-hold rail
 screenshot) in a sandbox where requestAnimationFrame is unreliable — a timing race, not a
 game bug. FIX it deterministically, per the documented strategy (no hard sleeps / no real-
 time races): either (a) drive the scene's hold logic directly (call beginHold/finalizeHold
 on a known note and assert the resulting judgement + rail state) instead of racing real
 playback time, or (b) use Playwright's page.clock to advance time deterministically through
 the song, or (c) if the rail-screenshot itself is the point, gate it behind a generous
 retry-with-fresh-query that polls the scene clock (it already re-queries; make the
 assertion itself tolerant of clock drift by asserting on the NOTE's judged state, not the
 pixel). Do NOT delete the test or mark it skipped. Goal: the full matrix runs green at least
 2 consecutive times (local repeat + the CI run on this push).
 Also scan the other e2e specs for the same class of real-time assertion and harden any you
 find (same techniques). 
 DONE-WHEN: local full e2e suite green 2x consecutively; CI on this push green across all
 profiles (no failures at all).

ITEM 2 — CLOSE THE TWO HONEST REMAINDERS (small, surgical).
 2a. Mid-phase resume memory for locations/relationship: CityScene's locationsVisited and
     relationshipsPlayed are run-scoped (reset in init()) and NOT persisted — an
     interruption between two locations resumes the picker without memory. Fix additively:
     extend Progress with optional locationsVisited/relationshipsPlayed arrays (schema-
     additive, migrate-backfilled like dialogueNodeId), persist them in CityScene's phase
     transitions, restore on resume, clear after the phase completes. Add a unit test for
     the round-trip. Same pattern as the dialogueNodeId fix already shipped.
 2b. Interactive rollback/back button: ASSESS in <=15 minutes. If a clean per-node
     irreversibility audit is achievable quickly (back re-renders the previous pure-dialogue
     node WITHOUT re-applying effects; hard-blocked past choices/minigame outcomes/rhythm
     results with a "can't go back past a choice" toast; the backlog "≡" toggle already
     covers review), implement the minimal version. If the audit reveals any city content
     where "back" could corrupt state, STOP and document the deferral in HANDOFF.md's
     remainder section instead — a rushed rollback is a worse bug than no rollback. The
     player-facing complaint is already addressed by the backlog + exact-line resume.
 DONE-WHEN: 2a landed + tested; 2b either landed with tests OR explicitly deferred with the
 audit's reason written down. Either outcome is acceptable and honest.

ITEM 3 — SHARE-READINESS GATE (prove the link is safe to hand to friends/family).
 3a. Fresh-profile first-run pass (Playwright, new incognito context, no IndexedDB): open
     the URL -> How to Play auto-opens -> dismiss -> New Run -> BandCreator -> RoutePlan ->
     Hub -> one full city (arrival -> minigame -> 2 locations -> relationship -> preshow ->
     rhythm song played to completion -> Results -> afterShow/journal) -> next city or wrap
     -> Scrapbook. Assert: zero console errors/pageerrors the entire way; no skipped
     gameplay; dialogue advances correctly; every button tappable. Run at desktop AND one
     phone viewport (Pixel 7). Capture the run as evidence (screenshot at each screen or a
     console log assertion).
 3b. Link-preview check: verify the og: tags produce a correct preview (title "Tour Life:
     International Dates", description, og:image 200s, theme-color present) — either via
     inspecting the live HTML or a link-preview service. The URL must look intentional when
     pasted into iMessage/X/WhatsApp.
 3c. Share-feature sanity: Title shows "Today's Tour" seed; scrapbook "Save tour as image"
     exports a real PNG; title theme plays after first tap and ducks correctly; PWA
     install prompt works (manifest + SW); offline reload after first visit shows the shell.
 3d. WRITE docs/FRIENDS_AND_FAMILY_CHECKLIST.md — Jameson's own 5-minute real-device pass:
     (1) on iPhone Safari + one Android Chrome, open the live URL; (2) tap through one city
     incl. a rhythm song; (3) confirm centered canvas, audio after first tap, no stuck
     screens; (4) add-to-home-screen optional; (5) what to tell testers: "tap to advance,
     no wrong answers, tap notes as they reach the gold line". Keep it to one page.
 DONE-WHEN: 3a-3c verified with evidence (fresh-profile console-clean log, og: preview,
 export PNG, theme audible); 3d committed.

ITEM 4 — REDEPLOY + CONFIRM (the "get ready to share" step).
 4a. git push (Vercel auto-deploys). Confirm via list_deployments or the dashboard that the
     new commit reached READY/production (do NOT race it with a manual vercel deploy).
 4b. Verify the LIVE url: curl 200 + title tag correct; the deployed asset hash matches the
     local build (index-*.js / phaser-*.js filenames); zero console errors on a fresh load;
     one screenshot of the live Title screen as final evidence.
 4c. Confirm CI green for THIS push (all profiles), then report the final tally
     (unit/e2e/dist counts, all green) so Jameson has the "share it" green light in one line.

GUARDRAILS: no new cities, no reality layer, no new systems, no audio changes; accessibility
+ no-fail intact (all-miss run still reaches Results); painted-world/code-drawn-UI rule;
constants in src/const.ts; scene fields reset in init(); DialogueBox scenes un-duck in
SHUTDOWN; no fillGradientStyle in cached textures; dialogue nodes <=40 words; additive save
schema with migrate() backfill only.

FINISH with: CI result (green x2 local + CI), 2a/2b status (landed or deferred-with-reason),
share-gate evidence (fresh-profile log, og: preview, export PNG, theme), live-URL
verification, FRIENDS_AND_FAMILY_CHECKLIST.md path, and a single "READY TO SHARE: yes/no"
verdict with the exact URL.
```
