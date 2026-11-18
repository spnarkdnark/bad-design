/**
 * Multi-selection: a field shows one value when every selected item shares it,
 * otherwise "mixed" (null), drawn as MIXED.
 */
export const MIXED = '—';

/** The shared value of `fn` across items, or null if mixed/empty. */
export function common<T, V>(items: T[], fn: (t: T) => V): V | null {
  if (items.length === 0) return null;
  const first = fn(items[0]);
  return items.every((i) => fn(i) === first) ? first : null;
}
