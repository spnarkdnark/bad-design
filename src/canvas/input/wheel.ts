/** Wheel: zoom at the cursor, step the size of a selected bubble under it, or (bubble tool) of the shape about to be placed. */
import { getDoc } from '../../store/documentStore';
import { useUi } from '../../store/uiStore';
import * as A from '../../store/actions';
import { topNodeAt } from '../hitTest';
import { sizeReadout } from '../tools/select';
import type { Point } from '../../model/types';
import { isSizable } from '../../model/geometry';
import { stepToIncrement } from '../../model/units';

/** A wheel delta at least this big is one mouse-wheel notch; smaller deltas (trackpads) accumulate. */
const NOTCH = 40;

export function createWheelHandler() {
  let accumulated = 0;
  let readoutTimer = 0;

  return (e: WheelEvent, screen: Point, world: Point) => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
    // Shift+wheel is reported as horizontal scroll in some browsers
    const delta = (e.deltaY || e.deltaX) * unit;
    if (e.ctrlKey || e.metaKey) return A.zoomAt(screen, Math.exp(-delta * 0.01)); // pinch / ctrl+wheel

    const ui = useUi.getState();
    const doc = getDoc();
    const increment = e.shiftKey ? 1 / 12 : doc.settings.snap.radiusIncrementFt;
    /** One step up (1) or down (-1) per wheel notch; trackpad deltas add up to a notch first. */
    const notch = (): 1 | -1 | 0 => {
      if (Math.abs(delta) >= NOTCH) {
        accumulated = 0;
        return delta < 0 ? 1 : -1;
      }
      accumulated += delta;
      if (Math.abs(accumulated) < NOTCH) return 0;
      const d = accumulated < 0 ? 1 : -1;
      accumulated = 0;
      return d;
    };

    // the bubble tool: size the shape before placing it
    if (ui.tool === 'bubble') {
      const dir = notch();
      if (dir) ui.setPlaceSize(stepToIncrement(ui.placeSize, increment, dir));
      return;
    }

    const over = topNodeAt(doc, world);
    const resizing =
      over && ui.tool === 'select' && ui.selection.nodes.includes(over) && isSizable(doc.nodes[over].shape);
    if (!resizing) return A.zoomAt(screen, Math.exp(-delta * 0.0015));

    const dir = notch();
    if (!dir) return;
    const sizable = ui.selection.nodes.filter((id) => doc.nodes[id] && isSizable(doc.nodes[id].shape));
    A.stepSize(sizable, dir, increment);
    ui.setReadout(sizeReadout(over));
    window.clearTimeout(readoutTimer);
    readoutTimer = window.setTimeout(() => useUi.getState().setReadout(null), 900);
  };
}
