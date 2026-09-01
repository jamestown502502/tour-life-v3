#!/usr/bin/env bash
# Generate all 16 bandmate portraits (4 characters x 4 moods) as transparent sprites.
#
# This is the executable form of docs/character-sheets.md — read that first for WHY the
# identity blocks must be reused verbatim and why moods are derived image-to-image instead of
# generated fresh. Editing an identity block here without editing it there (or vice versa) is
# how the two drift apart and a character stops looking like themselves.
#
# Idempotent: skips any portrait that already exists, so a partial/interrupted run can just be
# re-run. To regenerate one character, delete their four files first — and regenerate ALL four,
# because moods 2-4 are derived from the base and a new base means a new face.
#
# Usage: ./scripts/generate-portraits.sh

set -uo pipefail
cd "$(dirname "$0")/.."

export GEMINI_API_KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')" | tr -d '\r')
SCRIPT="C:/Users/Jbthi/.claude/skills/user/game-image-generator/scripts/generate_sprite.mjs"
OUT="public/assets/img"

# The background MUST be a saturated green, not the neutral light gray this originally used.
# Gray sits chromatically next to two things that are part of the subject: the whites of the
# eyes, and Rowan's pale sky-blue shirt. ffmpeg's colorkey ate both — every portrait came back
# with see-through eyes, and all four Rowans had large holes punched through the shirt. Pure
# green is far from every skin tone, hair color, eye white, and all four shirt colors
# (terracotta / teal / gold / sky), so nothing on the character is a near-match for it.
STYLE="Soft gouache cozy storybook character portrait, head and shoulders, centered, facing the viewer. Painterly gouache texture, soft rounded shapes, no harsh black outlines, warm even lighting, muted warm palette. Isolated on a plain flat uniform vivid pure green chroma-key background (#00FF00), with no scenery, no props, no cast shadow, and no green tint on the character. No text, no border, no frame."

id_mira="Mira, the band's lead singer: a young woman with light warm-toned skin, long dark brown wavy hair falling past her shoulders, wearing a terracotta-orange top, and a small round gold pendant on a thin chain."
id_theo="Theo, the band's drummer: a young man with medium tan skin, shaggy medium-brown hair with a fringe falling over his forehead, wearing a deep teal shirt, with a wooden drumstick tucked behind one ear."
id_jun="Jun, the band's guitarist and producer: a young person with deep brown skin and a short cropped black undercut hairstyle, wearing a warm golden-yellow shirt, with a guitar pick hanging on a cord around their neck."
id_rowan="Rowan, the band's bassist: a young person with light tan skin and auburn red hair worn in a single braid over one shoulder, wearing a pale sky-blue shirt, with a wide fabric bass strap across the chest."

mood_happy="Expression: warm open smile, relaxed eyebrows, bright eyes."
mood_worried="Expression: faint frown, eyebrows raised and drawn together, eyes looking slightly away, anxious."
mood_tense="Expression: jaw set, eyebrows lowered and knitted, mouth a flat line, guarded."
mood_inspired="Expression: eyes wide and lit up, slight open-mouthed smile, eyebrows raised, struck by an idea."

gen() { # gen <id> <mood> [referenceFile]
  local who="$1" mood="$2" ref="${3:-}"
  local file="$OUT/portrait_${who}_${mood}.png"
  if [ -f "$file" ]; then echo "skip  $file (exists)"; return 0; fi

  local identity mood_text prompt
  identity=$(eval echo "\"\$id_${who}\"")
  mood_text=$(eval echo "\"\$mood_${mood}\"")
  prompt="$STYLE $identity $mood_text"
  # Moods after the base are derived from it so the face stays the same person.
  [ -n "$ref" ] && prompt="Keep this exact character: identical face, hair, clothing and accessory. $prompt"

  if [ -n "$ref" ]; then
    node "$SCRIPT" --reference "$ref" --prompt "$prompt" --filename "$file" \
      --resolution 1K --chroma-key --output-size 280x280 || { echo "FAILED $file"; return 1; }
  else
    node "$SCRIPT" --prompt "$prompt" --filename "$file" \
      --resolution 1K --chroma-key --output-size 280x280 || { echo "FAILED $file"; return 1; }
  fi
  node scripts/fit-portrait.mjs "$file"
}

for who in mira theo jun rowan; do
  base="$OUT/portrait_${who}_happy.png"
  gen "$who" happy                    # base: text-to-image
  for mood in worried tense inspired; do
    gen "$who" "$mood" "$base"        # derived: image-to-image from the base
  done
done

echo "--- final verification pass ---"
fail=0
for f in "$OUT"/portrait_*.png; do
  node "$SCRIPT" verify "$f" || fail=1
done

# The alpha-percentage verify above is necessary but NOT sufficient: it answers "did the
# background key out?", not "did the key also eat part of the SUBJECT?". When the key eats
# subject pixels the transparent% goes UP, which reads as healthier, not worse — that is
# precisely how a whole set of portraits with keyed-out eye whites passed verification on the
# first run. This builds a contact sheet of every portrait composited over magenta; any
# background colour visible INSIDE a character (eyes, shirt, skin) is a hole that needs fixing.
# Look at it. It is the only check that catches this class of failure.
SHEET="docs/portrait-contact-sheet.png"
tmp=$(mktemp -d)
for who in mira theo jun rowan; do
  for m in happy worried tense inspired; do
    ffmpeg -y -v error -f lavfi -i "color=c=0xFF00FF:s=280x280:d=1" -i "$OUT/portrait_${who}_${m}.png" \
      -filter_complex "[0][1]overlay" -frames:v 1 "$tmp/h_${who}_${m}.png"
  done
  ffmpeg -y -v error -i "$tmp/h_${who}_happy.png" -i "$tmp/h_${who}_worried.png" \
    -i "$tmp/h_${who}_tense.png" -i "$tmp/h_${who}_inspired.png" \
    -filter_complex "[0][1][2][3]hstack=inputs=4" -frames:v 1 "$tmp/row_${who}.png"
done
mkdir -p docs
ffmpeg -y -v error -i "$tmp/row_mira.png" -i "$tmp/row_theo.png" -i "$tmp/row_jun.png" -i "$tmp/row_rowan.png" \
  -filter_complex "[0][1][2][3]vstack=inputs=4" -frames:v 1 "$SHEET"
rm -rf "$tmp"
echo "Contact sheet written to $SHEET — OPEN IT and check for magenta showing through any character."

[ "$fail" -eq 0 ] && echo "ALL PORTRAITS PASSED ALPHA VERIFICATION" || echo "ONE OR MORE PORTRAITS FAILED ALPHA VERIFICATION"
exit $fail
