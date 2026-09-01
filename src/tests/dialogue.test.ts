import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneGraph } from '../../content/schema';
import { advanceTarget, applyChoice, resolveNode, visibleChoices } from '../game/dialogue';
import { State } from '../core/state';

const graph: SceneGraph = {
  start: {
    id: 'start', speaker: 'narrator', text: 'You arrive.',
    choices: [
      { id: 'a', label: 'Cheer up', next: 'happy', effects: { harmony: 5 }, flags: ['cheered'] },
      { id: 'b', label: 'Stay quiet', next: 'quiet' },
      { id: 'c', label: 'Secret option', next: 'secret', condition: 'stat.harmony>=90' },
    ],
  },
  happy: { id: 'happy', speaker: 'narrator', text: 'Good mood.', next: 'end' },
  quiet: { id: 'quiet', speaker: 'narrator', text: 'Silence.' },
  secret: { id: 'secret', speaker: 'narrator', text: 'Hidden.' },
  end: { id: 'end', speaker: 'narrator', text: 'The end.' },
  gated: { id: 'gated', speaker: 'narrator', text: 'Gated content.', condition: 'flag:cheered', fallback: 'quiet' },
};

describe('dialogue engine', () => {
  beforeEach(() => {
    State.newRun('dialogue-test');
  });

  it('resolves a node with no condition directly', () => {
    expect(resolveNode(graph, 'start').id).toBe('start');
  });

  it('hides a choice whose condition is not met', () => {
    const visible = visibleChoices(graph.start);
    expect(visible.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('shows a conditioned choice once its condition is met', () => {
    State.data.stats.harmony = 95;
    const visible = visibleChoices(graph.start);
    expect(visible.map((c) => c.id)).toContain('c');
  });

  it('applyChoice mutates stats and flags and returns the next node id', () => {
    const nextId = applyChoice(graph.start.choices![0]);
    expect(nextId).toBe('happy');
    expect(State.data.stats.harmony).toBe(65); // 60 base + 5
    expect(State.hasFlag('cheered')).toBe(true);
  });

  it('falls back when a conditioned node is not satisfied', () => {
    expect(resolveNode(graph, 'gated').id).toBe('quiet');
  });

  it('resolves a conditioned node directly once its flag is set', () => {
    State.addFlag('cheered');
    expect(resolveNode(graph, 'gated').id).toBe('gated');
  });

  it('advanceTarget reads a choiceless node\'s next pointer', () => {
    expect(advanceTarget(graph.happy)).toBe('end');
    expect(advanceTarget(graph.quiet)).toBeUndefined();
  });
});
