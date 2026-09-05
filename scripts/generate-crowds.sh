#!/usr/bin/env bash
# Final Polish Addendum v2, Item 7 — dynamic crowd sprites. 5 diverse concert-goers per city, each
# in two moods (good-show cheering vs bad-show bored), following the exact pattern
# generate-portraits.sh already established: a base image generated fresh, the second mood
# DERIVED from it via --reference so the same person's face/outfit carries across both moods
# (per the bandmate-portrait convention — moods aren't independent renders of "some person").
#
# Idempotent: skips any file that already exists.
# Usage: ./scripts/generate-crowds.sh

set -uo pipefail
cd "$(dirname "$0")/.."

export GEMINI_API_KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')" | tr -d '\r')
SCRIPT="C:/Users/Jbthi/.claude/skills/user/game-image-generator/scripts/generate_sprite.mjs"
OUT="public/assets/img"

STYLE="Soft gouache cozy storybook illustration of a single concert-goer at a small indie show, full body visible from the knees up, standing, angled slightly toward the viewer so the face is clearly visible. Painterly gouache texture, soft rounded shapes, no harsh black outlines, warm lighting. Isolated on a plain flat uniform vivid pure green chroma-key background (#00FF00), no scenery, no props, no cast shadow, no green tint on the subject. No text, no border, no frame."

mood_good="Expression and pose: genuinely delighted, big open smile, both arms raised up cheering, eyes bright and engaged, leaning slightly forward toward the show."
mood_bad="Expression and pose: unimpressed and a little bored, flat mouth, arms crossed low, eyes cast slightly down and to the side, weight shifted back."

# Berlin — coats and umbrellas, midnight-indigo warehouse-club night.
id_berlin_m1="An older man with pale skin, a gray beard, wearing a dark green raincoat and a black beanie."
id_berlin_m2="A young woman with medium-dark skin, an undercut hairstyle with a pink streak, an oversized denim jacket, holding a small closed black umbrella under one arm."
id_berlin_m3="A middle-aged woman with pale skin, curly red hair, a plaid wool coat, and round wire glasses."
id_berlin_m4="A young man with light-brown South Asian skin, a faux-leather jacket, damp wet-look black hair, and a septum piercing."
id_berlin_m5="A nonbinary young adult with dark skin, a shaved head, a bright yellow raincoat, and a silver chain necklace."

# Lisbon — warm layers, intimate amber-lit fado room.
id_lisbon_m1="An older woman with olive skin, gray hair in a low bun, a deep red shawl over her shoulders, and gold hoop earrings."
id_lisbon_m2="A young man with tan skin, curly dark brown hair, a cream cable-knit sweater, and a loosely wrapped scarf."
id_lisbon_m3="A middle-aged man with dark skin, a short afro, and a mustard-yellow corduroy jacket."
id_lisbon_m4="A young woman with pale freckled skin, auburn hair in a low ponytail, and a burgundy cardigan."
id_lisbon_m5="An older man with light-brown skin, thinning white hair, a brown wool coat, and a flat cap."

# Tokyo — neon accents, compact rain-slick club.
id_tokyo_m1="A young East Asian woman with a bright pink bob haircut, wearing a black turtleneck with a neon-green trim."
id_tokyo_m2="A young East Asian man with an undercut dyed teal, wearing an oversized bomber jacket with a reflective strip."
id_tokyo_m3="A middle-aged woman with tan skin, cat-eye glasses with neon-pink frames, and a dark denim jacket covered in small pins."
id_tokyo_m4="A young nonbinary person with light skin, a half-shaved head with an electric-blue streak, wearing a mesh top layered over a plain tee."
id_tokyo_m5="An older East Asian man with a gray undercut, a plain black jacket, and a single neon-pink pin on the collar."

# Mexico City — festive community color, open-air festival stage.
id_mexico_city_m1="A young woman with warm tan skin tone, long black hair with a flower tucked behind one ear, and an embroidered floral blouse."
id_mexico_city_m2="A middle-aged man with tan skin, a thick mustache, and a sky-blue guayabera shirt."
id_mexico_city_m3="A young man with deep warm skin tone, curly black hair, and a bright orange poncho-style top."
id_mexico_city_m4="An older woman with warm light skin tone, silver hair in a long braid, and a colorful striped rebozo shawl."
id_mexico_city_m5="A nonbinary young adult with medium skin, short dyed-magenta hair, a patterned bandana, and a denim vest."

gen_pair() { # gen_pair <city> <memberId>
  local city="$1" member="$2"
  local base_file="$OUT/crowd_${city}_${member}_good.png"
  local bad_file="$OUT/crowd_${city}_${member}_bad.png"
  local identity
  identity=$(eval echo "\"\$id_${city}_${member}\"")

  if [ -f "$base_file" ]; then
    echo "skip  $base_file (exists)"
  else
    node "$SCRIPT" --prompt "$STYLE $identity $mood_good" --filename "$base_file" \
      --resolution 1K --chroma-key --output-size 200x280 || { echo "FAILED $base_file"; return 1; }
  fi

  if [ -f "$bad_file" ]; then
    echo "skip  $bad_file (exists)"
  else
    node "$SCRIPT" --reference "$base_file" \
      --prompt "Keep this exact same person: identical face, hair, and clothing. $STYLE $identity $mood_bad" \
      --filename "$bad_file" --resolution 1K --chroma-key --output-size 200x280 || { echo "FAILED $bad_file"; return 1; }
  fi
}

for city in berlin lisbon tokyo mexico_city; do
  for member in m1 m2 m3 m4 m5; do
    gen_pair "$city" "$member"
  done
done

echo "Done. Verifying transparency on every crowd sprite..."
fail=0
for f in "$OUT"/crowd_*.png; do
  [ -f "$f" ] || continue
  node "$SCRIPT" verify "$f" || fail=1
done
if [ "$fail" -eq 1 ]; then
  echo "One or more crowd sprites failed the transparency check — see FAIL lines above."
  exit 1
fi
echo "All crowd sprites verified clean."
