/** Draw scene primitives onto a 2D canvas context already transformed to world feet. */
import type { LabelPrim, Prim, TextScene } from './scene';
import { lineBaselinePt } from './scene';
import { textFont } from '../model/text';
import { hexToRgb } from '../model/color';

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * A run of primitives compiled for fast redraws: one Path2D per run of consecutive prims
 * that paint the same way. Hand-drawn styles emit hundreds of strokes per bubble (pencil
 * hatching); drawing them one by one every frame made panning and dragging crawl.
 * Merging only joins neighbours with an identical look, so drawing order is kept; hatch
 * strokes of one pass are parallel and never overlap, so translucent ones look the same.
 */
interface Batch {
  path: Path2D;
  fill?: string;
  stroke?: { style: string; width: number; cap: CanvasLineCap; dash: number[] };
}

/** Compiled batches per prim list: scene lists are reused while their element is unchanged. */
const compiled = new WeakMap<Prim[], Batch[]>();

function addGeometry(path: Path2D, p: Prim) {
  switch (p.t) {
    case 'circle':
      path.moveTo(p.cx + p.r, p.cy);
      path.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
      break;
    case 'arc':
      path.moveTo(p.cx + p.r * Math.cos(p.a0), p.cy + p.r * Math.sin(p.a0));
      path.arc(p.cx, p.cy, p.r, p.a0, p.a1);
      break;
    case 'path':
      path.moveTo(p.pts[0].x, p.pts[0].y);
      for (let i = 1; i < p.pts.length; i++) path.lineTo(p.pts[i].x, p.pts[i].y);
      if (p.closed) path.closePath();
      break;
  }
}

function compile(prims: Prim[]): Batch[] {
  const out: Batch[] = [];
  let key = '';
  for (const p of prims) {
    if (p.t === 'path' && p.pts.length === 0) continue;
    const fill = p.t !== 'arc' && p.fill ? rgba(p.fill.color, p.fill.alpha) : undefined;
    const s = p.stroke;
    const stroke = s
      ? { style: rgba(s.color, s.alpha), width: s.width, cap: s.cap as CanvasLineCap, dash: s.dash ?? [] }
      : undefined;
    // fills never merge (a merged translucent fill would paint overlaps once, not twice);
    // strokes merge with neighbours that look identical
    const k = !fill && stroke ? `${stroke.style}|${stroke.width}|${stroke.cap}|${stroke.dash.join(',')}` : '';
    const last = out[out.length - 1];
    if (k && k === key && last) {
      addGeometry(last.path, p);
      continue;
    }
    const path = new Path2D();
    addGeometry(path, p);
    out.push({ path, fill, stroke });
    key = k;
  }
  return out;
}

export function drawPrims(ctx: CanvasRenderingContext2D, prims: Prim[]) {
  let batches = compiled.get(prims);
  if (!batches) compiled.set(prims, (batches = compile(prims)));
  ctx.lineJoin = 'round';
  for (const b of batches) {
    if (b.fill) {
      ctx.fillStyle = b.fill;
      ctx.fill(b.path);
    }
    if (b.stroke) {
      ctx.strokeStyle = b.stroke.style;
      ctx.lineWidth = b.stroke.width;
      ctx.lineCap = b.stroke.cap;
      ctx.setLineDash(b.stroke.dash);
      ctx.stroke(b.path);
    }
  }
  ctx.setLineDash([]);
}

/**
 * Labels are drawn in screen pixels (counter-scaled) for crisp text.
 * @param k stage scale (px per ft); ftPerPt converts paper points to feet
 */
export function drawLabels(ctx: CanvasRenderingContext2D, labels: LabelPrim[], k: number, ftPerPt: number) {
  const pxPerPt = ftPerPt * k;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const l of labels) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.scale(1 / k, 1 / k);
    for (const line of l.layout.lines) {
      ctx.font = `${line.weight} ${line.sizePt * pxPerPt}px ${l.fontFamily}`;
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, 0, (line.topPt + line.heightPt / 2 + line.sizePt * 0.35) * pxPerPt);
    }
    ctx.restore();
  }
}

/** Text blocks, counter-scaled like labels. */
export function drawTexts(ctx: CanvasRenderingContext2D, texts: TextScene[], k: number, ftPerPt: number) {
  const pxPerPt = ftPerPt * k;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const t of texts) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(1 / k, 1 / k);
    ctx.font = textFont(t.style, t.style.sizePt * pxPerPt);
    ctx.fillStyle = t.style.color;
    const { lineHeightPt } = t.layout;
    for (const l of t.layout.lines)
      if (l.text)
        ctx.fillText(l.text, l.xPt * pxPerPt, lineBaselinePt(l.topPt, lineHeightPt, t.style.sizePt) * pxPerPt);
    ctx.restore();
  }
}
