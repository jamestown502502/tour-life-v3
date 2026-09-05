// Stuck-screen-hardening follow-up, Item C: content/opening.ts's graph integrity + the brief's
// own "<=40 words per beat" constraint, so a future edit that makes a beat too long fails a test
// instead of only being caught by eyeballing OpeningScene live.
import { describe, expect, it } from 'vitest';
import { BANDMATE_IDS } from '../../content/schema';
import { OPENING_GRAPH, OPENING_START } from '../../content/opening';

describe('content/opening.ts (Item C: the night-before opening beats)', () => {
  it('has exactly one beat per bandmate, keyed by their id', () => {
    expect(Object.keys(OPENING_GRAPH).sort()).toEqual([...BANDMATE_IDS].sort());
  });

  it('every beat speaks as a real bandmate with a real portrait mood', () => {
    for (const [id, node] of Object.entries(OPENING_GRAPH)) {
      expect(node.speaker, `${id}.speaker`).toBe(id);
      expect(node.id, `${id}.id`).toBe(id);
      expect(node.portrait, `${id}.portrait`).toBeTruthy();
    }
  });

  it('every beat is 40 words or fewer', () => {
    for (const [id, node] of Object.entries(OPENING_GRAPH)) {
      const wordCount = node.text.trim().split(/\s+/).length;
      expect(wordCount, `${id}'s beat is ${wordCount} words: "${node.text}"`).toBeLessThanOrEqual(40);
    }
  });

  it('OPENING_START is a real node, and walking every next reaches every bandmate exactly once with no cycle', () => {
    expect(OPENING_GRAPH[OPENING_START]).toBeTruthy();
    const visited: string[] = [];
    let cursor: string | undefined = OPENING_START;
    while (cursor) {
      expect(visited, `revisited "${cursor}" — the walk should never cycle`).not.toContain(cursor);
      visited.push(cursor);
      cursor = OPENING_GRAPH[cursor].next;
    }
    expect(visited.sort()).toEqual([...BANDMATE_IDS].sort());
  });
});
