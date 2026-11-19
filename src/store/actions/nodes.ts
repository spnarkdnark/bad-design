/** Creating and editing bubbles (sizing: size.ts; delete/duplicate/nudge of any element: elements.ts). */
import type { Draft } from 'immer';
import type { BubbleNode, Id, Point } from '../../model/types';
import { createNode } from '../../model/factory';
import { getDoc } from '../documentStore';
import { commit, ui } from './shared';

export function addNode(at: Point, partial: Partial<Omit<BubbleNode, 'id'>> = {}): Id {
  const n = createNode({ name: `Space ${getDoc().nodeOrder.length + 1}`, ...partial, x: at.x, y: at.y });
  commit((d) => {
    d.nodes[n.id] = n;
    d.nodeOrder.push(n.id);
  });
  ui().select({ nodes: [n.id] });
  return n.id;
}

export function updateNodes(ids: Id[], fn: (n: Draft<BubbleNode>) => void, coalesceKey?: string) {
  if (ids.length === 0) return;
  commit(
    (d) => {
      for (const id of ids) if (d.nodes[id]) fn(d.nodes[id]);
    },
    coalesceKey ? { coalesceKey: `${coalesceKey}:${ids.join(',')}` } : undefined,
  );
}

/** Rename from the on-canvas editor: one undo step; an empty name leaves the element unlabeled. */
export function renameNode(id: Id, name: string) {
  const n = getDoc().nodes[id];
  const clean = name.trim() ? name.replace(/\s+$/g, '') : '';
  if (!n || clean === n.name) return;
  updateNodes([id], (d) => void (d.name = clean));
}
