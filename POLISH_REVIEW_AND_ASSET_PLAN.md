# Tour Life v3 — Polish Review & Real-Asset Plan

**Date:** 2026-09-01
**Author:** Hermes (BAIS)
**Repo:** tour-life-v3 (jamestown502502)
**Supersedes:** nothing — this is a review of HANDOFF.md (v2) + the plan for the next build pass.

---

## Part 1 — Review of HANDOFF.md (v2, post-polish)

**Verdict: the polish pass was excellent engineering, and it proves the ceiling has been hit — the remaining gap is assets, not code.**

What's genuinely great in the current build (verified in the handoff + source):

- The 8-phase polish pass fixed the *presentation layer* that code can fix: real typography (Baloo 2 / Nunito, self-hosted), a depth/shadow UI system, full character-bust portraits, layered backgrounds with vignette + ambient particles, real hold-note scoring, working ambience + ducking, measured touch targets. That's real, shipped work — 37/37 tests, 12 documented bugs with root causes.
- The two "invisible bug" catches (bug #8 gradient transparency, bug #9 music never playing) are exactly the kind of thing that sinks a game silently. The runbook for the Vercel git-identity block (#11) is the single most valuable ops note in the file.
- The architecture decision that matters for THIS plan: **every `ensureX` texture function in `src/art/sprites.ts` checks `scene.textures.exists(key)` and early-returns.** That was designed for swap-in and it's exactly right. Real assets slot in under the same string keys; code-drawn becomes the automatic fallback. No re-architecting needed.

**The honest diagnosis of "it still looks ugly":**

The game is now a *polished* code-drawn game — but it's still **code-drawn**. Geometric fills, gradient bands, silhouette rows, shape-built faces. No texture, no light, no illustration richness. There is a hard aesthetic ceiling to procedural vector shapes, and this build is at it. Every ship-able game in this genre that "looks good" (Melatonin, Spiritfarer, Coffee Talk) uses **real painted assets**. The polish pass was phase A–F of the plan; **Phase G (the real-asset pass) is what actually moves the needle from "prototype-clean" to "beautiful."** It was skipped by instruction — now it's the assignment.

---

## Part 2 — The Real-Asset Plan (Phase G, activated)

### 2.1 Proven, verified — do not re-litigate

The full pipeline is installed and **just proven live** in this session:

- Tools verified present: `generate_image.py` (Gemini, backgrounds/general art), `generate_sprite.mjs` (transparent character sprites + `verify`), `generate_music.mjs` (Lyria).
- All three keys (`GEMINI_API_KEY`, `TRIPO_API_KEY`, `ELEVENLABS_API_KEY`) confirmed `SET`.
- **A live probe was generated and validated this session** (see below) — one-shot, correct style, no artifacts. The style direction works.

**Probe (style anchor — commit this into the repo):**
`docs/asset-probes/lisbon_bg_probe.png` — 848×1264, soft-gouache cozy Lisbon street at golden hour, warm amber/terracotta palette matching the game's `PALETTE`, no text, no distortion. This is the target look for every generated asset. Reuse its style block in every prompt.

**Key gotcha discovered (write this down):** the API keys live in the **Windows user environment**, not the shell env. `env | grep GEMINI` comes up empty. Load them with:
```bash
KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')")
```
and pass `--api-key "$KEY"` (or export it). Also: pass **native Windows paths** (`C:/Users/...`) to native tools — MSYS `/c/...` paths fail on spawn.

### 2.2 The swap-in mechanism (the seam — one design decision)

Real assets load into Phaser's texture manager **under the exact same keys** the code-drawn functions use. Because every `ensureX` function already does `if (scene.textures.exists(key)) return;`, a real texture wins and code-drawn never runs; a missing file falls back to code-drawn automatically.

**Implementation (small, surgical):** add a tiny asset-loading step that runs once at boot, *before* any scene renders:

1. Read a manifest (`public/assets/manifest.json`) listing `{ key, file }` pairs.
2. In `main.ts` boot (alongside `waitForFonts()`), `new Phaser.Loader` → load each image → `game.textures.addImage(key, tex)`.
3. Scenes then call `ensureX(...)` as they do today; the early-return does the rest.

Key inventory (the exact keys to emit in the manifest):

| Texture key | Source today | Asset to generate |
|---|---|---|
| `bg_title` | `ensureTitleBackground` | 1 title key art (2K) |
| `bg_city_lisbon` | `ensureCityBackground` | 1 Lisbon bg (2K) — **probe already proves this** |
| `bg_city_tokyo` | `ensureCityBackground` | 1 Tokyo bg (2K) |
| `bg_hub` | `ensureBusHubBackground` | 1 bus interior (2K) — keep window pane code-drawn OR per-city pane |
| `portrait_<id>_<mood>` × 16 | `ensurePortrait` | 4 bandmates × 4 moods (sprites, transparent) |
| dialogue panel, buttons, notes, lanes | code-drawn | **leave code-drawn** — crisp UI chrome over painted backgrounds reads intentional |

Rule of cohesion: **painted world, code-drawn UI.** Backgrounds and portraits get the real-asset pass; panels/buttons/notes stay code-drawn (they're the "interface chrome" and already look crisp). This is what actually looks good rather than a jarring all-AI melange.

### 2.3 Character consistency — the hard problem, solved up front

16 portraits that must be the **same person** across 4 moods. Text-to-image alone cannot do this. Strategy:

1. **One canonical base portrait per bandmate** via `generate_sprite.mjs` (chroma-key, transparent), with a shared character sheet style block (name, role, hair, skin, outfit color, accessory).
2. **Derive the 4 moods by image-to-image** from that base (`generate_sprite.mjs --reference <base.png>`), each mood reusing the same identity prompt + a mood expression instruction.
3. **`verify` every sprite** (the alpha check is mandatory — a prior BAIS game shipped a broken chroma-key).
4. Keep a `docs/character-sheets.md` with the canonical per-bandmate identity text so future cities/expressions stay consistent.

Moods needed: `happy, worried, tense, inspired` (the 4 the engine already uses).

### 2.4 Backgrounds — per city, plus title and bus

- Lisbon + Tokyo (2K, portrait 9:16-ish), using the probe's style block, each matching its city tint (`warm_amber`, `teal_pink`).
- Title key art (2K) — moody cozy stage/night skyline.
- Bus interior (2K) — cozy low-light interior; keep the code-drawn window pane tinted per-city or generate 2 panes.
- **Legibility safeguard:** backgrounds will be busier than flat fills. The dialogue panel (PANEL_Y 740) sits over the bottom third. Add a soft dark scrim behind the dialogue panel (a radial/linear dark overlay, ~35% alpha) so text stays readable over painted detail. Same for the location picker.

### 2.5 Audio — keep procedural (do not swap)

The ambience engine is now genuinely good and *adaptive* (chord-driven, crossfading, ducked). Real audio files would **reduce** flexibility (no crossfade, no per-city chord identity, bigger payloads). Recommendation: keep the Web Audio ambience; optionally add a single Lyria title theme later. **SFX already sound intentional after the soften pass.** Do not spend the asset budget here.

### 2.6 Verification (the non-negotiables)

1. Every sprite alpha-verified (`generate_sprite.mjs verify`).
2. Every bg aspect ≈ 9:16 or handled by `setDisplaySize` cover-crop; no letterbox seams.
3. Text legibility: dialogue + choices readable over every new background (screenshot each city's arrival + a 3-choice node).
4. Vignette + fireflies still apply (they're post-FX on the Image — confirm they don't look wrong over painted art; reduce firefly opacity if they fight the art).
5. `npm run typecheck && npm test` — 37/37 green.
6. Mobile 390×844 re-check (bg cover-crop + panel legibility).
7. Redeploy, curl the live URL, confirm 200 + real game HTML.

### 2.7 Budget & sequencing

- **Now:** commit this plan + the probe into the repo (done as part of this push).
- **Next session (resume prompt):** generate the 2 backgrounds + title, wire the manifest loader, ship — that alone transforms the look (worlds become painted). Portraits (16) in the same or next session. Bus interior last (it's a "set," low urgency). Keep audio as-is.
- **After:** content depth remains the biggest *longevity* gap (still ~15%) — but visual polish is what makes people click, so assets first.

---

## Part 3 — Bottom line

The polish pass built the right engine for beauty but not beauty itself. Code-drawn hit its ceiling; **the real-asset (Gemini) pass is the answer to "how do we get this looking good," and it's now proven viable with a live probe, a ready integration seam, and a consistency strategy that avoids the usual AI-character trap.** Written, committed, pushed — the resume prompt for Claude Code is in `RESUME_PROMPT.md` at repo root.
