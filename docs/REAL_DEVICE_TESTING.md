# Real-Device Testing — the owner's pass

**Why this exists:** nothing in CI runs on real hardware. The whole automated suite runs in a
headless browser that this project has repeatedly measured at ~4 frames per second, which has
produced false failures *and* false all-clears. Four separate "reproductions" this month turned out
to be the harness rather than the game, and the duplicate-dialogue bug could only be reproduced in
CI. Touch latency, real audio, PWA install, and how the thing actually feels in a hand are things
only you can check.

**Time:** ~25 minutes across two devices. **Do this on the live URL**, not localhost.

**Before you start:** close ALL tabs of the game first, then open it fresh. The service worker
serves the previous version to an already-open tab, and a stale manifest is exactly the kind of
false negative that has wasted a testing pass before.

**Live URL:** https://tour-life-v3.vercel.app

---

## Device A — iPhone (Safari)

| # | Check | PASS / FAIL | Notes |
|---|---|---|---|
| 1 | Loads to Title, art visible, no blank screen | | |
| 2 | Audio starts after your first tap (browsers require a gesture — expected) | | |
| 3 | Canvas is centred, nothing cut off at the edges | | |
| 4 | New Run → intro plays **once** (tap fast on purpose — this caught a real bug) | | |
| 5 | Intro, band creation, route screen all show painted art, not flat navy | | |
| 6 | Pick a tour promise; it reads back on the route screen | | |
| 7 | Van scene appears on the way into the first city | | |
| 8 | Minigame 1 — playable, you can finish it | | |
| 9 | Rhythm — **calibrate latency first** (Settings → audio offset) | | |
| 10 | Rhythm — notes fall, taps register, you can score a real hit (not all misses) | | |
| 11 | Rhythm — the backing track is audible and in time with the notes | | |
| 12 | Results → after-show → journal, no stuck screens | | |
| 13 | Return leg — the social feed appears, and mentions your first night accurately | | |
| 14 | Return leg — the song is **different** from the first night (check the label) | | |
| 15 | Scrapbook — epilogue reads correctly; "Save tour as image" produces a file | | |
| 16 | Add to Home Screen; launches standalone; plays offline after one load | | |

## Device B — Android (Chrome), mid-range if possible

Repeat 1–16. A mid-range phone matters more than a flagship here: the rhythm scene's timing and the
new backing-track sync are the things most likely to differ on slower hardware, and a cheap Android
is the closest thing to a worst case that you own.

| # | Check | PASS / FAIL | Notes |
|---|---|---|---|
| 1–16 | (as above) | | |
| 17 | Frame rate feels playable during rhythm (no visible stutter on falling notes) | | |
| 18 | Two-finger input works in "Hold the Mix" (both faders at once) | | |

---

## All six minigame types

Each appears in a specific city, so a single run will not show you all of them. Check them across
runs, or use a seed you have already seen.

| Type | Where | Playable? | Does the intro line teach the mechanic? |
|---|---|---|---|
| timing | Lisbon / Tokyo soundcheck | | |
| drag | Tokyo "Pack the Van", Lisbon "Load-In" | | |
| choice | Mexico City interview | | |
| **sequence** | Berlin "Modular Check" | | |
| **sustain** | Tokyo "Hold the Mix" | | |
| **pressure** | Lisbon "Live on Air" | | |

## Console check (desktop, F12)

Play one full city loop with the console open.

- [ ] Zero red errors
- [ ] No `MISSING textures` warnings from BootScene
- [ ] No failed network requests for game assets

---

## If something fails

Record: which device, which step number, what you saw, and whether it repeated on a second try.
A screenshot beats a description. If it is a rhythm or timing issue, note **how long you had been
playing** before it happened — session length was the hidden variable behind the worst bug in this
project's history, and no test found it because every test entered rhythm seconds after boot.
