#!/usr/bin/env bash
# Post-process a raw Gemini background into a game-ready WebP.
#
# Why this exists (three problems with the raw output, all measured, not assumed):
#   1. BORDER — Gemini renders a soft painterly white/cream edge around the artwork even when
#      the prompt explicitly says "no border, no frame, no white margin, no paper edge". It
#      ignores that instruction reliably. A 6% inset crop removes it; fighting the prompt does
#      not. Confirmed on both the original style probe and the first Lisbon generation.
#   2. ASPECT — output comes back at whatever aspect the model chose (~1536x2752 in practice,
#      close to but not exactly 9:16). Normalizing here means the runtime cover-fit in
#      src/art/background.ts is a no-op safety net rather than something doing real cropping.
#   3. SIZE — a raw 2K PNG is ~6.3MB. Four of those is ~25MB of background alone, which is not
#      shippable. WebP q82 at 1440x2560 lands ~340KB, an ~18x reduction with no visible loss on
#      painted art (verified by eye against the source).
#
# Output is 1440x2560 = exactly 2x the game's 720x1280 canvas, so it stays crisp at
# devicePixelRatio 2 without being gratuitously large.
#
# Usage: ./scripts/process-bg.sh <input.png> [output.webp]
#        (default output: same path/name with a .webp extension)

set -euo pipefail

IN="${1:?usage: process-bg.sh <input.png> [output.webp]}"
OUT="${2:-${IN%.*}.webp}"

ffmpeg -y -v error -i "$IN" \
  -vf "crop=iw*0.94:ih*0.94,scale=1440:2560:force_original_aspect_ratio=increase,crop=1440:2560" \
  -quality 82 "$OUT"

echo "$(basename "$IN") -> $(basename "$OUT")  $(du -h "$OUT" | cut -f1)"
