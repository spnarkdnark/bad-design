/** Zoom and pan (not undoable). */
import type { Point } from '../../model/types';
import { boundsCenter } from '../../model/geometry';
import { elementsBounds } from '../../model/elements';
import { pxPerFt } from '../../model/units';
import { getDoc } from '../documentStore';
import { MAX_ZOOM, MIN_ZOOM } from '../uiStore';
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

/**
 * The part of the canvas not covered by the wings (they float over it), in canvas screen px.
 * "Center" and "fit" mean this area; folding a wing never moves the drawing.
 */
export function visibleArea() {
  const { stageSize, insets } = ui();
  const width = Math.max(1, stageSize.width - insets.left - insets.right);
  return { left: insets.left, width, height: stageSize.height, cx: insets.left + width / 2, cy: stageSize.height / 2 };
}

export function setZoom(zoom: number) {
  const a = visibleArea();
  zoomAt({ x: a.cx, y: a.cy }, zoom / ui().view.zoom);
}

/** Center a world point in the visible part of the canvas. */
export function centerOn(p: Point, zoom = ui().view.zoom) {
  const a = visibleArea();
  const k = pxPerFt(getDoc().settings.scale, zoom);
  ui().setView({ zoom, panX: a.cx - p.x * k, panY: a.cy - p.y * k });
}

export function zoomToFit() {
  const doc = getDoc();
  const b = elementsBounds(doc);
  if (!b) return centerOn({ x: 0, y: 0 }, 1);
  const a = visibleArea();
  const pad = 60;
  const k1 = pxPerFt(doc.settings.scale, 1);
  const zx = (a.width - pad * 2) / ((b.maxX - b.minX) * k1);
  const zy = (a.height - pad * 2) / ((b.maxY - b.minY) * k1);
  centerOn(boundsCenter(b), Math.min(4, Math.max(MIN_ZOOM, Math.min(zx, zy))));
}

export function viewCenterWorld(): Point {
  const { view } = ui();
  const a = visibleArea();
  const k = pxPerFt(getDoc().settings.scale, view.zoom);
  return { x: (a.cx - view.panX) / k, y: (a.cy - view.panY) / k };
}
