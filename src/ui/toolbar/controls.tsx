/**
 * Toolbar controls. Each one is self-contained (reads its own state, calls its own
 * actions) so `layout.ts` can put it in any group, in any order.
 */
import { Fragment, type ComponentType, type ReactNode } from 'react';
import { useDoc, useDocument } from '../../store/documentStore';
import { useUi, type ToolId } from '../../store/uiStore';
import * as A from '../../store/actions';
import { SCALES } from '../../model/units';
import { GRID_SPACINGS_FT, SIZABLE_SHAPES } from '../../model/defaults';
import type { ScaleId, SizableKind } from '../../model/types';
import { FileMenu } from '../FileMenu';
import { openExample } from '../../io/fileActions';
import { Icons } from '../icons';
import { PRESET_OPTIONS } from '../options';
import { TOOL_LIST } from '../toolList';

function ToolButton({
  tool,
  label,
  shortcut,
  icon,
}: {
  tool: ToolId;
  label: string;
  shortcut: string;
  icon: ReactNode;
}) {
  const active = useUi((s) => s.tool === tool);
  return (
    <button
      className={`tool ${active ? 'active' : ''}`}
      title={`${label} (${shortcut})`}
      onClick={() => useUi.getState().setTool(tool)}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** What the bubble tool places (circle / square). */
function BubbleKindSelect({ value }: { value: SizableKind }) {
  return (
    <select
      className="input narrow"
      value={value}
      title="Bubble shape"
      aria-label="Bubble shape"
      onChange={(e) => {
        const ui = useUi.getState();
        ui.setBubbleKind(e.target.value as SizableKind);
        ui.setTool('bubble');
      }}
    >
      {SIZABLE_SHAPES.map((s) => (
        <option key={s.kind} value={s.kind}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

/** Bubble tool icon per shape (TypeScript requires one for every sizable kind). */
const BUBBLE_ICONS: Record<SizableKind, ReactNode> = { circle: Icons.bubble, rect: Icons.square };

/** The drawing tools, in `ui/toolList.ts` order. */
function Tools() {
  const bubbleKind = useUi((s) => s.bubbleKind);
  return (
    <>
      {TOOL_LIST.map((t) => (
        <Fragment key={t.id}>
          <ToolButton
            tool={t.id}
            label={t.label}
            shortcut={t.key.toUpperCase() + (t.hint ? `; ${t.hint}` : '')}
            icon={t.id === 'bubble' ? BUBBLE_ICONS[bubbleKind] : Icons[t.icon]}
          />
          {t.id === 'bubble' && <BubbleKindSelect value={bubbleKind} />}
        </Fragment>
      ))}
    </>
  );
}

function UndoRedo() {
  const canUndo = useDocument((s) => s.history.past.length > 0);
  const canRedo = useDocument((s) => s.history.future.length > 0);
  return (
    <>
      <button
        className="btn ghost"
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        onClick={() => useDocument.getState().undo()}
      >
        ↶
      </button>
      <button
        className="btn ghost"
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
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

function Style() {
  const preset = useDoc().settings.graphic.preset;
  return (
    <label className="inline-field" title="Graphic style">
      <span>Style</span>
      <select
        className="input"
        value={preset}
        onChange={(e) => e.target.value !== 'custom' && A.applyPreset(e.target.value)}
      >
        {PRESET_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} disabled={o.value === 'custom'}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Zoom() {
  const zoom = useUi((s) => s.view.zoom);
  return (
    <>
      <button className="btn ghost" title="Zoom out" onClick={() => A.setZoom(zoom / 1.25)}>
        −
      </button>
      <button className="btn ghost zoom-label" title="100% = true paper size (Ctrl+0)" onClick={() => A.setZoom(1)}>
        {Math.round(zoom * 100)}%
      </button>
      <button className="btn ghost" title="Zoom in" onClick={() => A.setZoom(zoom * 1.25)}>
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

/** Every toolbar control by id (the ids `layout.ts` arranges). */
export const TOOLBAR_CONTROLS = {
  tools: Tools,
  undoRedo: UndoRedo,
  scale: Scale,
  grid: Grid,
  style: Style,
  labels: Labels,
  zoom: Zoom,
  example: Example,
  file: FileMenu,
} satisfies Record<string, ComponentType>;

export type ToolbarControlId = keyof typeof TOOLBAR_CONTROLS;
