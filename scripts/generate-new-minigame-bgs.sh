#!/usr/bin/env bash
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
gen "ber_modular_check" "A dim Berlin warehouse backstage corner, a modular synthesizer covered in glowing patch cables on a road case, small coloured LEDs, concrete wall behind, midnight indigo shadows and a single warm work lamp."
gen "tok_mix_hold" "A small Tokyo venue mixing desk seen from behind, rows of faders and knobs glowing under a task lamp, the dark empty stage visible beyond in soft focus, teal and pink light spill."
gen "lis_live_radio" "A tiny Lisbon radio studio at night, a vintage microphone on a boom arm, a glowing ON AIR bulb, acoustic foam and warm wood panelling, a mixing board with soft amber lights."
echo Done.
