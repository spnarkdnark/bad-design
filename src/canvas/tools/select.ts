/**
 * Select tool: click/shift-click/marquee selection, moving, the resize
 * handle, shape point editing, overlap markers and in-place name/area editing.
 */
import type { Id } from '../../model/types';
import { countElements, translateElements, type ElementKind } from '../../model/elements';
import { blobGeometry, movePoint } from '../../model/blob';
import { resizeHandle, sizeAtHandle, withSize } from '../../model/geometry';
import { dimensionText } from '../../model/selectors';
import { MIN_SIZE_FT } from '../../model/defaults';
import { snap } from '../../model/units';
import { getDoc, useDocument } from '../../store/documentStore';
import { useUi } from '../../store/uiStore';
import * as A from '../../store/actions';
import { overlay, rectFrom } from '../overlayStore';
import { hitAt, labelAt, pointEditTarget, shapePointAt, snapAt } from '../query';
import { pxToFt } from '../viewport';
import { DRAG_THRESHOLD_PX, screenDistance, type CanvasEvent, type Gesture, type Tool } from './types';

const gesture = () => useDocument.getState();
/** true when the user pressed Esc mid-drag (the document gesture was cancelled) */
const cancelled = () => !gesture().gestureBase;

/** Drag the selection (any kinds of element); a click without dragging refines the selection. */
function moveGesture(start: CanvasEvent, clicked: { type: ElementKind; id: Id }, wasSelected: boolean): Gesture {
  const ids = A.selectedElements();
  let moved = false;
  let dead = false;
  return {
    move(e) {
      if (dead) return;
      if (!moved) {
        if (screenDistance(e, start) < DRAG_THRESHOLD_PX) return;
        moved = true;
        gesture().beginGesture();
      } else if (cancelled()) {
        dead = true;
        return;
      }
      const base = gesture().gestureBase!;
      gesture().preview((d) => translateElements(d, base, ids, e.world.x - start.world.x, e.world.y - start.world.y));
    },
    up(e) {
      const ui = useUi.getState();
      if (moved) return gesture().endGesture();
      if (!e.shift && countElements(A.selectedElements()) > 1)
        return A.selectElements({ [clicked.type]: [clicked.id] });
      // click on the name or area of the already-selected bubble: edit it in place
      if (wasSelected && clicked.type === 'nodes') {
        const label = labelAt(e.world);
        if (label?.id === clicked.id) ui.setEditingLabel(label);
      }
    },
  };
}

function resizeGesture(id: Id): Gesture {
  gesture().beginGesture();
  const ui = useUi.getState();
  let dead = false;
  return {
    move(e) {
      const n = getDoc().nodes[id];
      if (dead || !n || cancelled()) {
        dead = true;
        ui.setReadout(null);
        return;
      }
      // the half-extent (radius / half-width) snaps, so a square's side moves in 2× steps
      let r = sizeAtHandle(n, e.world);
      if (!e.shift) r = snap(r, getDoc().settings.snap.radiusIncrementFt);
      r = Math.max(MIN_SIZE_FT, r);
      gesture().preview((d) => {
        d.nodes[id].shape = withSize(d.nodes[id].shape, r);
      });
      ui.setReadout(sizeReadout(id));
    },
    up() {
      gesture().endGesture();
      ui.setReadout(null);
    },
  };
}

function marqueeGesture(start: CanvasEvent, additive: boolean): Gesture {
  return {
    move(e) {
      overlay().set({ marquee: rectFrom(start.world, e.world) });
    },
    up(e) {
      overlay().set({ marquee: null });
      if (screenDistance(e, start) < DRAG_THRESHOLD_PX) return;
      A.selectElements(A.elementsInMarquee(rectFrom(start.world, e.world)), additive);
    },
  };
}

function shapePointGesture(id: Id, index: number): Gesture {
  let moved = false;
  let dead = false;
  return {
    move(e) {
      const node = getDoc().nodes[id];
      if (dead || node?.shape.kind !== 'blob') return;
      if (!moved) {
        moved = true;
        gesture().beginGesture();
      } else if (cancelled()) {
        dead = true;
        overlay().set({ snapHint: null });
        return;
      }
      const { snap, hint } = e.alt ? { snap: null, hint: null } : snapAt(e.world, id);
      overlay().set({ snapHint: hint });
      const shape = movePoint(node, index, e.world, snap);
      gesture().preview((d) => {
        d.nodes[id].shape = shape;
      });
    },
    up() {
      if (moved) gesture().endGesture();
      overlay().set({ snapHint: null });
    },
  };
}

export const selectTool: Tool = {
  down(e) {
    const ui = useUi.getState();
    const point = shapePointAt(e.world);
    if (point) return shapePointGesture(point.id, point.index);
    const hit = hitAt(e.world);
    switch (hit.kind) {
      case 'handle':
        return resizeGesture(hit.id);
      case 'element': {
        const isSel = ui.selection[hit.type].includes(hit.id);
        if (e.shift) {
          A.toggleElement(hit.type, hit.id);
          if (isSel) return null; // deselected: no drag
        } else if (!isSel) A.selectElements({ [hit.type]: [hit.id] });
        return moveGesture(e, hit, isSel && !e.shift);
      }
      case 'connection':
        A.selectConnection(hit.id, e.shift);
        return null;
      case 'overlap':
        ui.select({ overlaps: [hit.key] });
        return null;
      case 'empty':
        if (!e.shift) ui.clearSelection();
        return marqueeGesture(e, e.shift);
    }
  },

  doubleClick(e) {
    const ui = useUi.getState();
    const point = shapePointAt(e.world);
    if (point) return A.deleteBlobPoint(point.id, point.index);
    const label = labelAt(e.world);
    if (label) {
      A.selectNodes([label.id]);
      ui.setEditingLabel(label);
      return;
    }
    // a nameless element has no name to click: double-click anywhere on it to name it
    const hit = hitAt(e.world);
    if (hit.kind === 'element' && hit.type === 'nodes' && !getDoc().nodes[hit.id].name.trim()) {
      A.selectNodes([hit.id]);
      ui.setEditingLabel({ id: hit.id, part: 'name' });
      return;
    }
    // on the edge of the selected shape: insert a point
    const target = pointEditTarget();
    if (!target) return;
    const geo = blobGeometry(getDoc().nodes[target], getDoc());
    let best = -1;
    let bestDist = Infinity;
    geo.poly.forEach((q, i) => {
      const d = Math.hypot(q.x - e.world.x, q.y - e.world.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best >= 0 && bestDist < pxToFt(10)) A.insertBlobPoint(target, geo.seg[best], e.world);
  },

  cursor(e) {
    const ui = useUi.getState();
    if (shapePointAt(e.world)) return 'grab';
    if (ui.selection.nodes.length === 1 && labelAt(e.world)?.id === ui.selection.nodes[0]) return 'text';
    const hit = hitAt(e.world);
    if (hit.kind === 'handle') return 'ew-resize';
    if (hit.kind === 'element') return 'move';
    if (hit.kind === 'connection' || hit.kind === 'overlap') return 'pointer';
    return 'default';
  },
};

/** Dimension readout next to the resize handle (used by the wheel resize too). */
export function sizeReadout(id: Id) {
  const n = getDoc().nodes[id];
  return { text: dimensionText(n.shape, true) ?? '', at: resizeHandle(n) ?? { x: n.x, y: n.y } };
}
