# RESUME PROMPT — Tour Life v3: STABILIZE FIRST (revert to known-good, then verify)

**Paste this at the start of the next session. Read it fully before touching anything.** The game has regressed repeatedly since the themed-transition system landed: every reported bug since (transition race, stuck screens, "rhythm skips", "interface disappears", and now "all minigames and rhythm games load in, immediately disappear, then die") has been in or adjacent to that layer. **The strategy this pass is REVERT-TO-KNOWN-GOOD, not another layer of fixes.** The simple 250ms camera fade shipped for many passes without a single reported problem in these systems. Restore that, verify everything with real-input tests, redeploy. Polish can return later as an isolated, separately-tested feature.

---

```text
STABILIZATION pass on "Tour Life: International Dates" (tour-life-v3). The game is UNPLAYABLE
outside the visual novel: all minigames and all rhythm gameplay load in, immediately
disappear, then die; transitions and gameplay conflict. Do NOT add fixes on top of the
current transition machinery. REVERT it to the known-good simple path first, then verify.

KNOWN-GOOD STATE (verified from git history): before Addendum v2's Item 9, src/ui/transition.ts
was ~14 lines: goTo() = 250ms camera fadeOut to night-navy then scene.start(key, data);
fadeIn() = camera fadeIn. No themed overlays, no input blocker, no WeakSet single-flight, no
watchdog, no SHUTDOWN cleanup. That path shipped every rhythm song and minigame for many
passes with zero reported issues in these systems. The regression history since the themed
system: transition crash (fixed), "skips gameplay" (fixed), stuck screens (fixed), "interface
immediately disappears" (reported), and now everything outside the VN "loads in, disappears,
dies" (reported). Every one of those bugs lived in or adjacent to the themed-transition layer.

STEP 0 — STOP THE BLEEDING (do this FIRST, before any investigation):
 0a. git log to find the last commit where src/ui/transition.ts was the simple version
     (the parent of the Addendum-v2 themed-transition commit — verify via git log --oneline
     -- src/ui/transition.ts).
 0b. Revert transition.ts to that simple version (git revert or checkout the file from that
     commit and re-apply any NON-transition-related constants it depended on — check const.ts
     for W/H/PALETTE imports; the simple version only needs SCREEN_FADE_MS + PALETTE.night).
 0c. Sweep every goTo() call site (grep -rn "goTo(" src/): strip the { transition: 'card' |
     'lights' | 'drive' } opts so every call is the plain goTo(scene, key, data) — the
     themed calls were only added in the same Addendum v2 pass (CityScene lines ~274/405/442,
     MiniGameScene, HubScene). Keep the *line* text only where it was already part of the
     pre-themed data flow; discard the rest. Do NOT leave any call site passing transition
     opts that a reverted transition.ts no longer understands (TS strict will catch them —
     keep it compiling).
 0d. If reverting reintroduces a REAL stuck-screen (one specific, reproducible, pre-existing
     bug — not hypothetical), re-add ONLY that one guard (e.g. the input blocker) as a
     minimal patch WITH a failing-then-passing e2e test for that exact stuck state. Do NOT
     re-add the themed overlays, the watchdog, or the WeakSet. One guard maximum, test
     mandatory.
 DONE-WHEN: transition.ts is the simple version; typecheck clean; fullrun.spec.ts passes;
 and the game is playable end-to-end again (see STEP 2).

STEP 1 — THE 10 TROUBLESHOOTING QUESTIONS (ask Jameson / gather answers IN PARALLEL with
Step 0 — they bisect the trigger and may reveal a non-transition co-factor like a save or
an accessibility setting). The questions, verbatim, to ask in one message:
 1. Which device/browser does it happen on — iPhone Safari, Android Chrome, desktop, or all?
 2. Fresh first-time run (incognito/cleared data) or only after Continue/resume from a save?
 3. Does it change with accessibility settings — autoplay on/off, rhythm mode, wiggle room?
 4. First rhythm/minigame of the run, or also the 2nd/3rd (later cities)?
 5. After it "disappears," where do you land — black screen, back to Title, straight to
    Results, or frozen on the transition cover?
 6. Do you see the transition cover first (gold ring / card / light streaks) or does it
    vanish with no cover at all?
 7. Does audio keep playing after it disappears, or does everything go silent?
 8. Does it happen with deliberate single taps, or only when tapping fast / multiple times?
 9. Does refreshing the page recover it, or does it reproduce every single attempt?
 10. On desktop, open the console (F12) at the moment it dies and paste the FIRST error
     text exactly — it may name the exact failing call.
 Record the answers in the fix report; adjust STEP 2's repro list if an answer narrows it.

STEP 2 — VERIFY EVERY MECHANIC WITH REAL INPUT (the e2e suite proved CI-green while the game
was broken, so these must NOT be logic-bypass tests — real input only):
 2a. RHYTHM: returning-player path (hasSeenRhythmTutorial = true, no practice demo) — enter
     rhythm via CityScene preshow, assert: lanes/notes/HUD/city label visible within 3s; a
     note is judged; the song does NOT leave to Results before 20s; zero pageerrors. Then
     the same with autoplay ON. And the all-miss no-fail run still reaches Results.
 2b. ALL THREE MINIGAMES: Soundcheck (timing — real taps), Pack the Van (drag — real pointer
     down/move/up across the screen), Interview (choice — real taps). Each: enters, plays to
     its outro, returns to the VN at the correct phase, zero pageerrors. Repeat the 2nd
     minigame per city (the 2-per-city insertion — scene reuse must be clean).
 2c. TRANSITION LEAK DETECTOR: after every goTo in a full city loop, assert no interactive
     object at depth >= 500 survives the scene shutdown (with the simple transition there
     should be NO overlay objects at all).
 2d. If any of 2a-2c fails on the reverted path, the bug is NOT the transitions — investigate
     THAT system (rhythm arrangement ids / chart regeneration / miniGameScene state /
     manifest texture keys), reproduce-first, fix, test.
 DONE-WHEN: 2a-2c all green locally (Pixel 7 profile, 2 consecutive runs), 128+ unit green.

STEP 3 — LOCK IT IN:
 3a. Add the 2a-2c spec files to CI (they're in e2e/, the matrix picks them up).
 3b. Update docs/TESTING_PROCEDURES.md: gameplay-mechanic changes require real-input e2e;
     the themed-transition feature is DISABLED (documented as "reverted for stability;
     reintroduce only as an isolated feature with its own real-input tests").
 3c. Push; confirm CI green on ALL profiles (unit + e2e + dist).
 3d. Deploy: confirm READY via list_deployments (don't race the CLI with a manual deploy).
 3e. LIVE verify: play one rhythm song end-to-end (>=20s), play Pack the Van with real
     drags, enter a 2nd minigame, walk a city — zero console errors, screenshots as evidence.
 DONE-WHEN: CI green, live URL plays every mechanic, evidence committed.

GUARDRAILS: no new cities, no Part 3 reality layer, no new systems, no audio changes;
accessibility + no-fail intact; painted-world/code-drawn-UI rule; constants in src/const.ts;
scene array/Map/Set fields reset in init(); DialogueBox scenes un-duck in SHUTDOWN; no
fillGradientStyle in cached textures; dialogue nodes <=40 words; additive save schema only.

FINISH with: the revert diff summary, the 10-question answers (if provided) and how they
shaped the investigation, per-mechanic real-input test results (failing-then-passing), CI
result, live-URL verification, and the honest remainder. State plainly: the themed transitions
are OFF and why; what it would take to bring them back safely.
```
