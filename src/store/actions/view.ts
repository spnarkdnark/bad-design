/** Zoom and pan (not undoable). */
import type { Point } from '../../model/types';
import { boundsCenter } from '../../model/geometry';
import { elementsBounds } from '../../model/elements';
import { pxPerFt } from '../../model/units';
import { getDoc } from '../documentStore';
import { MAX_ZOOM, MIN_ZOOM, type View } from '../uiStore';
import { ui } from './shared';

export function zoomAt(screen: Point, factor: number) {
  const { view } = ui();
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
  const ratio = zoom / view.zoom;
  ui().setView({
    zoom,
    panX: screen.x - (screen.x - view.panX) * ratio,
    panY: screen.y - (screen.y - view.panY) * ratio,
  });
}

export function setZoom(zoom: number) {
  const { stageSize } = ui();
  zoomAt({ x: stageSize.width / 2, y: stageSize.height / 2 }, zoom / ui().view.zoom);
}

/** Center a world point in the viewport. */
export function centerOn(p: Point, zoom = ui().view.zoom) {
  const { stageSize } = ui();
  const k = pxPerFt(getDoc().settings.scale, zoom);
  ui().setView({ zoom, panX: stageSize.width / 2 - p.x * k, panY: stageSize.height / 2 - p.y * k });
}

/** The view that frames the whole drawing with `pad` px around it (null when empty). */
function fitView(pad: number): View | null {
  const doc = getDoc();
  const b = elementsBounds(doc);
  if (!b) return null;
  const { stageSize } = ui();
  const k1 = pxPerFt(doc.settings.scale, 1);
  const zx = (stageSize.width - pad * 2) / ((b.maxX - b.minX) * k1);
  const zy = (stageSize.height - pad * 2) / ((b.maxY - b.minY) * k1);
  const zoom = Math.min(4, Math.max(MIN_ZOOM, Math.min(zx, zy)));
  const c = boundsCenter(b);
  const k = k1 * zoom;
  return { zoom, panX: stageSize.width / 2 - c.x * k, panY: stageSize.height / 2 - c.y * k };
}

export function zoomToFit() {
  const v = fitView(60);
  if (v) ui().setView(v);
  else centerOn({ x: 0, y: 0 }, 1);
}

/**
 * Smoothly zoom and pan to frame the whole drawing (used after the splash opens the
 * tutorial). Stops if the user zooms or pans meanwhile.
 */
export function glideToFit(pad = 24, ms = 700) {
  const to = fitView(pad);
  if (!to) return;
  const from = ui().view;
  const { stageSize } = ui();
  const k1 = pxPerFt(getDoc().settings.scale, 1);
  // interpolate the world point at the middle of the screen, and zoom geometrically
  const mid = (v: View) => ({
    x: (stageSize.width / 2 - v.panX) / (k1 * v.zoom),
    y: (stageSize.height / 2 - v.panY) / (k1 * v.zoom),
  });
  const a = mid(from);
  const b = mid(to);
  const t0 = performance.now();
  let last: View = from;
  const step = (now: number) => {
    if (ui().view !== last) return; // the user took over
    const t = Math.min(1, (now - t0) / ms);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // ease in-out
    const zoom = from.zoom * (to.zoom / from.zoom) ** e;
    const k = k1 * zoom;
    const cx = a.x + (b.x - a.x) * e;
    const cy = a.y + (b.y - a.y) * e;
    ui().setView({ zoom, panX: stageSize.width / 2 - cx * k, panY: stageSize.height / 2 - cy * k });
    last = ui().view;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function viewCenterWorld(): Point {
  const { view, stageSize } = ui();
  const k = pxPerFt(getDoc().settings.scale, view.zoom);
  return { x: (stageSize.width / 2 - view.panX) / k, y: (stageSize.height / 2 - view.panY) / k };
}
