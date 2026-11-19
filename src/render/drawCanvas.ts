/** Draw scene primitives onto a 2D canvas context already transformed to world feet. */
import type { LabelPrim, Prim, Scene, StrokeP, TextScene } from './scene';
import type { LabelPart } from '../model/types';
import { lineBaselinePt } from './scene';
import { textFont } from '../model/text';
import { hexToRgb } from '../model/color';

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function applyStroke(ctx: CanvasRenderingContext2D, s: StrokeP) {
  ctx.strokeStyle = rgba(s.color, s.alpha);
  ctx.lineWidth = s.width;
  ctx.lineCap = s.cap;
  ctx.lineJoin = 'round';
  ctx.setLineDash(s.dash ?? []);
}

export function drawPrims(ctx: CanvasRenderingContext2D, prims: Prim[]) {
  for (const p of prims) {
    ctx.beginPath();
    switch (p.t) {
      case 'circle':
        ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
        break;
      case 'arc':
        ctx.arc(p.cx, p.cy, p.r, p.a0, p.a1);
        break;
      case 'path':
        if (p.pts.length === 0) continue;
        ctx.moveTo(p.pts[0].x, p.pts[0].y);
        for (let i = 1; i < p.pts.length; i++) ctx.lineTo(p.pts[i].x, p.pts[i].y);
        if (p.closed) ctx.closePath();
        break;
    }
    if (p.t !== 'arc' && p.fill) {
      ctx.fillStyle = rgba(p.fill.color, p.fill.alpha);
      ctx.fill();
    }
    if (p.stroke) {
      applyStroke(ctx, p.stroke);
      ctx.stroke();
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

/**
 * A whole scene, back to front: connections, bubbles, overlap treatments, pen lines,
 * labels, text. Used by the canvas and the splash screen. `hide`: what an in-place editor
 * is showing instead (a label part, a text block).
 * @param k stage scale (px per ft)
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  k: number,
  hide: { label?: { id: string; part: LabelPart } | null; textId?: string | null } = {},
) {
  drawPrims(ctx, scene.connections);
  for (const n of scene.nodes) {
    drawPrims(ctx, n.fill);
    drawPrims(ctx, n.outline);
  }
  drawPrims(ctx, scene.overlays);
  for (const l of scene.lines) drawPrims(ctx, l.prims);
  const editing = hide.label;
  const labels = scene.nodes.flatMap((n) => {
    if (!n.label) return [];
    if (n.id !== editing?.id) return [n.label];
    const lines = n.label.layout.lines.filter((l) => l.part !== editing.part);
    return [{ ...n.label, layout: { ...n.label.layout, lines } }];
  });
  drawLabels(ctx, labels, k, scene.ftPerPt);
  drawTexts(
    ctx,
    scene.texts.filter((t) => t.id !== hide.textId),
    k,
    scene.ftPerPt,
  );
}
