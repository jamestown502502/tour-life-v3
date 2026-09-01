# Tour Life: International Dates — Build Rules

## Project
Cozy rhythm-adventure. An indie band's world tour as a playable diary. Every run: a seeded
route through a city pool, branching dialogue, expressive rhythm performances, a shareable
Tour Scrapbook ending. No hard fail states — imperfect choices produce a different story,
never a worse score. Phase 1 (this build) covers the cozy core loop only; the "reality layer"
(Wellbeing/Groundedness/Vices/Body-wear/Return Home epilogue — see DESIGN.md Part 3) is an
explicitly deferred phase 2, not yet implemented.

## Key rules
- Stack: Vite + TypeScript (strict) + Phaser 3. No React/Next.
- ALL art code-drawn via Graphics + generateTexture (src/art). No image files.
- ALL audio via Web Audio API (src/core/audio.ts). No audio files.
- Content = JSON in /content, validated against content/schema.ts at load.
- Constants (W/H/palette/timing) ONLY in src/const.ts. Never import from main.ts (circular deps).
- Save: IndexedDB + localStorage fallback, schemaVersion v1, validated on load.
- Seeded RNG (mulberry32) — runs reproducible from seed string.
- Touch-first: every interaction works by pointer/tap; keyboard optional.
- Rhythm score NEVER gates story. No-fail cozy mode is a shipped feature.
- Accessibility: visual assist, metronome, wiggle room, easy scoring, autoplay, no-fail,
  volume splits, reduced motion, no-flash. Non-negotiable.
- Changes: one system at a time; run tests + bot playtest; keep schemaVersion migration path.
- DoD: typecheck clean · tests green · bot playtest no softlocks · content validates ·
  save schema validated · golden path exercised · live deploy verified.

## Reference
Full PRD: `DESIGN.md` (blueprint) at repo root.
