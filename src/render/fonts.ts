/**
 * Bundled fonts (no network): the hand-lettering label fonts and the text block fonts
 * that aren't PDF standard fonts. The canvas uses them as web fonts; exports convert
 * them to vector outlines with opentype.js, so PDFs/SVGs look right without the font
 * installed. Styles a family doesn't have are faked (bold: a thin stroke; italic: a slant),
 * as the browser does on screen.
 */
import '@fontsource/architects-daughter/400.css';
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/700.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/eb-garamond/700-italic.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/700.css';
import '@fontsource/jost/400-italic.css';
import '@fontsource/jost/700-italic.css';
import '@fontsource/roboto-condensed/400.css';
import '@fontsource/roboto-condensed/700.css';
import '@fontsource/roboto-condensed/400-italic.css';
import '@fontsource/roboto-condensed/700-italic.css';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/700.css';
import '@fontsource/comic-neue/400.css';
import '@fontsource/comic-neue/700.css';
import '@fontsource/comic-neue/400-italic.css';
import '@fontsource/comic-neue/700-italic.css';
import architect400 from '@fontsource/architects-daughter/files/architects-daughter-latin-400-normal.woff?url';
import kalam400 from '@fontsource/kalam/files/kalam-latin-400-normal.woff?url';
import kalam700 from '@fontsource/kalam/files/kalam-latin-700-normal.woff?url';
import garamond400 from '@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff?url';
import garamond700 from '@fontsource/eb-garamond/files/eb-garamond-latin-700-normal.woff?url';
import garamond400i from '@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff?url';
import garamond700i from '@fontsource/eb-garamond/files/eb-garamond-latin-700-italic.woff?url';
import jost400 from '@fontsource/jost/files/jost-latin-400-normal.woff?url';
import jost700 from '@fontsource/jost/files/jost-latin-700-normal.woff?url';
import jost400i from '@fontsource/jost/files/jost-latin-400-italic.woff?url';
import jost700i from '@fontsource/jost/files/jost-latin-700-italic.woff?url';
import condensed400 from '@fontsource/roboto-condensed/files/roboto-condensed-latin-400-normal.woff?url';
import condensed700 from '@fontsource/roboto-condensed/files/roboto-condensed-latin-700-normal.woff?url';
import condensed400i from '@fontsource/roboto-condensed/files/roboto-condensed-latin-400-italic.woff?url';
import condensed700i from '@fontsource/roboto-condensed/files/roboto-condensed-latin-700-italic.woff?url';
import oswald400 from '@fontsource/oswald/files/oswald-latin-400-normal.woff?url';
import oswald700 from '@fontsource/oswald/files/oswald-latin-700-normal.woff?url';
import comic400 from '@fontsource/comic-neue/files/comic-neue-latin-400-normal.woff?url';
import comic700 from '@fontsource/comic-neue/files/comic-neue-latin-700-normal.woff?url';
import comic400i from '@fontsource/comic-neue/files/comic-neue-latin-400-italic.woff?url';
import comic700i from '@fontsource/comic-neue/files/comic-neue-latin-700-italic.woff?url';
import type { LabelFont, Project, TextFont } from '../model/types';
import { clearTextMeasureCache } from '../canvas/textLayout';

type OtFont = import('opentype.js').Font;

/** A font the app ships: a label font or a text font (the PDF standard fonts are not here). */
export type BundledFont = Exclude<LabelFont, 'clean'> | Exclude<TextFont, 'helvetica' | 'times' | 'courier'>;

interface Files {
  css: string;
  regular: string;
  bold?: string;
  italic?: string;
  boldItalic?: string;
}

const FILES: Record<BundledFont, Files> = {
  architect: { css: "'Architects Daughter'", regular: architect400 },
  pen: { css: "'Kalam'", regular: kalam400, bold: kalam700 },
  garamond: {
    css: "'EB Garamond'",
    regular: garamond400,
    bold: garamond700,
    italic: garamond400i,
    boldItalic: garamond700i,
  },
  futura: { css: "'Jost'", regular: jost400, bold: jost700, italic: jost400i, boldItalic: jost700i },
  condensed: {
    css: "'Roboto Condensed'",
    regular: condensed400,
    bold: condensed700,
    italic: condensed400i,
    boldItalic: condensed700i,
  },
  oswald: { css: "'Oswald'", regular: oswald400, bold: oswald700 },
  comic: { css: "'Comic Neue'", regular: comic400, bold: comic700, italic: comic400i, boldItalic: comic700i },
};

/** The bundled font behind a label font or text font, or null for system/PDF standard fonts. */
export function bundled(font: LabelFont | TextFont): BundledFont | null {
  return Object.hasOwn(FILES, font) ? (font as BundledFont) : null;
}

/** The bundled fonts a drawing uses: its label font and its text blocks' fonts. */
export function fontsIn(project: Project): BundledFont[] {
  const all = [project.settings.graphic.labelFont, ...Object.values(project.texts).map((t) => t.style.font)];
  return [...new Set(all.map(bundled).filter((f): f is BundledFont => f !== null))];
}

const webLoaded = new Set<BundledFont>();

/** Wait for the browser to load a bundled font's styles, then invalidate text measurements. */
export async function loadWebFont(font: LabelFont | TextFont): Promise<void> {
  const b = bundled(font);
  if (!b || webLoaded.has(b) || typeof document === 'undefined' || !document.fonts) return;
  const f = FILES[b];
  await Promise.all(
    ['400', '700', 'italic 400', 'italic 700'].map((s) => document.fonts.load(`${s} 20px ${f.css}`)),
  ).catch(() => undefined);
  webLoaded.add(b);
  clearTextMeasureCache();
}

const parsed = new Map<string, OtFont>();

/** Parse the font files needed to outline text in this font for export. */
export async function loadOutlineFont(font: LabelFont | TextFont): Promise<void> {
  const b = bundled(font);
  if (!b) return;
  const { parse } = await import('opentype.js');
  const f = FILES[b];
  for (const url of [f.regular, f.bold, f.italic, f.boldItalic].filter(Boolean) as string[]) {
    if (parsed.has(url)) continue;
    const buf = await (await fetch(url)).arrayBuffer();
    parsed.set(url, parse(buf));
  }
}

export interface Outline {
  font: OtFont;
  /** the family has no bold: thicken with a stroke */
  fakeBold: boolean;
  /** the family has no italic: slant the outline */
  fakeItalic: boolean;
}

/** Outline font for a run of text, or null (write <text>) for a standard font or if not loaded. */
export function outlineFont(font: LabelFont | TextFont, bold: boolean, italic = false): Outline | null {
  const b = bundled(font);
  if (!b) return null;
  const f = FILES[b];
  const exact = bold ? (italic ? f.boldItalic : f.bold) : italic ? f.italic : f.regular;
  // closest style the family has: bold italic → bold (slanted), then italic (thickened), then regular
  const pick = exact ?? (bold ? f.bold : undefined) ?? (italic ? f.italic : undefined) ?? f.regular;
  const ot = parsed.get(pick);
  if (!ot) return null;
  return {
    font: ot,
    fakeBold: bold && pick !== f.bold && pick !== f.boldItalic,
    fakeItalic: italic && pick !== f.italic && pick !== f.boldItalic,
  };
}

/** Slant applied to fake italics (matches the browser's synthetic oblique closely). */
export const FAKE_ITALIC_SKEW = Math.tan((12 * Math.PI) / 180);

/**
 * SVG path data with 2 decimals, written here rather than with opentype.js's toPathData,
 * whose rounding turns tiny fractions (1e-7) into NaN and cuts glyphs short in PDFs.
 */
function pathData(path: import('opentype.js').Path): string {
  const n = (v: number) => String(Math.round(v * 100) / 100);
  return path.commands
    .map((c) => {
      switch (c.type) {
        case 'M':
        case 'L':
          return `${c.type}${n(c.x)} ${n(c.y)}`;
        case 'Q':
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case 'C':
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        default:
          return 'Z';
      }
    })
    .join('');
}

const kernCache = new WeakMap<OtFont, unknown>();

/** Kerning between two glyphs, in font units (0 when the font's tables can't be read). */
function kerning(font: OtFont, a: import('opentype.js').Glyph, b: import('opentype.js').Glyph): number {
  try {
    const pos = (
      font as unknown as {
        position?: {
          getDefaultScriptName(): string;
          getKerningTables(s: string): unknown;
          getKerningValue(t: unknown, a: number, b: number): number;
        };
      }
    ).position;
    if (pos) {
      if (!kernCache.has(font)) kernCache.set(font, pos.getKerningTables(pos.getDefaultScriptName()) ?? null);
      const tables = kernCache.get(font);
      // some fonts' tables give undefined/NaN for pairs they don't cover
      const v = tables ? pos.getKerningValue(tables, a.index, b.index) : font.getKerningValue(a, b);
      return Number.isFinite(v) ? v : 0;
    }
    const v = font.getKerningValue(a, b);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

/**
 * Vector outline of one line of text: SVG path data and its advance width (pt).
 * Glyphs are placed one by one (with kerning) rather than through opentype.js's text
 * shaping, which throws on some fonts' substitution tables.
 */
export function outlineText(font: OtFont, text: string, x: number, baseline: number, sizePt: number) {
  const scale = sizePt / font.unitsPerEm;
  const glyphs = Array.from(text).map((ch) => font.charToGlyph(ch));
  const parts: string[] = [];
  let pen = x;
  glyphs.forEach((g, i) => {
    const d = pathData(g.getPath(pen, baseline, sizePt));
    if (d) parts.push(d);
    const adv = g.advanceWidth;
    pen += (Number.isFinite(adv) ? adv! : 0) * scale;
    if (i < glyphs.length - 1) pen += kerning(font, g, glyphs[i + 1]) * scale;
  });
  return { d: parts.join(''), width: pen - x };
}
