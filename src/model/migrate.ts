/* Parsing untrusted JSON: values are `any` until validated field by field below. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  BlobPoint,
  LineStyle,
  OverlapMode,
  PenLine,
  Point,
  Project,
  Shape,
  StyleOverrides,
  StyleProps,
  TextBlock,
  TextStyle,
} from './types';
import { SCHEMA_VERSION } from './types';
import {
  DEFAULT_GRAPHIC,
  DEFAULT_OVERLAP,
  DEFAULT_SETTINGS,
  DEFAULT_LINE_STYLE,
  DEFAULT_STYLE,
  DEFAULT_TEXT_STYLE,
  TEXT_FONTS,
} from './defaults';
import { SCALES } from './units';

export class ProjectFormatError extends Error {}

const STYLE_KEYS = Object.keys(DEFAULT_STYLE) as (keyof StyleProps)[];
const OVERLAP_MODES: OverlapMode[] = ['none', 'merge', 'lens', 'lensFill', 'threshold'];

/** A valid cost ($, finite, not negative) or undefined. */
function money(v: any): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/** Keep only known style keys with values of the right type. */
function cleanOverrides(raw: any): StyleOverrides {
  const out: StyleOverrides = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of STYLE_KEYS) {
    const v = raw[k];
    if (v === undefined) continue;
    const def = DEFAULT_STYLE[k];
    if (k === 'stroke' ? v === null || typeof v === 'string' : typeof v === typeof def) (out as any)[k] = v;
  }
  return out;
}

function fullStyle(raw: any, base: StyleProps = DEFAULT_STYLE): StyleProps {
  return { ...base, ...cleanOverrides(raw) };
}

function cleanShape(raw: any): Shape | null {
  if (raw?.kind === 'circle')
    return typeof raw.radiusFt === 'number' && raw.radiusFt > 0 ? { kind: 'circle', radiusFt: raw.radiusFt } : null;
  if (raw?.kind === 'rect') {
    const ok = (v: unknown) => typeof v === 'number' && v > 0;
    return ok(raw.widthFt) && ok(raw.heightFt) ? { kind: 'rect', widthFt: raw.widthFt, heightFt: raw.heightFt } : null;
  }
  if (raw?.kind === 'blob' && Array.isArray(raw.points)) {
    const points: BlobPoint[] = [];
    for (const p of raw.points) {
      if (p?.t === 'free' && typeof p.x === 'number' && typeof p.y === 'number')
        points.push({ t: 'free', x: p.x, y: p.y });
      else if (p?.t === 'anchor' && typeof p.node === 'string' && typeof p.angle === 'number')
        points.push({ t: 'anchor', node: p.node, angle: p.angle, dir: p.dir === -1 ? -1 : 1, arc: !!p.arc });
    }
    return points.length >= 3 ? { kind: 'blob', points, gapFt: typeof raw.gapFt === 'number' ? raw.gapFt : 2 } : null;
  }
  return null;
}

const ALIGNS: TextStyle['align'][] = ['left', 'center', 'right'];
const finite = (v: any): v is number => typeof v === 'number' && Number.isFinite(v);

/** A text block from untrusted JSON (null when unusable); unknown style values fall back to defaults. */
export function cleanText(raw: any, id: string): TextBlock | null {
  if (!raw || !finite(raw.x) || !finite(raw.y) || typeof raw.text !== 'string') return null;
  const st = raw.style ?? {};
  const d = DEFAULT_TEXT_STYLE;
  const style: TextStyle = {
    font: Object.hasOwn(TEXT_FONTS, st.font) ? st.font : d.font,
    sizePt: finite(st.sizePt) && st.sizePt > 0 ? st.sizePt : d.sizePt,
    color: typeof st.color === 'string' ? st.color : d.color,
    bold: typeof st.bold === 'boolean' ? st.bold : d.bold,
    italic: typeof st.italic === 'boolean' ? st.italic : d.italic,
    caps: typeof st.caps === 'boolean' ? st.caps : d.caps,
    align: ALIGNS.includes(st.align) ? st.align : d.align,
  };
  const widthPt = finite(raw.widthPt) && raw.widthPt > 0 ? raw.widthPt : null;
  return { id, x: raw.x, y: raw.y, text: raw.text, widthPt, style };
}

const DASHES: LineStyle['dash'][] = ['solid', 'dashed', 'dotted'];
const bool = (v: any, d: boolean) => (typeof v === 'boolean' ? v : d);

/** A pen line from untrusted JSON (null when unusable); unknown style values fall back to defaults. */
export function cleanLine(raw: any, id: string): PenLine | null {
  if (!raw || !finite(raw.x) || !finite(raw.y) || !Array.isArray(raw.points)) return null;
  const points: Point[] = raw.points
    .filter((p: any) => p && finite(p.x) && finite(p.y))
    .map((p: any) => ({ x: p.x, y: p.y }));
  if (points.length < 2) return null;
  const closed = raw.closed === true && points.length >= 3;
  const st = raw.style ?? {};
  const d = DEFAULT_LINE_STYLE;
  const style: LineStyle = {
    color: typeof st.color === 'string' ? st.color : d.color,
    weightPt: finite(st.weightPt) && st.weightPt >= 0 ? st.weightPt : d.weightPt,
    dash: DASHES.includes(st.dash) ? st.dash : d.dash,
    arrowStart: bool(st.arrowStart, d.arrowStart),
    arrowEnd: bool(st.arrowEnd, d.arrowEnd),
    fill: typeof st.fill === 'string' ? st.fill : null,
    fillOpacity: finite(st.fillOpacity) ? Math.min(1, Math.max(0, st.fillOpacity)) : d.fillOpacity,
    sketch: bool(st.sketch, d.sketch),
  };
  return { id, x: raw.x, y: raw.y, points, closed, style };
}

/** v1 → v2: category.color becomes a full style; node fill/label become sparse overrides. */
function upgradeV1(p: any): any {
  const V1_STYLE = { fillOpacity: 0.85, strokeWeightPt: 0.75, strokeStyle: 'solid' };
  const V1_LABEL = { fontSizePt: 9, secondary: 'area' };
  const categories: any = {};
  for (const [id, c] of Object.entries<any>(p.categories ?? {}))
    categories[id] = { id, name: c?.name, style: { ...DEFAULT_STYLE, fill: String(c?.color ?? '#cccccc') } };
  const nodes: any = {};
  for (const [id, n] of Object.entries<any>(p.nodes ?? {})) {
    const st = n?.style ?? {};
    const lb = n?.label ?? {};
    const o: any = {};
    if (st.fill) o.fill = st.fill;
    if (st.stroke) o.stroke = st.stroke;
    if (st.fillOpacity !== undefined && st.fillOpacity !== V1_STYLE.fillOpacity) o.fillOpacity = st.fillOpacity;
    if (st.strokeWeightPt !== undefined && st.strokeWeightPt !== V1_STYLE.strokeWeightPt)
      o.strokeWeightPt = st.strokeWeightPt;
    if (st.strokeStyle && st.strokeStyle !== V1_STYLE.strokeStyle) o.strokeStyle = st.strokeStyle;
    if (lb.fontSizePt !== undefined && lb.fontSizePt !== V1_LABEL.fontSizePt) o.labelSizePt = lb.fontSizePt;
    if (lb.secondary && lb.secondary !== V1_LABEL.secondary) o.labelSecondary = lb.secondary;
    nodes[id] = { ...n, style: o };
    delete nodes[id].label;
  }
  return { ...p, schemaVersion: 2, categories, nodes };
}

/**
 * Validate an unknown JSON value and upgrade it to the current schema.
 * Add an upgrade step per old schemaVersion when the format changes.
 */
export function migrateProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') throw new ProjectFormatError('Not a project file.');
  let p = raw as any;
  if (typeof p.schemaVersion !== 'number') throw new ProjectFormatError('Missing schemaVersion.');
  if (p.schemaVersion > SCHEMA_VERSION)
    throw new ProjectFormatError('This file was made with a newer version of the app.');
  if (!p.nodes || typeof p.nodes !== 'object') throw new ProjectFormatError('Missing nodes.');
  if (p.schemaVersion === 1) p = upgradeV1(p);

  // v2: normalize missing/partial fields defensively.
  const s = p.settings ?? {};
  const settings = {
    ...DEFAULT_SETTINGS,
    ...s,
    grid: { ...DEFAULT_SETTINGS.grid, ...s.grid },
    snap: { ...DEFAULT_SETTINGS.snap, ...s.snap },
    defaultStyle: fullStyle(s.defaultStyle),
    defaultCostPerSf: money(s.defaultCostPerSf) ?? 0,
    graphic: { ...DEFAULT_GRAPHIC, ...s.graphic },
    overlap: { ...DEFAULT_OVERLAP, ...s.overlap },
  };
  if (!SCALES.some((x) => x.id === settings.scale)) settings.scale = DEFAULT_SETTINGS.scale;

  const nodes: Project['nodes'] = {};
  for (const [id, n] of Object.entries<any>(p.nodes)) {
    if (!n || typeof n.x !== 'number' || typeof n.y !== 'number') continue;
    const shape = cleanShape(n.shape);
    if (!shape) continue;
    nodes[id] = {
      id,
      name: String(n.name ?? ''),
      x: n.x,
      y: n.y,
      shape,
      categoryId: n.categoryId ?? null,
      style: cleanOverrides(n.style),
      ...(money(n.costPerSf) !== undefined && { costPerSf: money(n.costPerSf) }),
    };
  }
  const categories: Project['categories'] = {};
  for (const [id, c] of Object.entries<any>(p.categories ?? {})) {
    categories[id] = { id, name: String(c?.name ?? 'Category'), style: fullStyle(c?.style) };
    if (money(c?.costPerSf) !== undefined) categories[id].costPerSf = money(c.costPerSf);
  }
  for (const n of Object.values(nodes)) if (n.categoryId && !categories[n.categoryId]) n.categoryId = null;
  // blob anchors must point at existing circles
  for (const n of Object.values(nodes)) {
    if (n.shape.kind !== 'blob') continue;
    n.shape.points = n.shape.points.filter((pt) => pt.t === 'free' || nodes[pt.node]?.shape.kind === 'circle');
    if (n.shape.points.length < 3) delete nodes[n.id];
  }

  const connections: Project['connections'] = {};
  for (const [id, c] of Object.entries<any>(p.connections ?? {})) {
    if (!c || !nodes[c.from] || !nodes[c.to] || c.from === c.to) continue;
    const type = ['strong', 'near', 'visual'].includes(c.type) ? c.type : 'near';
    connections[id] = { id, from: c.from, to: c.to, type };
  }

  const overlaps: Project['overlaps'] = {};
  for (const [key, o] of Object.entries<any>(p.overlaps ?? {})) {
    const [a, b] = key.split('|');
    if (nodes[a] && nodes[b] && OVERLAP_MODES.includes(o?.mode)) overlaps[key] = { mode: o.mode };
  }

  const costRates: Project['costRates'] = { categories: {} };
  for (const [id, v] of Object.entries<any>(p.costRates?.categories ?? {}))
    if (categories[id] && money(v) !== undefined) costRates.categories[id] = money(v)!;
  if (money(p.costRates?.uncategorized) !== undefined) costRates.uncategorized = money(p.costRates.uncategorized);

  const lines: Project['lines'] = {};
  for (const [id, l] of Object.entries<any>(p.lines ?? {})) {
    const clean = cleanLine(l, id);
    if (clean) lines[id] = clean;
  }
  const lineOrder: string[] = Array.isArray(p.lineOrder) ? p.lineOrder.filter((id: string) => lines[id]) : [];
  for (const id of Object.keys(lines)) if (!lineOrder.includes(id)) lineOrder.push(id);

  const texts: Project['texts'] = {};
  for (const [id, t] of Object.entries<any>(p.texts ?? {})) {
    const clean = cleanText(t, id);
    if (clean) texts[id] = clean;
  }
  const textOrder: string[] = Array.isArray(p.textOrder) ? p.textOrder.filter((id: string) => texts[id]) : [];
  for (const id of Object.keys(texts)) if (!textOrder.includes(id)) textOrder.push(id);

  const order: string[] = Array.isArray(p.nodeOrder) ? p.nodeOrder.filter((id: string) => nodes[id]) : [];
  for (const id of Object.keys(nodes)) if (!order.includes(id)) order.push(id);
  const catOrder: string[] = Array.isArray(p.categoryOrder)
    ? p.categoryOrder.filter((id: string) => categories[id])
    : [];
  for (const id of Object.keys(categories)) if (!catOrder.includes(id)) catOrder.push(id);

  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      name: String(p.meta?.name ?? 'Untitled diagram'),
      createdAt: p.meta?.createdAt ?? now,
      modifiedAt: p.meta?.modifiedAt ?? now,
    },
    settings,
    categories,
    categoryOrder: catOrder,
    nodes,
    nodeOrder: order,
    connections,
    lines,
    lineOrder,
    texts,
    textOrder,
    overlaps,
    costRates,
  };
}
