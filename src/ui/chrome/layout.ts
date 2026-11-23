/**
 * Where the app-wide controls sit: per region, groups (separated by thin rules) of controls
 * from `controls.tsx`, in order. Moving a control to another group or region is editing this.
 * (Drawing tools: ui/toolList.ts. Selection properties: ui/selection/.)
 */
import type { AppControlId } from './controls';

export const CONTROL_LAYOUT = {
  /** right end of the tab row */
  tabbar: [['undoRedo'], ['example', 'file']],
  /** floating strip at the bottom left of the drawing, by the scale bar */
  view: [['scale', 'grid', 'labels'], ['zoom']],
} satisfies Record<string, AppControlId[][]>;

export type ControlRegion = keyof typeof CONTROL_LAYOUT;
