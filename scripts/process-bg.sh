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
#      shippable. WebP at the output size lands well under 340KB with no visible loss on painted
#      art (verified by eye against the source).
#
# Output is 720x1280, the game canvas's actual backing-store size. It was 1440x2560 until
# 2026-09-27 on the theory that 2x stays crisp at devicePixelRatio 2, but Phaser draws into a
# 720x1280 canvas whatever the screen's DPR, so the extra pixels were never shown. They did cost
# GPU memory: every texture stays decoded (w*h*4 bytes), and 53 backgrounds at 1440x2560 came to
# ~760 MB, enough for a phone to kill the tab (seen as "Target crashed" on the iPhone profile).
#
# Usage: ./scripts/process-bg.sh <input.png> [output.webp]
#        (default output: same path/name with a .webp extension)

set -euo pipefail

IN="${1:?usage: process-bg.sh <input.png> [output.webp]}"
OUT="${2:-${IN%.*}.webp}"

ffmpeg -y -v error -i "$IN" \
  -vf "crop=iw*0.94:ih*0.94,scale=720:1280:force_original_aspect_ratio=increase:flags=lanczos,crop=720:1280" \
  -quality 85 "$OUT"

echo "$(basename "$IN") -> $(basename "$OUT")  $(du -h "$OUT" | cut -f1)"
