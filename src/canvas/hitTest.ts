/** Geometry-based hit testing in world feet (Konva layers are non-listening). */
import type { Id, Point, Project } from '../model/types';
import { connectionSegment, containsPoint, resizeHandle } from '../model/geometry';
import { elementAt, type ElementKind } from '../model/elements';
import { textWidthHandle } from '../model/text';
import { distToSegment } from '../model/polygon';

export type Hit =
  | { kind: 'handle'; id: Id }
  /** the wrapping-width handle of the selected text block */
  | { kind: 'textWidth'; id: Id }
  /** an element of any kind (topmost) */
  | { kind: 'element'; type: ElementKind; id: Id }
  | { kind: 'connection'; id: Id }
  | { kind: 'overlap'; key: string }
  | { kind: 'empty' };

/** Topmost bubble under `p`, ignoring other kinds of element (connect tool, wheel resize). */
export function topNodeAt(project: Project, p: Point): Id | null {
  for (let i = project.nodeOrder.length - 1; i >= 0; i--) {
    const id = project.nodeOrder[i];
    if (containsPoint(project.nodes[id], p, project)) return id;
  }
  return null;
}

/**
 * @param tolFt hit tolerance in feet (screen px / stage scale)
 * @param handleFor node id showing a resize handle (single selection), if any
 * @param textHandleFor text block id showing its width handle (single selection), if any
 */
export function hitTest(
  project: Project,
  p: Point,
  tolFt: number,
  handleFor: Id | null,
  markers: { key: string; marker: Point }[] = [],
  textHandleFor: Id | null = null,
): Hit {
  const t = textHandleFor ? project.texts[textHandleFor] : undefined;
  if (t) {
    const h = textWidthHandle(t, project);
    if (Math.hypot(p.x - h.x, p.y - h.y) <= tolFt * 1.2) return { kind: 'textWidth', id: t.id };
  }
  if (handleFor) {
    const h = project.nodes[handleFor] ? resizeHandle(project.nodes[handleFor]) : null;
    if (h && Math.hypot(p.x - h.x, p.y - h.y) <= tolFt * 1.2) return { kind: 'handle', id: handleFor };
  }
  for (const m of markers)
    if (Math.hypot(p.x - m.marker.x, p.y - m.marker.y) <= tolFt * 1.1) return { kind: 'overlap', key: m.key };
  const el = elementAt(project, p, tolFt);
  if (el) return { kind: 'element', type: el.kind, id: el.id };
  for (const c of Object.values(project.connections)) {
    const a = project.nodes[c.from];
    const b = project.nodes[c.to];
    if (!a || !b) continue;
    const seg = connectionSegment(a, b, project);
    if (seg && distToSegment(p, seg[0], seg[1]) <= tolFt) return { kind: 'connection', id: c.id };
  }
  return { kind: 'empty' };
}
