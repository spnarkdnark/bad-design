/**
 * The drawing tools as the UI presents them, in order: the toolbar buttons, the keyboard
 * shortcuts and the shortcuts help all read this list (the tools themselves: canvas/tools).
 * Moving the tools to a vertical palette, or adding one, starts here.
 */
import type { ToolId } from '../store/uiStore';
import { Icons } from './icons';

export interface ToolDef {
  id: ToolId;
  label: string;
  /** the shortcut key (lower case) */
  key: string;
  icon: keyof typeof Icons;
  /** extra tooltip text after the shortcut */
  hint?: string;
}

export const TOOL_LIST: ToolDef[] = [
  { id: 'select', label: 'Select', key: 'v', icon: 'select' },
  { id: 'bubble', label: 'Bubble', key: 'b', icon: 'bubble', hint: 'B again switches shape' },
  { id: 'connect', label: 'Connect', key: 'c', icon: 'connect' },
  { id: 'shape', label: 'Shape', key: 's', icon: 'shape' },
  { id: 'pen', label: 'Pen', key: 'p', icon: 'pen' },
  { id: 'text', label: 'Text', key: 't', icon: 'text' },
];

/** The tool a key selects, if any. */
export const toolForKey = (key: string) => TOOL_LIST.find((t) => t.key === key)?.id;
