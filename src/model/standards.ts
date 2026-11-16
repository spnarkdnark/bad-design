/**
 * Firm standards: the categories (with their default cost per sf), the
 * uncategorized default style and rate, the graphic style (sketch character,
 * paper, lettering) and the default overlap treatment are shared by every open
 * diagram. A drawing's own cost rates (project.costRates) are NOT standards. Each Project still stores a copy so saved files
 * are self-contained; these pure functions keep copies in line with the library.
 */
import type { Category, CostRates, GraphicSettings, Id, OverlapSettings, Project, StyleProps } from './types';
import { createCategory } from './factory';
import { matchCategory } from './categories';
import { drawingRate, firmRate, keepRate } from './costs';

export interface Standards {
  categories: Record<Id, Category>;
  categoryOrder: Id[];
  defaultStyle: StyleProps;
  defaultCostPerSf: number;
  graphic: GraphicSettings;
  overlap: OverlapSettings;
}

export function standardsOf(p: Project): Standards {
  const { defaultStyle, defaultCostPerSf, graphic, overlap } = p.settings;
  return { categories: p.categories, categoryOrder: p.categoryOrder, defaultStyle, defaultCostPerSf, graphic, overlap };
}

/** True when the project's standards-governed parts are exactly these standards. */
export function hasStandards(p: Project, s: Standards): boolean {
  return (
    p.categories === s.categories &&
    p.categoryOrder === s.categoryOrder &&
    p.settings.defaultStyle === s.defaultStyle &&
    p.settings.defaultCostPerSf === s.defaultCostPerSf &&
    p.settings.graphic === s.graphic &&
    p.settings.overlap === s.overlap
  );
}

/**
 * Replace a project's standards-governed parts with the standards. Elements whose
 * category no longer exists lose it but keep their look and rate (baked in), and
 * the drawing's rates for vanished categories are dropped.
 */
export function applyStandards(p: Project, s: Standards): Project {
  if (hasStandards(p, s)) return p;
  let nodes = p.nodes;
  for (const n of Object.values(p.nodes)) {
    if (!n.categoryId || s.categories[n.categoryId]) continue;
    const old = p.categories[n.categoryId];
    if (nodes === p.nodes) nodes = { ...p.nodes };
    nodes[n.id] = { ...keepRate(n, p), categoryId: null, style: { ...(old?.style ?? {}), ...n.style } };
  }
  const rates = Object.entries(p.costRates.categories);
  const kept = rates.filter(([id]) => s.categories[id]);
  const costRates =
    kept.length === rates.length ? p.costRates : { ...p.costRates, categories: Object.fromEntries(kept) };
  const { defaultStyle, defaultCostPerSf, graphic, overlap } = s;
  return {
    ...p,
    nodes,
    costRates,
    categories: s.categories,
    categoryOrder: s.categoryOrder,
    settings: { ...p.settings, defaultStyle, defaultCostPerSf, graphic, overlap },
  };
}

/**
 * Bring an incoming project (opened file, restored tab) under the standards:
 * its categories are matched to the library (model/categories.ts), and the library's
 * styles (and graphic/overlap settings) win. Categories the library lacks are added to it.
 * Costs don't change: rates the file sets (its own, or its category defaults where they
 * differ from the firm's) become this drawing's rates. A blank project follows the firm.
 */
export function adoptProject(p: Project, s: Standards): { project: Project; standards: Standards; restyled: number } {
  const map = new Map<Id, Id>();
  let categories = s.categories;
  let categoryOrder = s.categoryOrder;
  let restyled = 0;
  for (const id of p.categoryOrder) {
    const c = p.categories[id];
    const match = matchCategory(categories, c);
    if (match) {
      map.set(id, match);
      if (JSON.stringify(categories[match].style) !== JSON.stringify(c.style)) restyled++;
    } else {
      const added = s.categories[id] ? { ...createCategory(c.name, c.style), costPerSf: c.costPerSf } : { ...c };
      categories = { ...categories, [added.id]: added };
      categoryOrder = [...categoryOrder, added.id];
      map.set(id, added.id);
    }
  }
  const standards = categories === s.categories ? s : { ...s, categories, categoryOrder };
  const nodes: Project['nodes'] = {};
  for (const n of Object.values(p.nodes))
    nodes[n.id] = n.categoryId && map.has(n.categoryId) ? { ...n, categoryId: map.get(n.categoryId)! } : n;
  const costRates: CostRates = { categories: {} };
  for (const [from, to] of map) {
    const sets = p.costRates.categories[from] !== undefined || p.categories[from].costPerSf;
    const rate = drawingRate(p, from);
    if (sets && (p.costRates.categories[from] !== undefined || rate !== (categories[to].costPerSf ?? 0)))
      costRates.categories[to] = rate;
  }
  const ownU = p.costRates.uncategorized;
  if (ownU !== undefined || (firmRate(p, null) && firmRate(p, null) !== s.defaultCostPerSf))
    costRates.uncategorized = ownU ?? firmRate(p, null);
  return { project: applyStandards({ ...p, nodes, costRates }, standards), standards, restyled };
}

/**
 * The firm defaults (`defaults`: a fresh project) applied to `p`: default categories
 * (matched by name, so elements keep theirs) with their default rates, the default style and rate, graphic and overlap
 * settings. Other categories stay only if `p` uses them.
 */
export function withFirmDefaults(p: Project, defaults: Project): Project {
  const used = new Set(Object.values(p.nodes).map((n) => n.categoryId));
  const categories: Project['categories'] = {};
  const categoryOrder: Id[] = [];
  for (const c of defaults.categoryOrder.map((id) => defaults.categories[id])) {
    const id = matchCategory(p.categories, { name: c.name }) ?? c.id;
    categories[id] = { ...c, id };
    categoryOrder.push(id);
  }
  for (const id of p.categoryOrder)
    if (!categories[id] && used.has(id)) {
      categories[id] = p.categories[id];
      categoryOrder.push(id);
    }
  const { defaultStyle, defaultCostPerSf, graphic, overlap } = defaults.settings;
  return {
    ...p,
    categories,
    categoryOrder,
    settings: { ...p.settings, defaultStyle, defaultCostPerSf, graphic, overlap },
  };
}
