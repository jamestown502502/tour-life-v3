#!/usr/bin/env bash
# Backdrops for the two music-theory minigames (Lisbon ear training, Mexico City clave).
set -uo pipefail
cd "$(dirname "$0")/.."
export GEMINI_API_KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')" | tr -d '\r')
GEN="C:/Users/Jbthi/.claude/skills/threejs-image-generator/scripts/generate_image.py"
OUT="public/assets/img"
STYLE="Soft gouache painting, cozy storybook illustration style, portrait orientation 9:16."
SUFFIX="A single continuous scene from one fixed viewpoint, one unbroken space with natural depth. No panels, no split composition, no horizontal divisions or bands, no collage. Painterly brushwork, warm inviting palette, no sharp-focus faces in the foreground, no text, no border, no frame."
gen() {
  local id="$1" scene="$2"
  local webp="$OUT/bg_mini_${id}.webp"
  if [ -f "$webp" ]; then echo "skip $webp"; return 0; fi
  uv run "$GEN" --resolution 2K --prompt "$STYLE $scene $SUFFIX" --filename "$OUT/${id}_bg.raw.png" || { echo "FAILED $id"; return 1; }
  ./scripts/process-bg.sh "$OUT/${id}_bg.raw.png" "$webp"
  rm -f "$OUT/${id}_bg.raw.png"
}
gen "lis_tune_by_ear" "A quiet Lisbon dressing room at dusk, a nylon-string acoustic guitar resting on a worn wooden chair beside an open shuttered window, tuning pegs catching the last warm light, patterned azulejo tiles on the wall behind, a glass of water on a stool, terracotta floor."
gen "mex_find_the_clave" "A narrow Mexico City side street at golden hour seen from a shaded doorway, a pair of congas and wooden claves resting against the door frame, papel picado strung overhead, ochre and rose painted plaster walls, worn cobblestones warm in the late light."
echo Done.
