# Tour Life: International Dates

**A cozy rhythm-adventure about an indie band's world tour — played as a diary, not a scoreboard.**

Play free in a browser: **https://tour-life-v3.vercel.app**
No install. No account. No ads. Works on a phone.

---

## The one-liner

> Four friends, four cities, one van. Play the shows, survive the drives, and find out what the
> band becomes. There are no wrong answers — only a different tour.

## The pitch

Most rhythm games are about being good at rhythm games. This one is about being in a band.

You name the group, pick why you're doing this at all, and take four people across Berlin, Tokyo,
Lisbon and Mexico City. Between the shows there's a van, a green room, a soundcheck that isn't
going well, and three people you have to keep talking to. When the lights come up you play the set
— tap the lanes as notes reach the gold line — and the crowd responds to how it actually went.

Then the tour moves on, and the towns remember you.

**Nothing you do can fail the run.** A missed note is not a penalty, it's a different night. The
score never gates the story. That's not an easy mode you toggle on — it's the design.

---

## What makes it different

### The town remembers you

Play a city once and it keeps a memory of that night — a triumph, a solid show, or a rough one.
Come back on the return leg and the room has changed. So has the internet: a social feed shows what
fans and detractors said about your first visit, and it reflects what actually happened, not a
generic template.

### The setlist moves on

Every city has two songs. The first visit picks one; **the return leg always plays the other.**
You are structurally never asked to perform the same song twice in the same city. Eight songs, 24
arrangements, 2,624 hand-charted notes.

### Every run draws material you haven't seen

Each city holds 7–8 relationship scenes and a run shows 2. The draw prefers scenes **you have never
been shown, across every previous playthrough** — so a replay is new writing, not a reshuffle. With
30 scenes and 2 per city visit, there's real headroom before anything repeats.

Everything is seeded from a shareable run seed, so a friend can play *your exact tour* — same route,
same weather, same setlist, same drives.

### The drive carries the last city with it

The van between stops isn't filler. Whoever changed the most since the last city is the one who
talks, and the opening line reflects how that last show actually went:

> *"Nobody has brought up Berlin. The not-bringing-it-up is taking a lot of effort."*

### Six kinds of hands-on, not one

Ten minigames across six interaction types — memory sequences, timing windows, sustained holds,
drag-and-drop load-ins, pressure-timed interviews, and dialogue under a clock. Three cities carry
the newer types; Mexico City deliberately keeps the originals so each place keeps an identity.

---

## The loop

```
Name the band  →  pick a genre and a reason for touring  →  meet the four of them
        ↓
   ROUTE PLAN — a seeded run through the city pool
        ↓
   ┌──────────────────────────────────────────────┐
   │  VAN — a drive that remembers the last city  │
   │  ARRIVAL — the city, its weather, its mood   │
   │  LOCATIONS — where you spend the afternoon   │
   │  RELATIONSHIP BEAT — two of seven, drawn      │
   │  MINIGAME — soundcheck, load-in, an interview │
   │  PRE-SHOW — how you want to play it tonight   │
   │  THE SHOW — the rhythm set                    │
   │  RESULTS — what the room gave back            │
   │  AFTER — the green room, the journal          │
   └──────────────────────────────────────────────┘
        ↓  (and later, the return leg — same cities, different night)
   TOUR SCRAPBOOK — one of six endings, plus an epilogue
```

A full run takes roughly **30 minutes**.

---

## Feature breakdown

### The band

Four bandmates — **Mira** (vocals, wants recognition), **Theo** (drums, wants rest), **Jun**
(guitar and production, wants sonic experimentation), and **Rowan** (bass, wants to be seen). Each
has a standing that moves with your choices, and later scenes unlock as you get closer to them.

Sixteen painted portraits — four faces across four moods — and the game picks the one that fits the
line being spoken. When the writing doesn't specify a mood, the line itself decides.

### The shows

- 4-lane rhythm charts with taps, holds, and choice cues you can answer mid-song
- Real recorded backing tracks for **all eight songs**, with a procedural fallback that keeps a
  show playable even if a track hasn't finished downloading
- Three arrangements per song, chosen by how you say you want to play tonight
- A live crowd that reacts as you play, and a results screen that shows the whole breakdown —
  `47 of 60 notes landed · Perfect 12 · Good 30 · Close 9 · Missed 6` — not just a letter
- Full combos are named outright

### The story

- **503 dialogue nodes**, roughly 20,000 words
- Multi-node conversation chains with branching choices
- Relationship arcs that gate later beats behind standing
- Tour promises you can make and then have to keep
- Six endings — found family, beloved small tour, breakout circuit, live album, next chapter, or a
  quiet ending — each with its own epilogue

### Between runs

Finishing a tour unlocks something for the next one: **six additional genres** on top of the four
you start with, and **ten decor items** for the van. Runs are recorded in a history you can look
back at.

### The Tour Scrapbook

Every run ends with a shareable record: the route you took, the songs you actually played (in
order, including the return leg), the souvenirs you collected, where each relationship landed, and
the ending you earned. Exportable as an image.

---

## By the numbers

| | |
|---|---|
| Cities | 4 — Berlin, Tokyo, Lisbon, Mexico City |
| Locations | 24 |
| Songs | 8, all with real recorded audio |
| Arrangements | 24 |
| Charted notes | 2,624 |
| Minigames | 10, across 6 interaction types |
| Dialogue nodes | 503 (~20,000 words) |
| Relationship scenes | 30 (2 drawn per city visit) |
| Endings | 6, each with an epilogue |
| Painted assets | 81 — 25 backgrounds, 16 portraits, 40 crowd sprites |
| Soundtrack | 6.47 MB across 9 tracks |
| Accessibility options | 15 |
| Automated tests | 194 unit + 86 end-to-end, across 4 device profiles |
| Run length | ~30 minutes |
| Price | Free |

---

## Accessibility is not a settings tab afterthought

Fifteen options, and the ones that matter most are on by default:

**Rhythm** — three difficulty modes, a wiggle-room window that widens timing without touching
scoring, easy scoring that raises point values without touching windows, a visual assist, a
metronome audio assist, per-device audio offset calibration, and full autoplay.

**No-fail cozy mode** — a shipped, default-on feature, not a concession. An all-miss run still
reaches the results screen and still moves the story forward.

**Motion and light** — reduced motion (every screen shake, particle burst and hitstop no-ops) and
a no-flash option.

**Reading** — adjustable auto-advance, skip-already-read-text, and a scrollback of every line
spoken so far.

**Audio** — split volume controls for music, effects and interface.

**Touch** — every interaction works by tap. Keyboard is optional, never required. Touch targets are
sized against a measured device scale, not assumed.

---

## Design principles

**No fail states.** Rhythm score never gates story content. Ever. An imperfect run produces a
different tour, not a worse one.

**One continuous world.** Every full-screen scene is painted art, not a color card. The stops
connect — the drive references the last city, the results room still sounds like the song you just
played.

**Seeded, not random.** A run seed reproduces the whole tour: route, weather, setlist, scene draws,
drives. Share a seed, share a tour.

**Additive saves.** Save data only ever grows. An old save opens in a new build.

**Everything is measured, not asserted.** Backgrounds are checked for seams numerically. Text
contrast is measured from actual rendered pixels against WCAG thresholds, not eyeballed.

---

## Under the hood

- **Vite + TypeScript (strict) + Phaser 3.90** — no framework, no React
- Content is JSON validated against a schema at load time
- Save state in IndexedDB with a localStorage fallback, versioned and validated
- Seeded RNG (mulberry32) — runs reproduce exactly from a seed string
- A service worker with network-first navigation and a network-first asset index, so a redeploy is
  never served stale — and full offline replay once cached
- Boot shows a real loading screen; the soundtrack loads in the background *after* the game is
  playable, so nothing waits on 6 MB of music
- Continuous integration runs the whole suite across four device profiles: iPhone 12, iPhone 14,
  Pixel 7, and a 360x740 Android viewport

---

## Who this is for

- People who like rhythm games but bounce off the ones that punish you
- Visual novel readers who want something to *do* between the talking
- Anyone who has been in a band, driven a van, or loaded a cab up two flights of stairs
- Players with 30 minutes and a phone
- People who replay things to see what else was in there

**Who it isn't for:** anyone looking for a hard rhythm challenge with a fail screen. That's a real
game and this isn't it.

---

## FAQ

**Is it really free?**
Yes. No ads, no accounts, no purchases, no email capture.

**Do I need to install anything?**
No. It's a web page. On iOS or Android you can add it to your home screen and it runs offline after
the first load.

**Is it hard?**
It cannot be failed. The rhythm sections have three difficulty modes plus autoplay, and the story
advances regardless of how you play.

**How long is a run?**
About 30 minutes. Runs save automatically and resume where you left off.

**What's the replay hook?**
A seeded route through the city pool, a different draw of relationship scenes each time — biased
toward material you haven't seen — a second song per city on the return leg, six endings, and
unlockable genres and van decor between runs.

**Can I share a specific tour?**
Yes. Every run has a seed. Enter someone else's seed to play their exact tour.

**Does it work offline?**
After the first load, yes.

---

## Marketing copy

**Taglines**
- Four friends, four cities, one van.
- A world tour you can hold in one hand.
- No wrong answers. Only a different tour.
- The rhythm game where the band matters more than the score.
- Play the shows. Survive the drives. Find out what you become.

**Short post (social)**
> Tour Life: International Dates — a cozy rhythm-adventure about an indie band's first world tour.
> Play the shows, survive the drives, keep four people talking to each other. No fail states: a
> missed note is a different night, not a penalty. Free in your browser, ~30 minutes a run.
> https://tour-life-v3.vercel.app

**Longer post**
> I made a game about being in a band rather than being good at rhythm games.
>
> You name the group, pick why you're touring at all, and take four people across Berlin, Tokyo,
> Lisbon and Mexico City. Between shows there's a van, a green room, and three people you have to
> keep talking to. When the lights come up you play the set.
>
> The towns remember you. Play a city badly and the return leg is different — different room,
> different crowd, and a social feed that reflects the night you actually had. Every city has two
> songs and the return leg always plays the other one.
>
> Nothing can fail the run. That isn't an easy mode, it's the whole design.
>
> Free, no install, works on a phone, about 30 minutes.

**Product Hunt tagline (60 char)**
> A cozy rhythm-adventure about an indie band's first world tour

**Elevator version**
> It's a visual novel with a rhythm game inside it, about a band on tour. Four cities, real songs,
> and a story that changes based on how the shows went — but never punishes you for playing badly.
> Free in a browser, half an hour a run.

---

## Status

**Live and playable.** All automated verification is green: 194 unit tests, 86 end-to-end tests
across four device profiles, and continuous integration passing on the deployed commit.

**Two checks remain open, and they're the honest ones:** a real-device pass on physical hardware,
and a fresh-eyes playtest with people who have never seen it. This project's history is blunt about
why those matter — every serious bug it has shipped was found by a person opening the link, not by a
green test suite. Details in `docs/RELEASE_GATE.md`, `docs/REAL_DEVICE_TESTING.md` and
`docs/FRESH_EYES_PLAYTEST.md`.

---

*Built by Bennett AI Solutions Inc. · Source: https://github.com/jamestown502502/tour-life-v3*
