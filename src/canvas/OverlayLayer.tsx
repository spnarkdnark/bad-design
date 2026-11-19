/** Selection, handles, markers and tool previews drawn above the drawing (screen-constant sizes). */
import { Circle, Label, Layer, Line, Rect, Tag, Text } from 'react-konva';
import type { BubbleNode, Point, Project } from '../model/types';
import { blobGeometry } from '../model/blob';
import { boundaryPoint, connectionSegment, nodeOutline, resizeHandle, shapeSize } from '../model/geometry';
import { orderedNodes } from '../model/selectors';
import { textBounds, textWidthHandle } from '../model/text';
import type { Scene } from '../render/scene';
import { useUi } from '../store/uiStore';
import { useOverlay } from './overlayStore';
import { draftOutline, textWidthTarget } from './query';
import { canvasTheme } from './theme';

function flat(pts: Point[]): number[] {
  const out: number[] = [];
  for (const p of pts) out.push(p.x, p.y);
  return out;
}

export function OverlayLayer({ doc, scene, k }: { doc: Project; scene: Scene; k: number }) {
  const selection = useUi((s) => s.selection);
  const tool = useUi((s) => s.tool);
  const connectFrom = useUi((s) => s.connectFrom);
  const readout = useUi((s) => s.readout);
  const shapeDraft = useUi((s) => s.shapeDraft);
  const { marquee, pointerWorld, stroke, snapHint } = useOverlay();

  const theme = canvasTheme();
  const selected = new Set(selection.nodes);
  const sole = selection.nodes.length === 1 && tool === 'select' ? doc.nodes[selection.nodes[0]] : undefined;
  const handle = sole ? resizeHandle(sole) : null;
  const editShape = sole?.shape.kind === 'blob' ? sole : undefined;
  const fromNode = connectFrom ? doc.nodes[connectFrom] : undefined;
  const editingText = useUi((s) => s.editingText);
  const selectedTexts = selection.texts.filter((id) => doc.texts[id] && editingText?.id !== id);
  const widthFor = textWidthTarget();
  const widthHandle = widthFor && doc.texts[widthFor] ? textWidthHandle(doc.texts[widthFor], doc) : null;
  const highlighted = orderedNodes(doc).filter((n) => selected.has(n.id) || n.id === connectFrom);
  const ring = (n: BubbleNode) => ({
    stroke: theme.accent,
    strokeWidth: 1.5 / k,
    dash: n.id === connectFrom ? [4 / k, 3 / k] : undefined,
  });

  return (
    <Layer listening={false}>
      {Object.values(doc.connections)
        .filter((c) => selection.connections.includes(c.id) && doc.nodes[c.from] && doc.nodes[c.to])
        .map((c) => {
          const seg = connectionSegment(doc.nodes[c.from], doc.nodes[c.to], doc);
          return seg ? (
            <Line
              key={c.id}
              points={flat(seg)}
              stroke={theme.accent}
              opacity={0.45}
              strokeWidth={6 / k}
              lineCap="round"
            />
          ) : null;
        })}

      {scene.overlaps
        .filter((o) => selection.overlaps.includes(o.key) || selected.has(o.a) || selected.has(o.b))
        .map((o) => (
          <Rect
            key={o.key}
            x={o.marker.x}
            y={o.marker.y}
            offsetX={5 / k}
            offsetY={5 / k}
            width={10 / k}
            height={10 / k}
            rotation={45}
            fill={selection.overlaps.includes(o.key) ? theme.accent : theme.handleFill}
            stroke={theme.accent}
            strokeWidth={1.5 / k}
          />
        ))}

      {highlighted.map((n) => {
        if (n.shape.kind === 'circle')
          return <Circle key={n.id} x={n.x} y={n.y} radius={shapeSize(n.shape) + 3 / k} {...ring(n)} />;
        // every other shape: its outline (works for any future shape kind)
        return <Line key={n.id} points={flat(nodeOutline(n, doc) ?? [])} closed {...ring(n)} />;
      })}

      {selectedTexts.map((id) => {
        const b = textBounds(doc.texts[id], doc);
        const pad = 3 / k;
        return (
          <Rect
            key={id}
            x={b.minX - pad}
            y={b.minY - pad}
            width={b.maxX - b.minX + pad * 2}
            height={b.maxY - b.minY + pad * 2}
            stroke={theme.accent}
            strokeWidth={1.5 / k}
          />
        );
      })}

      {widthHandle && (
        <Rect
          x={widthHandle.x + 3 / k - 2.5 / k}
          y={widthHandle.y - 6 / k}
          width={5 / k}
          height={12 / k}
          cornerRadius={1.5 / k}
          fill={theme.handleFill}
          stroke={theme.accent}
          strokeWidth={1.5 / k}
        />
      )}

      {handle && (
        <Rect
          x={handle.x - 4.5 / k}
          y={handle.y - 4.5 / k}
          width={9 / k}
          height={9 / k}
          fill={theme.handleFill}
          stroke={theme.accent}
          strokeWidth={1.5 / k}
        />
      )}

      {fromNode && pointerWorld && (
        <Line
          points={flat([boundaryPoint(fromNode, pointerWorld, doc), pointerWorld])}
          stroke={theme.accent}
          strokeWidth={1.5 / k}
          dash={[6 / k, 4 / k]}
        />
      )}

      {editShape &&
        editShape.shape.kind === 'blob' &&
        blobGeometry(editShape, doc).ctrl.map((c, i) => (
          <Circle
            key={i}
            x={c.x}
            y={c.y}
            radius={4.5 / k}
            fill={
              editShape.shape.kind === 'blob' && editShape.shape.points[i]?.t === 'anchor'
                ? theme.accent
                : theme.handleFill
            }
            stroke={theme.accent}
            strokeWidth={1.5 / k}
          />
        ))}

      {snapHint && (
        <>
          <Circle
            x={snapHint.x}
            y={snapHint.y}
            radius={snapHint.R}
            stroke={theme.accent}
            strokeWidth={1 / k}
            dash={[5 / k, 4 / k]}
            opacity={0.8}
          />
          <Circle x={snapHint.at.x} y={snapHint.at.y} radius={3.5 / k} fill={theme.accent} />
        </>
      )}

      {stroke && (
        <Line
          points={flat(stroke)}
          stroke={theme.strokePreview}
          strokeWidth={1.4 / k}
          lineCap="round"
          lineJoin="round"
          opacity={0.85}
        />
      )}

      {shapeDraft && shapeDraft.length > 0 && (
        <>
          <Line
            points={flat(draftOutline(shapeDraft, pointerWorld))}
            closed
            stroke={theme.accent}
            strokeWidth={1.5 / k}
            fill="rgba(47,125,225,0.06)"
          />
          {shapeDraft.map((q, i) => (
            <Circle
              key={i}
              x={q.x}
              y={q.y}
              radius={(i === 0 ? 5 : 3.5) / k}
              fill={i === 0 ? theme.handleFill : theme.accent}
              stroke={theme.accent}
              strokeWidth={1.5 / k}
            />
          ))}
        </>
      )}

      {marquee && (
        <Rect
          x={marquee.minX}
          y={marquee.minY}
          width={marquee.maxX - marquee.minX}
          height={marquee.maxY - marquee.minY}
          fill="rgba(47,125,225,0.06)"
          stroke={theme.accent}
          strokeWidth={1 / k}
        />
      )}

      {readout && (
        <Label x={readout.at.x + 10 / k} y={readout.at.y - 10 / k} scaleX={1 / k} scaleY={1 / k}>
          <Tag fill={theme.readoutBg} cornerRadius={3} />
          <Text
            text={readout.text}
            fill={theme.readoutText}
            fontSize={12}
            padding={5}
            fontFamily="system-ui, sans-serif"
          />
        </Label>
      )}
    </Layer>
  );
}
