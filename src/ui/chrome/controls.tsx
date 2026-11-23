/**
 * App-wide controls (file, undo, scale, grid, labels, zoom). Each one is self-contained
 * (reads its own state, calls its own actions) so `layout.ts` can put it in any region and
 * group, in any order.
 */
import type { ComponentType } from 'react';
import { useDoc, useDocument } from '../../store/documentStore';
import { useUi } from '../../store/uiStore';
import * as A from '../../store/actions';
import { SCALES } from '../../model/units';
import { GRID_SPACINGS_FT } from '../../model/defaults';
import type { ScaleId } from '../../model/types';
import { FileMenu } from '../FileMenu';
import { openExample } from '../../io/fileActions';

function UndoRedo() {
  const canUndo = useDocument((s) => s.history.past.length > 0);
  const canRedo = useDocument((s) => s.history.future.length > 0);
  return (
    <>
      <button
        className="btn ghost"
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        onClick={() => useDocument.getState().undo()}
      >
        ↶
      </button>
      <button
        className="btn ghost"
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
        onClick={() => useDocument.getState().redo()}
      >
        ↷
      </button>
    </>
  );
}

function Scale() {
  const scale = useDoc().settings.scale;
  return (
    <label className="inline-field" title="Drawing scale">
      <span>Scale</span>
      <select className="input" value={scale} onChange={(e) => A.setScale(e.target.value as ScaleId)}>
        {SCALES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Grid() {
  const grid = useDoc().settings.grid;
  return (
    <>
      <label className="inline-field checkbox">
        <input type="checkbox" checked={grid.visible} onChange={(e) => A.setGrid({ visible: e.target.checked })} />
        <span>Grid</span>
      </label>
      <select
        className="input narrow"
        value={grid.spacingFt}
        disabled={!grid.visible}
        title="Grid spacing"
        aria-label="Grid spacing"
        onChange={(e) => A.setGrid({ spacingFt: parseFloat(e.target.value) })}
      >
        {GRID_SPACINGS_FT.map((g) => (
          <option key={g} value={g}>
            {g}'
          </option>
        ))}
      </select>
    </>
  );
}

/** Bubble annotations (names, sizes, costs) on or off for this drawing. */
function Labels() {
  const show = useDoc().settings.showLabels;
  return (
    <label className="inline-field checkbox" title="Show bubble names, sizes and costs (text and lines stay)">
      <input type="checkbox" checked={show} onChange={(e) => A.setShowLabels(e.target.checked)} />
      <span>Labels</span>
    </label>
  );
}

function Zoom() {
  const zoom = useUi((s) => s.view.zoom);
  return (
    <>
      <button className="btn ghost" title="Zoom out" aria-label="Zoom out" onClick={() => A.setZoom(zoom / 1.25)}>
        −
      </button>
      <button className="btn ghost zoom-label" title="100% = true paper size (Ctrl+0)" onClick={() => A.setZoom(1)}>
        {Math.round(zoom * 100)}%
      </button>
      <button className="btn ghost" title="Zoom in" aria-label="Zoom in" onClick={() => A.setZoom(zoom * 1.25)}>
        +
      </button>
      <button className="btn ghost" title="Zoom to fit (F)" onClick={A.zoomToFit}>
        Fit
      </button>
    </>
  );
}

function Example() {
  return (
    <button className="btn ghost" title="Open an example drawing that shows what B.A.D. can do" onClick={openExample}>
      B.A.D. Example
    </button>
  );
}

/** Every app-wide control by id (the ids `layout.ts` arranges). */
export const APP_CONTROLS = {
  undoRedo: UndoRedo,
  scale: Scale,
  grid: Grid,
  labels: Labels,
  zoom: Zoom,
  example: Example,
  file: FileMenu,
} satisfies Record<string, ComponentType>;

export type AppControlId = keyof typeof APP_CONTROLS;
