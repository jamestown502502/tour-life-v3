#!/usr/bin/env bash
# The OTHER four songs.
#
# Part B added a second song per city and generated real audio for those four. The four ORIGINAL
# songs -- the ones a first visit is most likely to open with -- were never given any. They fell
# back to the procedural oscillator bed, so half of every playthrough's shows had no real music,
# and two cities in a row could sound like the same synth pad with different notes. Reported live
# as "the audio is the same every city and every scenario".
#
# Each prompt matches that song's authored BPM, waveform and mood exactly, so the generated track
# lands on the existing chart rather than needing the chart rewritten.
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

# Berlin, kreuzberg_static: 126 BPM, square wave, Dm-Bb-F-C. Cold, fast, warehouse.
gen_song "berlin_first" "A cold driving minimal techno-leaning indie instrumental at exactly 126 BPM, roughly 60 seconds, analogue saw and square synth stabs, insistent four-on-the-floor kick, tape hiss and concrete room reverb, hypnotic Berlin warehouse energy, no vocals, clean loopable ending."

# Tokyo, neon_rain: 118 BPM, square wave, Am-F-C-G. Neon synth-pop in the wet.
gen_song "tokyo_first" "A neon city-pop instrumental at exactly 118 BPM, roughly 60 seconds, bright chorused electric guitar, glassy FM synth leads, punchy gated drums, rain-slick nighttime energy, melodic and propulsive, no vocals, clean ending."

# Lisbon, sailor_lullaby: 92 BPM, triangle wave, Am7-Fmaj7-Cmaj7-G6. Slow, acoustic, tidal.
gen_song "lisbon_first" "A slow acoustic indie folk instrumental at exactly 92 BPM, roughly 60 seconds, fingerpicked nylon-string guitar, soft upright bass, brushed drums, gentle accordion swell, a sailor's lullaby by the water at dusk, tender and unhurried, no vocals, clean ending."

# Mexico City, callejon_groove: 104 BPM, triangle wave, Am-Dm-E7-Am. Street groove, minor key.
gen_song "mexico_first" "A warm Latin street-groove indie instrumental at exactly 104 BPM, roughly 60 seconds, syncopated nylon guitar, congas and timbales, walking bass, minor-key and swaggering, a narrow alley at golden hour, no vocals, clean ending."

echo "Done."
