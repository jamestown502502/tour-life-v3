# Tour Life: International Dates — Handoff Document (v2, post-polish)

**Written:** 2026-09-01, by Claude (Sonnet 5), for whichever agent picks this up next.
**This supersedes the original HANDOFF.md.** That version was written right after the initial
vertical-slice build, before a full 8-phase visual/audio/feel polish pass. This version is the
current as-built truth. **Read this before touching code.** `DESIGN.md` (the original
blueprint) is the *aspirational* spec — this file is what's actually true today. Where they
disagree, trust this file for current state, but treat `DESIGN.md` as the target to keep
building toward.

---

## 0. TL;DR

A cozy rhythm-adventure browser game. Vite + TypeScript + Phaser 3. **Art is real painted
Gemini assets** (5 backgrounds + 16 character portraits) with the original code-drawn Graphics
kept as an automatic fallback; all audio is still Web Audio synthesis. One complete, **polished**
vertical slice exists: Title → Band Creator → seeded Route → Hub → three fully playable cities
(Lisbon, Tokyo, Mexico City) each with dialogue, exploration, a relationship scene, a real
rhythm performance (including real hold-note scoring), and an after-show → Scrapbook with a
generated ending. First-time players get real onboarding (§H). Save/resume, 8 accessibility
settings, seeded RNG, meta-progression, real typography, a depth/shadow UI system, atmospheric
backgrounds, and actually-playing ambient music all work. 39/39 tests pass, typecheck is clean,
and it's deployed and publicly live.

**What changed since the last handoff:** two passes. Phase G (real-asset pass, §G) put painted
soft-gouache backgrounds and 16 character portraits over the code-drawn originals through the
existing texture-key seam. Then this pass (§H) added onboarding/dummy-proofing, a third full
city (Mexico City), deepened Lisbon and Tokyo, and gave the previously-cosmetic mid-tour
complication one real mechanical effect. Before Phase G, an 8-phase polish pass took the game
from "functional but flat" to looking and sounding finished. See §9/§12 for the polish-pass bug
ledger and §6 for Phase G's (bugs 13–16) and this pass's (bugs 17–18).

**Art direction rule, deliberately chosen: painted world, code-drawn UI.** Backgrounds and
character portraits are real assets; panels, buttons, notes, lanes and the rhythm HUD stay
code-drawn. Crisp vector chrome over painted art reads as intentional design — replacing
everything with generated art produces a mushier, less coherent look. Keep this split.

**What it is still NOT, and why — both are the owner's explicit calls, not gaps:** the 3-4 hour
"every run unique" promise from the blueprint (12-16 cities). Asked directly on 2026-09-01
whether to add a 4th/5th city before closing out this pass, the owner chose to ship with 3
(Lisbon ~513 words, Tokyo ~498, Mexico City ~1,210 — see §8). The "reality layer" (Part 3 of the
blueprint: Wellbeing/Groundedness/Vices/Return Home) still does not exist in code. Asked the
same day whether to build a version of it calibrated to read as dark/mature while still passing
Google Play's content-rating review as something milder, that specific framing was declined —
content designed to misrepresent itself to a platform's rating review isn't something to build,
full stop — and offered an honestly-rated alternative instead; the owner chose to skip the
reality layer entirely rather than pursue that either. It remains fully deferred — no code, no
content, no schema fields.

**Live:** https://tour-life-v3.vercel.app
**Repo:** https://github.com/jamestown502502/tour-life-v3 (private, owner `jamestown502502`)
**Vercel project:** `tour-life-v3` under org `team_umNzYj4aX78WbIgY1mj5wNNy` (project id
`prj_icJ8x5VqVsxc9U25QzPYMfF8qKEn`)

---

## 1. How to run this

```bash
cd tour-life-v3
npm install
npm run dev        # Vite dev server on http://localhost:5183
npm run typecheck  # tsc --noEmit, strict mode, should be silent
npm test           # vitest run — 37 tests across 6 test files
npm run build      # tsc && vite build -> dist/ (check dist/fonts/ exists — see §5.9)
```

Launch config: `C:\Users\Jbthi\Claude Cowork\.claude\launch.json`, entry `"tour-life-v3"`, uses
the 8.3 short path `C:\Users\Jbthi\CLAUDE~2\TOUR-L~1` (Vite's `fs.strict` allowlist rejects the
long path-with-spaces otherwise; `vite.config.ts` also sets `fs.strict:false` as defense in
depth). Regenerate the short path if the repo moves.

### Deploying — READ THIS FIRST, it will otherwise look like it's hanging forever

```bash
git push
npx --yes vercel@latest deploy --prod --yes
```

**Do not use `--name`** — it's deprecated on current CLI and the project is already linked via
`.vercel/project.json`.

**If the CLI prints `Building…` and then just sits there for minutes with no further output,
do not assume it's a slow build and do not keep retrying.** This happened repeatedly this
session and every retry made it worse (see §12, bug #11). The deployment is not actually
building — it's `BLOCKED` server-side because Vercel couldn't verify the git commit author, and
the CLI's own status output (`UNKNOWN`) hides this completely. Diagnose with:

```bash
# Via Vercel MCP tools (preferred — doesn't depend on a possibly-stuck CLI):
# get_deployment_build_logs(idOrUrl, teamId) -> "No build log events found" = never started,
#   not a slow build.
# Then fetch the deployment's raw JSON for readyStateReason (the CLI never surfaces this):
```
```bash
node -e "
const fs = require('fs');
const token = JSON.parse(fs.readFileSync(process.env.APPDATA + '/xdg.data/com.vercel.cli/auth.json', 'utf8')).token;
fetch('https://api.vercel.com/v13/deployments/<DEPLOYMENT_ID>?teamId=team_umNzYj4aX78WbIgY1mj5wNNy', { headers: { Authorization: 'Bearer ' + token } })
  .then(r => r.json()).then(d => console.log(d.readyStateReason));
"
```

If it says something like *"blocked because there was no git user associated with the
commit"*, the fix is a git-identity mismatch, not a code or Vercel-outage problem — see §12
bug #11 for the full diagnosis and §14 for the permanent fix already applied (repo-local git
`user.email` is now set to a GitHub-verified noreply address; **don't change it back** without
re-reading why). This project does **not** have SSO deployment protection enabled — a plain
`curl` to the live URL should return 200 with real game HTML, not a login redirect; if it ever
does redirect, that's the one other thing worth checking before assuming a build problem.

**Verifying a deploy actually worked:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://tour-life-v3.vercel.app
curl -s https://tour-life-v3.vercel.app | grep -o '<title>[^<]*</title>'
```
Expect `200` and `<title>Tour Life: International Dates</title>`. The stable alias
`https://tour-life-v3.vercel.app` auto-repoints to whatever's current production — hand that
URL to the user, not the per-deploy hash URL (`tour-life-v3-<hash>-jameson-s-projects.vercel.app`,
which is a permanent immutable snapshot that does NOT update on the next deploy).

---

## 2. Tech stack (decided, don't relitigate without reason)

- **Vite 6 + TypeScript 5 (strict) + Phaser 3.90.** No React, no Next.js.
- **All art is code-drawn**: `Phaser.GameObjects.Graphics` → `generateTexture()`. Zero image
  files. See `src/art/sprites.ts` (now ~430 lines after the polish pass — portraits, UI chrome,
  backgrounds, rhythm/crowd/cue art all live here).
- **All audio is Web Audio API synthesis**: oscillators, filtered noise, a real ambience
  engine (pad + arpeggio + bass pulse + room-tone noise bed). See `src/core/audio.ts` and the
  new `src/core/musicTheory.ts`.
- **Two self-hosted variable-weight webfonts** (Baloo 2 for display, Nunito for body) are the
  *only* non-code-drawn assets in the whole game — self-hosted specifically to avoid a CDN
  hotlink, per `public/fonts/`. This is new since the last handoff (Polish Phase A). Everything
  else is still exactly as strict about "no external assets" as before.
- **Content is JSON** in `/content`, hand-validated (no JSON-Schema library) in
  `content/schema.ts`. Untouched by the polish pass.
- **State is a module-singleton class** (`src/core/state.ts`'s `State` export).
- **Save is IndexedDB with a localStorage fallback**, schema-versioned (`schemaVersion: 1`).
- **Tests are Vitest**, pure-logic only. 37 tests, 6 files (up from 29/5 — the polish pass added
  `musicTheory.test.ts` and 6 more cases to `rhythm.test.ts` for hold-note grading).

---

## 3. Repo map (every file, what it's for — updated for the polish pass)

```
tour-life-v3/
├─ DESIGN.md, CLAUDE.md, HANDOFF.md    Same roles as before (see original doc for DESIGN.md's
│                                       own numbering, still referenced in code comments).
├─ index.html          Now also declares two @font-face blocks (Baloo 2 / Nunito, self-hosted
│                        from /fonts/) — added in Polish Phase A.
├─ public/fonts/        NEW. Baloo2-Variable.woff2 (~33KB), Nunito-Variable.woff2 (~39KB). Real
│                        variable-weight font files, downloaded once this session directly from
│                        Google Fonts' CDN (fonts.gstatic.com) then committed — self-hosted from
│                        here on, no runtime CDN dependency. Vite copies public/ verbatim into
│                        dist/ — confirmed present in dist/fonts/ after every build.
├─ docs/polish-before-after/   NEW. ~15 screenshots taken during the polish pass, one or more
│                        per phase, for the visual record. Not load-bearing for anything, just
│                        evidence of what changed and when.
│
├─ content/              UNCHANGED by the polish pass — same 4 files, same schema, same 2
│                        cities. See the original architecture notes below (§3 continues).
│  ├─ schema.ts, bands.ts, cities/{lisbon,tokyo}.json, songs/{sailor_lullaby,neon_rain}.json
│
├─ src/
│  ├─ main.ts            Boots Phaser.Game after awaiting document.fonts.load() for both faces
│                         (NEW — see §5.1). Exposes window.__game AND (NEW) window.__audio in
│                         DEV only.
│  ├─ const.ts            NEW additions: UI_RADIUS {card:22, button:14, chip:10}, UI_MARGIN=24,
│                         UI_PADDING=16 — the shared geometry language every panel/card/button
│                         now draws from. Everything else (W/H/PALETTE/RHYTHM_WINDOWS/etc.)
│                         unchanged.
│  │
│  ├─ core/
│  │  ├─ rng.ts, state.ts, save.ts    UNCHANGED by the polish pass.
│  │  ├─ audio.ts          SUBSTANTIALLY REWRITTEN (Polish Phase F). Was: gain buses + simple
│  │  │                    tone()/noiseBurst() SFX + a playAmbience() that was written but NEVER
│  │  │                    CALLED anywhere (see §12 bug #9). Now: a master chain (low/high shelf
│  │  │                    + DynamicsCompressorNode before destination, so the now-much-busier
│  │  │                    mix can't clip), softened SFX (square→triangle for tap/good, a
│  │  │                    5th-harmonic shimmer added to the perfect-hit sparkle), and a real
│  │  │                    playAmbience(chords, bpm, waveform) that builds a sustained chord pad
│  │  │                    + an 8th-note arpeggio layer (with per-pluck gain wobble, not a flat
│  │  │                    sequencer) + a bass pulse on beat 1 of every bar + a quiet filtered-
│  │  │                    noise room-tone bed, and crossfades (0.8s ramp both directions)
│  │  │                    instead of hard-cutting when you call it again. duckMusic(bool) was
│  │  │                    ALSO written-but-never-called before this pass — now wired into
│  │  │                    DialogueBox (see below). `musicNodes.stop(fadeSec?)` signature
│  │  │                    changed to support the crossfade — if you're calling stopMusic()
│  │  │                    directly anywhere new, the signature still works with no args
│  │  │                    (defaults to a 0.4s fade).
│  │  └─ musicTheory.ts     NEW. parseChord(symbol, octave) / parseChordProgression(progression,
│  │                        octave) — turns a plain-text chord symbol like `"Am7"` into actual
│  │                        frequencies (regex parse: root note + quality suffix
│  │                        {'', m, maj7, m7, 7, 6, m6} → interval table → equal-temperament
│  │                        Hz). This is how song JSON's existing `chordProgression: "Am7-
│  │                        Fmaj7-Cmaj7-G6"` field — which existed before but was never actually
│  │                        consumed by anything — now drives the ambience. Also exports
│  │                        DEFAULT_AMBIENCE_CHORDS/BPM, a generic cozy pad used by Title and
│  │                        Hub (screens with no specific song attached). Unit-tested
│  │                        (musicTheory.test.ts, 5 cases). ASSUMES every chord in one
│  │                        progression has the same tone count — true for both songs today
│  │                        (Lisbon's are all 4-tone, Tokyo's all 3-tone) but not generally
│  │                        enforced; see the comment in audio.ts's playAmbience for the exact
│  │                        failure mode if that's ever violated.
│  │
│  ├─ game/               ALL UNCHANGED by the polish pass except rhythm.ts:
│  │  ├─ content.ts, condition.ts, dialogue.ts, route.ts, scenePool.ts, endings.ts, meta.ts
│  │  │                    — identical logic to the original handoff. meta.ts's unlock pools
│  │  │                    WERE padded out this session but as part of Phase B, not F — see the
│  │  │                    polish-phase notes below (§9.B) — UNLOCKABLE_GENRES 2→6,
│  │  │                    UNLOCKABLE_DECOR 4→10.
│  │  └─ rhythm.ts          NEW: combineHoldJudgement(startJudgement, completion) — see §5.6.
│  │                        Everything else (effectiveWindows, judgeHit, scoreForHit,
│  │                        comboMultiplier, pickArrangement, buildPerformanceResult) unchanged
│  │                        in behavior (buildPerformanceResult's maxPossible-score bug was
│  │                        already fixed in the FIRST session, before the original handoff —
│  │                        not a polish-pass change).
│  │
│  ├─ art/
│  │  ├─ palette.ts         CITY_TINTS expanded 2 → 8 named color stories (added:
│  │  │                    lavender_dusk, rose_gold, forest_moss, desert_clay, midnight_indigo,
│  │  │                    citrus_bloom — content only uses 2 of these today). NEW:
│  │  │                    NIGHT_TINTS (a Set marking which tints get bright lit windows vs a
│  │  │                    softer day-glass tint in backgrounds, and which color fireflies use
│  │  │                    in CityScene).
│  │  ├─ sprites.ts          MASSIVELY EXPANDED (was ~210 lines, now ~430). New shared UI-chrome
│  │  │                    helpers: ensureRoundedRect (plain white rounded rect, tinted via
│  │  │                    .setTint() for shadows/glows), ensureButtonTexture (fill+gold-border
│  │  │                    baked per size+color+radius, with a top-edge highlight line),
│  │  │                    ensurePortraitFrame (circular gold-ring card behind a portrait),
│  │  │                    fillVerticalGradient (see §12 bug #8 — replaces ALL prior
│  │  │                    Graphics.fillGradientStyle calls), drawBuildingRow (shared
│  │  │                    silhouette-row helper with optional lit windows, used by both Title
│  │  │                    and City backgrounds), ensureHoldRail (hold-note vertical rail,
│  │  │                    bucketed by duration), ensureHitLineGlow, ensureCueIcon (5 drawn
│  │  │                    glyphs, one per ChoiceCueType), ensureCrowdFigure (2 poses: idle /
│  │  │                    arms-raised), ensureHubWindowPane (small texture keyed by city tint,
│  │  │                    kept separate from the big cached hub background so it can change per
│  │  │                    visit without invalidating that larger texture). ensurePortrait was
│  │  │                    REBUILT from a tinted-circle-plus-mouth into a full bust — see §5.4.
│  │  │                    BANDMATE_BASE is now exported (was module-private) so DialogueBox can
│  │  │                    color the speaker nameplate per bandmate.
│  │  └─ effects.ts          New: applyVignette(image, strength?) (Phaser's built-in postFX,
│  │                        WebGL-only, wrapped in try/catch), spawnFireflies(scene, color?,
│  │                        count?) (ambient particles, reducedMotion-gated, reused by Title/
│  │                        Hub/non-raining City scenes), spawnRingPulse(scene,x,y,color?) (a
│  │                        quick expanding-ring flash on perfect hits, reducedMotion-gated).
│  │                        All pre-existing effects (spawnPerfectSpark, comboPop, hitstop,
│  │                        shake, flash, spawnRain, spawnConfetti) unchanged, all still
│  │                        correctly reducedMotion/noFlash-gated — reconfirmed via a full grep
│  │                        audit this session, not just assumed.
│  │
│  ├─ ui/
│  │  ├─ textStyles.ts      NEW. The single named-style system (title/h1/h2/speaker/dialogue/
│  │  │                    body/button/stat/small) every Phaser Text object in the game now
│  │  │                    goes through via `textStyle(name, overrides?)`. Replaced 52 inline
│  │  │                    `{fontFamily:'Georgia, serif', ...}` style objects across every scene
│  │  │                    file. If you add a new Text anywhere, use this — don't hand-roll a
│  │  │                    style object again.
│  │  ├─ Button.ts           REBUILT (Polish Phase B, touched again in Phase H). Was: a plain
│  │  │                    Rectangle + Text. Now: baked rounded-rect textures (fill+border+top-
│  │  │                    highlight via ensureButtonTexture), a plum drop shadow layer, a gold
│  │  │                    hover-glow overlay, a press state (scale 0.96, via container.scale —
│  │  │                    NOT a re-tint, tinting was tried and reverted for a different reason
│  │  │                    during development), a persistent "selected" ring (setButtonSelected
│  │  │                    export — replaces two call sites in BandCreatorScene that used to
│  │  │                    reach into `.list[0]` as a raw Rectangle and call `.setStrokeStyle()`
│  │  │                    directly, which no longer exists as a concept once the button is a
│  │  │                    baked Image), a labelText data getter (getButtonText export — same
│  │  │                    reason, replaces two `.list[1]` reach-ins in SettingsScene that
│  │  │                    updated a toggle's On/Off text), a randomized entrance-pop stagger
│  │  │                    (container starts at scale 0.9/alpha 0, tweens in with 0-140ms random
│  │  │                    delay so a screen's buttons don't all snap in simultaneously), and
│  │  │                    (Phase H) a padded custom hit area — see §5.8/§12 bug #10. New
│  │  │                    ButtonOptions field: `tapSfx?: SfxName` (defaults 'tap'; dialogue
│  │  │                    choices pass 'choiceConfirm' to keep their distinct sound). If you
│  │  │                    ever need a button's internal shape/text again, use the exported
│  │  │                    getters — do NOT reach into `.list[n]`, the child order is
│  │  │                    `[shadow, hoverGlow, bg, selectedRing, text]` and is NOT part of the
│  │  │                    public contract (it already changed once this session and broke two
│  │  │                    call sites that assumed the old order).
│  │  ├─ DialogueBox.ts      Panel gets a shadow layer + gold-tinted border + a top-edge
│  │  │                    highlight (was a flat sand rounded rect). Portrait now sits inside a
│  │  │                    framed circular card (ensurePortraitFrame) instead of floating bare.
│  │  │                    Speaker nameplate is colored per-bandmate (BANDMATE_BASE) instead of
│  │  │                    fixed plum. Choice buttons now route through the shared Button
│  │  │                    component (createButton) instead of a hand-rolled Rectangle+Text —
│  │  │                    this is also where the panel's shadow/portrait-frame math lives, so
│  │  │                    if PANEL_Y (still 740, see §5.7) ever changes, check both the panel
│  │  │                    layout AND the portrait/frame offsets together. NEW: calls
│  │  │                    audio.duckMusic(true) in its constructor and audio.duckMusic(false)
│  │  │                    in setVisible(false) and destroy() — see §12 bug #12 for a real bug
│  │  │                    this produced and how it's now covered.
│  │  ├─ CityScene.ts        Adds applyVignette + spawnFireflies (when not raining) on its
│  │  │                    background. Now calls audio.playAmbience() with the city's own song's
│  │  │                    chord progression (at half the song's real bpm — a deliberate slower
│  │  │                    "exploring" feel distinct from the full-tempo performance later).
│  │  │                    SHUTDOWN handler now unconditionally calls audio.duckMusic(false) —
│  │  │                    see §12 bug #12, this is the actual fix location.
│  │  ├─ HubScene.ts         Adds applyVignette + spawnFireflies, a real window pane image
│  │  │                    (ensureHubWindowPane, tinted by the NEXT city's tint — or
│  │  │                    'midnight_indigo' once the route is fully walked), a dynamic
│  │  │                    corkboard that renders actual State.data.inventory items as small
│  │  │                    pinned chips (was purely decorative before — now reflects real run
│  │  │                    state), and stat bars that tween in (width 0→target, staggered per
│  │  │                    stat) instead of snapping to value instantly. Calls
│  │  │                    audio.playAmbience(DEFAULT_AMBIENCE_CHORDS, ...) on every visit.
│  │  ├─ RhythmScene.ts      SUBSTANTIALLY REWRITTEN — see §5.6 for the full hold-note story.
│  │  │                    Also: a glowing hit line (ensureHitLineGlow) replacing a flat gold
│  │  │                    bar, tap/choice notes get a baked drop shadow, choice-cue banners are
│  │  │                    now a real styled callout (reuses createButton + a drawn icon)
│  │  │                    instead of a raw rectangle+text, combo stamps pop at combo 10/25/50
│  │  │                    ("Warming up!"/"Lit up!"/"On fire!", tracked per streak so they can
│  │  │                    retrigger after a combo reset), and the crowd meter is 5 silhouette
│  │  │                    figures (ensureCrowdFigure) that light up left-to-right with the
│  │  │                    crowd value instead of a flat progress-bar Rectangle. Plays the
│  │  │                    song's own ambience at full tempo underneath the performance.
│  │  ├─ ResultsScene.ts, ScrapbookScene.ts, SettingsScene.ts, BandCreatorScene.ts,
│  │  │  RoutePlanScene.ts, TitleScene.ts    All touched for the textStyles migration (Phase A)
│  │  │                    and Button.ts's new getter API (Phase B, BandCreatorScene +
│  │  │                    SettingsScene only). TitleScene additionally gets applyVignette +
│  │  │                    spawnFireflies on its background and now calls
│  │  │                    audio.playAmbience(DEFAULT_AMBIENCE_CHORDS, ...) on the same first-
│  │  │                    gesture handler that calls audio.unlock().
│  │  ├─ htmlOverlay.ts, transition.ts    UNCHANGED by the polish pass.
│  │
│  └─ tests/               6 files now (was 5). rhythm.test.ts gained 6 new hold-judgement
│                          cases (3 for combineHoldJudgement directly, matching the 3 tiers:
│                          full-completion keeps judgement, half-to-85% softens one tier, under-
│                          half is a miss). musicTheory.test.ts is entirely new (5 cases). The
│                          other 4 test files are unchanged from the original handoff.
```

---

## 4. Core systems — what's new or changed since the last handoff

### 4.1 Typography (`src/ui/textStyles.ts`) — new, Phase A

There was **no font system at all** before this pass — every Text object hand-specified
`fontFamily: 'Georgia, serif'` inline. This was flagged by an external review as "the single
biggest reason it reads as a dev build." Fixed by:
1. Downloading two real Google Fonts as **variable-weight woff2 files** directly (not linking
   Google's CDN at runtime — self-hosted from `public/fonts/`). Baloo 2 (rounded display face,
   weights 600-800) for titles/buttons/speaker names; Nunito (soft body face, 400-700) for
   dialogue/body/stats. Both fonts turned out to be served by Google as single variable-font
   files covering the whole weight range requested — one file each, not one-per-weight.
2. `main.ts` now `await`s `document.fonts.load()` for both faces **before** constructing
   `Phaser.Game`. This matters: a Phaser `Text` object drawn before its font finishes loading
   silently falls back to the browser default and — this is the important part — **never
   re-renders once the font arrives**, because Phaser bakes text to a canvas at creation time
   and doesn't watch for font-load events. Gating the entire boot on font-load avoids a flash-
   of-unstyled-text bug class entirely rather than trying to patch it after the fact.
3. `textStyles.ts` exports one `textStyle(name, overrides?)` function with 9 named presets.
   Every scene's `add.text()` calls now go through it. If you add new UI, use it — don't repeat
   the "no font system" mistake for anything new.

### 4.2 UI depth system (`const.ts` UI_RADIUS/MARGIN/PADDING, `sprites.ts`, `Button.ts`) — Phase B

Buttons and panels were flat-filled rectangles with sharp corners before. Now: shared geometry
constants (`UI_RADIUS.card=22`, `.button=14`, `.chip=10`), a reusable `ensureRoundedRect` +
`ensureButtonTexture` pair in sprites.ts (cached per unique size+color+radius, so this stays
cheap even with many differently-sized buttons across screens), and Button.ts draws a real
plum drop-shadow layer + a gold hover-glow + a subtle top-edge highlight baked into the button
texture itself (makes it read as "raised," not flat). See §3's Button.ts entry above for the
full list of behavior changes (press state, selection ring, entrance stagger, the new getter
API that replaced raw `.list[n]` access).

### 4.3 The meta-progression pool fix — Phase B, small but real

`UNLOCKABLE_GENRES` (2 entries) and `UNLOCKABLE_DECOR` (4 entries) in `src/game/meta.ts` meant
a player's 3rd completed run had nothing left to unlock — `completeRun()`'s `.find()` calls
just silently returned `undefined` and pushed nothing, quietly killing the replay-reward hook
right when a repeat player would start to notice. Padded to 6 and 10 entries respectively. Not
part of any of the 8 named polish phases specifically — flagged by the same external review
that kicked off the whole polish pass, folded into Phase B's commit since it touched the same
"make repeat play feel rewarded" concern.

### 4.4 Character portraits (`sprites.ts` `ensurePortrait`) — Phase C

Was: a tinted circle (bandmate's base color as fill) with two dot eyes and a mood-based mouth
arc, on a 200×200 canvas. Now: a full code-drawn bust on a 280×280 canvas — head, neck, a
trapezoid torso in the bandmate's own clothing color (`BANDMATE_BASE`, unchanged: Mira
terracotta, Theo teal, Jun gold, Rowan sky), a **per-bandmate skin tone** (4 distinct tones,
`SKIN` map) and **per-bandmate hair** (Mira: long wavy sides flowing past the shoulders; Theo:
shaggy fringe with jagged front spikes; Jun: cropped undercut, tight to the head; Rowan: neat
cap + a segmented braid hanging over one shoulder — `HAIR` map, 4 distinct colors), and a
**signature accessory** per bandmate (Mira: a small gold pendant on a thin cord; Theo: a
drumstick tucked behind one ear, drawn via `Graphics.rotateCanvas`; Jun: a guitar pick on a
cord at the neck; Rowan: a diagonal bass strap across the torso). The mood system expanded from
"mouth shape only" to eyes + eyebrows + mouth, still the same 4 moods (happy/worried/tense/
inspired) — see `drawFace()` for the exact geometry per mood. Verified via a temporary 4×4 grid
test scene (all 4 bandmates × all 4 moods, screenshotted, then the scene file deleted and the
screenshots removed before committing — not part of the shipped code, but worth knowing this
verification method exists if you need to eyeball every combination again quickly: create a
throwaway Scene class that calls `ensurePortrait` in a grid and register it via
`window.__game.scene.add(key, SceneClass, true)` from the browser console, no main.ts edit
needed).

### 4.5 Backgrounds & atmosphere (`sprites.ts`, `palette.ts`, `effects.ts`) — Phase D

Title, City, and Hub backgrounds went from flat single-color fills + solid-silhouette
buildings to: a real vertical gradient sky (see §12 bug #8 — this required a workaround, not
just new code), a **far silhouette layer** with seeded lit windows (`drawBuildingRow`, shared
helper — gold/cream windows scattered pseudo-randomly using a tiny local xorshift-style PRNG,
`nextSeed()`, NOT the game's real seeded RNG in `core/rng.ts` — this is purely cosmetic
variance, not save-affecting, deliberately kept separate), and a **near silhouette layer** in
the city's own tint color for foreground depth. `CITY_TINTS` expanded from 2 to 8 named color
stories; `NIGHT_TINTS` (a `Set`) decides whether a tint gets bright gold-lit windows (night
cities) or a softer cream day-glass tint. A Phaser built-in postFX vignette
(`applyVignette`) is applied to every full-screen background image, and ambient particles
(`spawnFireflies`) run on Title, Hub, and non-raining City scenes (mutually exclusive with
`spawnRain` — never both at once in the same scene). Hub specifically also got real bunks, a
sagging string-light chain along the ceiling, and a corkboard frame (the actual souvenir
content on it is drawn dynamically by HubScene, not baked into this cached texture — see §4.8).

### 4.6 Real hold-note rhythm scoring (`game/rhythm.ts`, `ui/RhythmScene.ts`) — Phase E

**This was cosmetic before and is now real.** Previously: a hold-type note had a distinct
texture but was judged identically to a tap — a single press anywhere in the note's timing
window judged the *entire* hold, and `note.dur` was never read by any scoring logic at all.
Now:
- `pointerdown` in a lane finds the best unjudged note as before, but if it's `type: 'hold'`,
  instead of immediately judging it, `beginHold()` marks it "holding," records the press-timing
  delta, and adds it to a per-lane `activeHolds` Map. The note is NOT judged/destroyed yet.
- Release is handled three ways, all converging on `finalizeHold()`: (a) a scene-level
  `pointerup` listener (handles a finger drifting off the lane's hit-zone bounds — a per-zone
  `pointerup` alone would miss that), (b) keyboard `keyup` for the D/F/J/K bindings, (c) an
  auto-finalize check in `update()` for a hold whose window has fully elapsed without ever
  being released (rewards holding all the way through without penalizing for not releasing at
  an exact instant — matches the "cozy, forgiving" design language rather than requiring
  precision on both ends).
- `finalizeHold()` computes `completion` = how much of the note's actual duration was held
  (0..1), judges the *initial press* exactly like a tap (`judgeHit` against the start delta),
  then combines the two via the new pure function `combineHoldJudgement(startJudgement,
  completion)` in `game/rhythm.ts`: holding ≥85% of the duration keeps the start judgement as-
  is; 50-85% softens it one tier (perfect→good→ok, ok stays ok); under 50% is a miss regardless
  of how good the initial press was. Unit-tested directly (3 new cases in `rhythm.test.ts`),
  independent of any Phaser/scene machinery.
- Hold notes now render as a **vertical rail** (`ensureHoldRail`, bucketed to the nearest 10px
  of duration-derived height so a whole song doesn't generate one unique texture per note) that
  grows upward from the head, instead of the old fixed-size block that didn't visually reflect
  duration at all.
- Autoplay drives holds through the exact same `beginHold`/auto-finalize path (starts the hold
  at the right instant, the "elapsed without release" check in `update()` completes it) — no
  separate autoplay-specific hold logic to maintain.
- **This directly produced a real crash bug** — see §12 bug #10 (`crowdFigures` not reset on
  scene re-entry) — found while live-testing this exact phase by deliberately restarting the
  Rhythm scene twice in a row, which is not something the unit tests could ever catch since
  they don't touch Phaser scene lifecycle at all. If you're ever suspicious of a "works once,
  breaks on revisit" bug in *any* scene, check every `private foo: Bar[] = []` / `= new Map()`
  / `= new Set()` class field and confirm it's explicitly reset in that scene's `init()`, not
  just declared with an initializer that only runs once when the scene INSTANCE is first
  constructed (Phaser reuses scene instances across `.start()`/`.stop()` cycles by default).

### 4.7 Audio — ambience actually plays now, plus a real ducking bug (`core/audio.ts`) — Phase F

Two things were fully built in earlier code but **never actually called from anywhere** —
confirmed by grep, not assumption: `AudioSystem.playAmbience()` and `AudioSystem.duckMusic()`.
This meant **no background music had ever played in this game, in any scene, at any point**,
despite the blueprint's validation checklist explicitly requiring "music present in hub, city,
and rhythm" (§12 bug #9). Both are now wired up:
- `playAmbience(chords, bpm, waveform)` is called in TitleScene (on first-gesture unlock, using
  a generic cozy default progression — `DEFAULT_AMBIENCE_CHORDS`/`BPM` from the new
  `musicTheory.ts`), HubScene (same default, every visit), CityScene (the visited city's own
  song's chord progression, at half the song's real bpm — a deliberately slower "exploring"
  feel), and RhythmScene (the song's progression at full tempo, underneath the actual
  performance).
- The function itself was rebuilt from "3-4 sustained oscillators + one shared LFO" into a real
  bed: the sustained pad, an 8th-note arpeggio with per-pluck gain wobble (randomized, not a
  flat mechanical sequence), a bass pulse on beat 1 of every bar, and a quiet filtered-noise
  room-tone layer (standing in for "city ambience" — crowd murmur / traffic, per the original
  polish request). Switching ambience now **crossfades** (old bed ramps to 0 over 0.8s while the
  new one ramps in) instead of an abrupt cut.
- `duckMusic(true/false)` is now called from `DialogueBox`'s constructor (true), `setVisible`
  (mirrors the visible flag), and `destroy()` (false) — dialogue text ducks the music bed to
  half volume while it's on screen. This surfaced a genuine, audible bug: see §12 bug #12.
- **Master chain**: a low-shelf (+2dB @ 200Hz, warmth) → high-shelf (-3dB @ 6kHz, softness) →
  `DynamicsCompressorNode` (threshold -18dB, ratio 4:1) now sits between the master gain and
  `ctx.destination`, added because the mix is now genuinely busy (pad + arpeggio + bass + noise
  + SFX, several of these simultaneously during Rhythm) and needed real headroom management.
- SFX softened: `tap` and `good` were `square` (reads harsh/cheap), now `triangle`. The
  perfect-hit sparkle gained a third, quiet oscillator at a higher harmonic for a bit of
  shimmer.
- `window.__audio` is now exposed in dev builds (same pattern as `window.__game`) specifically
  because this whole phase's verification depended on inspecting the live audio graph directly
  — you cannot "hear" a Playwright session, so `window.__audio.isUnlocked()`,
  `window.__audio['ctx'].state`, `window.__audio['musicGain'].gain.value`, and
  `window.__audio['musicNodes']` (truthy while ambience is actively playing) are how both real
  bugs in this phase were actually confirmed fixed, not just assumed fixed from reading the
  diff.

### 4.8 Touch targets (`ui/Button.ts`) — Phase H

Direct measurement (not assumption) at a 390px-wide mobile viewport showed the canvas renders
at ~0.54× scale, meaning most buttons — drawn 40-60px tall in the game's 720-wide coordinate
space — render at only ~22-33 CSS px tall on an actual phone screen, under the ~44px touch-
target guideline. Rhythm's own lane hit-zones are unaffected (140×120 game units, comfortably
above 44px at any reasonable viewport) — this was specifically a general-UI-button problem.
Fixed with a **padded custom hit area** in `Button.ts` (`Phaser.Geom.Rectangle` +
`Rectangle.Contains`, +8px on every edge beyond the drawn button) rather than resizing all 23
`createButton(...)` call sites across 10 files. This is a real, measured improvement but **does
not fully guarantee 44px on the smallest phones (360-390px)** — the padding is deliberately
conservative, sized against the tightest existing spacing in the game (the Settings volume
+/- pair, only 10px apart) so it can't be pushed further without risking two buttons' hit areas
overlapping. Closing that last gap needs an actual spacing pass on the tightest screens
(Settings, BandCreator's genre/why-tour grids) — flagged as a follow-up in §15, not silently
claimed as fully solved.

---

## 5. What did NOT change (still true from the original handoff — not re-verified in depth
this session, but nothing in the polish pass should have touched these)

- The full scene state-machine / flow diagram (Title → BandCreator → RoutePlan → Hub ⇄
  City[phases] → Rhythm → Results → Scrapbook), the resume/Continue mapping table, the
  RunState shape (still `schemaVersion: 1`, no Wellbeing/Groundedness/vice fields), the
  condition-expression DSL (`stat.x>=n` / `relationship.x>=n` / `localLove.x>=n` / `flag:x`),
  the dialogue node-graph walker (`game/dialogue.ts`), route/scene-pool generation, the ending
  generator, and the save/load system are all **unchanged**. Re-read the original handoff's
  §4-§6 (now folded into this file's history — see the git log for `f0a1723` if you want the
  original text verbatim) for the full mechanics of each; nothing here needed updating.
- Content authoring pipeline (how to add city #4) — unchanged, still content-JSON-only, no
  engine changes required for a new city (proven again by Mexico City in this pass — see §H).
- Content depth numbers — updated this pass. Lisbon 513 words / 5 locations / 5 relationship
  pool entries (was ~460/4/3). Tokyo 498 words / 5 / 5 (was ~460/4/3). Mexico City, new: 1,210
  words / 5 locations / 4 relationship pool entries / 3 preShowChoices / its own song. Still
  well under the blueprint's ~3,200-word-per-city target — see §H for the honest framing.
- The Part 3 "reality layer" — still fully deferred, still not started. Raised explicitly this
  pass (owner asked for a version calibrated to pass Google Play's content rating while reading
  as dark/mature) and declined on those terms — see TL;DR. Still needs its own scoped decision
  on tone/rating posture, on honest terms, before any of it gets written.

---

## 6. Full bug ledger (chronological — the original build's 4 bugs, then 8 more from the polish
pass)

*From the original vertical-slice build (unchanged from the last handoff, included here for a
single complete reference):*

1. **Phaser's `scene.add.dom()` mis-positions elements under `Scale.FIT`.** Fixed with
   `src/ui/htmlOverlay.ts`'s `createFloatingInput`, which polls the canvas's real
   `getBoundingClientRect()` instead of trusting Phaser's DOM plugin transform. Still in place,
   untouched by the polish pass.
2. **`DialogueBox`'s choice buttons could render below the visible canvas** on 3+ choice nodes.
   Fixed by moving `PANEL_Y` to 740 and hiding the panel entirely during picker/pre-show-choice
   UI phases. Still 740 — reconfirmed still fits (up to 4 choice rows) after Phase B's changes
   to choice-button rendering (now via `createButton`, taller row height 58px vs the original
   54px — re-verify this arithmetic if you ever touch `PANEL_Y` or the choice row spacing:
   `panel.y + panel.height(300) + 14 + rows*58 <= 1280`).
3. **A flawless rhythm performance couldn't reach the 'perfect' grade** — `buildPerformanceResult`'s
   `maxPossible` score formula assumed every hit already sat at the final capped combo
   multiplier. Fixed before the original handoff was written; unaffected by the polish pass's
   hold-note changes (the fix is in the aggregate scoring math, not per-note judging).
4. **"Continue" crashed with `unknown city "undefined"`** because `TitleScene` didn't pass
   `cityId` when resuming into the City scene. Fixed with `resumeTarget(progress)`. Unaffected
   by the polish pass.

*From this session's polish pass:*

5. *(renumbered from the polish-pass work — see §4.6)* **Real hold-note grading replaces a
   cosmetic stand-in.** Not a bug exactly (the old behavior was intentional-but-flagged-
   incomplete, documented as such in the original handoff's §8), but listed here because it's
   the kind of "looks done, isn't" gap worth knowing was closed.
6. **A truly random star icon `Graphics.fillPoints()` call was written with a broken flat-
   array-to-points conversion** while building `ensureCueIcon`'s spotlight-bandmate glyph —
   caught and fixed during authoring, before it ever shipped or was tested (a `map`/`filter`
   hack that didn't actually produce the point-object array `fillPoints` expects; rewritten as
   a straightforward loop pushing `{x,y}` objects). Mentioned here only because it's exactly
   the kind of thing that's easy to reintroduce if you touch that function without re-reading
   the Phaser `fillPoints` signature (`Vector2Like[]`, not a flat number array).
7. **`ensureHubWindowPane`'s gradient fill produced a fully blank/transparent texture** — the
   first symptom noticed of what turned out to be bug #8 below, this was the specific call site
   that led to discovering it.
8. **`Graphics.fillGradientStyle()` bakes as fully transparent through `generateTexture()` in
   this Phaser/WebGL setup — confirmed by direct pixel readback, not assumption.** This is the
   single most significant bug found this session. Every gradient sky in the game (Title, City
   ×8 possible tints, the Hub interior, the Hub window pane) had been **silently invisible
   since the code was originally written** — masked only because `PALETTE.night` (the gradient
   fill's start/end color in most cases) happens to closely match the page's own CSS background
   color, so a transparent canvas region and an actually-rendered dark-navy fill looked
   indistinguishable in a casual screenshot. Diagnosis method (repeatable if this class of bug
   ever recurs): generate a texture, then read it back via
   `texture.getSourceImage()` → draw onto a scratch 2D canvas → `getImageData()` on a pixel
   that should be inside the fill. A **solid** `fillStyle()`+`fillRect()` texture read back
   correctly with real RGBA values immediately after generation; a `fillGradientStyle()`+
   `fillRect()` texture read back as `[0,0,0,0]` — proven with an isolated repro directly in
   the browser console (both textures created and read in the same synchronous script, ruling
   out any "hasn't rendered yet" timing explanation). Fixed by replacing every
   `fillGradientStyle` call with a new hand-rolled `fillVerticalGradient()` helper in
   `sprites.ts` (bands of solid `fillStyle`+`fillRect` calls, linearly interpolating RGB
   between two colors — 24 steps by default, no seams visible at that step count). **If you
   ever see `fillGradientStyle` reintroduced anywhere inside a `withGraphics()`/
   `generateTexture()` callback, that's very likely this bug coming back — don't add it without
   re-verifying the underlying Phaser/WebGL behavior has actually changed.**
9. **`AudioSystem.playAmbience()` and `.duckMusic()` were fully implemented but never called
   from anywhere** — confirmed by `grep -r "playAmbience\|duckMusic" src/` returning zero call
   sites before this session's fix. This meant no background music had ever played in this
   game, in any scene, despite `DESIGN.md`'s validation checklist explicitly requiring it.
   Fixed by wiring both into Title/Hub/City/Rhythm and DialogueBox respectively — see §4.7.
10. **`RhythmScene.crowdFigures` (an array of Image objects) wasn't reset in `init()`.** Phaser
    reuses scene instances across `.start()`/`.stop()` cycles, so a second visit to the Rhythm
    scene tried to `.setTexture()` on Image objects that the FIRST visit's shutdown had already
    destroyed, throwing `Cannot read properties of undefined (reading 'sys')` and crashing
    scene boot entirely. Caught by deliberately restarting the Rhythm scene twice in a row
    during live verification of Phase E — **not** something any unit test could catch, since
    none of them touch Phaser scene lifecycle. Fixed by explicitly setting
    `this.crowdFigures = []` in `init()`, alongside a comment explaining why (matches the
    pattern already used correctly for `notes`/`cues`/`judgements`/etc.). **If you add any new
    array/Map/Set instance field to any scene, it MUST be reset in that scene's `init()`, not
    just declared with an initializer** — the initializer only runs once, when the scene
    instance is first constructed at game boot, not on every subsequent `.start()`.
11. **Vercel CLI deploys silently pile up in a `BLOCKED` state that looks exactly like a slow
    build, with no useful error from the CLI.** Root cause: the git commit author's email
    wasn't a verified email on the GitHub account connected to the Vercel Hobby team — Vercel
    requires an exact match for Hobby-tier deploys, with no override setting, and the CLI's own
    `status`/`inspect` output just says `UNKNOWN` instead of surfacing the real
    `readyStateReason`. Full diagnosis and the permanent fix are in §1 (deploy section) and
    §14 — this is likely the single most useful thing in this document if a future deploy
    mysteriously "hangs."
12. **Ducked music could get stuck at half volume indefinitely.** `DialogueBox.setVisible(false)`
    and `.destroy()` are the only two places that call `audio.duckMusic(false)` to restore full
    volume — but neither fires when a City scene ends while its dialogue box is still visible,
    which is the NORMAL way a city ends (journal's last dialogue line → tap → straight to
    `finishCity()` → Hub, with the box never explicitly hidden first). Confirmed live by direct
    gain-node inspection: `musicGain.gain.value` read `0.35` (ducked) throughout a Hub visit
    that followed a city completed this way, `0.7` (correct) after the fix. Fixed by adding an
    unconditional `audio.duckMusic(false)` to `CityScene`'s own `SHUTDOWN` handler, rather than
    relying on `DialogueBox`'s lifecycle (which doesn't cover every path a scene can end
    through). **If you add a new scene that creates a `DialogueBox`, give that scene's own
    shutdown handler the same unconditional un-duck** — don't assume the box's own
    `setVisible`/`destroy` calls will always run first.

*From the real-asset pass (Phase G):*

13. **`preBoot` runs before the WebGL renderer exists.** Registering a real texture there with
    `game.textures.addImage()` creates a Texture with no GL texture behind it, and the first
    render throws `Cannot read properties of null (reading 'webGLTexture')`. Hit on the first
    attempt at wiring the asset loader. Fixed by loading assets from a dedicated `BootScene`
    using `this.load.image()` — Phaser then creates and uploads normally, and the scene can't
    advance early, so there's no race with any other scene's `create()`.
14. **The chroma-key verify gate cannot detect the key eating the SUBJECT.** Its heuristic asks
    "did the background key out?" — high transparent%, low partial%. When `colorkey` eats
    subject pixels, transparent% goes *up*, which reads as healthier. A neutral light-gray
    background sat chromatically next to the whites of the eyes and Rowan's pale sky-blue shirt;
    every portrait shipped with see-through eyes and all four Rowans had holes in the shirt, and
    **15 of 16 passed verification**. Caught only by compositing over magenta and looking.
    Decisive confirmation trick: composite the same file over two different colors — if the
    suspect region changes color with the background, it's transparency, not paint. Fixed by
    regenerating against a vivid pure-green background; the contact-sheet composite is now a
    scripted step in `scripts/generate-portraits.sh`. **A metric passing is not the same as
    having looked at the output.**
15. **One stray artifact silently shrank a portrait by ~40%.** `fit-portrait.mjs`'s alpha
    bounding box counted any pixel over the threshold, so a single pale artifact near an edge
    inflated the box and the subject was scaled to fit *that* instead of itself. Only the four
    text-to-image base portraits had such artifacts, so the four "happy" portraits came out
    visibly smaller than their image-to-image siblings. Fixed with a minimum-run threshold —
    a row/column needs ≥3 opaque pixels to count as content.
16. **The legibility scrim drew visible banding lines.** Its 40 bands used a `+1px` height fudge
    to avoid seams, but because the bands are semi-transparent the shared row composited twice
    and showed as a darker line every few pixels across every painted background (obvious at
    mobile width). Fixed with exact integer band edges derived from the index. Note the same
    `+1` exists in `fillVerticalGradient` and is *harmless there* — those fills are opaque, so
    overlapping just overwrites rather than accumulating.

*From this pass (onboarding + content depth):*

17. **Title's seed-entry field floated on top of every modal launched over it.** It's a real DOM
    `<input>` (`position:fixed`, `z-index:1000` — see `src/ui/htmlOverlay.ts`), entirely outside
    Phaser's canvas/scene stacking. `scene.pause()` only halts Title's own update/input loop; it
    does nothing to a DOM element sitting above the whole canvas. This was already true for
    SettingsScene before this pass (unnoticed — nothing in Settings' layout happened to collide
    with where the input sits) and became visible the moment HowToPlayScene added a second thing
    launched over Title. Fixed by hiding/showing the input in lockstep with Title's own
    `PAUSE`/`RESUME` events, registered immediately after the input is created — not by
    repositioning new UI around a magic Y offset, which breaks again the next time anything is
    added near that row.

---

## §G. The real-asset pass — how to add or regenerate art

**The seam:** every `ensureX()` in `src/art/sprites.ts` goes through `withGraphics()`, which
early-returns if `scene.textures.exists(key)`. Register a real image under the same key and it
wins; leave it out and the code-drawn version draws. That's the whole mechanism — there is no
"asset mode" flag and no parallel rendering branch.

**Wiring:** `public/assets/manifest.json` is a flat `[{key, file}]` list. `src/ui/BootScene.ts`
loads every entry through Phaser's loader then starts Title; a missing or corrupt file logs a
warning and falls back. `hasRealAsset(key)` (in `src/core/assets.ts`) lets a scene ask which it
got — needed because some code-drawn art is composed against its own background (the hub bakes a
window frame and corkboard into `bg_hub` and overlays a tinted pane and souvenir chips at those
exact spots; painted bus art puts its windows elsewhere, so the pane is skipped and the corkboard
gets a standalone backing).

**Backgrounds** — `scripts/process-bg.sh <raw.png>`. Generation via
`generate_image.py --resolution 2K`. Three non-obvious things it handles, all measured:
Gemini renders a painterly white border no matter how emphatically the prompt forbids it (6%
inset crop removes it); output aspect is close to but not exactly 9:16 (normalized here so the
runtime cover-fit is a safety net, not doing real work); and a raw 2K PNG is ~6.3MB, which WebP
q82 at 1440×2560 takes to ~60–340KB with no visible loss.

**Portraits** — `scripts/generate-portraits.sh` (idempotent; skips existing files). It's the
executable form of `docs/character-sheets.md` — **keep those two in sync**, the identity blocks
must be reused verbatim or characters drift. Consistency comes from generating one base per
character text-to-image then deriving the other three moods image-to-image from it. Two hard
requirements: the background must be **vivid green** (see bug 14), and you must **open
`docs/portrait-contact-sheet.png` and look** before believing the run succeeded.

**To add a city's background:** generate → `process-bg.sh` → add `{key: "bg_city_<id>", file:
"img/bg_city_<id>.webp"}` to the manifest. No code changes.

**Audio was deliberately NOT swapped to real files.** The procedural ambience is chord-driven,
crossfading and duckable; static tracks would lose per-city chord identity and crossfade for a
much larger payload. Only a single generated title theme would plausibly be worth adding.

---

## §H. Onboarding, dummy-proofing, and Mexico City — this pass

**Onboarding** (`src/ui/HowToPlayScene.ts`, `src/ui/HelpButton.ts`, `src/core/onboarding.ts`):
a 3-page How to Play screen (auto-opens once ever on a fresh player, reachable any time from
Title), a one-line diegetic "Sol" intro the first time RoutePlan/Hub appear each run, a
non-interactive tween-driven demo of TAP/HOLD/CUE before a player's first-ever real song (never
touches the real note/scoring pipeline — see bug-class notes on `RhythmScene.runPracticePass`),
and a "?" help button on Hub/City/Rhythm/Scrapbook. Two flag systems, deliberately separate:
`State.data.flags` (run-scoped, wiped by `State.newRun()` — used for the RoutePlan/Hub intros,
which are meant to repeat gently each new tour) vs. `src/core/onboarding.ts`'s localStorage
flags (persistent across every run — used for "has this player EVER seen X", e.g. the How to
Play auto-open and the rhythm tutorial).

**Dummy-proofing:** New Run now confirms before overwriting an existing save. Hub gained a
one-line "tonight's goal" teaser, deliberately left-anchored and width-capped so it can't
collide with the corkboard beside it. Settings' volume +/- pair and BandCreator's genre/why-tour
grids were re-sized to clear a real 44 CSS-px touch target at the measured 390px-width scale
factor (0.5417) — the residual gap the previous handoff flagged.

**Mexico City** (`content/cities/mexico_city.json`, `content/songs/callejon_groove.json`,
`public/assets/img/bg_city_mexico_city.webp`): third full city, `citrus_bloom` tint,
community/percussion tone. Built to the same template as Lisbon/Tokyo — 5 locations, 4
relationship-pool entries, 3 preShowChoices (the third, "duet with Ximena", gated on
`stat.harmony>=35` same pattern as Lisbon's duet/Tokyo's bass_forward), collaborator NPC +
gift, storyGate. 1,210 words, every node under the enforced 40-word cap. Its song was built by
`scripts/generate-chart.mjs` — a small deterministic chart generator (motif-based note
placement, holds substituted periodically, cues at ~1/3 and ~2/3) rather than hand-typing ~300
note objects; run once, not wired into the build. Background generated via the same
`generate_image.py` → `process-bg.sh` → manifest pipeline as §G, first try, no border-crop
surprises this time.

**Mid-tour complication given a real effect** (`HubScene.applyMidTourComplicationIfDue`):
previously drawn at RoutePlan and displayed once as flavor text, never read again. Now applies
a small one-time stat delta (`COMPLICATION_EFFECTS` in `HubScene.ts`) the first Hub visit at or
past the route's midpoint, and surfaces which one fired as a line under the band name. Purely
additive — `State.data.midTourComplication` already existed, this is a new consumer of it, not
a new field.

**Two explicit no's, both the owner's call, not gaps:** a 4th/5th city, and a version of the
Part 3 reality layer calibrated to pass Google Play's content-rating review while reading as
dark/mature — see TL;DR for why the second one specifically was declined rather than attempted
in some watered-down form.

typecheck clean, 39/39 tests (2 new — `onboarding.test.ts` covers the persistent-flag module's
get/set roundtrip and its broken-localStorage fallback; `headless_playtest.test.ts` needed no
changes and passing with 3 cities is itself a proof point that adding a city took zero engine
changes). Verified live: full onboarding walkthrough, New Run confirm, Settings/BandCreator
spacing at 390×844, a complete Lisbon-adjacent path through the new Tokyo pachinko-parlor
location and Mexico City's arrival/locations/relationship/portraits, the mid-tour complication
firing exactly at the midpoint Hub visit — zero console errors throughout every check.

---

## 7. What was and wasn't verified this session (polish pass specifically — see the original
handoff for the initial build's verification notes, still accurate)

**Verified via automated tests (37/37 passing):** everything from the original handoff, plus
`combineHoldJudgement`'s 3 grading tiers and `musicTheory.ts`'s chord parsing (5 cases:
major/minor-7th/major-7th chord tone counts, the unparseable-symbol fallback, and progression
splitting).

**Verified live in-browser (Playwright, not the Claude_Browser pane — see §14):**
- Every visual change: Title/City(Tokyo)/Hub with the gradient fix, dialogue with the new
  portrait framing and nameplate coloring, the 4×4 portrait mood/bandmate grid, live rhythm
  gameplay (lanes/hit-line/crowd figures/notes rendering, a real rapid-tap sequence across all
  four lanes producing no errors and a rising score), the Scrapbook/Settings screens.
- The no-fail guarantee specifically re-confirmed AFTER the RhythmScene rewrite: a song left
  completely untouched (no input at all) still ran to full completion and transitioned cleanly
  to Results, no console errors, confirmed via direct scene-state inspection after waiting real
  wall-clock time for the ~57s Tokyo chart to actually finish.
- Audio: `AudioContext` reaches `"running"` on first gesture, `musicNodes` stays truthy
  (ambience actively playing) across Title→Hub→City with no console errors, ducking toggles
  correctly on dialogue show/hide (0.7 ↔ 0.35, matching the configured volumes), and the
  journal→Hub stuck-duck bug was reproduced live, then confirmed fixed, by direct gain-value
  inspection before and after the code change — not inferred from reading the diff.
- Mobile: Playwright resize to 390×844 and 430×932. Scale.FIT and safe-area CSS hold up
  correctly at both sizes; the dialogue panel + up to 3 visible choice rows fit inside the
  canvas with room to spare at both sizes (4-row math re-verified separately, not just
  screenshotted). The touch-target measurement itself (canvas renders at ~0.54× at 390px width)
  came from direct `getBoundingClientRect()` inspection, not a guess.
- The Vercel git-identity deploy block: reproduced 4 times (all now permanently `BLOCKED`,
  harmless clutter in the deployment list — the Cancel Deployment API refuses to cancel them,
  400 "Could not cancel"), root-caused via the raw deployment JSON's `readyStateReason` field
  (never surfaced by the CLI), fixed by changing the repo-local git commit email, and confirmed
  fixed by a clean deploy reaching `readyState: "READY"` and the live URL serving correctly.

**NOT verified this session** (things worth doing before calling the polish pass "fully done"):
- The full Tokyo city walked end-to-end live in the browser with the NEW UI (Lisbon was walked
  completely through Results with the post-polish UI; Tokyo's arrival/rhythm were spot-checked
  individually via direct scene jumps, not as one continuous live playthrough).
- Keyboard input (D/F/J/K) was never actually pressed during this session's live testing, only
  read from the code (the hold-note keyup handling in particular is unverified by hand, only by
  reading the logic — it mirrors the pointer path closely enough that this is probably fine,
  but "probably fine by inspection" is not the same as tested).
- The exact visual feel of a hold-note rail growing/shrinking in real time (confirmed it
  renders and doesn't crash via a rapid-tap stress test, but never watched one specific hold
  note in slow motion to confirm the rail's visual growth rate looks right).
- A truly cold, fresh-tab audio unlock → immediate Rhythm-scene ambience check (the audio
  verification this session always went through Title first, which is also how real play
  always starts, so this gap is low-risk, but it means the CityScene/RhythmScene ambience calls
  were never confirmed to gracefully no-op if somehow reached before `audio.unlock()` — they
  should, since `playAmbience` checks `if (!this.ctx) return;` at the top, but this exact path
  wasn't exercised).
- Whether the 8px hit-area padding on buttons (§4.8) actually reaches a comfortable feel on a
  REAL physical phone, as opposed to a Playwright-emulated viewport — emulation confirms the
  math, not the actual tactile experience.

---

## 8. Environment gotchas (specific to this dev setup — updated with 3 new entries from the
polish pass; the original 5 entries are unchanged and not repeated in full here, see git
history at `f0a1723` for their original wording, or the summaries below)

*Carried over, unchanged:*
- The Claude_Browser pane doesn't run `requestAnimationFrame` reliably for this game — use the
  Playwright MCP tools for any interactive testing, not the pane.
- Editing source files while a Playwright tab has the dev server open triggers a Vite HMR full
  reload, silently resetting the game to Title. If something "mysteriously" jumps back to
  Title mid-test, check whether you just edited a file.
- Real wall-clock time passes between tool calls, and Phaser's clock is tied to it — a rhythm
  song can genuinely finish while you're doing several other things, not because of a bug.
- `window.__game` is exposed in dev builds for fast scene-jumping
  (`window.__game.scene.start('City', {cityId:'tokyo'})`) — remember to `.stop()` the old
  scene explicitly if jumping via the global `game.scene` manager (as opposed to
  `this.scene.start()` from inside a running scene), since the global path does NOT auto-stop
  the previous scene.
- The 8.3 short-path requirement for the dev server, and the lack of a global git identity on
  this machine (both covered in §1 above with current specifics).

*New this session:*

- **`window.__audio` is exposed in dev builds** alongside `window.__game` — see §4.7 for why
  and how it was used.
- **Vercel CLI deploys can silently pile up `BLOCKED` with no useful CLI error — see §1 and
  §6 bug #11.** This is the single highest-value thing to remember from this whole session if
  you're the one debugging a "stuck" deploy next.
- **This repo's local git `user.email` is deliberately set to
  `214519214+jamestown502502@users.noreply.github.com`** (a GitHub-verified noreply address for
  the account connected to the Vercel Hobby team), **not** the user's real email
  (`jmbenn02@icloud.com`, used everywhere else in this portfolio and in this repo's OWN earlier
  commits). This is a deliberate, repo-local-only override to fix bug #11 — don't "fix" it back
  to match other projects without re-reading why, and don't set it globally (other projects
  don't have this problem and shouldn't inherit this workaround). If a fresh clone needs a new
  git identity, prefer this same noreply-address pattern over a real email for any repo that
  will deploy to this Vercel Hobby team.

---

## 9. Prioritized next steps

Same overall shape as the original handoff's roadmap, re-ordered now that look/feel/audio is
done:

1. **Content is now clearly the biggest remaining gap relative to effort already spent
   elsewhere.** The game looks and sounds finished; it plays for ~10-15 minutes. Either author
   more relationship-scene-pool depth for the 2 existing cities (each pool is still exactly 3
   entries, the schema minimum) or start city #3 via the pipeline (§ unchanged from original
   handoff — still content-JSON-only, no engine changes needed for a new city, and nothing in
   the polish pass changed that pipeline).
2. **Close the touch-target gap properly** (§4.8) — a real spacing pass on Settings and
   BandCreator's genre/why-tour grids, specifically, rather than another blanket padding
   increase (which risks hit-area overlap at the current spacing).
3. **Real hold-note visual polish** — the rail renders and scores correctly but was never
   watched in slow motion; worth a dedicated look if hold notes end up mattering more as chart
   content grows.
4. **A real asset pass** (Gemini backgrounds/portraits, Lyria music, ElevenLabs SFX) — this was
   Phase G of the polish plan, explicitly skipped by instruction ("do not do this now"). The
   code-drawn system this session built is specifically designed to be swapped from without
   re-architecting: every `ensureX` texture function in `sprites.ts` already caches by a string
   key, so a real-asset version would slot in behind the same key convention.
5. **Part 3 reality layer** — still gated on an explicit go-ahead plus tone-dial/content-
   warning UX decisions, unchanged from the original handoff.
6. **CI** — still doesn't exist. `npm run typecheck && npm test` in a GitHub Action would catch
   regressions automatically; more valuable now than before, given how much more surface area
   (audio graph, texture generation, button hit-areas) the polish pass added.

## 10. Open questions to ask the user, not assume

- Is the current visual/audio polish level good enough to actively promote the live URL now,
  or is more content depth (§9.1) a prerequisite before it's shown around? The original handoff
  flagged "don't link this publicly yet, it looks like a prototype" as a real concern — that
  concern is substantially addressed now, but content depth (~15% of the target) is unchanged
  and worth being explicit about before assuming the answer.
- Priority order between content depth, the remaining touch-target gap, and a real asset pass —
  §9's ordering is one reasonable read, not the only defensible one.
- Whether it's worth spending a short session specifically re-verifying Tokyo's full path live
  in-browser (§7's one real coverage gap) before considering this build "done," or whether the
  headless test coverage + the spot-checks already done are sufficient confidence.
