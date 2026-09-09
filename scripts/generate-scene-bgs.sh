#!/usr/bin/env bash
# Pre-public close-out, Part A — "no barren screens".
#
# Five scenes rendered on flat navy instead of painted art: the opening beat, band creation, the
# route/promise screen, the scrapbook + epilogue, and the van travel beats. Every one of them is a
# screen players LINGER on (the intro and the epilogue especially), which is exactly where a bare
# background breaks the "one painted world" contract.
#
# Same pipeline as every other background (generate_image.py -> process-bg.sh -> manifest ->
# BootScene), keys bg_scene_<id>. The code-drawn/flat fallback stays in place: a missing file
# degrades, it never crashes.
set -uo pipefail
cd "$(dirname "$0")/.."

export GEMINI_API_KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')" | tr -d '\r')
GEN="C:/Users/Jbthi/.claude/skills/threejs-image-generator/scripts/generate_image.py"
OUT="public/assets/img"

STYLE="Soft gouache painting, cozy storybook illustration style, portrait orientation 9:16."
# CRITICAL, learned the hard way: the rhythm backdrops were originally generated with a suffix
# asking for "the vertical middle third ... darker and simpler than the top and bottom". The model
# painted that instruction LITERALLY as three stacked zones joined by hard horizontal seams, in all
# four cities, at different positions each — unmaskable in code and only fixed by regenerating.
# Never describe the image in bands, thirds, top or bottom. Ask for one continuous space and let
# depth do the work.
SUFFIX="A single continuous scene from one fixed viewpoint, one unbroken space with natural depth and soft falloff into shadow. No panels, no split composition, no horizontal divisions or bands, no collage, no separate framed sections. Painterly brushwork, warm inviting palette, no sharp-focus faces in the foreground, no text, no border, no frame."

gen_bg() { # gen_bg <key-suffix> <scene description>
  local id="$1" scene="$2"
  local webp="$OUT/bg_scene_${id}.webp"
  if [ -f "$webp" ]; then echo "skip $webp (exists)"; return 0; fi
  uv run "$GEN" --resolution 2K --prompt "$STYLE $scene $SUFFIX" --filename "$OUT/scene_${id}.raw.png" || { echo "FAILED $id"; return 1; }
  ./scripts/process-bg.sh "$OUT/scene_${id}.raw.png" "$webp"
  rm -f "$OUT/scene_${id}.raw.png"
}

# OpeningScene — "the night before the tour", four bandmates each saying the thing they're nervous
# about. Wants intimacy and anticipation, not the road yet.
gen_bg "opening" "The inside of a small band rehearsal room late at night, the last evening before a tour: instrument cases half packed by the door, a lamp in the corner throwing warm light across a worn rug, a window showing a dark street beyond, empty chairs pulled into a loose circle."

# BandCreatorScene — genre, name, why you are touring. Wants "before anything has happened yet".
gen_bg "bandcreator" "A cluttered practice space in the afternoon, sunlight through a dusty window, a guitar leaning against a battered amplifier, a notebook and pens on a stool, band flyers taped to the wall, nobody in the room yet."

# RoutePlanScene — the route list and the tour promise. Wants planning, maps, intention.
gen_bg "routeplan" "A wooden table seen from above and slightly to the side, covered with a paper map of Europe marked in pen, a corkboard behind it pinned with photographs and ticket stubs, a mug and a notebook at the edge, warm desk-lamp light."

# ScrapbookScene — the ending card and the "Two Months Later" epilogue. Wants after, home, quiet.
gen_bg "scrapbook" "A quiet room at home two months later, rain running down a large window, warm lamplight on a table where a scrapbook lies open beside a cold cup of tea, a guitar just visible against the wall in the soft dark."

# VanScene — the two-beat travel scene between cities. Wants motion, night, being in transit.
gen_bg "van" "The inside of a touring van at night seen from the back seat, motorway lights streaking past the windows, gear bags stacked beside the seats, the faint glow of a dashboard far ahead, everything else in soft darkness."

echo "Done."
