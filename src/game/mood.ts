// What face a character wears when the writing did not say.
//
// Sixteen portraits are painted -- four bandmates times happy / worried / tense / inspired -- and
// DialogueBox has always supported picking one per line via DialogueNode.portrait. But only 108 of
// the game's 503 dialogue nodes actually author a mood, and the fallback was `mood ?? 'happy'`.
// So for 79% of every conversation the cast smiled: through the argument about the setlist, through
// a bandmate admitting their hands shake, through the night the room did not fill. The expressive
// art existed and went unused, and worse, the wrong expression actively fought the line.
//
// This infers a mood from the line itself when the writer did not specify one. It is presentational
// only -- it never gates, scores, or branches anything -- and an authored `portrait` always wins.
// The bar it has to clear is not "always right", it is "better than smiling through everything".
export type PortraitMood = 'happy' | 'worried' | 'tense' | 'inspired';

/** Scored rather than first-match: a line like "I don't know, maybe we try something new" hits both
 *  the worried and inspired sets, and should land on whichever is better represented. */
const CUES: Record<PortraitMood, RegExp[]> = {
  tense: [
    /\b(don'?t|do not|stop|not again|whatever|forget it|drop it)\b/i,
    /\b(argu|shout|snap|slam|glare|tense|angry|furious|blame|fault)\w*/i,
    /\b(you always|you never|why do you|that'?s not)\b/i,
    /[?!]{2,}|!\s*$/,
  ],
  worried: [
    /\b(sorry|tired|exhaust\w*|scared|afraid|worried|nervous|shak\w+|ache|hurt)\b/i,
    /\b(i don'?t know|not sure|what if|can'?t|cannot|too much|slow down|sit down)\b/i,
    /\b(empty|quiet|nobody|no one|alone|late|money|rent|broke)\b/i,
  ],
  inspired: [
    /\b(idea|wrote|writing|new song|riff|melody|hook|bridge|chorus)\b/i,
    /\b(try|what about|imagine|listen to this|play it|sounds like)\b/i,
    /\b(better|finally|it works|that'?s it|yes)\b/i,
  ],
  happy: [
    /\b(thank|glad|love|good|great|brilliant|proud|laugh|smil\w+|warm|home)\b/i,
    /\b(we did it|nailed it|that was fun|come on)\b/i,
  ],
};

/** Ties break toward the calmer read: a line that is equally tense and worried is worried, and a
 *  line with no signal at all stays neutral-positive rather than inventing drama. */
const PRECEDENCE: PortraitMood[] = ['worried', 'tense', 'inspired', 'happy'];

export function inferMood(text: string): PortraitMood {
  const scores = new Map<PortraitMood, number>();
  for (const mood of PRECEDENCE) {
    scores.set(mood, CUES[mood].reduce((n, re) => n + (re.test(text) ? 1 : 0), 0));
  }
  let best: PortraitMood = 'happy';
  let bestScore = 0;
  for (const mood of PRECEDENCE) {
    const score = scores.get(mood) ?? 0;
    if (score > bestScore) { best = mood; bestScore = score; }
  }
  return bestScore === 0 ? 'happy' : best;
}

/** The mood to actually render: an authored one always wins, otherwise infer from the line. */
export function moodForNode(authored: string | undefined, text: string): PortraitMood {
  if (authored === 'happy' || authored === 'worried' || authored === 'tense' || authored === 'inspired') {
    return authored;
  }
  return inferMood(text);
}
