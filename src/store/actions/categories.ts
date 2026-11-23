/** Categories, the uncategorized default style, and resetting the standards. */
import type { Id, StyleKey, StyleProps } from '../../model/types';
import { createCategory, createProject, nextCategoryColor } from '../../model/factory';
import { withFirmDefaults } from '../../model/standards';
import { keepRate } from '../../model/costs';
import { getDoc } from '../documentStore';
import { commit } from './shared';
import { updateNodes } from './nodes';
import { cycleCategory } from '../../model/categories';

export function addCategory(name = 'New category'): Id {
  const c = createCategory(name, nextCategoryColor(getDoc()));
  commit((d) => {
    d.categories[c.id] = c;
    d.categoryOrder.push(c.id);
  });
  return c.id;
}

export function renameCategory(id: Id, name: string) {
  commit(
    (d) => {
      if (d.categories[id]) d.categories[id].name = name;
    },
    { coalesceKey: `cat-name:${id}` },
  );
}

/** Set one style property on a category, or on the uncategorized default when id is null. */
export function setCategoryStyle<K extends StyleKey>(id: Id | null, key: K, value: StyleProps[K]) {
  commit(
    (d) => {
      const target = id ? d.categories[id]?.style : d.settings.defaultStyle;
      if (target) (target as StyleProps)[key] = value;
    },
    { coalesceKey: `cat-style:${id}:${key}` },
  );
}

/** Deleting a category un-assigns its bubbles but keeps their look and rate (baked in as overrides). */
export function deleteCategory(id: Id) {
  const doc = getDoc();
  commit((d) => {
    const cat = d.categories[id];
    if (!cat) return;
    for (const n of Object.values(d.nodes)) {
      if (n.categoryId === id) {
        n.costPerSf = keepRate(doc.nodes[n.id], doc).costPerSf;
        n.categoryId = null;
        n.style = { ...cat.style, ...n.style };
      }
    }
    delete d.costRates.categories[id];
    delete d.categories[id];
    d.categoryOrder = d.categoryOrder.filter((c) => c !== id);
  });
}

/** Restore the firm defaults in this tab; the standards sync applies them to every tab. One undo step. */
export function resetStandards() {
  const next = withFirmDefaults(getDoc(), createProject());
  commit((d) => {
    d.categories = next.categories;
    d.categoryOrder = next.categoryOrder;
    d.settings = next.settings;
  });
}

/**
 * Right-click recategorizing: `ids` all take the category after (dir -1: before) the one `from`
 * has. Quick repeated clicks on the same elements are one undo step.
 */
export function cycleNodeCategory(ids: Id[], from: Id, dir: 1 | -1): Id | null {
  const doc = getDoc();
  const next = cycleCategory(doc.categoryOrder, doc.nodes[from]?.categoryId ?? null, dir);
  updateNodes(ids, (n) => void (n.categoryId = next), `recategorize:${[...ids].sort().join(',')}`);
  return next;
}
