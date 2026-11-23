/**
 * Size of the selected bubbles. `AreaField` sits in the selection bar itself; `SizeFields`
 * (shape, radius/diameter for circles, width/height for rectangles, gap for freeform shapes)
 * fills its Size menu. A new shape kind adds its fields here.
 */
import type { BubbleNode, Id, Project, SizableKind } from '../../model/types';
import * as A from '../../store/actions';
import { totalArea } from '../../model/selectors';
import { isSizable, shapeSize, sizableArea } from '../../model/geometry';
import { MIN_SIZE_FT, SIZABLE_SHAPES } from '../../model/defaults';
import { formatArea, formatFeetInches, parseArea, parseLength } from '../../model/units';
import { Field, NumberField, ReadOnly, SelectField } from '../controls/Controls';
import { common } from '../controls/mixed';

/** A feet-and-inches input (12.5, 12'-6"). */
function LengthField(props: { value: number | null; step: number; min: number; onCommit: (ft: number) => void }) {
  return <NumberField {...props} format={formatFeetInches} parse={(s) => parseLength(s)} width={84} />;
}

/** Area: typed for circles and rectangles (the size follows); a freeform shape's follows its outline. */
export function AreaField({ doc, nodes }: { doc: Project; nodes: BubbleNode[] }) {
  const ids: Id[] = nodes.map((n) => n.id);
  if (!nodes.every((n) => isSizable(n.shape)))
    return (
      <Field label={nodes.length > 1 ? 'Total area' : 'Area'}>
        <ReadOnly value={formatArea(totalArea(doc, ids))} />
      </Field>
    );
  return (
    <Field label="Area" hint="Type the program area (e.g. 1200 or 1,200 sf); the size is calculated from it">
      <NumberField
        value={common(nodes, (n) => (isSizable(n.shape) ? Math.round(sizableArea(n.shape)) : 0))}
        format={formatArea}
        parse={(s) => parseArea(s)}
        step={10}
        min={Math.ceil(Math.PI * MIN_SIZE_FT * MIN_SIZE_FT)}
        width={96}
        onCommit={(v) => A.setArea(ids, v)}
      />
    </Field>
  );
}

export function SizeFields({ doc, nodes }: { doc: Project; nodes: BubbleNode[] }) {
  const ids: Id[] = nodes.map((n) => n.id);
  const sizable = nodes.filter((n) => isSizable(n.shape));
  const sizableIds = sizable.map((n) => n.id);
  const allOf = (kind: SizableKind) => sizable.length > 0 && sizable.every((n) => n.shape.kind === kind);
  const blobs = nodes.filter((n) => n.shape.kind === 'blob');
  const radius = common(sizable, (n) => shapeSize(n.shape));
  const rectDim = (k: 'widthFt' | 'heightFt') => common(sizable, (n) => (n.shape.kind === 'rect' ? n.shape[k] : 0));
  const step = doc.settings.snap.radiusIncrementFt;

  return (
    <>
      {sizable.length > 0 && (
        <Field label="Shape" hint="Changing the shape keeps the area">
          <SelectField<SizableKind>
            value={common(sizable, (n) => n.shape.kind as SizableKind)}
            options={SIZABLE_SHAPES.map((s) => ({ value: s.kind, label: s.label }))}
            onChange={(k) => A.convertShape(sizableIds, k)}
          />
        </Field>
      )}
      {allOf('circle') && (
        <>
          <Field label="Radius" hint={`Type 12.5 or 12'-6"`}>
            <LengthField value={radius} step={step} min={MIN_SIZE_FT} onCommit={(v) => A.setRadius(sizableIds, v)} />
          </Field>
          <Field label="Diameter" hint={`Type 25 or 24'-6"`}>
            <LengthField
              value={radius === null ? null : radius * 2}
              step={step * 2}
              min={MIN_SIZE_FT * 2}
              onCommit={(v) => A.setRadius(sizableIds, v / 2)}
            />
          </Field>
        </>
      )}
      {allOf('rect') && (
        <>
          <Field label="Width" hint={`Type 20 or 20'-6". Width and height can differ (a rectangle).`}>
            <LengthField
              value={rectDim('widthFt')}
              step={step * 2}
              min={MIN_SIZE_FT * 2}
              onCommit={(v) => A.setRectSize(sizableIds, { widthFt: v })}
            />
          </Field>
          <Field label="Height" hint={`Type 20 or 20'-6"`}>
            <LengthField
              value={rectDim('heightFt')}
              step={step * 2}
              min={MIN_SIZE_FT * 2}
              onCommit={(v) => A.setRectSize(sizableIds, { heightFt: v })}
            />
          </Field>
        </>
      )}
      {blobs.length > 0 && (
        <Field label="Gap to bubbles" hint="Distance between attached edges and the bubbles they hug">
          <LengthField
            value={common(blobs, (n) => (n.shape.kind === 'blob' ? n.shape.gapFt : 0))}
            step={0.5}
            min={0}
            onCommit={(v) =>
              A.setBlobGap(
                blobs.map((n) => n.id),
                v,
              )
            }
          />
        </Field>
      )}
      {nodes.length > 1 && (
        <Field label="Total area">
          <ReadOnly value={formatArea(totalArea(doc, ids))} />
        </Field>
      )}
    </>
  );
}
