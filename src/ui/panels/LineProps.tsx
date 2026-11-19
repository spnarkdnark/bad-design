/** Sidebar for selected pen lines: color, weight, dashes, arrowheads, closing and fill, hand-drawn. */
import type { LineStyle, PenLine, StrokeStyle } from '../../model/types';
import { useDoc } from '../../store/documentStore';
import * as A from '../../store/actions';
import { formatPt, parsePt } from '../../model/units';
import { Checkbox, ColorField, Field, NumberField, Section, SelectField, Slider } from '../controls/Controls';
import { common } from '../controls/mixed';

const DASHES: { value: StrokeStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

/** `actions`: show the Duplicate/Delete row (off when a section above already has one). */
export function LineProps({ ids, actions = true }: { ids: string[]; actions?: boolean }) {
  const doc = useDoc();
  const lines = ids.map((id) => doc.lines[id]).filter(Boolean) as PenLine[];
  if (lines.length === 0) return null;
  const get = <K extends keyof LineStyle>(k: K) => common(lines, (l) => l.style[k]);
  const set = (patch: Partial<LineStyle>) => A.setLineStyle(ids, patch);
  const closed = common(lines, (l) => l.closed);
  const canClose = lines.every((l) => l.points.length >= 3);
  const fill = get('fill');
  const filled = common(lines, (l) => l.style.fill !== null);

  return (
    <>
      <Section title={lines.length > 1 ? `${lines.length} lines` : 'Line'}>
        <Field label="Color">
          <ColorField value={get('color')} onChange={(color) => set({ color })} />
        </Field>
        <Field label="Weight" hint="On paper, like outlines: stays the same when the scale changes">
          <NumberField
            value={get('weightPt')}
            format={formatPt}
            parse={parsePt}
            step={0.25}
            min={0}
            max={24}
            onCommit={(weightPt) => set({ weightPt })}
          />
        </Field>
        <Field label="Style">
          <SelectField<StrokeStyle> value={get('dash')} options={DASHES} onChange={(dash) => set({ dash })} />
        </Field>
        {closed !== true && (
          <Field label="Arrows">
            <span className="stack">
              <Checkbox label="At start" checked={get('arrowStart')} onChange={(arrowStart) => set({ arrowStart })} />
              <Checkbox label="At end" checked={get('arrowEnd')} onChange={(arrowEnd) => set({ arrowEnd })} />
            </span>
          </Field>
        )}
        {canClose && (
          <Field label="Shape" hint="Join the last point back to the first">
            <Checkbox label="Closed" checked={closed} onChange={(v) => A.setLineClosed(ids, v)} />
          </Field>
        )}
        {closed === true && (
          <Field label="Fill">
            <span className="stack">
              <Checkbox
                label="Filled"
                checked={filled}
                onChange={(v) => set({ fill: v ? (fill ?? get('color') ?? '#cccccc') : null })}
              />
              {filled !== false && <ColorField value={fill} onChange={(c) => set({ fill: c })} />}
            </span>
          </Field>
        )}
        {closed === true && filled !== false && (
          <Field label="Opacity">
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={get('fillOpacity')}
              onChange={(fillOpacity) => set({ fillOpacity })}
            />
          </Field>
        )}
        <Field label="Hand-drawn" hint="Follow the drawing's graphic style; off: always crisp">
          <Checkbox label="Like the drawing" checked={get('sketch')} onChange={(sketch) => set({ sketch })} />
        </Field>
      </Section>
      {actions && (
        <div className="button-row">
          <button className="btn" onClick={A.duplicateSelection}>
            Duplicate
          </button>
          <button className="btn" onClick={() => A.bringToFront({ lines: ids })}>
            To front
          </button>
          <button className="btn danger" onClick={A.deleteSelection}>
            Delete
          </button>
        </div>
      )}
      <p className="tip">
        Drag a point to move it (it snaps to other lines; Shift keeps 45°). Double-click a point to delete it, or an
        edge to add one.
      </p>
    </>
  );
}
