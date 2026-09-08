# Tour Life v3 — Symptom Report & Redeploy Recommendation

**Date:** 2026-09-08
**Context:** Jameson's live-play report of mini-game and rhythm failures, now clarified with the landing state.

---

## 1. Formal symptom statement

A live play session reported that the **first minigame and the first rhythm game both failed back-to-back**. The clarified landing state is:

- After the rhythm section, the run **did not freeze and did not skip to a broken screen** — it landed on a **bad grade** and advanced to the next city.

This is materially different from the previously suspected "frozen on transition cover." The game's no-fail design is structural: **every path through rhythm/minigames advances the run**, with degraded outcomes when notes are missed. That means a broken rhythm system reads to the player as *"you played badly"* — indistinguishable from *"the game didn't register my input."*

### What this rules out
- **A hard freeze / dead cover** (starved-clock theory): not observed. The run continues.
- **A skipped transition**: the sequence played to Results and advanced — the pipeline completed.

### What this points to (candidate mechanisms, in suspicion order)
1. **Song ending early (empty or truncated arrangement)** — `finish()` fires when `t > longestNoteEndSeconds() + 1.5`. If the arrangement's notes are empty or its last note timestamp is tiny (chart regeneration drift, or a storyGate arrangement id referencing a missing/broken chart), the song ends almost immediately, every note auto-misses, and the result is a bad grade. **This produces exactly "fail → bad grade → next city" with no input involved.**
2. **Input not registering on lanes** — hit zones too small at the phone scale, or an invisible interactive overlay eating taps (transition-blocker class). All-miss → bad grade → advance.
3. **Timing/clock skew on the play device** — notes judged as misses because the fall timing or the song duration is off (the same clamped-frame-delta clock issue, but manifesting as mis-timed judgement rather than a frozen cover).

### The question that discriminates (must be answered)
> **Did the rhythm section play for roughly its full length (~55–65 seconds) while you missed everything, or did it end almost immediately (a few seconds) after it started?**

- *Ended almost immediately* → mechanism #1 (empty/truncated chart). Check `pickArrangement`'s fallback and the storyGate arrangement-id ↔ chart existence mapping; add a content assertion that every referenced arrangement has a non-empty `notes[]`.
- *Played full length, everything missed* → mechanism #2/#3 (input registration or clock skew). Check the lane hit zones at the device's effective scale and the `audioOffsetMs`/clock behavior on the failing device.

Also confirm: **did the minigame similarly play to an outcome, or end instantly?**

---

## 2. Recommendation on redeploy

**Do not redeploy the current working tree as-is.** The revert (transition.ts 168→29 lines) is the correct stability move and should ship — but it is *not yet committed*, and more importantly it does **not** address the mechanism behind this specific symptom. Shipping the revert alone risks another "still broken" report.

**Recommended sequence:**

1. **Complete the revert commit** (the working tree already has it: transition.ts back to the simple 250ms fade, themed opts stripped from all 4 call sites, typecheck clean).
2. **Answer the discriminating question** (full-length play vs instant end) — this determines which mechanism to chase. If Jameson can't answer from memory, the fastest path is one targeted repro on his device (or a Playwright run on a slow-emulated profile) that records: song duration actually played, notes judged vs auto-missed, and any console error.
3. **Fix the actual mechanism, not the transition layer** — per the discrimination above:
   - If instant-end: harden `pickArrangement` to always fall back to a non-empty default arrangement, add a dev warning + content.test.ts assertion for every storyGate arrangement id, and add an e2e that enters rhythm via the real city path and asserts the song plays ≥20s with notes judged.
   - If full-length-all-missed: reproduce input registration at the failing viewport, check hit zones and any lingering interactive overlay, and add a real-input e2e (actual pointer taps on lanes, asserting a judgement other than miss).
4. **Run the full CI matrix** (unit + e2e at all 4 device profiles) — green across profiles, not just locally.
5. **Deploy and verify live in the exact order Jameson plays**: New Run → first city → first minigame (play it to completion) → first rhythm (play it to completion, confirm a real grade from real hits) → confirm the run advances with a *representative* outcome, not an auto-miss one.
6. **Only after that live pass is clean** consider restoring the themed transitions as an isolated, separately-tested feature (documented in TESTING_PROCEDURES.md) — or leave them off; stability beats polish.

**What not to do:** do not ship the revert alone and call it done; do not add another guard/overlay on top of the current machinery; do not mark this resolved on a green CI without a live playthrough matching Jameson's play pattern.

---

## 3. Immediate follow-up to Claude (paste after it finishes the current run)

```text
Jameson reported the clarified landing state: the first rhythm game ends in a BAD GRADE and
advances to the next city — no freeze, no broken screen. That rules out the frozen-cover
theory and points at either (1) the song ending early via an empty/truncated arrangement
(pickArrangement fallback or a storyGate arrangement-id mismatch), or (2) input not
registering on the lanes (hit zones / lingering interactive overlay), or (3) clock skew
mis-judging hits.

BEFORE committing the revert: determine which mechanism by checking whether the first song
plays ~55-65s with everything missed, or ends almost immediately. Add the discriminating
evidence (song duration actually played, judged-vs-missed counts, console errors) to the
report. Then fix the actual mechanism with a real-input e2e (rhythm via the real city path
asserting >=20s of play with notes judged), run the full CI matrix, deploy, and verify live
in Jameson's exact play order: first city → first minigame → first rhythm → representative
outcome, not auto-miss.
```
