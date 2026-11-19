/**
 * Elements: the free-standing things on a drawing (bubbles today; text and linework
 * next). Everything that treats elements alike — selection, marquee, moving, nudging,
 * deleting, duplicating, copy/paste, export subsets, zoom to fit — goes through this
 * file, so a new kind is registered here once instead of special-cased in each feature.
 *
 * Rules every kind follows:
 * - Stored as `project[coll]: Record<Id, T>` plus a back-to-front `project[order]: Id[]`.
 * - Its position is `x`/`y` (feet) and all its other geometry is relative to that, so
 *   moving an element only changes `x`/`y`.
 *
 * Adding a kind: extend `ElementOf`, add its row to `KINDS` (in drawing order, back to
 * front), and TypeScript lists what else needs it (selection, clipboard, factory…).
 */
import type { Draft } from 'immer';
import type { Bounds, BubbleNode, Id, Point, Project, TextBlock } from './types';
import { containsPoint, intersectsRect, nodeBounds, unionBounds } from './geometry';
import { textBounds, textContains, textIntersects } from './text';

/** Each element kind and its type, keyed by its collection name in Project. */
export interface ElementOf {
  nodes: BubbleNode;
  texts: TextBlock;
}
export type ElementKind = keyof ElementOf;
/** Ids per kind (a selection, a clipboard set, an export subset…). */
export type ElementIds = Record<ElementKind, Id[]>;

interface KindDef<T> {
  /** key of the id list (back to front) in Project */
  order: 'nodeOrder' | 'textOrder';
  bounds(el: T, project: Project): Bounds;
  contains(el: T, p: Point, project: Project, tolFt: number): boolean;
  intersects(el: T, rect: Bounds, project: Project): boolean;
}

/** Registered kinds, in drawing order (back to front). Hit testing goes front to back. */
const KINDS: { [K in ElementKind]: KindDef<ElementOf[K]> } = {
  nodes: {
    order: 'nodeOrder',
    bounds: nodeBounds,
    contains: (n, p, project) => containsPoint(n, p, project),
    intersects: intersectsRect,
  },
  texts: {
    order: 'textOrder',
    bounds: textBounds,
    contains: textContains,
    intersects: textIntersects,
  },
};

export const ELEMENT_KINDS = Object.keys(KINDS) as ElementKind[];

export const noElements = (): ElementIds => ({ nodes: [], texts: [] });

type AnyProject = Project | Draft<Project>;

/** Ids of one kind, back to front. */
export function orderOf(project: AnyProject, kind: ElementKind): Id[] {
  return project[KINDS[kind].order];
}

export function elementOf<K extends ElementKind>(project: Project, kind: K, id: Id): ElementOf[K] | undefined {
  return (project[kind] as Record<Id, ElementOf[K]>)[id];
}

/** Every element of the drawing. */
export function allElements(project: Project): ElementIds {
  const out = noElements();
  for (const k of ELEMENT_KINDS) out[k] = [...orderOf(project, k)];
  return out;
}

export function countElements(ids: Partial<ElementIds>): number {
  return ELEMENT_KINDS.reduce((a, k) => a + (ids[k]?.length ?? 0), 0);
}

export const hasElements = (project: Project) => countElements(allElements(project)) > 0;

/** "3 elements", "1 element" (for toasts). */
export function describeCount(ids: Partial<ElementIds>): string {
  const n = countElements(ids);
  return `${n} ${n === 1 ? 'element' : 'elements'}`;
}

/** `ids` restricted to elements that exist, in drawing order. */
export function existing(project: Project, ids: Partial<ElementIds>): ElementIds {
  const out = noElements();
  for (const k of ELEMENT_KINDS) {
    const want = new Set(ids[k] ?? []);
    out[k] = orderOf(project, k).filter((id) => want.has(id));
  }
  return out;
}

/** Bounds of the given elements (all of them by default), or null when there are none. */
export function elementsBounds(project: Project, ids: Partial<ElementIds> = allElements(project)): Bounds | null {
  const list: Bounds[] = [];
  for (const k of ELEMENT_KINDS)
    for (const id of ids[k] ?? []) {
      const el = elementOf(project, k, id);
      if (el) list.push((KINDS[k] as KindDef<typeof el>).bounds(el, project));
    }
  return unionBounds(list);
}

/** Elements touching a rectangle (marquee selection). */
export function elementsInRect(project: Project, rect: Bounds): ElementIds {
  const out = noElements();
  for (const k of ELEMENT_KINDS)
    out[k] = orderOf(project, k).filter((id) => {
      const el = elementOf(project, k, id)!;
      return (KINDS[k] as KindDef<typeof el>).intersects(el, rect, project);
    });
  return out;
}

/** Topmost element under `p` (later kinds draw above earlier ones). */
export function elementAt(project: Project, p: Point, tolFt: number): { kind: ElementKind; id: Id } | null {
  for (let ki = ELEMENT_KINDS.length - 1; ki >= 0; ki--) {
    const k = ELEMENT_KINDS[ki];
    const order = orderOf(project, k);
    for (let i = order.length - 1; i >= 0; i--) {
      const el = elementOf(project, k, order[i])!;
      if ((KINDS[k] as KindDef<typeof el>).contains(el, p, project, tolFt)) return { kind: k, id: order[i] };
    }
  }
  return null;
}

/**
 * Move elements by (dx, dy) from where they are in `base` (the document when a drag
 * began), so repeated previews don't accumulate. Pass the draft itself as `base` for a
 * one-off nudge.
 */
export function translateElements(
  d: Draft<Project>,
  base: AnyProject,
  ids: Partial<ElementIds>,
  dx: number,
  dy: number,
) {
  for (const k of ELEMENT_KINDS)
    for (const id of ids[k] ?? []) {
      const el = (d[k] as Record<Id, Point>)[id];
      const from = (base[k] as Record<Id, Point>)[id];
      if (!el || !from) continue;
      el.x = from.x + dx;
      el.y = from.y + dy;
    }
}

/** Remove elements and their ids from the drawing order (dependents: see actions/elements). */
export function removeElements(d: Draft<Project>, ids: Partial<ElementIds>) {
  for (const k of ELEMENT_KINDS) {
    const gone = new Set(ids[k] ?? []);
    if (gone.size === 0) continue;
    for (const id of gone) delete (d[k] as Record<Id, unknown>)[id];
    const key = KINDS[k].order;
    (d[key] as Id[]) = (d[key] as Id[]).filter((id) => !gone.has(id));
  }
}

/** Move elements to the front of their kind's drawing order. */
export function bringElementsToFront(d: Draft<Project>, ids: Partial<ElementIds>) {
  for (const k of ELEMENT_KINDS) {
    const set = new Set(ids[k] ?? []);
    if (set.size === 0) continue;
    const key = KINDS[k].order;
    const order = d[key] as Id[];
    (d[key] as Id[]) = [...order.filter((id) => !set.has(id)), ...order.filter((id) => set.has(id))];
  }
}

/** The drawing restricted to some elements (and the connections/overlaps among its bubbles). */
export function subsetProject(project: Project, ids: Partial<ElementIds>): Project {
  const keep = existing(project, ids);
  if (ELEMENT_KINDS.every((k) => keep[k].length === orderOf(project, k).length)) return project;
  const out: Project = { ...project };
  for (const k of ELEMENT_KINDS) {
    const set = new Set(keep[k]);
    (out[k] as Record<Id, unknown>) = Object.fromEntries(Object.entries(project[k]).filter(([id]) => set.has(id)));
    out[KINDS[k].order] = keep[k];
  }
  const nodes = new Set(keep.nodes);
  out.connections = Object.fromEntries(
    Object.entries(project.connections).filter(([, c]) => nodes.has(c.from) && nodes.has(c.to)),
  );
  out.overlaps = Object.fromEntries(
    Object.entries(project.overlaps).filter(([key]) => key.split('|').every((id) => nodes.has(id))),
  );
  return out;
}
