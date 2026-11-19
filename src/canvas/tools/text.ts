/** Text tool: click to place a text block, drag to give it a wrapping width, click a block to edit it. */
import { getDoc } from '../../store/documentStore';
import { useUi } from '../../store/uiStore';
import * as A from '../../store/actions';
import { elementAt } from '../../model/elements';
import { ptToFt } from '../../model/units';
import { MIN_TEXT_WIDTH_EM } from '../../model/defaults';
import { overlay, rectFrom } from '../overlayStore';
import { pxToFt } from '../viewport';
import { HIT_TOL_PX } from '../query';
import { DRAG_THRESHOLD_PX, screenDistance, type Tool } from './types';

function textUnder(p: { x: number; y: number }) {
  const hit = elementAt(getDoc(), p, pxToFt(HIT_TOL_PX));
  return hit?.kind === 'texts' ? hit.id : null;
}

export const textTool: Tool = {
  down(start) {
    const ui = useUi.getState();
    // typing somewhere already: this click only ends it (the editor saves on blur)
    if (ui.editingText) return null;
    const existing = textUnder(start.world);
    if (existing) {
      A.editText(existing);
      return null;
    }
    return {
      move(e) {
        if (screenDistance(e, start) >= DRAG_THRESHOLD_PX) overlay().set({ marquee: rectFrom(start.world, e.world) });
      },
      up(e) {
        overlay().set({ marquee: null });
        const dragged = screenDistance(e, start) >= DRAG_THRESHOLD_PX;
        const r = rectFrom(start.world, e.world);
        const ftPerPt = ptToFt(1, getDoc().settings.scale);
        const minPt = ui.textStyle.sizePt * MIN_TEXT_WIDTH_EM;
        A.selectElements({});
        ui.setEditingText(
          dragged
            ? { id: null, x: r.minX, y: r.minY, widthPt: Math.max(minPt, (r.maxX - r.minX) / ftPerPt) }
            : { id: null, x: start.world.x, y: start.world.y, widthPt: null },
        );
      },
    };
  },
  cursor: (e) => (textUnder(e.world) ? 'text' : 'crosshair'),
};
