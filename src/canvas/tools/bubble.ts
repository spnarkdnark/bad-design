/**
 * Bubble tool: the shape to place (uiStore.bubbleKind, at uiStore.placeSize, in uiStore.placeCategory:
 * set in the placement bar, ui/selection/PlacementBar) follows the cursor as a preview in its
 * category's look (OverlayLayer); the wheel resizes it (input/wheel.ts), a click places it.
 * Shift keeps the tool active. Works for any sizable kind, through `newShape`.
 */
import type { BubbleNode, Point } from '../../model/types';
import { useUi } from '../../store/uiStore';
import { getDoc } from '../../store/documentStore';
import * as A from '../../store/actions';
import { newShape } from '../../model/geometry';
import { overlay } from '../overlayStore';
import type { Tool } from './types';

/** The element the bubble tool would place at `at` (not in the document), in the placement bar's category. */
export function placementNode(at: Point): BubbleNode {
  const { bubbleKind, placeSize, placeCategory } = useUi.getState();
  const doc = getDoc();
  return {
    id: 'placing',
    name: '',
    x: at.x,
    y: at.y,
    shape: newShape(bubbleKind, placeSize),
    // a category deleted since it was picked falls back to none
    categoryId: placeCategory && doc.categories[placeCategory] ? placeCategory : null,
    style: {},
  };
}

export const bubbleTool: Tool = {
  down(e) {
    const { shape, categoryId } = placementNode(e.world);
    A.addNode(e.world, { shape, categoryId });
    if (!e.shift) useUi.getState().setTool('select');
    return null;
  },
  hover(e) {
    overlay().set({ pointerWorld: e.world });
  },
  cursor: () => 'crosshair',
};
