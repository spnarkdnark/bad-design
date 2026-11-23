/**
 * The drawing tools as the UI presents them, in order: the tool palette, the keyboard
 * shortcuts and the shortcuts help all read this list (the tools themselves: canvas/tools).
 * Reordering the palette or adding an entry starts here.
 */
import type { SizableKind } from '../model/types';
import { useUi, type ToolId } from '../store/uiStore';
import type { ToolIconId } from './toolIcons';

export interface ToolDef {
  id: ToolId;
  label: string;
  /** the shortcut key (lower case) */
  key: string;
  icon: ToolIconId;
  /** the bubble tool appears once per shape it places */
  kind?: SizableKind;
}

export const TOOL_LIST: ToolDef[] = [
  { id: 'select', label: 'Select', key: 'v', icon: 'select' },
  { id: 'bubble', label: 'Bubble', key: 'b', icon: 'bubble', kind: 'circle' },
  { id: 'bubble', label: 'Square', key: 'q', icon: 'square', kind: 'rect' },
  { id: 'connect', label: 'Connect', key: 'c', icon: 'connect' },
  { id: 'shape', label: 'Shape', key: 's', icon: 'shape' },
  { id: 'pen', label: 'Pen', key: 'p', icon: 'pen' },
  { id: 'text', label: 'Text', key: 't', icon: 'text' },
];

/** The palette entry a key selects, if any. */
export const toolForKey = (key: string) => TOOL_LIST.find((t) => t.key === key);

export function activateTool(t: ToolDef) {
  const ui = useUi.getState();
  if (t.kind) ui.setBubbleKind(t.kind);
  ui.setTool(t.id);
}

/** Whether a palette entry is the current tool. */
export const isActiveTool = (t: ToolDef, tool: ToolId, kind: SizableKind) =>
  tool === t.id && (!t.kind || t.kind === kind);
