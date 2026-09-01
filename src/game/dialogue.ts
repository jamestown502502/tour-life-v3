// JSON node-graph dialogue engine (PRD §15.4.4). Data-driven, ~70-line core.

import type { DialogueChoice, DialogueNode, SceneGraph } from '../../content/schema';
import { evaluateCondition, type ConditionContext } from './condition';
import { State } from '../core/state';

function contextFromState(): ConditionContext {
  return {
    stats: State.data.stats,
    relationships: State.data.relationships,
    localLove: State.data.localLove,
    flags: State.data.flags,
  };
}

/** Resolves a node id to its live node, following `fallback` chains when a node's own
 *  condition fails. Throws if the graph is malformed (missing id, no fallback on a
 *  conditioned node) — that's a content bug that must be caught before ship, not hidden. */
export function resolveNode(graph: SceneGraph, nodeId: string): DialogueNode {
  const node = graph[nodeId];
  if (!node) throw new Error(`[dialogue] missing node "${nodeId}"`);
  if (node.condition && !evaluateCondition(node.condition, contextFromState())) {
    if (!node.fallback) throw new Error(`[dialogue] node "${nodeId}" has a condition but no fallback`);
    return resolveNode(graph, node.fallback);
  }
  return node;
}

/** Choices whose own condition passes, in authored order. */
export function visibleChoices(node: DialogueNode): DialogueChoice[] {
  if (!node.choices) return [];
  const ctx = contextFromState();
  return node.choices.filter((c) => evaluateCondition(c.condition, ctx));
}

/** Applies a choice's effects to global state and returns the next node id to resolve. */
export function applyChoice(choice: DialogueChoice): string {
  State.applyStatDeltas(choice.effects);
  State.applyRelationshipDeltas(choice.relationshipEffects);
  for (const flag of choice.flags ?? []) State.addFlag(flag);
  return choice.next;
}

/** For a choiceless node, the plain advance target (or undefined if this node ends the scene). */
export function advanceTarget(node: DialogueNode): string | undefined {
  return node.next;
}
