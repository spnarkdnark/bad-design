/**
 * App-wide controls (undo, labels, example, file). Each one is self-contained
 * (reads its own state, calls its own actions) so `layout.ts` can put it in any region and
 * group, in any order.
 */
import type { ComponentType } from 'react';
import { useDoc, useDocument } from '../../store/documentStore';
import * as A from '../../store/actions';
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
  labels: Labels,
  example: Example,
  file: FileMenu,
} satisfies Record<string, ComponentType>;

export type AppControlId = keyof typeof APP_CONTROLS;
