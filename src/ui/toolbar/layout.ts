/**
 * How the toolbar is arranged: groups (separated by thin rules) of controls from
 * `controls.tsx`, left to right; 'spacer' pushes what follows to the right edge.
 * Rearranging or regrouping the toolbar is editing this list.
 */
import type { ToolbarControlId } from './controls';

export type ToolbarSlot = ToolbarControlId[] | 'spacer';

export const TOOLBAR_LAYOUT: ToolbarSlot[] = [
  ['tools'],
  ['undoRedo'],
  ['scale', 'grid'],
  ['style', 'labels'],
  ['zoom'],
  'spacer',
  ['example', 'file'],
];
