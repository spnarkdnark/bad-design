/**
 * Text blocks: line layout and bounds. Positions are feet (model space); sizes and
 * widths are paper points, so text keeps its size on paper when the scale changes.
 * The canvas and the exporter both draw from `layoutText`, so they wrap identically.
 *
 * Measuring text needs a browser; canvas/textLayout.ts installs a real measurer with
 * `setTextMeasurer`. Without one (unit tests) an approximation is used.
 */
import type { Bounds, Point, Project, TextBlock, TextStyle } from './types';
import { MIN_TEXT_WIDTH_EM, TEXT_FONTS } from './defaults';
import { ptToFt } from './units';

/** Width of `text` drawn with a CSS font at 100px (e.g. `italic 700 100px Helvetica`), divided by 100. */
export type TextMeasurer = (text: string, font100: string) => number;

let measure: TextMeasurer = (text) => text.length * 0.55;
export function setTextMeasurer(m: TextMeasurer) {
  measure = m;
}

export const TEXT_LINE_HEIGHT = 1.2;

/** CSS font for a text style at a pixel size: `italic 700 16px 'EB Garamond', serif`. */
export function textFont(style: TextStyle, px: number): string {
  return `${style.italic ? 'italic' : 'normal'} ${style.bold ? 700 : 400} ${px}px ${TEXT_FONTS[style.font].family}`;
}

export interface TextLine {
  text: string;
  /** left edge of the line within the block (alignment), pt */
  xPt: number;
  /** top of the line box below the block's top, pt */
  topPt: number;
  /** measured width, pt */
  wPt: number;
}

export interface TextLayout {
  lines: TextLine[];
  widthPt: number;
  heightPt: number;
  lineHeightPt: number;
}

/** The text as drawn (capitals when the style says so). */
export const displayText = (t: Pick<TextBlock, 'text' | 'style'>) => (t.style.caps ? t.text.toUpperCase() : t.text);

function wrapParagraph(para: string, maxPt: number, width: (s: string) => number): string[] {
  const words = para.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const out: string[] = [];
  let line = words[0];
  for (const w of words.slice(1)) {
    const test = `${line} ${w}`;
    if (width(test) <= maxPt) line = test;
    else {
      out.push(line);
      line = w;
    }
  }
  out.push(line);
  return out;
}

/** Lines of a text block: its line breaks, plus wrapping when it has a width. Empty lines are kept. */
export function layoutText(t: Pick<TextBlock, 'text' | 'style' | 'widthPt'>): TextLayout {
  const { sizePt, align } = t.style;
  const font = textFont(t.style, 100);
  const width = (s: string) => measure(s, font) * sizePt;
  const raw = displayText(t).replace(/\r\n?/g, '\n').split('\n');
  const texts = t.widthPt ? raw.flatMap((p) => wrapParagraph(p, t.widthPt!, width)) : raw;
  const lineHeightPt = sizePt * TEXT_LINE_HEIGHT;
  const measured = texts.map((text) => ({ text, wPt: text ? width(text) : 0 }));
  const widthPt = t.widthPt ?? Math.max(sizePt, ...measured.map((l) => l.wPt));
  const lines = measured.map((l, i) => ({
    ...l,
    xPt: align === 'left' ? 0 : align === 'center' ? (widthPt - l.wPt) / 2 : widthPt - l.wPt,
    topPt: i * lineHeightPt,
  }));
  return { lines, widthPt, heightPt: lines.length * lineHeightPt, lineHeightPt };
}

/** The block's box in feet at the drawing's scale. */
export function textBounds(t: TextBlock, project: Project): Bounds {
  const l = layoutText(t);
  const ft = (pt: number) => ptToFt(pt, project.settings.scale);
  return { minX: t.x, minY: t.y, maxX: t.x + ft(l.widthPt), maxY: t.y + ft(l.heightPt) };
}

export function textContains(t: TextBlock, p: Point, project: Project, tolFt = 0): boolean {
  const b = textBounds(t, project);
  return p.x >= b.minX - tolFt && p.x <= b.maxX + tolFt && p.y >= b.minY - tolFt && p.y <= b.maxY + tolFt;
}

export function textIntersects(t: TextBlock, r: Bounds, project: Project): boolean {
  const b = textBounds(t, project);
  return b.minX <= r.maxX && b.maxX >= r.minX && b.minY <= r.maxY && b.maxY >= r.minY;
}

/** Where the width handle sits: middle of the right edge, feet. */
export function textWidthHandle(t: TextBlock, project: Project): Point {
  const b = textBounds(t, project);
  return { x: b.maxX, y: (b.minY + b.maxY) / 2 };
}

/** Wrapping width (pt) for the width handle dragged to `p`. */
export function textWidthAt(t: TextBlock, p: Point, project: Project): number {
  const pt = (p.x - t.x) / ptToFt(1, project.settings.scale);
  return Math.max(t.style.sizePt * MIN_TEXT_WIDTH_EM, pt);
}
