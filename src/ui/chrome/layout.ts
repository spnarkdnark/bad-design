/**
 * Where the app-wide controls sit (the drawing's scale and grid are in the standards wing's
 * Drawing section): per region, groups (separated by thin rules) of controls
 * from `controls.tsx`, in order. Moving a control to another group or region is editing this.
 * (Drawing tools: ui/toolList.ts. Selection properties: ui/selection/.)
 */
import type { AppControlId } from './controls';

export const CONTROL_LAYOUT = {
  /** right end of the tab row */
  tabbar: [['undoRedo'], ['labels', 'example', 'file']],
} satisfies Record<string, AppControlId[][]>;

export type ControlRegion = keyof typeof CONTROL_LAYOUT;
