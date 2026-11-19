/**
 * Single source of truth for exports. Builds an SVG directly from the data
 * model at TRUE PAPER SCALE (independent of on-screen zoom). User units are
 * paper points (1/72"), so stroke weights and font sizes map 1:1.
 */
import type { Project } from '../../model/types';
import { elementsBounds, subsetProject, type ElementIds } from '../../model/elements';
import { LABEL_FONT_FAMILY, TEXT_FONTS } from '../../model/defaults';
import { ftToPt, getScale, niceScaleBarFt, PT_PER_IN, scaleBarSegments } from '../../model/units';
import { buildScene, lineBaselinePt, type Prim, type StrokeP, type TextScene } from '../../render/scene';
import { FAKE_ITALIC_SKEW, outlineFont, outlineText } from '../../render/fonts';
import { PAPER_COLORS, paperCanvas } from '../../render/paper';

export interface ExportOptions {
  includeGrid: boolean;
  /** scale bar + project name + scale note under the drawing */
  includeScaleBar: boolean;
  marginIn: number;
  /** only these elements (and the connections between their bubbles); everything when undefined */
  only?: Partial<ElementIds>;
}

const DEFAULT_EXPORT_OPTIONS: ExportOptions = { includeGrid: false, includeScaleBar: true, marginIn: 0.5 };

export interface SvgResult {
  svg: string;
  widthPt: number;
  heightPt: number;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => +v.toFixed(3);
const FOOTER_PT = 40;

function strokeAttrs(s: StrokeP, k: number): string {
  return ` stroke="${s.color}"${s.alpha < 1 ? ` stroke-opacity="${n(s.alpha)}"` : ''} stroke-width="${n(s.width * k)}"${
    s.dash ? ` stroke-dasharray="${n(s.dash[0] * k)} ${n(s.dash[1] * k)}"` : ''
  }${s.cap !== 'butt' ? ` stroke-linecap="${s.cap}"` : ''} stroke-linejoin="round"`;
}

function primSvg(p: Prim, X: (ft: number) => number, Y: (ft: number) => number, k: number): string {
  const fill = (f?: { color: string; alpha: number }) =>
    f ? ` fill="${f.color}"${f.alpha < 1 ? ` fill-opacity="${n(f.alpha)}"` : ''}` : ' fill="none"';
  const stroke = (s?: StrokeP) => (s ? strokeAttrs(s, k) : '');
  switch (p.t) {
    case 'circle':
      return `<circle cx="${n(X(p.cx))}" cy="${n(Y(p.cy))}" r="${n(p.r * k)}"${fill(p.fill)}${stroke(p.stroke)}/>`;
    case 'arc': {
      const span = p.a1 - p.a0;
      if (span >= Math.PI * 2 - 1e-6)
        return `<circle cx="${n(X(p.cx))}" cy="${n(Y(p.cy))}" r="${n(p.r * k)}" fill="none"${stroke(p.stroke)}/>`;
      const x0 = X(p.cx + Math.cos(p.a0) * p.r);
      const y0 = Y(p.cy + Math.sin(p.a0) * p.r);
      const x1 = X(p.cx + Math.cos(p.a1) * p.r);
      const y1 = Y(p.cy + Math.sin(p.a1) * p.r);
      const r = n(p.r * k);
      return `<path d="M${n(x0)} ${n(y0)}A${r} ${r} 0 ${span > Math.PI ? 1 : 0} 1 ${n(x1)} ${n(y1)}" fill="none"${stroke(p.stroke)}/>`;
    }
    case 'path': {
      if (p.pts.length < 2) return '';
      const d = 'M' + p.pts.map((q) => `${n(X(q.x))} ${n(Y(q.y))}`).join('L') + (p.closed ? 'Z' : '');
      return `<path d="${d}"${fill(p.fill)}${stroke(p.stroke)}/>`;
    }
  }
}

export function buildSvg(project: Project, opts: ExportOptions = DEFAULT_EXPORT_OPTIONS): SvgResult | null {
  const bounds = elementsBounds(project, opts.only);
  if (!bounds) return null;
  const scale = project.settings.scale;
  const m = opts.marginIn * PT_PER_IN;
  const toPt = (ft: number) => ftToPt(ft, scale);
  const X = (ft: number) => m + toPt(ft - bounds.minX);
  const Y = (ft: number) => m + toPt(ft - bounds.minY);
  const drawW = toPt(bounds.maxX - bounds.minX);
  const drawH = toPt(bounds.maxY - bounds.minY);
  const footer = opts.includeScaleBar ? FOOTER_PT : 0;
  const W = drawW + m * 2;
  const H = drawH + m * 2 + footer;

  const scene = buildScene(opts.only ? subsetProject(project, opts.only) : project);
  const k = toPt(1); // pt per ft
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${n(W / PT_PER_IN)}in" height="${n(H / PT_PER_IN)}in" viewBox="0 0 ${n(W)} ${n(H)}">`,
    `<rect x="0" y="0" width="${n(W)}" height="${n(H)}" fill="${PAPER_COLORS[project.settings.graphic.paper]}"/>`,
  );
  if (project.settings.graphic.paper !== 'none') {
    // ~110 dpi texture, capped so very large sheets stay a reasonable file size
    const dpi = Math.min(110, 4000 / Math.max(W / PT_PER_IN, H / PT_PER_IN));
    const url = paperCanvas(project.settings.graphic.paper, (W / PT_PER_IN) * dpi, (H / PT_PER_IN) * dpi).toDataURL(
      'image/jpeg',
      0.85,
    );
    out.push(
      `<image x="0" y="0" width="${n(W)}" height="${n(H)}" preserveAspectRatio="none" href="${url}" xlink:href="${url}"/>`,
    );
  }

  if (opts.includeGrid) {
    const s = project.settings.grid.spacingFt;
    const gx0 = Math.floor(bounds.minX / s) * s;
    const gy0 = Math.floor(bounds.minY / s) * s;
    const parts: string[] = [];
    for (let x = gx0; x <= bounds.maxX + 1e-9; x += s)
      if (x >= bounds.minX - 1e-9) parts.push(`M${n(X(x))} ${n(Y(bounds.minY))}V${n(Y(bounds.maxY))}`);
    for (let y = gy0; y <= bounds.maxY + 1e-9; y += s)
      if (y >= bounds.minY - 1e-9) parts.push(`M${n(X(bounds.minX))} ${n(Y(y))}H${n(X(bounds.maxX))}`);
    out.push(`<path d="${parts.join('')}" fill="none" stroke="#e3e5e8" stroke-width="0.25"/>`);
  }

  const prims = (list: Prim[]) => list.map((p) => primSvg(p, X, Y, k)).join('');
  out.push(`<g id="connections">${prims(scene.connections)}</g>`);
  out.push('<g id="bubbles">');
  for (const ns of scene.nodes) out.push(`<g id="bubble-${esc(ns.id)}">${prims(ns.fill)}${prims(ns.outline)}</g>`);
  out.push('</g>');
  out.push(`<g id="overlaps">${prims(scene.overlays)}</g>`);
  out.push(`<g id="lines">${scene.lines.map((l) => `<g id="line-${esc(l.id)}">${prims(l.prims)}</g>`).join('')}</g>`);
  out.push('<g id="labels">');
  for (const ns of scene.nodes) {
    if (!ns.label) continue;
    const cx = X(ns.label.x);
    const cy = Y(ns.label.y);
    for (const l of ns.label.layout.lines) {
      const baseline = cy + l.topPt + l.heightPt / 2 + l.sizePt * 0.35;
      const of = outlineFont(project.settings.graphic.labelFont, l.weight === 600);
      if (of) {
        // hand fonts become vector outlines so PDFs/SVGs need no installed font
        const w = outlineText(of.font, l.text, 0, 0, l.sizePt).width;
        const { d } = outlineText(of.font, l.text, cx - w / 2, baseline, l.sizePt);
        const bold = of.fakeBold
          ? ` stroke="${l.color}" stroke-width="${n(l.sizePt * 0.045)}" stroke-linejoin="round"`
          : '';
        out.push(`<path d="${d}" fill="${l.color}"${bold}/>`);
      } else {
        out.push(
          `<text x="${n(cx)}" y="${n(baseline)}" text-anchor="middle" font-family="${esc(ns.label.fontFamily)}" font-size="${n(l.sizePt)}"${
            l.weight === 600 ? ' font-weight="bold"' : ''
          } fill="${l.color}">${esc(l.text)}</text>`,
        );
      }
    }
  }
  out.push('</g>');
  out.push(`<g id="texts">${scene.texts.map((t) => textSvg(t, X(t.x), Y(t.y))).join('')}</g>`);

  if (opts.includeScaleBar) out.push(scaleBarSvg(project, m, m + drawH + 14));
  out.push('</svg>');
  return { svg: out.join('\n'), widthPt: W, heightPt: H };
}

/** A text block at (x, y) pt: PDF standard fonts as <text>, bundled fonts as outlines. */
function textSvg(t: TextScene, x: number, y: number): string {
  const { style, layout } = t;
  const out: string[] = [];
  const of = outlineFont(style.font, style.bold, style.italic);
  for (const l of layout.lines) {
    if (!l.text) continue;
    const base = y + lineBaselinePt(l.topPt, layout.lineHeightPt, style.sizePt);
    if (of) {
      // align by the outline's own advance so centered/right text stays true in the export
      const w = outlineText(of.font, l.text, 0, 0, style.sizePt).width;
      const lx =
        x + (style.align === 'left' ? 0 : style.align === 'center' ? (layout.widthPt - w) / 2 : layout.widthPt - w);
      const { d } = outlineText(of.font, l.text, lx, base, style.sizePt);
      const bold = of.fakeBold
        ? ` stroke="${style.color}" stroke-width="${n(style.sizePt * 0.045)}" stroke-linejoin="round"`
        : '';
      const slant = of.fakeItalic
        ? ` transform="matrix(1 0 ${n(-FAKE_ITALIC_SKEW)} 1 ${n(FAKE_ITALIC_SKEW * base)} 0)"`
        : '';
      out.push(`<path d="${d}" fill="${style.color}"${bold}${slant}/>`);
    } else {
      out.push(
        `<text x="${n(x + l.xPt)}" y="${n(base)}" xml:space="preserve" font-family="${esc(TEXT_FONTS[style.font].family)}" font-size="${n(style.sizePt)}"${
          style.bold ? ' font-weight="bold"' : ''
        }${style.italic ? ' font-style="italic"' : ''} fill="${style.color}">${esc(l.text)}</text>`,
      );
    }
  }
  return `<g id="text-${esc(t.id)}">${out.join('')}</g>`;
}

function scaleBarSvg(project: Project, x: number, y: number): string {
  const ptPerFt = ftToPt(1, project.settings.scale);
  const len = niceScaleBarFt(ptPerFt, 108);
  const segs = scaleBarSegments(len);
  const w = len * ptPerFt;
  const parts: string[] = ['<g id="scale-bar">'];
  for (let i = 0; i < segs; i++)
    parts.push(
      `<rect x="${n(x + (i * w) / segs)}" y="${n(y)}" width="${n(w / segs)}" height="4" fill="${i % 2 ? '#ffffff' : '#333333'}" stroke="#333333" stroke-width="0.5"/>`,
    );
  const t = (tx: number, label: string) =>
    `<text x="${n(tx)}" y="${n(y + 13)}" text-anchor="middle" font-family="${LABEL_FONT_FAMILY}" font-size="7" fill="#333333">${label}</text>`;
  parts.push(t(x, '0'), t(x + w / 2, `${len / 2}'`), t(x + w, `${len}'`));
  parts.push(
    `<text x="${n(x + w + 16)}" y="${n(y + 4)}" font-family="${LABEL_FONT_FAMILY}" font-size="8" font-weight="bold" fill="#222222">${esc(project.meta.name)}</text>`,
    `<text x="${n(x + w + 16)}" y="${n(y + 14)}" font-family="${LABEL_FONT_FAMILY}" font-size="7" fill="#555555">Scale: ${esc(getScale(project.settings.scale).label)}</text>`,
  );
  parts.push('</g>');
  return parts.join('\n');
}
