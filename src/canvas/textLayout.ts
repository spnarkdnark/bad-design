/**
 * Label layout shared by the canvas renderer and the SVG/PDF/PNG exporter so
 * they wrap identically. All values are in PAPER POINTS relative to the
 * bubble center. Uses a 2D canvas for text measurement (browser only).
 */
import type { BubbleNode, LabelPart, Project } from '../model/types';
import { costLabel } from '../model/costs';
import { labelWidthFt } from '../model/geometry';
import { resolveStyle, secondaryLabel, type ResolvedStyle } from '../model/selectors';
import { ftToPt } from '../model/units';
import { LABEL_FONT_FAMILY, SECONDARY_LABEL_COLOR } from '../model/defaults';
import { setTextMeasurer } from '../model/text';

export interface LabelLine {
  text: string;
  sizePt: number;
  weight: 400 | 600;
  /** which part of the label this line belongs to (name lines, size line, cost line) */
  part: LabelPart;
  color: string;
  /** baseline-free: top of the line box relative to bubble center, pt */
  topPt: number;
  heightPt: number;
  /** measured text width, pt */
  wPt: number;
}

export interface LabelLayout {
  lines: LabelLine[];
  widthPt: number;
}

export const LINE_HEIGHT = 1.2;
const SECONDARY_RATIO = 0.85;

export interface LabelFont {
  family: string;
  upper: boolean;
}

const CLEAN_FONT: LabelFont = { family: LABEL_FONT_FAMILY, upper: false };

let ctx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();
let family = LABEL_FONT_FAMILY;

/** Forget cached text widths (call after a web font finishes loading). */
let epoch = 0;
export function clearTextMeasureCache() {
  widthCache.clear();
  epoch++;
}
/** Bumps whenever cached measurements are invalidated. */
export function measureEpoch(): number {
  return epoch;
}

/** Width at 1 pt of `text` in a CSS font given at 100px (cached). */
function measureFont(text: string, font100: string): number {
  const key = `${font100}|${text}`;
  let w = widthCache.get(key);
  if (w === undefined) {
    if (!ctx && typeof document !== 'undefined') ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      ctx.font = font100;
      w = ctx.measureText(text).width / 100;
    } else w = text.length * 0.55;
    if (widthCache.size > 20000) widthCache.clear();
    widthCache.set(key, w);
  }
  return w;
}
// text blocks (model/text.ts) measure with the same cache
setTextMeasurer(measureFont);

function measure(text: string, sizePt: number, weight: number): number {
  return measureFont(text, `${weight} 100px ${family}`) * sizePt;
}

function wrap(text: string, sizePt: number, weight: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    let line = words[0];
    for (const w of words.slice(1)) {
      const test = `${line} ${w}`;
      if (measure(test, sizePt, weight) <= maxWidth) line = test;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

export function layoutLabel(
  node: BubbleNode,
  project: Project,
  style: ResolvedStyle = resolveStyle(node, project),
  font: LabelFont = CLEAN_FONT,
): LabelLayout {
  const scale = project.settings.scale;
  family = font.family;
  const name = font.upper ? node.name.toUpperCase() : node.name;
  const size = style.labelSizePt;
  const weight = style.labelBold ? 600 : 400;
  // wrap width: most of the shape's width on paper, but never narrower than a few characters
  const widthPt = Math.max(ftToPt(labelWidthFt(node, project), scale), size * 4);
  const rows: Omit<LabelLine, 'topPt'>[] = [];
  for (const t of wrap(name, size, weight, widthPt))
    rows.push({
      text: t,
      sizePt: size,
      weight,
      part: 'name',
      color: style.labelColor,
      heightPt: size * LINE_HEIGHT,
      wPt: measure(t, size, weight),
    });
  // smaller gray lines under the name: size, then cost
  const extra: [LabelPart, string | null][] = [
    ['size', secondaryLabel(node, project, style)],
    ['cost', costLabel(node, project, style.labelCost)],
  ];
  family = font.family;
  const s = size * SECONDARY_RATIO;
  for (const [part, text] of extra)
    if (text)
      rows.push({
        text,
        sizePt: s,
        weight: 400,
        part,
        color: SECONDARY_LABEL_COLOR,
        heightPt: s * LINE_HEIGHT,
        wPt: measure(text, s, 400),
      });
  const total = rows.reduce((a, r) => a + r.heightPt, 0);
  let y = -total / 2;
  const lines = rows.map((r) => {
    const l = { ...r, topPt: y };
    y += r.heightPt;
    return l;
  });
  return { lines, widthPt };
}
