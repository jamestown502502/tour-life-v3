#!/usr/bin/env bash
# Resubmission pass (2026-09-27): two sets of painted art, both loaded AFTER the title screen
# rather than at boot (see src/ui/BootScene.ts loadImagesInBackground), because the boot manifest is
# already ~10 MB and none of this is needed in the first minutes of a run.
#
#  1. RETURN-VISIT ART. The return leg books one city a second time. It used to look identical to
#     the first night. Each city now has a second city scene and a second stage, same place,
#     different hour and weather, and a fuller room — the town remembers you.
#     Keys: bg_city_<id>_return, bg_rhythm_<id>_return.
#  2. MINIGAME BACKDROPS for the 18 minigames added since the last art pass, which fell back to a
#     code-drawn gradient. Keys: bg_mini_<id>.
#
# Same pipeline and the same hard-won prompt rules as every other background: one continuous space
# from one viewpoint, never described in bands or thirds (see generate-rhythm-stages.sh), and
# process-bg.sh crops the border Gemini paints no matter what the prompt says.
set -uo pipefail
cd "$(dirname "$0")/.."

export GEMINI_API_KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')" | tr -d '\r')
GEN="C:/Users/Jbthi/.claude/skills/threejs-image-generator/scripts/generate_image.py"
OUT="public/assets/img/later"
mkdir -p "$OUT"

STYLE="Soft gouache painting, cozy storybook illustration style, portrait orientation 9:16."
SCENE_SUFFIX="A single continuous scene from one fixed viewpoint, one unbroken space with natural depth and soft falloff into shadow. No panels, no split composition, no horizontal divisions or bands, no collage, no separate framed sections. Painterly brushwork, warm inviting palette, no sharp-focus faces in the foreground, no text, no border, no frame."
STAGE_SUFFIX="A single continuous scene painted from one fixed viewpoint in the audience looking toward the stage. One unbroken room with natural depth: the stage lit at the far end, the air between dim and hazy, the nearest foreground in shadow. Absolutely no panels, no split composition, no horizontal divisions or bands, no collage, no separate framed sections. Painterly brushwork, warm inviting palette, no text, no border, no frame."

gen() { # gen <key> <suffix> <scene description>
  local key="$1" suffix="$2" scene="$3"
  local webp="$OUT/${key}.webp"
  if [ -f "$webp" ]; then echo "skip $key (exists)"; return 0; fi
  local raw="$OUT/${key}.raw.png"
  for attempt in 1 2; do
    if uv run "$GEN" --resolution 2K --prompt "$STYLE $scene $suffix" --filename "$raw" >/dev/null 2>&1 && [ -s "$raw" ]; then
      ./scripts/process-bg.sh "$raw" "$webp" && rm -f "$raw" && return 0
    fi
    echo "retry $key (attempt $attempt failed)"; sleep 5
  done
  echo "FAILED $key"; rm -f "$raw"; return 1
}

# Run up to POOL generations at once (default 3); each is an independent network call. POOL=1 for a
# re-run after rate-limit failures — existing files are skipped, so only the gaps are generated.
pool() { while [ "$(jobs -rp | wc -l)" -ge ${POOL:-3} ]; do sleep 1; done; }

# ---------------------------------------------------------------- 1. return visits: city scenes
pool; gen bg_city_lisbon_return "$SCENE_SUFFIX" "A steep tiled street in Lisbon at blue hour just after rain, tram rails glistening on wet cobblestones, warm lamplight reflected in puddles, laundry lines strung between balconies, the glowing doorway of a small fado house partway down the hill." &
pool; gen bg_city_tokyo_return "$SCENE_SUFFIX" "A narrow Tokyo alley of tiny bars at dawn after a long night, paper lanterns switched off, a pale pink sky above the rooftops, vending machines still glowing, a light dusting of snow on the awnings and bicycles." &
pool; gen bg_city_mexico_city_return "$SCENE_SUFFIX" "A colonial plaza in Mexico City during a late-afternoon summer downpour, bright umbrellas crossing the square, wet cobblestones reflecting warm string lights that are just coming on, a church facade softened by the rain." &
pool; gen bg_city_berlin_return "$SCENE_SUFFIX" "A Berlin canal street in winter at night, a light snowfall, bare trees wrapped in small warm lights, graffiti on old brick walls under a dusting of snow, the glowing entrance of a U-Bahn station along the water." &

# ---------------------------------------------------------------- 1. return visits: stages
pool; gen bg_rhythm_lisbon_return "$STAGE_SUFFIX" "The same intimate Lisbon fado room, now packed late at night and lit by candles, a single stool and guitar on the small stage, people standing shoulder to shoulder along the tiled walls because every seat is taken." &
pool; gen bg_rhythm_tokyo_return "$STAGE_SUFFIX" "The same compact Tokyo club, now sold out, a sea of small raised phone lights in the dark, teal and pink stage lighting, the rain-streaked window glowing with city lights beyond the stage." &
pool; gen bg_rhythm_mexico_city_return "$STAGE_SUFFIX" "The same open-air Mexico City stage on a festival night, fireworks blooming in the sky above the stage, marigold garlands and papel picado strung overhead, warm light spilling over a packed plaza." &
pool; gen bg_rhythm_berlin_return "$STAGE_SUFFIX" "The same concrete warehouse club in Berlin at five in the morning, pale sunrise light slanting through high industrial windows into the haze, the stage still lit, the room still full." &

# ---------------------------------------------------------------- 2. minigame backdrops: Lisbon
pool; gen bg_mini_lis_door_deal "$SCENE_SUFFIX" "A small wooden bar counter at the back of a Lisbon fado house, a ledger and two handwritten slips of paper beside a glass of water, warm amber sconces, azulejo tiles on the wall behind." &
pool; gen bg_mini_lis_chord_ear "$SCENE_SUFFIX" "A quiet backstage room in Lisbon, a guitar resting on an amplifier beside a window, afternoon light falling across a terracotta floor, a music stand with a single sheet of chords." &
pool; gen bg_mini_lis_exchange "$SCENE_SUFFIX" "A narrow Lisbon street with three small currency exchange windows side by side, warm evening light, hand-painted signs too blurred to read, cobblestones and a tram wire overhead." &
pool; gen bg_mini_lis_step_down "$SCENE_SUFFIX" "The corner of a Lisbon fado house after hours, two chairs pulled close together near a single microphone, a guitar on one chair, soft amber light and tiled walls." &
pool; gen bg_mini_lis_backline "$SCENE_SUFFIX" "An airport check-in area at night, a drum kit packed in battered road cases on a luggage trolley, the long counter stretching away, soft overhead lights and large windows showing a dark runway." &

# ---------------------------------------------------------------- 2. minigame backdrops: Tokyo
pool; gen bg_mini_tok_merch_table "$SCENE_SUFFIX" "A folding merch table in the lobby of a Tokyo livehouse, neatly folded band t-shirts in stacks, a small cash box and a price card, teal and pink light spilling in from the club doors." &
pool; gen bg_mini_tok_count_in "$SCENE_SUFFIX" "A tiny green room in a Tokyo club, drumsticks resting on a practice pad on a low table, a wall of band stickers, teal light from a small window, a pair of headphones hanging on a hook." &
pool; gen bg_mini_tok_door_split "$SCENE_SUFFIX" "The booking counter of a Tokyo livehouse, a clipboard and a small stack of paper tickets on the counter, neon signage glowing softly behind, a narrow staircase leading down to the club." &
pool; gen bg_mini_tok_click "$SCENE_SUFFIX" "A mixing desk in a compact Tokyo club during soundcheck, a laptop showing a metronome beside the faders, cables taped to the floor, teal and pink stage light in the background." &

# ---------------------------------------------------------------- 2. minigame backdrops: Mexico City
pool; gen bg_mini_mex_per_diem "$SCENE_SUFFIX" "The dashboard of a touring van parked on a Mexico City street at dusk, a paper envelope of cash and a notebook on the dash, warm street light through the windscreen, a taco stand glowing across the road." &
pool; gen bg_mini_mex_crowd_clap "$SCENE_SUFFIX" "A lively Mexico City plaza at night seen from the edge of a small stage, silhouettes of people clapping, papel picado banners overhead, warm string lights, a bass guitar leaning on an amplifier in the foreground." &
pool; gen bg_mini_mex_exchange "$SCENE_SUFFIX" "A busy Mexico City street corner with a small bank branch, a market stall and a hotel doorway side by side, warm afternoon light, colorful facades, hand-painted signs too blurred to read." &
pool; gen bg_mini_mex_mercado "$SCENE_SUFFIX" "A small stall at a Sunday mercado in Mexico City, printed tote bags hanging from a wooden frame, bright awnings overhead, fruit stalls blurred in the background, warm morning light." &
pool; gen bg_mini_mex_son_meter "$SCENE_SUFFIX" "A courtyard in Mexico City in the evening, a small wooden jarana guitar resting on a tiled bench beside a wooden dance platform, potted plants, warm lanterns strung along a colorful wall." &

# ---------------------------------------------------------------- 2. minigame backdrops: Berlin
pool; gen bg_mini_ber_synth_call "$SCENE_SUFFIX" "The window of a small secondhand music shop in Berlin at night, a vintage synthesizer on display under a warm lamp, snow on the sill, the street reflected faintly in the glass." &
pool; gen bg_mini_ber_transpose "$SCENE_SUFFIX" "A backstage corridor in a Berlin warehouse club, a setlist taped to a concrete wall beside a keyboard on a stand, a single industrial lamp, midnight-indigo shadows." &
pool; gen bg_mini_ber_beatmatch "$SCENE_SUFFIX" "A DJ booth in a Berlin warehouse club seen from beside it, two turntables and a mixer glowing softly, haze drifting through a single beam of light, the dark dance floor beyond." &
pool; gen bg_mini_ber_night_budget "$SCENE_SUFFIX" "The bar of a Berlin club at two in the morning, a few banknotes and a notebook laid out on the counter, a late-night food stand glowing through a doorway, a worn couch in a side room." &

wait
echo "Done."
ls "$OUT"/*.webp 2>/dev/null | wc -l
