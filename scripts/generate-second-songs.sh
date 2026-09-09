#!/usr/bin/env bash
# Pre-public close-out, Part B — a SECOND song per city.
#
# Every city had exactly one song, so a full run heard four tracks and the return leg replayed the
# same song as the first night. r/rhythmgames is blunt about this ("DO NOT repeat the same songs,
# add variety") and habituation research agrees: the same chart on repeat is the fastest way to
# lose a rhythm player. A second song per city also upgrades the return leg that already shipped —
# the town remembers you AND the setlist has moved on.
#
# Each second song is written as the SAME BAND'S other side: same city identity, deliberately
# different tempo and energy from the first.
#
# --model pro, not clip: clip caps at 30s and these need 55-70s to match the existing charts.
# The API key lives in the Windows USER environment, not the shell.
set -uo pipefail
cd "$(dirname "$0")/.."

export GEMINI_API_KEY=$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')" | tr -d '\r')
GEN="C:/Users/Jbthi/.claude/skills/user/game-music-generator/scripts/generate_music.mjs"
OUT="public/audio"
mkdir -p "$OUT"

gen_song() { # gen_song <file-stem> <prompt>
  local stem="$1" prompt="$2"
  local out="$OUT/${stem}.mp3"
  if [ -f "$out" ]; then echo "skip $out (exists)"; return 0; fi
  node "$GEN" --model pro --format mp3 --prompt "$prompt" --filename "$out" || { echo "FAILED $stem"; return 1; }
  echo "wrote $out"
}

# Lisbon's first song is a slow 92bpm acoustic lullaby. Its second is the room after midnight.
gen_song "lisbon_second" "A warm indie folk-rock instrumental at about 108 BPM, roughly 60 seconds, acoustic guitar and brushed drums building to a full band, Portuguese fado influence, nylon-string melody over a steady kick, bittersweet and rising, no vocals, clean loopable ending."

# Tokyo's first song is a 118bpm neon synth-pop cut. Its second is the quiet after the crowd goes.
gen_song "tokyo_second" "A sparse, slow city-pop instrumental at about 84 BPM, roughly 60 seconds, clean electric guitar with heavy reverb, soft synth pads, brushed rimshot drums, rain-at-night mood, restrained and spacious, no vocals, clean ending."

# Mexico City's first song is a 104bpm street groove. Its second leans harder into the rhythm.
gen_song "mexico_second" "A bright Latin-influenced indie instrumental at about 122 BPM, roughly 60 seconds, driving cumbia-flavoured percussion, bright clean guitar, warm bass, festive and propulsive, brass stabs, no vocals, clean ending."

# Berlin's first song is 126bpm cold synth static. Its second is colder and slower still.
gen_song "berlin_second" "A cold minimal electronic instrumental at about 96 BPM, roughly 60 seconds, analogue synth pads, muted four-on-the-floor kick, tape hiss, industrial warehouse ambience, hypnotic and restrained, no vocals, clean ending."

echo "Done."
