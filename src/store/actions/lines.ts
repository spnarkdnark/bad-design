/** Pen lines: drawing, restyling, closing and point edits (move/delete/duplicate: elements.ts). */
import type { Draft } from 'immer';
import type { Id, LineStyle, PenLine, Point } from '../../model/types';
import { createLine } from '../../model/factory';
import { deletePoint, insertPoint, minPoints } from '../../model/linework';
import { getDoc } from '../documentStore';
import { commit, ui } from './shared';
import { selectElements } from './selection';

/** Add a line through world points (in the last used look) and select it; null if too short. */
export function addLine(worldPts: Point[], closed = false): Id | null {
  const pts = worldPts.filter((p, i) => i === 0 || Math.hypot(p.x - worldPts[i - 1].x, p.y - worldPts[i - 1].y) > 1e-6);
  if (pts.length < minPoints({ closed })) return null;
  const l = createLine(pts, closed, ui().lineStyle);
  commit((d) => {
    d.lines[l.id] = l;
    d.lineOrder.push(l.id);
  });
  selectElements({ lines: [l.id] });
  return l.id;
}

/** Finish the pen draft: open, or closed when asked (and it has 3+ points). */
export function finishLineDraft(closed = false): Id | null {
  const draft = ui().lineDraft ?? [];
  ui().setLineDraft(null);
  return addLine(draft, closed && draft.length >= 3);
}

export function updateLines(ids: Id[], fn: (l: Draft<PenLine>) => void, coalesceKey?: string) {
  if (ids.length === 0) return;
  commit(
    (d) => {
      for (const id of ids) if (d.lines[id]) fn(d.lines[id]);
    },
    coalesceKey ? { coalesceKey: `${coalesceKey}:${ids.join(',')}` } : undefined,
  );
}

/** Change part of the look of lines; new lines then get this look too. */
export function setLineStyle(ids: Id[], patch: Partial<LineStyle>) {
  updateLines(ids, (l) => void Object.assign(l.style, patch), `line-style:${Object.keys(patch).join(',')}`);
  const first = getDoc().lines[ids[0]];
  if (first) ui().setLineStyle({ ...first.style });
}

/** Close or open lines (lines with only 2 points stay open). */
export function setLineClosed(ids: Id[], closed: boolean) {
  updateLines(ids, (l) => void (l.closed = closed && l.points.length >= 3));
}

export function deleteLinePoint(id: Id, index: number) {
  const l = getDoc().lines[id];
  const pts = l && deletePoint(l, index);
  if (pts) updateLines([id], (d) => void (d.points = pts));
}

export function insertLinePoint(id: Id, segment: number, world: Point) {
  const l = getDoc().lines[id];
  if (l) updateLines([id], (d) => void (d.points = insertPoint(l, segment, world)));
}
