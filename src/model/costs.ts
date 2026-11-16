/**
 * Cost per square foot. Three levels, each falling back to the one above:
 *   firm default (Category.costPerSf / settings.defaultCostPerSf, shared standards)
 *   -> this drawing's rate (project.costRates)
 *   -> the element's own rate (node.costPerSf).
 * Cost = area x rate; overlapping elements each count their full area.
 */
import type { BubbleNode, Id, LabelCost, Project } from './types';
import { nodeArea } from './geometry';
import { formatMoney, formatRate } from './units';

/** The firm default rate for a category (null = uncategorized). */
export function firmRate(project: Project, categoryId: Id | null): number {
  if (!categoryId) return project.settings.defaultCostPerSf;
  return project.categories[categoryId]?.costPerSf ?? 0;
}

/** The drawing's own rate for a category, if it sets one. */
export function ownDrawingRate(project: Project, categoryId: Id | null): number | undefined {
  return categoryId ? project.costRates.categories[categoryId] : project.costRates.uncategorized;
}

/** The rate a category's elements use in this drawing. */
export function drawingRate(project: Project, categoryId: Id | null): number {
  return ownDrawingRate(project, categoryId) ?? firmRate(project, categoryId);
}

/** The rate an element inherits (what it uses without its own override). */
export function inheritedRate(node: Pick<BubbleNode, 'categoryId'>, project: Project): number {
  const cat = node.categoryId && project.categories[node.categoryId] ? node.categoryId : null;
  return drawingRate(project, cat);
}

export function nodeRate(node: BubbleNode, project: Project): number {
  return node.costPerSf ?? inheritedRate(node, project);
}

export function nodeCost(node: BubbleNode, project: Project): number {
  return nodeArea(node, project) * nodeRate(node, project);
}

export function totalCost(project: Project, ids?: Id[]): number {
  const list = ids ? ids.map((id) => project.nodes[id]).filter(Boolean) : Object.values(project.nodes);
  return list.reduce((sum, n) => sum + nodeCost(n, project), 0);
}

export interface CostRow {
  categoryId: Id | null;
  name: string;
  /** the drawing's rate for this category */
  rate: number;
  /** true when the drawing sets its own rate (vs. the firm default) */
  ownRate: boolean;
  count: number;
  area: number;
  /** from each element's own rate, so element overrides are included */
  cost: number;
}

/** Area and cost per category, in category order, then uncategorized. */
export function costBreakdown(project: Project): CostRow[] {
  const ids: (Id | null)[] = [...project.categoryOrder, null];
  return ids.map((categoryId) => {
    const nodes = Object.values(project.nodes).filter((n) => (n.categoryId ?? null) === categoryId);
    return {
      categoryId,
      name: categoryId ? project.categories[categoryId].name : 'No category',
      rate: drawingRate(project, categoryId),
      ownRate: ownDrawingRate(project, categoryId) !== undefined,
      count: nodes.length,
      area: nodes.reduce((s, n) => s + nodeArea(n, project), 0),
      cost: nodes.reduce((s, n) => s + nodeCost(n, project), 0),
    };
  });
}

/** The cost line under an element's label, or null (hidden, or the rate is $0). */
export function costLabel(node: BubbleNode, project: Project, mode: LabelCost): string | null {
  const rate = nodeRate(node, project);
  if (mode === 'none' || rate <= 0) return null;
  return mode === 'rate' ? formatRate(rate) : formatMoney(nodeArea(node, project) * rate);
}

/**
 * An element about to lose its category keeps the rate it was using, the way it
 * keeps its look: that rate becomes its own (unless it already has one).
 */
export function keepRate<N extends BubbleNode>(node: N, project: Project): N {
  if (node.costPerSf !== undefined) return node;
  const rate = inheritedRate(node, project);
  return rate > 0 ? { ...node, costPerSf: rate } : node;
}
