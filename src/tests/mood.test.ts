// The cast used to smile through everything. See game/mood.ts.
import { describe, it, expect } from 'vitest';
import { inferMood, moodForNode } from '../game/mood';

describe('portrait mood inference', () => {
  it('an authored mood always wins over inference', () => {
    expect(moodForNode('tense', 'What a wonderful, brilliant, lovely day.')).toBe('tense');
    expect(moodForNode('worried', 'We did it!')).toBe('worried');
  });

  it('falls back to inference only when the writer left it out', () => {
    expect(moodForNode(undefined, 'I wrote a new song, listen to this.')).toBe('inspired');
    expect(moodForNode('not-a-real-mood', 'I wrote a new song, listen to this.')).toBe('inspired');
  });

  it('reads worry, not cheer, off the lines that carry it', () => {
    expect(inferMood("If my hands start shaking again like last time, somebody tell me to sit down.")).toBe('worried');
    expect(inferMood('The room was half empty and nobody stayed.')).toBe('worried');
    expect(inferMood("I don't know if we can afford the next leg.")).toBe('worried');
  });

  it('reads conflict as tense', () => {
    expect(inferMood("You always do this. Forget it.")).toBe('tense');
    expect(inferMood("Stop. That's not what I said.")).toBe('tense');
  });

  it('reads creative momentum as inspired', () => {
    expect(inferMood('I have an idea for the bridge — what about a key change?')).toBe('inspired');
    expect(inferMood('Play it again, that riff sounds like the chorus.')).toBe('inspired');
  });

  it('stays neutral-positive when a line carries no emotional signal at all', () => {
    expect(inferMood('The van is parked around the back.')).toBe('happy');
    expect(inferMood('Doors at seven.')).toBe('happy');
  });

  it('never returns a mood without a painted portrait behind it', () => {
    const painted = ['happy', 'worried', 'tense', 'inspired'];
    const lines = [
      'We did it!', 'I am so tired.', 'You never listen.', 'New riff, listen.',
      'Doors at seven.', '', 'Why do you always say that?!',
    ];
    for (const line of lines) expect(painted).toContain(inferMood(line));
  });
});
