/**
 * Bubble tool: the shape to place (uiStore.bubbleKind, at uiStore.placeSize) follows the cursor
 * as a preview (OverlayLayer); the wheel resizes it (input/wheel.ts), a click places it.
 * Shift keeps the tool active. Works for any sizable kind, through `newShape`.
 */
import type { BubbleNode, Point } from '../../model/types';
import { useUi } from '../../store/uiStore';
import * as A from '../../store/actions';
import { newShape } from '../../model/geometry';
import { overlay } from '../overlayStore';
import type { Tool } from './types';

/** The element the bubble tool would place at `at` (not in the document). */
export function placementNode(at: Point): BubbleNode {
  const { bubbleKind, placeSize } = useUi.getState();
  return {
    id: 'placing',
    name: '',
    x: at.x,
    y: at.y,
    shape: newShape(bubbleKind, placeSize),
    categoryId: null,
    style: {},
  };
}

export const bubbleTool: Tool = {
  down(e) {
    A.addNode(e.world, { shape: placementNode(e.world).shape });
    if (!e.shift) useUi.getState().setTool('select');
    return null;
  },
  hover(e) {
    overlay().set({ pointerWorld: e.world });
  },
  cursor: () => 'crosshair',
};
