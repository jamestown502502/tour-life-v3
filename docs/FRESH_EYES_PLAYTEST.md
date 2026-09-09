# Fresh-Eyes Playtest

**Why this exists:** everyone who has touched this game knows how it is supposed to work, which
makes all of us the wrong people to judge whether it explains itself. Automated tests prove the
game *functions*. They cannot tell you whether a stranger understands what they are looking at in
the first sixty seconds, or whether they want a second run.

**Who:** 3–5 people who have never seen it. Ideally at least one who does not play rhythm games.

**How long:** one full run, about 30 minutes, on their own phone.

**Link:** https://tour-life-v3.vercel.app

---

## What to tell them (and nothing more)

> "It's a game about a band on tour. Play it on your phone, however you want. Tap to advance,
> there are no wrong answers. When you get to the music part, tap the lanes as the notes reach the
> gold line. Tell me what you actually thought afterwards."

Do not explain the minigames. Do not warn them about anything. Do not sit and watch over their
shoulder narrating — if they get stuck, that is the single most valuable thing this exercise can
find, and prompting them destroys it.

---

## The five questions

Ask afterwards, in this order. Write the answers down verbatim where you can.

**1. What did you think was going on in the first minute?**
Tests whether the opening explains itself. If they cannot describe the premise, the intro is not
doing its job regardless of how nice it looks.

**2. Was there any point where you were stuck, confused, or wanted to go back?**
The back button exists and now has content long enough to reach it — but if nobody notices it,
that is the same as it not existing.

**3. Was there anything you wanted to do that the game wouldn't let you?**
The most useful question in the set. Catches missing affordances rather than broken ones.

**4. Did the music part feel fair? Which minigame confused you most?**
Rhythm fairness is the thing most likely to differ on their hardware and their reflexes. There are
six minigame types now; "confused" is a design signal, not a player failing.

**5. Would you play again, or send this to someone? Yes / maybe / no — and why?**
The only question that measures whether it is worth sharing. "Maybe" is a real answer; press
gently on why.

---

## Reward participation, never positivity

Thank them the same amount whether they loved it or listed fifteen problems. If people learn that
enthusiasm is what gets appreciated, you stop receiving the thing you actually need. A tester who
says "I got bored in the second city and closed it" has done you more good than four who say it's
great.

Say so explicitly up front: *"Please be blunt — unflattering is more useful to me than kind."*

---

## Triage

Log every finding in `PLAYTEST_TRIAGE.md` under one of two headings. Be honest about which:

**Blockers — fix before public**
- Anyone stuck with no way forward
- Anything that reads as broken (even if technically working — perception is the bug)
- Anything that made someone quit before the end
- Console errors on their device

**Non-blockers — log and decide later**
- Preference disagreements ("I'd have liked more choices")
- Wants that imply new features
- Anything only one person hit and could not reproduce

The gate in `RELEASE_GATE.md` requires blockers fixed, not the list empty. A shipped game with a
known, written-down list of small annoyances is in far better shape than one held back until
nobody can find anything.
