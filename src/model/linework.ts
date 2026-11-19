/**
 * Pen lines: geometry for hit testing, bounds, arrowheads, the 45° lock and point
 * edits. Points are stored relative to the line's x/y (feet); weights are paper points.
 */
import type { Bounds, PenLine, Point, Project } from './types';
import { arrowLengthPt } from './defaults';
import { distToSegment, pointInPolygon } from './polygon';
import { ptToFt } from './units';

/** The line's points in world feet. */
export function linePoints(l: Pick<PenLine, 'x' | 'y' | 'points'>): Point[] {
  return l.points.map((p) => ({ x: l.x + p.x, y: l.y + p.y }));
}

/** Segments as point pairs (closing segment included when closed). */
export function lineSegments(l: PenLine): [Point, Point][] {
  const pts = linePoints(l);
  const segs: [Point, Point][] = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
  if (l.closed && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
  return segs;
}

const hasArrows = (l: PenLine) => !l.closed && (l.style.arrowStart || l.style.arrowEnd);

export function lineBounds(l: PenLine, project: Project): Bounds {
  const pts = linePoints(l);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const pad = ptToFt(hasArrows(l) ? arrowLengthPt(l.style.weightPt) / 2 : l.style.weightPt / 2, project.settings.scale);
  return {
    minX: Math.min(...xs) - pad,
    minY: Math.min(...ys) - pad,
    maxX: Math.max(...xs) + pad,
    maxY: Math.max(...ys) + pad,
  };
}

/** On the stroke (within `tolFt` of it), or inside a filled closed line. */
export function lineContains(l: PenLine, p: Point, project: Project, tolFt = 0): boolean {
  const half = ptToFt(l.style.weightPt / 2, project.settings.scale);
  if (lineSegments(l).some(([a, b]) => distToSegment(p, a, b) <= tolFt + half)) return true;
  return l.closed && l.style.fill !== null && pointInPolygon(p, linePoints(l));
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}

/** Touches the rectangle: a point inside it, a segment crossing it, or (filled) enclosing it. */
export function lineIntersects(l: PenLine, r: Bounds, project: Project): boolean {
  void project;
  const inside = (p: Point) => p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
  if (linePoints(l).some(inside)) return true;
  const c = [
    { x: r.minX, y: r.minY },
    { x: r.maxX, y: r.minY },
    { x: r.maxX, y: r.maxY },
    { x: r.minX, y: r.maxY },
  ];
  const edges: [Point, Point][] = c.map((p, i) => [p, c[(i + 1) % 4]]);
  if (lineSegments(l).some(([a, b]) => edges.some(([e, f]) => segmentsCross(a, b, e, f)))) return true;
  return l.closed && l.style.fill !== null && pointInPolygon(c[0], linePoints(l));
}

/** Shift while drawing: the point at the cursor's distance from `from`, on the nearest 45° direction. */
export function constrain45(from: Point, to: Point): Point {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  const step = Math.PI / 4;
  const a = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / step) * step;
  return { x: from.x + Math.cos(a) * d, y: from.y + Math.sin(a) * d };
}

/** An arrowhead (triangle) with its tip at `tip`, pointing away from `from`. */
export function arrowHead(tip: Point, from: Point, lengthFt: number): Point[] {
  const a = Math.atan2(tip.y - from.y, tip.x - from.x);
  const w = lengthFt / 2;
  const bx = tip.x - Math.cos(a) * lengthFt;
  const by = tip.y - Math.sin(a) * lengthFt;
  const nx = -Math.sin(a) * (w / 2);
  const ny = Math.cos(a) * (w / 2);
  return [tip, { x: bx + nx, y: by + ny }, { x: bx - nx, y: by - ny }];
}

/** Move `p` back towards `from` by `d` (so a line stops inside its arrowhead). */
export function pullBack(p: Point, from: Point, d: number): Point {
  const len = Math.hypot(p.x - from.x, p.y - from.y);
  if (len <= d) return from;
  return { x: p.x + ((from.x - p.x) / len) * d, y: p.y + ((from.y - p.y) / len) * d };
}

// ---------- point edits (each returns the new relative points) ----------

/** Smallest number of points a line can have. */
export const minPoints = (l: Pick<PenLine, 'closed'>) => (l.closed ? 3 : 2);

export function movePoint(l: PenLine, index: number, world: Point): Point[] {
  return l.points.map((p, i) => (i === index ? { x: world.x - l.x, y: world.y - l.y } : p));
}

/** Delete a point; null when the line would get too short. */
export function deletePoint(l: PenLine, index: number): Point[] | null {
  if (l.points.length <= minPoints(l)) return null;
  return l.points.filter((_, i) => i !== index);
}

/** Index of the segment (start point) within `tolFt` of `p`, or -1. */
export function segmentAt(l: PenLine, p: Point, tolFt: number): number {
  let best = -1;
  let bestD = tolFt;
  lineSegments(l).forEach(([a, b], i) => {
    const d = distToSegment(p, a, b);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Add a point at `world` after point `segment`. */
export function insertPoint(l: PenLine, segment: number, world: Point): Point[] {
  const pts = l.points.slice();
  pts.splice(segment + 1, 0, { x: world.x - l.x, y: world.y - l.y });
  return pts;
}

/** Every point of every line (to snap new points to). */
export function linePointsAll(project: Project, except?: string): Point[] {
  return project.lineOrder.filter((id) => id !== except).flatMap((id) => linePoints(project.lines[id]));
}
