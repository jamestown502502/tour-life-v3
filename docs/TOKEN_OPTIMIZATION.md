# Token Optimization — Working With Claude on This Repo

Concrete, repo-specific practices for keeping a Claude Code session's token spend down without
losing the evidence-first standard this project runs on. Written from this session's own
experience — the parts that genuinely helped, not generic advice.

## 1. One focused task per prompt, with the file/line already named

"Fix the canvas centering issue in `src/main.ts`'s Phaser scale config — `index.html`'s `#app` is
a flex container, check whether `autoCenter` is fighting it" gets fixed in one pass with minimal
re-exploration. "Fix everything that's wrong" forces a full-repo re-orientation before any actual
work starts — the same investigation this session already did once gets partially redone. If you
already know (or suspect) where a bug lives, say so; it's the single highest-leverage thing you
can hand over.

## 2. Ask for git-diff-scoped reports, not full-file dumps

A final report built from `git diff --stat` + the specific hunks that matter reads faster for you
and costs less to generate than a full-file recap of every changed file. This session's own
before/after docs already follow this pattern (naming files + quoting the specific changed logic,
not pasting whole files) — asking for that explicitly up front saves a round-trip.

## 3. Run `/compact` after each completed, independent part of a larger ask

When a request has real phase boundaries (verify issue A → fix issue B → write doc C → write doc
D, as this session did), compacting between phases keeps the context a later phase needs small —
the fix for the centering bug doesn't need the full investigation transcript for the rhythm-skip
bug still in context once both are done and committed.

## 4. Don't switch models/providers mid-session

Prompt caching is keyed to the exact model; switching loses the cached context and every
subsequent turn re-pays the full context cost. If a session is using Sonnet, stay on Sonnet for
that session's duration — start a fresh session (not a mid-stream switch) if a different model is
actually needed for a specific reason.

## 5. Run the one new/changed spec locally before the full matrix

A single `npx playwright test <file>.spec.ts --project="Pixel 7" --workers=1` run (one profile,
one file) is a fraction of the cost of the full 4-profile × 6-file matrix, and catches the large
majority of real bugs just as well during iteration. Reserve the full matrix for the actual
pre-push/pre-deploy verification, not every intermediate check while a fix is still being
tightened — this session ran the full matrix twice total across two commits, not once per
iteration of the transition-crash investigation that preceded them.

## 6. Commit per fix, not one giant commit at the end

Each verified, working change (the centering fix, the resume-node fix, a specific test) as its
own commit means a future session can run `git log --oneline` + `git show <sha> --stat` to
understand what happened without re-reading a sprawling diff — and it means if something needs a
targeted revert, it's targeted. This session's own commit history (e.g. `0fccc57` for the main
pass, `e55455e` specifically for the crash fix found during its own verification) is the actual
audit trail future sessions read from `[[project_tour_life]]`'s memory notes.

## 7. Narrow reads before the full DESIGN.md

`HANDOFF.md`'s relevant section + the specific files a task touches is almost always enough
context. The full `DESIGN.md` blueprint is a last resort for genuinely open design questions
(e.g. "should Part 3 exist"), not a default starting read for a bug-fix session — most fixes need
the *current, as-built* behavior (HANDOFF.md, or just the code itself), not the original
aspirational design doc.

## 8. Batch evidence collection into one call

Gathering several screenshots, a console-error check, and a network-request check as one combined
step (or as close together as the tool surface allows) beats issuing them one at a time across
separate turns — each tool round-trip has fixed overhead independent of what it returns. This
session's own live-verification passes (screenshot + console-error check + a scene-state read, in
close sequence) are the pattern to keep using.

## What this session specifically got wrong, worth naming

Two timeout increases (5s → 15s → 60s) chasing what turned out to be a genuine crash, not slowness
— each retry cost a full test run (minutes of wall-clock, plus the context to reason about the
result) before switching to actually reading the thrown exception. The cheaper move, in hindsight:
instrument `page.on('pageerror')` (or equivalent) on the *first* unexplained "stuck" symptom,
before trying a second timeout value, not after the second one also fails to help.
