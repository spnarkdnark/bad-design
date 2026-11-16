/** Cost per square foot at each level: firm default, this drawing, one element (see model/costs.ts). */
import type { Id } from '../../model/types';
import { inheritedRate, nodeRate } from '../../model/costs';
import { nodeArea } from '../../model/geometry';
import { resolveStyle } from '../../model/selectors';
import { formatMoney, formatRate, parseMoney } from '../../model/units';
import { getDoc } from '../documentStore';
import { commit } from './shared';
import { updateNodes } from './nodes';

/** The elements' own rate; null returns them to the rate they inherit. */
export function setNodeRate(ids: Id[], rate: number | null) {
  updateNodes(
    ids,
    (n) => {
      if (rate === null) delete n.costPerSf;
      else n.costPerSf = rate;
    },
    'cost',
  );
}

/** This drawing's rate for a category (null = uncategorized); `rate` null returns it to the firm default. */
export function setDrawingRate(categoryId: Id | null, rate: number | null) {
  commit(
    (d) => {
      if (categoryId === null) {
        if (rate === null) delete d.costRates.uncategorized;
        else d.costRates.uncategorized = rate;
      } else if (rate === null) delete d.costRates.categories[categoryId];
      else d.costRates.categories[categoryId] = rate;
    },
    { coalesceKey: `drawing-rate:${categoryId}` },
  );
}

/** The firm default rate for a category (null = uncategorized). A standard: applies to every tab. */
export function setFirmRate(categoryId: Id | null, rate: number) {
  commit(
    (d) => {
      if (categoryId === null) d.settings.defaultCostPerSf = rate;
      else if (d.categories[categoryId]) d.categories[categoryId].costPerSf = rate;
    },
    { coalesceKey: `firm-rate:${categoryId}` },
  );
}

/** Text for the on-canvas cost editor: the rate, or the element's cost when the label shows that. */
export function costEditText(id: Id): string {
  const doc = getDoc();
  const n = doc.nodes[id];
  if (!n) return '';
  const rate = nodeRate(n, doc);
  return resolveStyle(n, doc).labelCost === 'total' ? formatMoney(nodeArea(n, doc) * rate) : formatRate(rate);
}

/** Set an element's rate from the cost editor (a rate, or a total divided by its area). */
export function setCostFromText(id: Id, text: string) {
  const doc = getDoc();
  const n = doc.nodes[id];
  const v = parseMoney(text);
  if (!n || v === null || text.trim() === costEditText(id)) return;
  const area = nodeArea(n, doc);
  const rate = resolveStyle(n, doc).labelCost === 'total' ? (area > 0 ? v / area : 0) : v;
  // typing the inherited rate clears the override rather than freezing it
  setNodeRate([id], rate === inheritedRate(n, doc) ? null : rate);
}
