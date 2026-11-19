import type { ToolId } from '../../store/uiStore';
import { bubbleTool } from './bubble';
import { connectTool } from './connect';
import { selectTool } from './select';
import { shapeTool } from './shape';
import { textTool } from './text';
import type { Tool } from './types';

export const TOOLS: Record<ToolId, Tool> = {
  select: selectTool,
  bubble: bubbleTool,
  connect: connectTool,
  shape: shapeTool,
  text: textTool,
};
