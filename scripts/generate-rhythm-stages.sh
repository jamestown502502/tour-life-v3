#!/usr/bin/env bash
# Final Polish Addendum v2, Item 10 — one rhythm-stage background per city, replacing the flat
# navy rectangle RhythmScene currently draws. Same pipeline as every other background
# (generate_image.py -> process-bg.sh -> manifest), keys bg_rhythm_<cityId>.
set -uo pipefail
cd "$(dirname "$0")/.."

export GEMINI_API_KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')" | tr -d '\r')
GEN="C:/Users/Jbthi/.claude/skills/threejs-image-generator/scripts/generate_image.py"
OUT="public/assets/img"
STYLE="Soft gouache painting, cozy storybook illustration style, portrait orientation 9:16."
# PROMPT REWRITE 2026-09-08. The previous suffix asked for "the vertical middle third ... darker
# and simpler than the top and bottom", and the model read that as THREE ZONES: every city came
# back as three stacked bands joined by hard horizontal seams (a sharp stage, a blurry middle, a
# separate floor-and-crowd shot), which read as three photos taped together. Measured seam
# positions differed per city, so it could not even be masked generically in code.
#
# This version never mentions thirds, bands, top or bottom. It asks for ONE continuous room from
# ONE viewpoint and gets the dark middle from something the model renders coherently anyway:
# depth. A room naturally falls into shadow between a lit stage and a foreground crowd.
# RhythmScene also veils the backdrop at runtime for legibility, so the art no longer has to
# carry that job alone.
SUFFIX="A single continuous scene painted from one fixed viewpoint in the audience looking toward the stage. One unbroken room with natural depth: the stage lit at the far end, the air between dim and hazy, the nearest foreground in shadow. Absolutely no panels, no split composition, no horizontal divisions or bands, no collage, no separate framed sections. Painterly brushwork, warm inviting palette, no text, no border, no frame."

gen_bg() {
  local id="$1" scene="$2"
  local webp="$OUT/bg_rhythm_${id}.webp"
  if [ -f "$webp" ]; then echo "skip $webp (exists)"; return 0; fi
  uv run "$GEN" --resolution 2K --prompt "$STYLE $scene $SUFFIX" --filename "$OUT/rhythm_${id}_bg.raw.png" || { echo "FAILED $id"; return 1; }
  ./scripts/process-bg.sh "$OUT/rhythm_${id}_bg.raw.png" "$webp"
  rm -f "$OUT/rhythm_${id}_bg.raw.png"
}

gen_bg "lisbon" "An intimate fado room stage in Lisbon, seen from the audience, warm amber and terracotta tones, strings of small warm lights crossing overhead, a small modest stage with a single stool and a guitar stand, tiled walls in the background."
gen_bg "tokyo" "A neon-soaked compact club stage in Tokyo, seen from the audience, teal and pink stage lighting, a rain-streaked window glowing with city lights in the far background, cables taped across the stage floor."
gen_bg "mexico_city" "An open-air festival stage in Mexico City at night, seen from the audience, citrus orange and warm community colors, colorful papel picado banners strung overhead, string lights, a warm crowd silhouette at the very edges of the frame."
gen_bg "berlin" "A midnight-indigo warehouse club stage in Berlin, seen from the audience, exposed concrete walls, a light haze in the air, minimal moody stage lighting, a single hanging industrial lamp."

echo "Done."
