/** The drawing surface: Konva stage, grid, the rendered scene, overlays and the in-place label editor. */
import { useEffect, useMemo, useRef } from 'react';
import { Layer, Shape, Stage } from 'react-konva';
import type { Paper } from '../model/types';
import { pxPerFt } from '../model/units';
import { elementsBounds, hasElements } from '../model/elements';
import { boundsCenter } from '../model/geometry';
import { createText } from '../model/factory';
import { getDoc, useDoc } from '../store/documentStore';
import { useUi, type EditingLabel, type TextEdit } from '../store/uiStore';
import * as A from '../store/actions';
import { buildScene, editorLabel, type Scene } from '../render/scene';
import { drawLabels, drawPrims, drawTexts } from '../render/drawCanvas';
import { bundled, fontsIn, loadWebFont, type BundledFont } from '../render/fonts';
import { PAPER_COLORS, paperTileUrl } from '../render/paper';
import { GridLayer } from './layers/GridLayer';
import { LabelEditor } from './LabelEditor';
import { TextEditor } from './TextEditor';
import { OverlayLayer } from './OverlayLayer';
import { useCanvasInput } from './input/useCanvasInput';
import { setLatestScene } from './query';

function paperStyle(paper: Paper): React.CSSProperties {
  const url = paperTileUrl(paper);
  return { backgroundColor: PAPER_COLORS[paper], backgroundImage: url ? `url(${url})` : undefined };
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  k: number,
  editing: EditingLabel | null,
  editingText: TextEdit | null,
) {
  drawPrims(ctx, scene.connections);
  for (const n of scene.nodes) {
    drawPrims(ctx, n.fill);
    drawPrims(ctx, n.outline);
  }
  drawPrims(ctx, scene.overlays);
  for (const l of scene.lines) drawPrims(ctx, l.prims);
  // hide the lines under the in-place editor
  const labels = scene.nodes.flatMap((n) => {
    if (!n.label) return [];
    if (n.id !== editing?.id) return [n.label];
    const lines = n.label.layout.lines.filter((l) => l.part !== editing.part);
    return [{ ...n.label, layout: { ...n.label.layout, lines } }];
  });
  drawLabels(ctx, labels, k, scene.ftPerPt);
  // the block being typed is drawn by its editor instead
  drawTexts(
    ctx,
    scene.texts.filter((t) => t.id !== editingText?.id),
    k,
    scene.ftPerPt,
  );
}

export function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const doc = useDoc();
  const view = useUi((s) => s.view);
  const size = useUi((s) => s.stageSize);
  const tool = useUi((s) => s.tool);
  const shapeDraft = useUi((s) => s.shapeDraft);
  const lineDraft = useUi((s) => s.lineDraft);
  const editingLabel = useUi((s) => s.editingLabel);
  const editingText = useUi((s) => s.editingText);
  const textStyle = useUi((s) => s.textStyle);
  const fontEpoch = useUi((s) => s.fontEpoch);
  const input = useCanvasInput(containerRef);

  const k = pxPerFt(doc.settings.scale, view.zoom);
  // fontEpoch: rebuild once a web font loads so labels are re-measured
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scene = useMemo(() => buildScene(doc), [doc, fontEpoch]);
  setLatestScene(scene);

  // bundled fonts in use (labels, text blocks): re-measure once each has loaded
  // (and the font new text will be typed in)
  const fonts = [...new Set([...fontsIn(doc), bundled(textStyle.font)])].filter(Boolean).join(',');
  useEffect(() => {
    let alive = true;
    for (const f of fonts.split(',').filter(Boolean))
      loadWebFont(f as BundledFont).then(() => alive && useUi.getState().bumpFontEpoch());
    return () => {
      alive = false;
    };
  }, [fonts]);

  // track the container size; on first mount center the drawing at 100%
  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(() => useUi.getState().setStageSize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    const ui = useUi.getState();
    ui.setStageSize(el.clientWidth, el.clientHeight);
    // opening the site: the drawing at 100% (true paper size), centered on its content
    const b = elementsBounds(getDoc());
    A.centerOn(b ? boundsCenter(b) : { x: 0, y: 0 }, 1);
    return () => ro.disconnect();
  }, []);

  const editingNode = editingLabel ? doc.nodes[editingLabel.id] : undefined;
  const editingPrim = editingLabel && editingNode ? editorLabel(editingNode, doc, editingLabel.part) : null;
  const closeEditor = () => useUi.getState().setEditingLabel(null);
  const editingBlock = !editingText
    ? null
    : editingText.id === null
      ? {
          ...createText({ x: editingText.x, y: editingText.y, widthPt: editingText.widthPt, style: textStyle }),
          id: '',
        }
      : (doc.texts[editingText.id] ?? null);

  return (
    <div
      ref={containerRef}
      className="canvas"
      style={paperStyle(doc.settings.graphic.paper)}
      onMouseDown={input.onMouseDown}
      onDoubleClick={input.onDoubleClick}
      onMouseLeave={input.onMouseLeave}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stage
        width={size.width}
        height={size.height}
        x={view.panX}
        y={view.panY}
        scaleX={k}
        scaleY={k}
        listening={false}
      >
        {doc.settings.grid.visible && (
          <GridLayer
            spacingFt={doc.settings.grid.spacingFt}
            k={k}
            panX={view.panX}
            panY={view.panY}
            width={size.width}
            height={size.height}
          />
        )}
        <Layer listening={false}>
          <Shape
            listening={false}
            sceneFunc={(c) => drawScene(c._context as CanvasRenderingContext2D, scene, k, editingLabel, editingText)}
          />
        </Layer>
        <OverlayLayer doc={doc} scene={scene} k={k} />
      </Stage>

      {editingLabel && editingNode && editingPrim && (
        <LabelEditor
          key={`${editingLabel.id}:${editingLabel.part}`}
          value={A.labelEditText(editingNode.id, editingLabel.part)}
          label={editingPrim}
          part={editingLabel.part}
          k={k}
          panX={view.panX}
          panY={view.panY}
          ftPerPt={scene.ftPerPt}
          onCommit={(text) => {
            A.commitLabelEdit(editingNode.id, editingLabel.part, text);
            closeEditor();
          }}
          onCancel={closeEditor}
        />
      )}

      {editingBlock && editingText && (
        <TextEditor
          key={editingText.id ?? 'new'}
          block={editingBlock}
          k={k}
          panX={view.panX}
          panY={view.panY}
          ftPerPt={scene.ftPerPt}
          onCommit={(text) => {
            A.commitTextEdit(editingText, text);
            // a new block: back to selecting, with the block selected (to restyle it)
            if (editingText.id === null) useUi.getState().setTool('select');
          }}
        />
      )}

      {tool === 'text' && !editingText && (
        <div className="canvas-tip">
          Click to place text, or drag to set how wide it wraps. Click a text block to edit it.
        </div>
      )}
      {editingText && <div className="canvas-tip">Enter adds a line · Esc or click away to finish</div>}
      {tool === 'pen' && (
        <div className="canvas-tip">
          {lineDraft?.length
            ? 'Click to add points (Shift: 45°) · click the first point to close · Enter, double-click or Esc finishes · Backspace removes the last point'
            : 'Click to start a line, or drag to draw freehand. Points snap to other lines (Alt: no snapping).'}
        </div>
      )}
      {tool === 'shape' && (
        <div className="canvas-tip">
          {shapeDraft?.length
            ? 'Click to add points · click the first point, double-click or press Enter to close · Backspace removes the last point · Esc cancels'
            : 'Drag to draw a shape freehand, or click to place points. Edges near a bubble snap to it. Double-click in a gap between bubbles to fill it.'}
        </div>
      )}
      {!hasElements(doc) && tool !== 'bubble' && (
        <div className="canvas-hint">
          Press <kbd>B</kbd> and click to place a bubble, or import a CSV.
        </div>
      )}
    </div>
  );
}
