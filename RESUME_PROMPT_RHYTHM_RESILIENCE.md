# RESUME PROMPT — Tour Life v3: Rhythm-Still-Dies — Texture-Failure Resilience + Intro-BG Triage

**Paste at the next session start. Context:** after the SW fix (d7e5bf9, live), minigames now work and the VN works, but the RHYTHM scene still "disappears immediately" on first rhythm entry (too fast to screenshot), and the NEW-GAME INTRO section shows a "weird background." All rhythm/crowd/stage asset FILES exist in the repo and all manifest entries exist (verified) — so the failure is a texture that fails to LOAD in production at runtime, and the scene hard-crashes on it. Do not re-investigate the SW (fixed). This pass: capture the error, make the rhythm scene resilient to any missing decorative texture, triage the intro background, and prove it with a resilience test.

---

```text
RHYTHM-STILL-DIES pass on "Tour Life: International Dates" (tour-life-v3, HEAD d7e5bf9 live).
Minigames now work (SW fix confirmed). The RHYTHM scene still dies instantly on first entry
("disappears immediately, too fast to screenshot"), and the new-game intro shows a "weird
background." All rhythm/crowd/stage asset files EXIST in public/assets/img/ and every key is
in public/assets/manifest.json (verified — do not re-check). The most likely mechanism:
one of the ~11 textures RhythmScene.create() adds (bg_rhythm_<city> + 10 crowd_<city>_m*_good/
bad) fails to LOAD at runtime in production (network 404, case-mismatch on Vercel's
case-sensitive hosting, or a transient failure), the key never registers in the texture
manager, and Phaser's add.image(key) THROWS "Texture key not found" — killing create() in the
same frame. The scene must be hardened so a missing decorative texture can NEVER kill it.

STEP 0 — CAPTURE THE LIVE ERROR (one shot, do not block the fix on it):
 Ask Jameson (or capture in Playwright against production with page.on('pageerror') +
 response/requestfailed logging): open the live URL fresh (ALL tabs closed first — the old
 worker can serve the stale manifest one final time), play to the first rhythm entry, and
 capture the FIRST console/pageerror text and any failed network request (requestfailed
 gives the exact URL that 404'd). Record it in the report. If the failed URL names a specific
 texture file, the fix is confirmed; if the error is not a texture error, adjust Step 1.

STEP 1 — TEXTURE-FAILURE RESILIENCE (the core fix; do NOT rely on Step 0):
 1a. src/ui/RhythmScene.ts create(): audit EVERY add.image()/addCoverBackground() call whose
     key comes from a manifest asset (stage bg, all 10 crowd figures, hit line, cue icons,
     lane textures). Before each, guard with scene.textures.exists(key) (or the existing
     hasRealAsset helper). On a missing key: fall back per-texture, never throw —
     stage bg -> the pre-existing navy/fallback background; a crowd figure -> skip that
     figure (or use the code-drawn silhouette crowd entirely when any real crowd key is
     missing — simplest: if hasRealCrowd, but any individual key is absent, fall the whole
     crowd back to silhouettes).
 1b. Do the same resilience sweep in MiniGameScene.ts (bg_mini_* keys) and any other scene
     that adds manifest-texture images (Title/intro, City backgrounds, Hub, HowToPlay) —
     a missing decorative texture anywhere must degrade, never crash.
 1c. src/ui/BootScene.ts: after loading the manifest, verify every key registered (a helper
     that checks game.textures.exists per manifest entry) and console.warn a clear list of
     MISSING textures (dev AND prod) instead of failing silently. Consider a tiny
     try/catch around each load failure so one bad file doesn't abort the loader queue.
 DONE-WHEN: RhythmScene boots and plays end-to-end even with a manifest entry deliberately
 missing (prove it — see Step 3); console lists missing keys loudly instead of dying.

STEP 2 — INTRO-BG TRIAGE ("weird background with intro section of a new game"):
 2a. Reproduce: fresh New Run on the live URL, screenshot the intro/opening section and the
     Title background at 390x844 + desktop. Compare against the repo's source assets
     (bg_title.webp, the opening/cast-faces scene textures, any code-drawn fallback).
 2b. Classify: (a) a missing-texture fallback rendering wrong (code-drawn gradient showing
     where painted art should — same class as Step 1, fixed by resilience + the missing-key
     console warnings), (b) the painted asset itself looking off (art issue — note it, don't
     regenerate unless asked), or (c) a transition/overlay artifact (the themed transitions
     are REVERTED — confirm no leftover themed overlay code still draws at scene start).
     Fix (a)/(c); report (b) honestly.
 DONE-WHEN: the intro/title renders the intended background with no mystery artifact, and
 the report classifies what the "weird background" was.

STEP 3 — RESILIENCE REGRESSION TEST (make it unrepeatable):
 3a. e2e/texture-resilience.spec.ts: (i) intercept/route-block ONE rhythm texture request
     (e.g. bg_rhythm_lisbon.webp or one crowd file) via Playwright route.fulfill 404 or
     route.abort, enter rhythm through the REAL city path, and assert: the scene boots,
     lanes/notes/HUD are visible, a note is judged, the song does NOT bail to Results before
     20s, zero pageerrors. (ii) Repeat blocking a minigame bg (bg_mini_*) and assert the
     minigame still plays. This is the test that would have caught the current bug.
 3b. Confirm the existing rhythm-entry.spec.ts (the never-started-song guard test) still
     passes — the two fixes are complementary (startTime guard prevents finish()-before-
     begin; resilience prevents create()-throw).
 DONE-WHEN: 3a passes with the texture blocked; full local suite green (Pixel 7, 2 runs).

STEP 4 — CI, DEPLOY, LIVE VERIFY:
 4a. Push; CI green on the full matrix (build-and-test + e2e, all profiles).
 4b. Deploy (confirm READY via list_deployments; do not race the CLI). CACHE_NAME already
     bumped — no SW change needed unless Step 1 touches public/ (it shouldn't).
 4c. Live verify in Jameson's exact order: ALL tabs closed -> fresh load -> New Run (intro
     background correct) -> first city -> first minigame -> first RHYTHM: assert the rhythm
     screen stays, notes fall, a real hit produces a real judgement, and Results shows a
     grade from actual hits. Capture the console clean (no pageerrors, no requestfailed for
     game assets). Screenshots as evidence.
 DONE-WHEN: live rhythm plays end-to-end with zero console errors, intro bg correct.

GUARDRAILS: no new cities, no Part 3 reality layer, no new systems, no audio changes, no
re-adding themed transitions; accessibility + no-fail intact (all-miss run still reaches
Results — re-verify after any RhythmScene change); painted-world/code-drawn-UI rule;
constants in src/const.ts; scene array/Map/Set fields reset in init(); DialogueBox scenes
un-duck in SHUTDOWN; no fillGradientStyle in cached textures; dialogue nodes <=40 words.

FINISH with: the Step 0 captured error (or the reason it couldn't be captured), the Step 1
per-callsite resilience list (each guarded site + its fallback), the Step 2 intro-bg
classification, the Step 3 test results (failing-then-passing with the texture blocked), CI
result, live-URL verification screenshots, and the honest remainder.
```
