import { nanoid } from 'nanoid';
import type {
  BubbleNode,
  Category,
  Connection,
  ConnectionType,
  Id,
  PenLine,
  Point,
  Project,
  StyleProps,
  TextBlock,
} from './types';
import { SCHEMA_VERSION } from './types';
import {
  CATEGORY_PALETTE,
  DEFAULT_CATEGORIES,
  DEFAULT_RADIUS_FT,
  DEFAULT_SETTINGS,
  DEFAULT_LINE_STYLE,
  DEFAULT_TEXT_STYLE,
  styleWithFill,
} from './defaults';

export const newId = (): Id => nanoid(10);

export function createCategory(name: string, styleOrColor: StyleProps | string): Category {
  const style = typeof styleOrColor === 'string' ? styleWithFill(styleOrColor) : { ...styleOrColor };
  return { id: newId(), name, style };
}

export function createProject(name = 'Untitled diagram'): Project {
  const now = new Date().toISOString();
  const cats = DEFAULT_CATEGORIES.map((c) => createCategory(c.name, c.style));
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { name, createdAt: now, modifiedAt: now },
    settings: structuredClone(DEFAULT_SETTINGS),
    categories: Object.fromEntries(cats.map((c) => [c.id, c])),
    categoryOrder: cats.map((c) => c.id),
    nodes: {},
    nodeOrder: [],
    connections: {},
    lines: {},
    lineOrder: [],
    texts: {},
    textOrder: [],
    overlaps: {},
    costRates: { categories: {} },
  };
}

export function createNode(partial: Partial<Omit<BubbleNode, 'id'>> = {}): BubbleNode {
  return {
    id: newId(),
    name: partial.name ?? 'Space',
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    shape: partial.shape ?? { kind: 'circle', radiusFt: DEFAULT_RADIUS_FT },
    categoryId: partial.categoryId ?? null,
    style: { ...partial.style },
    ...(partial.costPerSf !== undefined && { costPerSf: partial.costPerSf }),
  };
}

export function createText(partial: Partial<Omit<TextBlock, 'id'>> = {}): TextBlock {
  return {
    id: newId(),
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    text: partial.text ?? '',
    widthPt: partial.widthPt ?? null,
    style: { ...DEFAULT_TEXT_STYLE, ...partial.style },
  };
}

/** A pen line through world points (its origin is the first point). */
export function createLine(worldPts: Point[], closed = false, style: Partial<PenLine['style']> = {}): PenLine {
  const o = worldPts[0];
  return {
    id: newId(),
    x: o.x,
    y: o.y,
    points: worldPts.map((p) => ({ x: p.x - o.x, y: p.y - o.y })),
    closed,
    style: { ...DEFAULT_LINE_STYLE, ...style },
  };
}

export function createConnection(from: Id, to: Id, type: ConnectionType = 'near'): Connection {
  return { id: newId(), from, to, type };
}

/** Next palette color not already used by a category (cycles if all used). */
export function nextCategoryColor(project: Project): string {
  const used = new Set(Object.values(project.categories).map((c) => c.style.fill.toLowerCase()));
  return (
    CATEGORY_PALETTE.find((c) => !used.has(c.toLowerCase())) ??
    CATEGORY_PALETTE[project.categoryOrder.length % CATEGORY_PALETTE.length]
  );
}
