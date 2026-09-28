#!/usr/bin/env bash
# Van travel variants (2026-09-28). Every drive used to show the same painting (bg_scene_van).
# Three more, same viewpoint from the back seat, different road, hour, and weather, so a tour's
# drives never repeat back to back (see vanBackdropKey in src/art/sprites.ts). Background-loaded
# from img/later like the return-visit art. Output 720x1280 via process-bg.sh.
set -uo pipefail
cd "$(dirname "$0")/.."
export GEMINI_API_KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')" | tr -d '\r')
GEN="C:/Users/Jbthi/.claude/skills/threejs-image-generator/scripts/generate_image.py"
OUT="public/assets/img/later"
STYLE="Soft gouache painting, cozy storybook illustration style, portrait orientation 9:16."
SUFFIX="The inside of a touring van seen from the back seat looking forward, one continuous scene from one fixed viewpoint, gear bags and instrument cases stacked beside the seats. No panels, no split composition, no horizontal bands, no collage. Painterly brushwork, warm inviting palette, no faces, no text, no border, no frame."
gen() {
  local key="$1" scene="$2" webp="$OUT/$1.webp" raw="$OUT/$1.raw.png"
  [ -f "$webp" ] && { echo "skip $key"; return 0; }
  for attempt in 1 2 3; do
    if uv run "$GEN" --resolution 2K --prompt "$STYLE $scene $SUFFIX" --filename "$raw" >/dev/null 2>&1 && [ -s "$raw" ]; then
      ./scripts/process-bg.sh "$raw" "$webp" && rm -f "$raw" && return 0
    fi
    echo "retry $key ($attempt)"; sleep 8
  done
  echo "FAILED $key"; return 1
}
gen bg_scene_van_2 "Early morning on a coastal highway, pale golden sunrise over the sea through the windshield, one bandmate's feet up on the dashboard, coffee cups in the cup holders."
gen bg_scene_van_3 "A rainy afternoon on a mountain road, rain streaking the side windows, wipers mid-sweep, green hills and low clouds ahead, a paper map spread across the front passenger seat."
gen bg_scene_van_4 "Late evening crossing a long bridge into a city skyline glowing orange and pink at dusk, the city lights reflected in the river, a string of fairy lights taped along the van ceiling."
echo Done
