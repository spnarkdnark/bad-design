/**
 * Operations on any selected elements, whatever their kind (see model/elements.ts):
 * delete, duplicate, nudge, bring to front. Kind-specific edits live in their own files.
 */
import {
  bringElementsToFront,
  countElements,
  existing,
  removeElements,
  translateElements,
  type ElementIds,
} from '../../model/elements';
import { buildClip, insertPlan, planIds, planPaste } from '../../model/clip';
import { DUPLICATE_OFFSET_FT } from '../../model/defaults';
import { detachAnchors } from '../../model/blob';
import { getDoc } from '../documentStore';
import { commit, ui } from './shared';
import { selectedElements, selectElements } from './selection';

/** Delete the selected elements and connections, and whatever depended on deleted bubbles. */
export function deleteSelection() {
  const doc = getDoc();
  const ids = existing(doc, selectedElements());
  const { connections } = ui().selection;
  if (countElements(ids) === 0 && connections.length === 0) return;
  const nodeSet = new Set(ids.nodes);
  // shapes hugging deleted bubbles keep their outline: anchors become free points
  const detached = Object.values(doc.nodes)
    .filter(
      (n) =>
        n.shape.kind === 'blob' &&
        !nodeSet.has(n.id) &&
        n.shape.points.some((p) => p.t === 'anchor' && nodeSet.has(p.node)),
    )
    .map((n) => ({ id: n.id, shape: detachAnchors(n, doc, (id) => nodeSet.has(id)) }));
  commit((d) => {
    for (const x of detached) d.nodes[x.id].shape = x.shape;
    removeElements(d, ids);
    for (const c of Object.values(d.connections)) {
      if (connections.includes(c.id) || nodeSet.has(c.from) || nodeSet.has(c.to)) delete d.connections[c.id];
    }
    for (const k of Object.keys(d.overlaps)) if (k.split('|').some((id) => nodeSet.has(id))) delete d.overlaps[k];
  });
  ui().clearSelection();
}

/** Duplicate the selected elements (with what they carry, like copy + paste), offset, and select the copies. */
export function duplicateSelection() {
  const doc = getDoc();
  const clip = buildClip(doc, selectedElements());
  if (!clip) return;
  const c = clip.center;
  const plan = planPaste(doc, clip, { x: c.x + DUPLICATE_OFFSET_FT, y: c.y + DUPLICATE_OFFSET_FT });
  commit((d) => insertPlan(d, plan));
  selectElements(planIds(plan));
}

/** Arrow keys: move the selected elements. Repeats merge into one undo step. */
export function nudgeSelection(dx: number, dy: number) {
  const ids = selectedElements();
  if (countElements(ids) === 0) return;
  const key = Object.values(ids).flat().join(',');
  commit((d) => translateElements(d, d, ids, dx, dy), { coalesceKey: `nudge:${key}` });
}

export function bringToFront(ids: Partial<ElementIds>) {
  commit((d) => bringElementsToFront(d, ids));
}
