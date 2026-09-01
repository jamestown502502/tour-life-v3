# RESUME PROMPT — Tour Life v3: Best-in-Class Pass (Mobile UX, Rhythm Feel, VN Depth, Minigames)

**Paste this to Claude Code at the start of the next session.** Read `HANDOFF.md`, `DESIGN.md`, `CLAUDE.md`, and `POLISH_BEST_IN_CLASS_PLAN.md` in the repo root first. This is a big pass — work in the exact order below, one workstream at a time, verifying each before moving on.

---

```text
You are doing the BEST-IN-CLASS pass on "Tour Life: International Dates" (tour-life-v3, Vite + TS strict + Phaser 3.90). The engine is solid and the game LOOKS good (painted Gemini world, code-drawn UI). But the player-facing interface is not mobile-grade and the flow is bland. Read POLISH_BEST_IN_CLASS_PLAN.md for the full research-cited spec; this prompt is the executable version. Five workstreams, in order.

HARD GUARDRAILS (do not violate):
- No new systems outside this plan. Do NOT build the Part 3 reality layer (Wellbeing/Groundedness/vices/Return Home) — deferred by owner. Do NOT swap audio to files. Painted world + code-drawn UI stays. No-fail/autoplay/relaxed accessibility stays and must be re-verified after ANY gameplay change.
- Match existing style; surgical changes; one thing at a time. Constants only in src/const.ts. Any new array/Map/Set field on a Scene MUST be reset in init() (Phaser reuses scene instances — bug #10). Any scene creating a DialogueBox must un-duck music in its SHUTDOWN handler (bug #12).
- Content schema changes must be additive + validated; keep every dialogue node <=40 words (enforced by content/schema.ts).

WORKSTREAM A — MOBILE RHYTHM FEEL (do first; it's the game's name).
 1. ENABLE MULTI-TOUCH: add `input: { activePointers: 4 }` to the Phaser config in src/main.ts. This is the single biggest "rhythm feels bad" cause — with the default (1 active pointer), two simultaneous lane taps are dropped. Verify live with a real two-finger test (Playwright multi-touch or devtools touch simulation): two lanes tapped at once must BOTH register.
 2. RAISE + WIDEN PLAYFIELD in src/ui/RhythmScene.ts: HIT_LINE_Y 1100 -> ~980; LANE_W 140 -> 165; LANE_X_START 90 -> 30 (4*165=660 fits 720). Hit zones at HIT_LINE_Y-40, keep 120 tall. Re-tune SPAWN_Y / PX_PER_MS so the 1600ms lead still maps cleanly (or make lead per-difficulty: relaxed 1800 / standard 1600 / expert 1400).
 3. PER-LANE FEEDBACK: fix the bug where every perfect-hit spark fires at the FIXED lane-0 x (`hitX = LANE_X_START + LANE_W/2` in applyJudgement) — compute the actual lane's center from the judged note's lane. Add a lane flash tint on hit and a floating judgement text ("Perfect! +100" / "Good" / "OK") at that lane's hit line, rising + fade 0.6s. Add a center "Combo xN" plate that pops on milestones (reuse comboPop).
 4. GRADE PLATE AT RESULTS: compute and show an S/A/B/C grade from the timing ratio (S>=0.95, A>=0.85, B>=0.70, C else) with a tween.
 5. CHART READABILITY: rebuild scripts/generate-chart.mjs into a motif system (kick beat -> tap, snare -> tap, offbeat -> hold, every N bars a rest of >=0.5s; sparse beats read better than dense walls — Exceed7 notecharting principle). Regenerate all existing charts. THEN hand-author ONE "hero" chart per existing song as the flagship arrangement (e.g. the storyGate-unlocked one) — notes placed on actual musical hits, ~55-70s.
 6. PRACTICE PASS: make the tutorial demo notes land on real beats (sync tweens to a 4/4 grid at the song's bpm) so the player learns timing feel, not just the gesture. Keep it unscored and non-punishing.
 DONE-WHEN: two-finger simultaneous taps register on distinct lanes; judgement feedback appears at the correct lane; playfield raised+widened; charts regenerated + hero charts authored; no-fail still holds (all-miss run reaches Results).

WORKSTREAM B — VN TEXTBOX THAT FEELS ALIVE (src/ui/DialogueBox.ts).
 1. PORTRAIT LIFE: subtle y-bob (+-3px) synced to typewriter progress; mouth-open/closed flicker while typing (toggle 2 portrait textures if cheap, else just the bob); soft gold radial glow behind the nameplate.
 2. TYPEWRITER SFX: soft per-character click (sine ~520Hz, 12ms, low gain, randomized pitch +-10%) via audio.playSfx — add a 'typewriter' sfx recipe to src/core/audio.ts. Respect the SFX volume bus. Skip during autoplay-skip/instant.
 3. ADVANCE AFFORDANCE: a pulsing gold chevron "v" bottom-right of the panel shown when a line is fully typed (tap = skipZone advance, already separate from choices). Name underline bar in BANDMATE_HEX under the nameplate.
 4. SAFE-AREA LAYOUT: raise PANEL_Y 740 -> ~700; cap visible choices at 3 with the 4th+ scrolling/fading (or shrink spacing so 4 fit above the safe line). Ensure panel + choices never extend below y ~1230 game px. Re-verify the arithmetic: panel.y + panel.height + 14 + rows*58 <= 1230.
 5. SETTINGS QoL: add AUTO mode (advance after ~4s, pause on choice) and SKIP READ TEXT (instant-complete the line) toggles to the Settings screen + a persistent keyboard/quick key for them (Space = skip line, hold = auto).
 6. LOCATION VARIETY: per-location color grade over the shared city background (tint overlay + vignette strength + ambient particle color) so the 5 locations feel distinct at near-zero asset cost. Wire in CityScene's location picker.
 DONE-WHEN: portrait animates during typing; typewriter click audible; chevron shows on complete; choices always above the safe line at 390x844 and 430x932 (measured, not assumed); auto/skip toggles work.

WORKSTREAM C — MINIGAMES TO BREAK THE VN FLOW (sparse, thematic, no-fail).
 Design rule (research): use the tour's own verbs, keep it 20-45s, reward-don't-punish, no fail state.
 1. ARCHITECTURE: add `MiniGameDef` to content/schema.ts (id, type, introText, outroText, rewards {stat, amount} | flags, gatingCondition?, backdropKey?). One shared scene src/ui/MiniGameScene.ts that switches on type. City JSON gets an optional `minigames[]` array; CityScene inserts a minigame between phases (after arrival / before preshow) when one is available + unplayed this run.
 2. SOUNDCHECK (timing): needle sweeps a gauge; tap when in the green zone. 3 rounds, escalating speed. Reuses rhythm.ts's judgeHit for windows. Rewards Harmony + Funds. Type: 'timing'.
 3. PACK THE VAN (quick-drag): 6 items, drag each into a grid slot before a soft timer; cozy + tactile. Rewards Energy + a travel flag. Type: 'drag'.
 4. INTERVIEW (rapid-chat): promoter asks 3 quick questions, 2 options each, soft timer; correct choices build Funds/Inspiration + relationship with the member being interviewed. Type: 'choice'.
 Each: one intro line, one outro line with the stat result, worst case = "rough but fine" flavor. Use existing DialogueBox for intro/outro. All input through pointer (touch-first) — no keyboard required.
 5. GEMINI BACKDROPS: generate 3 soft-gouache backdrops (soundboard/backstage, van interior, radio booth) via C:/Users/Jbthi/.claude/skills/threejs-image-generator/scripts/generate_image.py --resolution 2K --prompt "<style block from docs/asset-probes/lisbon_bg_probe.png: soft gouache cozy illustration, portrait 9:16, scene description, no text>" --api-key "$KEY", process via scripts/process-bg.sh, add to public/assets/manifest.json under keys bg_mini_<id>.
 DONE-WHEN: all 3 minigames reachable in a normal run (gated + flag-tracked), completable in 20-45s, no fail state (worst = flavor), rewards apply to state, backdrops render.

WORKSTREAM D — STORY DEPTH (beef up without a rewrite).
 1. Deepen Lisbon/Tokyo/Mexico City: +1 location each (5->6), +2 relationship-pool entries each (->6), +1 alternate after-show variant each (flag-gated). Target ~800-1000 words/city added. Keep nodes <=40 words.
 2. CITY #4: BERLIN — tint 'midnight_indigo' (unused), blueprint tone = ambition/experimentation. Author content/cities/berlin.json to Mexico City's depth (~1,200+ words, 5 locations, 4-5 relationship pool, 3 preShowChoices incl. one storyGate-conditioned arrangement, collaborator NPC + gift, weather pool, arrival/preShow/afterShow/journal scenes). Song content/songs/<id>.json with 3 arrangements (motif-generated, one hero chart per A.5). Register in src/game/content.ts (import + CITIES/SONGS). Generate Berlin background via the Gemini pipeline + process-bg.sh + manifest entry.
 3. BANDMATE BACKSTORY: 2 short gated scenes per bandmate ("letter from home" / "why they're here"), gated on relationship thresholds (e.g. relationship.<id> >= 40), in the relationship pools of the 3 existing cities (add to pools — no engine change).
 DONE-WHEN: Berlin plays end-to-end with painted bg; each old city has 6 locations / 6 pool entries; backstory beats appear when relationships cross thresholds; content validates (npm test).

WORKSTREAM E — IPHONE/MOBILE FIXES (the "can't see / unclear / unreadable" complaints).
 1. SAFE-AREA-FIRST: every interactive element above y~1230 game px; add env(safe-area-inset-bottom) padding inside the panel/choice stack and around the rhythm hit area (index.html + canvas-side offsets). Verify at 390x844 + 430x932 via getBoundingClientRect() (the measured 0.5417x scale method is documented — reuse it).
 2. READABILITY: dialogue body >=26px game px, button font >=24px, stronger text shadow on dialogue over painted backgrounds (strengthen the existing scrim under choices).
 3. HIT-TARGET AUDIT screen-by-screen (Settings, BandCreator, RoutePlan, Hub, Scrapbook): every tappable >=64 game px tall OR explicitly padded. Fix the Settings volume +/- pair and BandCreator genre/why-tour grids with REAL spacing (not blanket padding — overlap risk). Measure, don't guess.
 4. FULL-SCREEN iPhone capture test (Playwright resize to iPhone 12/14) for every screen: nothing interactive under the home indicator, no clipped text, no overlap.
 DONE-WHEN: measured >=44 CSS px touch targets on all screens at 390px width; nothing under the home indicator; dialogue/choices readable over painted backgrounds.

FINAL VERIFY & SHIP:
 1. npm run typecheck && npm test — all green (39 existing + new tests: minigame logic, schema validation for new fields, chart generation determinism, any new condition usage). If content schema gained fields, add validation + a test.
 2. Live browser pass (Playwright, NOT the Claude_Browser pane): fresh save -> onboarding -> Soundcheck minigame -> Berlin city -> hero-chart rhythm -> Results grade plate -> Scrapbook. Two-finger rhythm test. All-miss run still reaches Results.
 3. Mobile viewport pass: 390x844 + 430x932 screenshots of every screen (safe area, readability, touch targets).
 4. Screenshot before/after to docs/polish-before-after/.
 5. Deploy: npx --yes vercel@latest deploy --prod --yes (NO --name flag). If it "hangs" at Building -> git-identity BLOCK (HANDOFF.md §1 / bug #11), don't retry.
 6. curl -s -o /dev/null -w "%{http_code}" https://tour-life-v3.vercel.app -> 200 + title "Tour Life: International Dates".

FINISH with: files changed, new tests + count, minigame list + reachability, Berlin word count + bg, multi-touch + grade-plate verification, safe-area audit results, deploy verification, and anything deferred (reality layer, remaining cities, optional items). Report honestly what you could NOT verify.
```
