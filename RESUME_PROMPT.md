# RESUME PROMPT — Tour Life v3: The Real-Asset (Gemini) Pass

**Paste this to Claude Code at the start of the next session.** It supersedes any "assets
later" deferral. Read `HANDOFF.md`, `POLISH_REVIEW_AND_ASSET_PLAN.md`, and `CLAUDE.md` in the
repo root first, then follow this prompt. This is a look-and-feel pass: **do not touch
`/content`, do not change systems, do not build the Part 3 reality layer.**

---

```text
You are doing THE REAL-ASSET PASS on "Tour Life: International Dates" (tour-life-v3,
Vite + TypeScript strict + Phaser 3.90). The game is polished but its art is still fully
code-drawn, and code-drawn vector shapes have hit their aesthetic ceiling. Your job: swap
in REAL Gemini-generated painted assets for the two "world" layers — backgrounds and
character portraits — behind the game's existing texture-cache seam, with code-drawn as
automatic fallback. Keep the code-drawn UI chrome (panels, buttons, notes, lanes).

CONTEXT YOU MUST TRUST:
- The swap-in mechanism is DESIGNED and PROVEN. Every ensureX texture function in
  src/art/sprites.ts checks scene.textures.exists(key) and early-returns. So: if a real
  image is loaded into Phaser's texture manager under the SAME key a code-drawn function
  would generate, the real image wins and code-drawn never runs. Missing file = code-drawn
  fallback. No engine re-architecture needed.
- Keys: bg_title | bg_city_lisbon | bg_city_tokyo | bg_hub | portrait_<id>_<mood> for
  bandmate ids mira/theo/jun/rowan × moods happy/worried/tense/inspired (16 total).
- Tools + keys are installed and verified. Live probe this session:
  docs/asset-probes/lisbon_bg_probe.png (848x1264, soft-gouache cozy Lisbon at golden hour,
  warm amber/terracotta palette matching the game palette) — THIS is the style anchor.
- GOTCHA: API keys live in the WINDOWS USER env, not the shell env. Load with:
  KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')")
  Pass native Windows paths (C:/Users/...) to native tools, not MSYS /c/ paths.

STEP 1 — WIRE THE SEAM (smallest possible, do this first so the rest is verifiable):
  - Create public/assets/manifest.json: [{ "key": "bg_city_lisbon", "file": "img/bg_city_lisbon.png" }, ...].
  - In src/main.ts boot(), after waitForFonts(), add an async loadAssets() that uses a
    Phaser.Loader to load every manifest entry, then game.textures.addImage(key, tex) for
    each. Missing files must not crash boot (guard per entry). Scenes keep calling
    ensureX() unchanged.
  - Verify: with an empty/missing img/ dir, the game still boots and renders code-drawn
    (fallback works). Then drop in ONE real background and confirm it renders.

STEP 2 — GENERATE THE WORLD (backgrounds + title + bus):
  - Use C:/Users/Jbthi/.claude/skills/threejs-image-generator/scripts/generate_image.py
    --prompt "<style block>" --filename C:/Users/Jbthi/Claude Cowork/tour-life-v3/public/assets/img/<file>.png --resolution 2K --api-key "$KEY"
  - STYLE BLOCK (reuse the probe's): "Soft gouache cozy illustration, portrait orientation,
    warm <city> tones matching palette #F5EBDD #E8D5B7 #C4704F #3E7C7B #4A2C40. <scene
    description>. soft rounded shapes, no harsh outlines, gentle vignette, storybook cozy
    mood, no text"
  - Generate: bg_title (cozy night stage/skyline), bg_city_lisbon (hillside street, tram,
    laundry — see probe), bg_city_tokyo (rainy neon-soaked street, teal/pink, #3E7C7B),
    bg_hub (low-light bus interior, plum tones, bunks + warm string lights).
  - Every background rendered at portrait 9:16-ish (848x1264 or 720x1280). Where the loaded
    image doesn't exactly match W/H, setDisplaySize the image to cover 720x1280 (center
    crop) — no letterbox seams.
  - LEGIBILITY SAFEGUARD (required): add a soft dark scrim behind the DialogueBox panel and
    the location picker (linear/radial dark overlay ~35% alpha) so text stays readable over
    painted detail. Keep PANEL_Y = 740.

STEP 3 — GENERATE THE CHARACTERS (consistency strategy — the hard part):
  - Use C:/Users/Jbthi/.claude/skills/user/game-image-generator/scripts/generate_sprite.mjs
    --prompt "<identity + style>" --filename ... --chroma-key (transparent), then verify:
    generate_sprite.mjs verify <file.png> on EVERY sprite. A failed alpha is a shipped bug
    in this portfolio's history — do not skip verify.
  - Write docs/character-sheets.md first: one canonical identity block per bandmate (name,
    role, hair, skin tone, outfit color from BANDMATE_BASE: mira terracotta, theo teal, jun
    gold, rowan sky; signature accessory: mira pendant, theo drumstick, jun guitar pick,
    rowan bass strap). Keep these blocks verbatim across ALL generations so identity holds.
  - Per bandmate: generate ONE canonical base (neutral/happy), then derive the other 3
    moods by image-to-image with --reference <base.png> + the identity block + a mood
    instruction (happy/worried/tense/inspired). Do NOT text-to-image each mood fresh — it
    will not be the same person.
  - Downscale/center-crop to the portrait frame size used by ensurePortraitFrame (280x280
    game units; the loaded texture is auto-scaled by the frame — confirm it fits and
    centers).

STEP 4 — WIRE + VERIFY (non-negotiable):
  1. manifest.json lists exactly the files that exist (stale keys = console noise; prune).
  2. npm run typecheck && npm test — 37/37 green.
  3. Sprite verify passes on all 16 portraits.
  4. Screenshot each city arrival + a 3-choice node over the new backgrounds: text legible.
  5. Vignette + fireflies still apply on top of painted art; if fireflies fight the art,
     reduce their opacity (do not remove the reducedMotion gating).
  6. Mobile 390x844 re-check: bg cover-crop + panel legibility + touch targets.
  7. Do NOT touch /content, systems, accessibility settings, or audio (procedural ambience
     stays — it's adaptive and good).
  8. npx --yes vercel@latest deploy --prod --yes   (NO --name flag; project is linked)
  9. curl -s -o /dev/null -w "%{http_code}" https://tour-life-v3.vercel.app  → 200, and the
     title tag is "Tour Life: International Dates". If the deploy "hangs" at Building: it's
     the git-identity BLOCK, not a slow build — see HANDOFF.md §1/§6 bug #11. Repo-local git
     identity is already fixed; do not change it.

SCOPE GUARDRAILS:
- Painted world, code-drawn UI: panels/buttons/notes/lanes stay code-drawn.
- Audio stays procedural (Web Audio). No Lyria/ElevenLabs this pass.
- The bus interior is a "set" — lowest priority; only if the first three go cleanly.
- No new systems, no /content edits, no Part 3 reality layer.
- One change at a time; baseline (fallback build screenshot) before swapping assets; after
  each asset, confirm fallback still exists when the file is removed.

FINISH with: files changed, manifest contents, sprite-verify results, screenshot paths for
each new background/portrait, test results, the live-URL verification, and any asset you
deliberately deferred. Report honestly which assets still use code-drawn fallback.
```
