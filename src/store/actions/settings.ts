/** Drawing-wide settings: scale, grid, snapping, name. */
import type { Project, ScaleId } from '../../model/types';
import { pxPerFt } from '../../model/units';
import { getDoc } from '../documentStore';
import { commit, ui } from './shared';
import { visibleArea } from './view';

/** Change scale while keeping the view center fixed on the same world point. */
export function setScale(scale: ScaleId) {
  const doc = getDoc();
  const { view } = ui();
  const a = visibleArea();
  const kOld = pxPerFt(doc.settings.scale, view.zoom);
  const cx = (a.cx - view.panX) / kOld;
  const cy = (a.cy - view.panY) / kOld;
  commit((d) => {
    d.settings.scale = scale;
  });
  const kNew = pxPerFt(scale, view.zoom);
  ui().setView({ panX: a.cx - cx * kNew, panY: a.cy - cy * kNew });
}

export function setGrid(patch: Partial<Project['settings']['grid']>) {
  commit((d) => {
    Object.assign(d.settings.grid, patch);
  });
}

/** Bubble annotations on or off for the whole drawing (text blocks and lines stay). */
export function setShowLabels(show: boolean) {
  commit((d) => {
    d.settings.showLabels = show;
  });
}

export function renameProject(name: string) {
  commit(
    (d) => {
      d.meta.name = name;
    },
    { coalesceKey: 'project-name' },
  );
}

export function setSnapIncrement(ft: number) {
  commit((d) => {
    d.settings.snap.radiusIncrementFt = ft;
  });
}
