/** Selection operations (selection itself lives in uiStore and is not undoable). */
import type { Bounds, Id } from '../../model/types';
import {
  allElements,
  ELEMENT_KINDS,
  elementsInRect,
  existing,
  noElements,
  type ElementIds,
  type ElementKind,
} from '../../model/elements';
import { getDoc, useDocument } from '../documentStore';
import { ui } from './shared';

/** The selected elements (without connections and overlaps). */
export function selectedElements(): ElementIds {
  const sel = ui().selection;
  const out = noElements();
  for (const k of ELEMENT_KINDS) out[k] = sel[k];
  return out;
}

/** Select elements; `additive` adds them to the current elements (and keeps selected connections). */
export function selectElements(ids: Partial<ElementIds>, additive = false) {
  const cur = ui().selection;
  const next = noElements();
  for (const k of ELEMENT_KINDS)
    next[k] = additive ? Array.from(new Set([...cur[k], ...(ids[k] ?? [])])) : (ids[k] ?? []);
  ui().select({ ...next, connections: additive ? cur.connections : [] });
}

export function selectNodes(ids: Id[], additive = false) {
  selectElements({ nodes: ids }, additive);
}

/** Shift-click: add or remove one element, keeping the rest of the selection. */
export function toggleElement(kind: ElementKind, id: Id) {
  const cur = ui().selection;
  const list = cur[kind].includes(id) ? cur[kind].filter((x) => x !== id) : [...cur[kind], id];
  ui().select({ ...selectedElements(), [kind]: list, connections: cur.connections });
}

export function selectConnection(id: Id, additive = false) {
  const cur = ui().selection;
  if (additive) {
    const connections = cur.connections.includes(id)
      ? cur.connections.filter((c) => c !== id)
      : [...cur.connections, id];
    ui().select({ ...selectedElements(), connections });
  } else ui().select({ connections: [id] });
}

export function selectAll() {
  const d = getDoc();
  ui().select({ ...allElements(d), connections: Object.keys(d.connections) });
}

export function elementsInMarquee(rect: Bounds): ElementIds {
  return elementsInRect(getDoc(), rect);
}

/** Keep the selection consistent with the document (after undo/delete/load). */
export function installSelectionPruning() {
  return useDocument.subscribe((s, prev) => {
    if (s.history.present === prev.history.present) return;
    const d = s.history.present;
    const sel = ui().selection;
    const elements = existing(d, sel);
    const connections = sel.connections.filter((id) => d.connections[id]);
    const overlaps = sel.overlaps.filter((k) => k.split('|').every((id) => d.nodes[id]));
    const changed =
      ELEMENT_KINDS.some((k) => elements[k].length !== sel[k].length) ||
      connections.length !== sel.connections.length ||
      overlaps.length !== sel.overlaps.length;
    if (changed) ui().select({ ...elements, connections, overlaps });
    const cf = ui().connectFrom;
    if (cf && !d.nodes[cf]) ui().setConnectFrom(null);
  });
}
