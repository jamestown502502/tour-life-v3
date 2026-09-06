# Friends & Family Checklist — Tour Life: International Dates

Your own 5-minute real-device pass before sending the link out. Everything CI/automation can
check has already been checked (see `docs/TESTING_PROCEDURES.md`) — this is specifically the
part only a real phone in your own hands can confirm.

**Live URL:** https://tour-life-v3.vercel.app

## The pass (~5 minutes)

1. **Open the link on iPhone Safari AND one Android phone's Chrome.** Two different engines
   (WebKit/Blink) — a bug specific to one won't show on the other.
2. **Tap through one full city**, including a rhythm song: New Run → pick a genre/why-tour →
   meet the band (tap a face) → travel to the first city → arrival dialogue → a minigame → 2
   locations → a relationship scene → the pre-show choice → play the song (just tap notes as they
   reach the gold line, missing is fine) → Results → after-show dialogue.
3. **Confirm, specifically:**
   - The game canvas is **centered** on screen, not pushed to one side.
   - Music/the title theme is audible after your first tap (browsers require a tap before audio
     unlocks — that's expected, not a bug).
   - Nothing ever visually "sticks" — every tap gets a response within about a second.
   - Text fits inside its buttons/panels, nothing overlapping or cut off.
4. **Optional: add to home screen.** iOS Safari's Share sheet → "Add to Home Screen"; Android
   Chrome will offer an install prompt on its own. Not required for the game to work, just a nice
   touch if you want the icon on your phone.

## What to tell testers

Keep it to one line: **"Tap to advance, no wrong answers — just play through. When you get to
the rhythm part, tap the lane as the note reaches the gold line."** That's the whole rulebook.
Nothing they do can "lose" — every choice just makes a different story, and a missed rhythm note
is scored but never blocks anything.

## If something looks wrong

Screenshot it and note: which phone/browser, roughly where in a run it happened, and whether it
recurred on a second try. The backlog button (the "≡" icon, top-left of any dialogue screen) lets
a tester re-read the last ~30 lines if they think they missed something — point them to it if
they ask "wait, what did that just say?"
