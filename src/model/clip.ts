/**
 * Copying elements: one path for copy/paste (as JSON text, so it works between tabs
 * and diagrams) and duplicate. `buildClip` takes a self-contained copy, `planPaste`
 * turns it into new elements for a document, `insertPlan` adds them.
 */
import type { Draft } from 'immer';
import type {
  BubbleNode,
  Category,
  Connection,
  Id,
  OverlapMode,
  Point,
  Project,
  StyleOverrides,
  TextBlock,
  LineStyle,
  PenLine,
  TextStyle,
} from './types';
import { boundsCenter } from './geometry';
import { newId } from './factory';
import { categoryResolver } from './categories';
import { overlapKey } from './overlaps';
import { detachAnchors } from './blob';
import { elementsBounds, existing, noElements, type ElementIds } from './elements';

/** Keeps the app's original name so clips copied in older versions still paste. */
export const CLIP_TYPE = 'bubble-diagram/clip';

export interface ClipPayload {
  type: typeof CLIP_TYPE;
  v: 2;
  nodes: BubbleNode[];
  connections: Connection[];
  categories: Category[];
  overlaps: Record<string, { mode: OverlapMode }>;
  /** absent in clips from before text blocks existed */
  texts?: TextBlock[];
  /** absent in clips from before pen lines existed */
  lines?: PenLine[];
  /** center of the copied content, feet */
  center: Point;
}

/** A self-contained copy of some elements (null when none of them exist). */
export function buildClip(project: Project, ids: Partial<ElementIds>): ClipPayload | null {
  const sel = existing(project, ids);
  const bounds = elementsBounds(project, sel);
  if (!bounds) return null;
  const set = new Set(sel.nodes);
  const nodes = sel.nodes.map((id) => {
    const n = structuredClone(project.nodes[id]);
    // shapes copied without the bubbles they hug keep their outline as free points
    if (n.shape.kind === 'blob') n.shape = detachAnchors(project.nodes[id], project, (a) => !set.has(a));
    return n;
  });
  const connections = Object.values(project.connections).filter((c) => set.has(c.from) && set.has(c.to));
  const catIds = new Set(nodes.map((n) => n.categoryId).filter(Boolean) as Id[]);
  const categories = [...catIds].map((id) => project.categories[id]).filter(Boolean);
  const overlaps: ClipPayload['overlaps'] = {};
  for (const [k, v] of Object.entries(project.overlaps)) {
    const [a, b] = k.split('|');
    if (set.has(a) && set.has(b)) overlaps[k] = v;
  }
  const texts = sel.texts.map((id) => structuredClone(project.texts[id]));
  const lines = sel.lines.map((id) => structuredClone(project.lines[id]));
  return {
    type: CLIP_TYPE,
    v: 2,
    nodes,
    connections,
    categories,
    overlaps,
    texts,
    lines,
    center: boundsCenter(bounds),
  };
}

export function parseClip(text: string): ClipPayload | null {
  if (!text || text[0] !== '{') return null;
  try {
    const c = JSON.parse(text);
    if (c?.type !== CLIP_TYPE || !Array.isArray(c.nodes)) return null;
    return c as ClipPayload;
  } catch {
    return null;
  }
}

export interface PastePlan {
  categories: Category[];
  nodes: BubbleNode[];
  connections: Connection[];
  overlaps: Record<string, { mode: OverlapMode }>;
  texts: TextBlock[];
  lines: PenLine[];
}

export const emptyPlan = (): PastePlan => ({
  categories: [],
  nodes: [],
  connections: [],
  overlaps: {},
  texts: [],
  lines: [],
});

/** Map a clip into new elements for `project`, centered on `at`. */
export function planPaste(project: Project, clip: ClipPayload, at: Point): PastePlan {
  const cats = categoryResolver(project);
  const catMap = new Map(clip.categories.map((c) => [c.id, cats.resolve(c)]));
  const idMap = new Map<Id, Id>();
  clip.nodes.forEach((n) => idMap.set(n.id, newId()));
  const dx = at.x - clip.center.x;
  const dy = at.y - clip.center.y;
  const nodes = clip.nodes.map((n) => ({
    ...structuredClone(n),
    id: idMap.get(n.id)!,
    x: n.x + dx,
    y: n.y + dy,
    categoryId: n.categoryId ? (catMap.get(n.categoryId) ?? null) : null,
    shape:
      n.shape.kind === 'blob'
        ? {
            ...n.shape,
            points: n.shape.points.map((pt) =>
              pt.t === 'anchor' ? { ...pt, node: idMap.get(pt.node) ?? pt.node } : pt,
            ),
          }
        : n.shape,
  }));
  const connections = clip.connections
    .filter((c) => idMap.has(c.from) && idMap.has(c.to))
    .map((c) => ({ ...c, id: newId(), from: idMap.get(c.from)!, to: idMap.get(c.to)! }));
  const overlaps: PastePlan['overlaps'] = {};
  for (const [k, v] of Object.entries(clip.overlaps ?? {})) {
    const [a, b] = k.split('|');
    if (idMap.has(a) && idMap.has(b)) overlaps[overlapKey(idMap.get(a)!, idMap.get(b)!)] = v;
  }
  const texts = (clip.texts ?? []).map((t) => ({ ...structuredClone(t), id: newId(), x: t.x + dx, y: t.y + dy }));
  const lines = (clip.lines ?? []).map((l) => ({ ...structuredClone(l), id: newId(), x: l.x + dx, y: l.y + dy }));
  return { categories: cats.added, nodes, connections, overlaps, texts, lines };
}

/** Add a paste plan's elements (on top) and new categories to the document. */
export function insertPlan(d: Draft<Project>, plan: PastePlan) {
  for (const c of plan.categories) {
    d.categories[c.id] = c;
    d.categoryOrder.push(c.id);
  }
  for (const n of plan.nodes) {
    d.nodes[n.id] = n;
    d.nodeOrder.push(n.id);
  }
  for (const c of plan.connections) d.connections[c.id] = c;
  Object.assign(d.overlaps, plan.overlaps);
  for (const l of plan.lines) {
    d.lines[l.id] = l;
    d.lineOrder.push(l.id);
  }
  for (const t of plan.texts) {
    d.texts[t.id] = t;
    d.textOrder.push(t.id);
  }
}

/** The ids a paste plan creates (to select them). */
export function planIds(plan: PastePlan): ElementIds {
  const ids = noElements();
  ids.nodes = plan.nodes.map((n) => n.id);
  ids.texts = plan.texts.map((t) => t.id);
  ids.lines = plan.lines.map((l) => l.id);
  return ids;
}

/** The look of the first copied text block, for pasting onto text blocks. */
export function clipTextStyle(clip: ClipPayload): TextStyle | null {
  const t = clip.texts?.[0];
  return t ? { ...t.style } : null;
}

/** The look of the first copied pen line, for pasting onto lines. */
export function clipLineStyle(clip: ClipPayload): LineStyle | null {
  const l = clip.lines?.[0];
  return l ? { ...l.style } : null;
}

/** The "look" of the first copied bubble: its category (mapped by name) and overrides. */
export function clipStyle(
  project: Project,
  clip: ClipPayload,
): { categoryId: Id | null; style: StyleOverrides; newCategory?: Category } | null {
  const n = clip.nodes[0];
  if (!n) return null;
  if (!n.categoryId) return { categoryId: null, style: { ...n.style } };
  const c = clip.categories.find((x) => x.id === n.categoryId);
  if (!c) return { categoryId: null, style: { ...n.style } };
  const cats = categoryResolver(project);
  const categoryId = cats.resolve(c);
  return { categoryId, style: { ...n.style }, newCategory: cats.added[0] };
}
