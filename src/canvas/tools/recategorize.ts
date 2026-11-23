/**
 * Right-click on a bubble or shape (every tool but the bubble tool, which uses right-click for
 * the category it places): step it to the next category, Shift to the previous one. Right-click
 * on one of several selected elements steps them all, from the clicked one's category. A tag at
 * the cursor names the new category.
 */
import { getDoc } from '../../store/documentStore';
import { useUi } from '../../store/uiStore';
import * as A from '../../store/actions';
import { topNodeAt } from '../hitTest';
import type { CanvasEvent } from './types';

let readoutTimer = 0;

export function recategorizeAt(e: CanvasEvent) {
  const doc = getDoc();
  const id = topNodeAt(doc, e.world);
  if (!id) return;
  const ui = useUi.getState();
  const ids = ui.selection.nodes.includes(id) ? ui.selection.nodes : [id];
  const next = A.cycleNodeCategory(ids, id, e.shift ? -1 : 1);
  const name = next ? getDoc().categories[next]?.name : 'No category';
  ui.setReadout({ text: name ?? '', at: e.world });
  window.clearTimeout(readoutTimer);
  readoutTimer = window.setTimeout(() => useUi.getState().setReadout(null), 900);
}
