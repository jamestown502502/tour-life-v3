# Tour Life v3 — Final Polish Insights & Close-Out (Pre-Public)

**Date:** 2026-09-08 · **Live:** https://tour-life-v3.vercel.app
**Grounded in:** the before/after doc + 4 final research rounds (launch checklists, playtesting best practices, real-device testing, accessibility standards — cited inline).

---

## Part 1 — Where the game is (the honest launch position)

**Genuinely near-done:** 162 unit tests, full 4-device CI matrix green, return leg with social feed, 6 minigame types, three-beat scenes with a working back button, relationship arcs, van beats, tour promises, regenerated backdrops, a written launch kit. **This is the strongest state the game has been in.**

**The three named remainders, triaged:**
| Remainder | Verdict |
|---|---|
| Arc = 1 gate, not 3 stages | **Ship as-is.** The mechanism exists; more stages is pure content, a post-launch add. Not a blocker. |
| New minigames in 3 cities, not 4 | **Ship as-is.** Mexico City's original three are a deliberate identity choice. Not a bug. |
| 3 backdrops not eyeballed | **Close it — 10 minutes.** The identical corrected prompt produced them; a full-size eyeball per city is the one real QA gap left in this list. |

**The real remaining risk is not code — it's the two things no automated test can do:** real-device behavior and fresh eyes. The project's own history proves it: the clock bug hid for weeks because every test entered rhythm seconds after boot; the harness can't reproduce production. The close-out is built around exactly those two gaps.

## Part 2 — Final polish suggestions, per pillar (verify-don't-build)

**Research basis:** Snoop Game + presskit.gg launch checklists (functionality → performance → compatibility, freeze features, final QA before publish); firstlook.gg + r/gamedev playtesting (observe without leading questions, note spontaneous struggles, structured forms, "reward participation and quality, never positivity"); TestMu/qawerk (cover ≥1 device per major manufacturer incl. a mid-range Android); WCAG + Access-Ability 2025 (verify the shipped accessibility set on real hardware; high-contrast, reduced motion, custom difficulty are the 2025 baseline — this game already ships most of it).

**Rule: nothing here is a new feature. Every item is a verification or a 30-minute fix.**

1. **Feature freeze.** The launch kit is written; adding anything new now risks the exact regression cycle this project just escaped. Tag the current commit `release-candidate`. The only code changes allowed before public: the 3-backdrop eyeball fix (if it reveals an issue) and blocker bugs from real-device/fresh-eyes testing.
2. **First impression / FTUE (verify):** fresh profile → auto How-to-Play → New Run → band creator → night-before → route promise. Does the first 60 seconds read as intentional? Screenshot each step; if any step stalls or confuses, fix the copy/flow — this is what a new player's "should I stay?" decision is made on.
3. **VN (verify):** the back button is now reachable (chains ≥2 post-choice) — verify it appears in real play and restores the prior line without re-applying effects; backlog reachable; autoAdvance/skipReadText defaults feel right.
4. **Minigames (verify per type):** all 6 types — each intro line teaches the mechanic ("am I doing this right?" test). The 3 new types (sequence/sustain/pressure) have never been felt on a real device — that's the feel check.
5. **Rhythm (verify on device):** latency calibration + tap-sound toggle exist — on a real phone, calibrate once and play a song; the audio-vs-touch offset is exactly what calibration fixes and only a real device exposes it. Per-difficulty lead feel.
6. **Transitions (verify):** post-revert plain 250ms fade everywhere, no themed remnants; smooth on a mid phone (the starved-clock lesson — simple fade degrades gracefully).
7. **Accessibility (verify the shipped set live):** reducedMotion, noFlash, autoplay, wiggle room, easy scoring, visual assist, metronome, split volumes, contrast (the text-fit gate + contrast audit are in CI — verify the live feel). 2025 baseline is high-contrast + reduced-motion + custom difficulty; this game meets or exceeds it.
8. **The launch link itself (verify):** OG tags/title/description/image live and previewable in iMessage/X/WhatsApp; PWA installs on a real phone; offline works after one load; scrapbook PNG export works on a real device.

## Part 3 — How to test it (the two gaps + the gate)

**Gap 1 — real devices (the single most missing verification):** a structured on-device pass on the owner's iPhone + one Android (ideally mid-range): full run (band creator → route → promise → 4 cities + return leg → scrapbook → epilogue), all 6 minigames, one calibrated rhythm song, PWA install + offline, share-preview, scrapbook export, zero console errors. Documented as a checklist the owner can actually run.

**Gap 2 — fresh eyes:** 3–5 people, blind (no hints, no leading questions), structured form:
- First impression (first 60 seconds): confusing / clear / delightful?
- Where did you get stuck or want a "back" that wasn't there?
- What did you want to do that you couldn't?
- Did the rhythm feel fair? Which minigame confused you at first?
- Would you play again / share it? (Yes/Maybe/No + why)
Rule per the research: **reward participation, never positivity.** Triage: fix blockers before public; log non-blockers for post-launch. This is what catches "missing things" that no test can.

**The release gate:** a checklist doc that must be fully green before the URL is shared publicly: CI green on the release candidate · 3 backdrops eyeballed · real-device pass done · fresh-eyes feedback triaged (blockers fixed) · launch link verified · feature freeze in effect.

---

# RESUME PROMPT — paste this to Claude Code for the final close-out

```text
FINAL CLOSE-OUT before public release of "Tour Life: International Dates" (tour-life-v3).
The game is feature-complete: 162 unit tests, full CI matrix green, return leg + social feed,
6 minigame types, launch kit written (BAIS_TourLife_BeforeAfter_PublicRelease_20260908.md).
This pass: feature freeze, close the 3-backdrop eyeball gap, write the real-device + fresh-eyes
test protocols, verify the per-pillar checks, verify the launch link, and produce the release
gate verdict. NO new features, NO new systems, NO new content beyond fixing a backdrop if the
eyeball finds an issue. Keep it lean and evidence-first.

STEP 1 — FREEZE + CLOSE THE REMAINDERS:
 1a. Tag the current HEAD release-candidate (git tag + push). From this commit on, the only
     allowed changes before public are: the backdrop eyeball fix and blocker bugs from the
     real-device/fresh-eyes passes.
 1b. Eyeball the 3 unexamined rhythm backdrops (lisbon, mexico_city, berlin) at full size in a
     browser — one continuous room per city, no hard seams (Tokyo was already confirmed). If
     any shows seams/zones, regenerate via the corrected prompt (the one that never mentions
     thirds/bands/top/bottom) and re-measure seam positions. Screenshot all 4 as evidence.
 1c. Confirm the themed-transition revert is complete: grep for transition:'card'/'lights'/
     'drive' / buildThemedOverlay / TransitionType across src/ — zero remnants (the plain
     250ms fade is the only transition).
 DONE-WHEN: release-candidate tag pushed; 4 backdrops verified with screenshots; no themed
 remnants.

STEP 2 — REAL-DEVICE TEST PROTOCOL (the #1 missing verification):
 2a. Write docs/REAL_DEVICE_TESTING.md — a structured checklist the owner runs on their
     iPhone + one Android (mid-range if available): fresh load (ALL tabs closed — the old
     service worker can serve the stale manifest once), full run (band creator -> route ->
     promise -> 4 cities incl. return leg with social feed -> scrapbook -> epilogue), all 6
     minigame types played to completion, one rhythm song AFTER using the latency calibration
     (confirm the offset fixes feel), PWA install (add-to-home-screen), offline reload after
     one load, share-preview of the URL in iMessage/X/WhatsApp, scrapbook PNG export, zero
     console errors (how to open the console on each device). Keep it to ~2 pages, copy-paste
     usable, with a PASS/FAIL column per item.
 2b. Add a "report back" section: the owner pastes the PASS/FAIL list + any console errors.
 DONE-WHEN: the doc exists and is committed; you cannot run it yourself (no hardware) — it is
 the owner's checklist, stated honestly as such.

STEP 3 — FRESH-EYES PLAYTEST PROTOCOL:
 3a. Write docs/FRESH_EYES_PLAYTEST.md — the protocol + feedback form for 3-5 blind testers:
     the exact 5 questions (first 60s impression; where did you get stuck / want a back;
     what did you want to do that you couldn't; did the rhythm feel fair / which minigame
     confused you first; would you play again or share it — yes/maybe/no + why). NO hints, NO
     leading questions, observe-don't-teach. Reward participation, never positivity.
 3b. Include a triage rule: blockers (game can't be played/enjoyed) get fixed before public;
     non-blockers logged for post-launch in a PLAYTEST_TRIAGE.md.
 DONE-WHEN: the protocol + form are committed and shareable as-is.

STEP 4 — PER-PILLAR VERIFICATION (each = screenshot + one-line result, no building):
 4a. FTUE: fresh profile -> auto How-to-Play -> New Run -> band creator -> night-before ->
     route promise; screenshot each step; any stall/confusion = fix the copy/flow (small
     change only).
 4b. VN: back button appears in real play (chains >=2 post-choice) and restores the prior line
     without re-applying effects; backlog reachable; autoAdvance/skipReadText sane.
 4c. Minigames: each of the 6 types — intro line teaches the mechanic; play each to
     completion; screenshot each.
 4d. Rhythm: latency calibration path + tap-sound toggle functional; a real song plays >=20s
     with notes judged; grade from real hits (not auto-miss).
 4e. Transitions: plain fade at every seam, no dead frames, smooth on an emulated mid phone.
 4f. Accessibility: reducedMotion, noFlash, autoplay, wiggle room, easy scoring, visual
     assist, metronome, split volumes — each toggles and visibly does its thing; contrast
     (the text-fit gate + contrast audit are in CI — spot-check live).
 DONE-WHEN: per-item evidence (screenshot + result) in the final report; only the small fixes
 listed above allowed.

STEP 5 — LAUNCH LINK VERIFICATION:
 5a. Live URL: curl 200 + title "Tour Life: International Dates"; OG tags (og:title,
     og:description, og:image) present and the image 200s; theme-color; apple-touch-icon;
     manifest.webmanifest 200; sw.js serves the current CACHE_NAME.
 5b. Fresh-profile full run on the live URL (devtools clean console): boot -> onboarding ->
     first city -> minigame -> rhythm -> return leg social feed -> scrapbook export (PNG
     downloads). Screenshot the scrapbook export.
 DONE-WHEN: the link previews correctly and a fresh-profile run is console-clean.

STEP 6 — RELEASE GATE + VERDICT:
 6a. Write RELEASE_GATE.md: the checklist that must be fully green before the URL is shared
     publicly (CI green on release-candidate; 4 backdrops verified; REAL_DEVICE_TESTING done;
     FRESH_EYES triage done with blockers fixed; launch link verified; feature freeze in
     effect; the honest deferred list: arc stages, 4th-city minigames, Part 3 reality layer,
     5th+ city — each with why).
 6b. Push the release-candidate + docs; confirm CI green on the full matrix; confirm the live
     URL is serving the release-candidate commit.
 6c. Final verdict in one line: "READY TO SHARE: yes/no" with the URL and the gate checklist
     status.

GUARDRAILS: NO new features/systems/content (except backdrop fixes + the small FTUE copy
fixes); no Part 3 reality layer; no audio changes; accessibility + no-fail intact; painted-
world/code-drawn-UI rule; the themed transitions stay OFF. Evidence-first: every claim needs
a screenshot, console log, or CI link; anything you cannot verify (real devices, fresh eyes)
goes on the owner's checklist, never in the "verified" column.

FINISH with: release-candidate tag + CI result, 4-backdrop evidence, both protocol docs,
per-pillar verification table, launch-link proof, RELEASE_GATE.md, and the one-line verdict.
```
