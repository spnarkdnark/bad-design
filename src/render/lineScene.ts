/** Pen lines → primitives (feet): stroke, optional fill, arrowheads; sketched when the drawing is. */
import type { PenLine, Project } from '../model/types';
import { arrowLengthPt, dashPatternPt } from '../model/defaults';
import { arrowHead, linePoints, pullBack } from '../model/linework';
import { darken } from '../model/color';
import { scaleParams, sketchClosedStroke, sketchFill, isClean, type SketchParams } from './sketch';
import { openStrokePrims, opsToPrims, seeded, subdivide, type Prim, type StrokeP } from './primitives';

export function linePrims(l: PenLine, project: Project, base: SketchParams, ftPerPt: number): Prim[] {
  const { style } = l;
  const params = style.sketch ? base : scaleParams(base, 0);
  const seed = seeded(l.id, project.settings.graphic.seed);
  const dash = dashPatternPt(style.dash, style.weightPt);
  const stroke: StrokeP = {
    color: style.color,
    alpha: 1,
    width: style.weightPt * ftPerPt,
    dash: dash ? [dash[0] * ftPerPt, dash[1] * ftPerPt] : undefined,
    cap: style.dash === 'dotted' ? 'round' : 'butt',
  };
  const pts = linePoints(l);
  const out: Prim[] = [];

  if (l.closed) {
    const clean = isClean(params);
    const opts = { params, seed, unitsPerPt: ftPerPt };
    const ring = clean ? pts : subdivide(pts, 1.5 * ftPerPt);
    if (style.fill) {
      const colors = { fill: style.fill, fillDark: darken(style.fill, 0.28), stroke: style.color };
      if (clean) out.push({ t: 'path', pts, closed: true, fill: { color: style.fill, alpha: style.fillOpacity } });
      else out.push(...opsToPrims(sketchFill(ring, opts), colors, style.fillOpacity));
    }
    if (style.weightPt > 0) {
      if (clean) out.push({ t: 'path', pts, closed: true, stroke });
      else {
        const colors = { fill: style.color, fillDark: style.color, stroke: style.color };
        out.push(...opsToPrims(sketchClosedStroke(ring, { width: stroke.width, dash: stroke.dash }, opts), colors, 1));
      }
    }
    return out;
  }

  // open: the stroke stops inside each arrowhead so its end doesn't poke past the tip
  const len = arrowLengthPt(style.weightPt) * ftPerPt;
  const n = pts.length;
  const body = pts.slice();
  if (style.arrowStart) body[0] = pullBack(pts[0], pts[1], len * 0.8);
  if (style.arrowEnd) body[n - 1] = pullBack(pts[n - 1], pts[n - 2], len * 0.8);
  if (style.weightPt > 0) out.push(...openStrokePrims(body, stroke, params, seed, ftPerPt));
  const head = (tip: (typeof pts)[0], from: (typeof pts)[0]): Prim => ({
    t: 'path',
    pts: arrowHead(tip, from, len),
    closed: true,
    fill: { color: style.color, alpha: 1 },
  });
  if (style.arrowStart) out.push(head(pts[0], pts[1]));
  if (style.arrowEnd) out.push(head(pts[n - 1], pts[n - 2]));
  return out;
}
