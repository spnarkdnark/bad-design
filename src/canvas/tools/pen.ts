/**
 * Pen tool: click to place points (Shift: 45° steps; points snap to other lines' points),
 * click the first point to close, Enter / double-click / Esc to finish. Dragging from
 * nothing draws freehand. The tool stays active for the next line.
 */
import type { Point } from '../../model/types';
import { simplifyPolyline } from '../../model/polygon';
import { useUi } from '../../store/uiStore';
import * as A from '../../store/actions';
import { overlay } from '../overlayStore';
import { penPoint } from '../query';
import { pxToFt } from '../viewport';
import type { CanvasEvent, Tool } from './types';

/** Strokes shorter than this (screen px) count as clicks. */
const CLICK_PX = 6;

/** Where a click lands given the current draft (its start is a snap target, to close). */
function landing(e: CanvasEvent) {
  const draft = useUi.getState().lineDraft ?? [];
  return penPoint(e, draft[draft.length - 1], draft.length >= 3 ? [draft[0]] : []);
}

export const penTool: Tool = {
  down(start) {
    const ui = useUi.getState();
    const draft = ui.lineDraft ?? [];
    const { p } = landing(start);
    const stroke: Point[] = [start.world];
    let last = start.screen;
    let length = 0;
    return {
      move(e) {
        if (draft.length) return; // freehand only when starting a new line
        const step = Math.hypot(e.screen.x - last.x, e.screen.y - last.y);
        if (step < 2) return;
        length += step;
        last = e.screen;
        stroke.push(e.world);
        overlay().set({ stroke: length > CLICK_PX ? stroke.slice() : null, pointSnap: null });
      },
      up() {
        overlay().set({ stroke: null });
        if (!draft.length && length >= CLICK_PX) {
          A.addLine(simplifyPolyline(stroke, pxToFt(1.5)));
          return;
        }
        const first = draft[0];
        if (first && draft.length >= 3 && p.x === first.x && p.y === first.y) {
          A.finishLineDraft(true);
          overlay().set({ pointSnap: null });
          return;
        }
        ui.setLineDraft([...draft, p]);
      },
    };
  },

  hover(e) {
    const { p, snapped } = landing(e);
    overlay().set({ pointerWorld: p, pointSnap: snapped });
  },

  doubleClick() {
    const ui = useUi.getState();
    const draft = (ui.lineDraft ?? []).slice();
    // both clicks of the double-click placed a point at the same spot: keep one
    const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < pxToFt(4);
    while (draft.length >= 2 && near(draft[draft.length - 1], draft[draft.length - 2])) draft.pop();
    ui.setLineDraft(draft);
    A.finishLineDraft(false);
    overlay().set({ pointSnap: null });
  },

  cursor: () => 'crosshair',
};
