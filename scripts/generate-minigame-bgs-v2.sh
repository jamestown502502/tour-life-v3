#!/usr/bin/env bash
# Final Polish Addendum v2, Item 8d — backdrops for the 4 new minigames, following the exact
# pipeline HANDOFF.md §11.1 documents for backgrounds (generate_image.py -> process-bg.sh ->
# manifest), just with bg_mini_<id> keys instead of bg_city_<id> ones.
set -uo pipefail
cd "$(dirname "$0")/.."

export GEMINI_API_KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')" | tr -d '\r')
GEN="C:/Users/Jbthi/.claude/skills/threejs-image-generator/scripts/generate_image.py"
OUT="public/assets/img"
STYLE="Soft gouache painting, cozy storybook illustration style, portrait orientation 9:16."
SUFFIX="Painterly brushwork, warm inviting palette, no sharp-focus people in the foreground, no text, no border, no frame."

gen_bg() { # gen_bg <id> <scene description>
  local id="$1" scene="$2"
  local webp="$OUT/bg_mini_${id}.webp"
  if [ -f "$webp" ]; then echo "skip $webp (exists)"; return 0; fi
  uv run "$GEN" --resolution 2K --prompt "$STYLE $scene $SUFFIX" --filename "$OUT/${id}_bg.raw.png" || { echo "FAILED $id"; return 1; }
  ./scripts/process-bg.sh "$OUT/${id}_bg.raw.png" "$webp"
  rm -f "$OUT/${id}_bg.raw.png"
}

gen_bg "ber_synth_check" "A cozy backstage corner in a Berlin warehouse club, a modular synthesizer rig covered in tangled patch cables sitting on a road case, warm stage lights bleeding in from just offstage, midnight-indigo shadows."
gen_bg "lis_load_in" "The narrow wooden stairwell of a small fado house in Lisbon, amps and instrument cases stacked on the steps mid-carry, warm amber wall sconces, terracotta tile floor visible at the bottom."
gen_bg "tok_soundcheck" "A compact neon-lit club stage in Tokyo mid-soundcheck, a drum kit under teal and pink stage lights, a rain-streaked window in the background, cables taped to the floor."
gen_bg "mex_radio_callin" "A small community radio booth at a Mexico City street market, a well-worn microphone on a stand, colorful papel picado banners strung overhead, warm string lights, a hand-painted station sign just out of focus."

echo "Done."
