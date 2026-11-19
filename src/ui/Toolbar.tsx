import type { ReactNode } from 'react';
import { useDoc, useDocument } from '../store/documentStore';
import { useUi, type ToolId } from '../store/uiStore';
import * as A from '../store/actions';
import { SCALES } from '../model/units';
import { GRID_SPACINGS_FT, SIZABLE_SHAPES } from '../model/defaults';
import type { ScaleId, SizableKind } from '../model/types';
import { FileMenu } from './FileMenu';
import { Icons } from './icons';
import { PRESET_OPTIONS } from './options';

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

/** Bubble tool icon per shape (TypeScript requires one for every sizable kind). */
const BUBBLE_ICONS: Record<SizableKind, ReactNode> = { circle: Icons.bubble, rect: Icons.square };

export function Toolbar() {
  const doc = useDoc();
  const canUndo = useDocument((s) => s.history.past.length > 0);
  const canRedo = useDocument((s) => s.history.future.length > 0);
  const zoom = useUi((s) => s.view.zoom);
  const bubbleKind = useUi((s) => s.bubbleKind);
  const grid = doc.settings.grid;

  return (
    <header className="toolbar">
      <div className="group">
        <ToolButton tool="select" label="Select" shortcut="V" icon={Icons.select} />
        <ToolButton tool="bubble" label="Bubble" shortcut="B; B again switches shape" icon={BUBBLE_ICONS[bubbleKind]} />
        <select
          className="input narrow"
          value={bubbleKind}
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
        <ToolButton tool="connect" label="Connect" shortcut="C" icon={Icons.connect} />
        <ToolButton tool="shape" label="Shape" shortcut="S" icon={Icons.shape} />
        <ToolButton tool="pen" label="Pen" shortcut="P" icon={Icons.pen} />
        <ToolButton tool="text" label="Text" shortcut="T" icon={Icons.text} />
      </div>
      <div className="group">
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
      </div>
      <div className="group">
        <label className="inline-field" title="Drawing scale">
          <span>Scale</span>
          <select className="input" value={doc.settings.scale} onChange={(e) => A.setScale(e.target.value as ScaleId)}>
            {SCALES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
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
      </div>
      <div className="group">
        <label className="inline-field" title="Graphic style">
          <span>Style</span>
          <select
            className="input"
            value={doc.settings.graphic.preset}
            onChange={(e) => e.target.value !== 'custom' && A.applyPreset(e.target.value)}
          >
            {PRESET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} disabled={o.value === 'custom'}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="group">
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
      </div>
      <div className="spacer" />
      <FileMenu />
    </header>
  );
}
