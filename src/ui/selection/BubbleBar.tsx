/**
 * Selected bubbles and shapes: the everyday settings inline (name, category, fill, outline,
 * weight, area, cost / sf), the rest in the Size, Label and More menus.
 */
import type { BubbleNode, Id, LabelCost, LabelSecondary, StrokeStyle, StyleKey, StyleProps } from '../../model/types';
import { useDoc } from '../../store/documentStore';
import * as A from '../../store/actions';
import { baseStyle, resolveStyle } from '../../model/selectors';
import { isSizable } from '../../model/geometry';
import { formatPt, parsePt } from '../../model/units';
import {
  Checkbox,
  ColorField,
  Field,
  NumberField,
  SelectField,
  Slider,
  TextField,
  type OverrideMark,
} from '../controls/Controls';
import { common } from '../controls/mixed';
import { AreaField, SizeFields } from './SizeFields';
import { CostReadout, RateField } from './CostFields';
import { NodeOverlaps } from './overlaps';
import { Popover } from './Popover';

function title(nodes: BubbleNode[]) {
  if (nodes.length > 1) return `${nodes.length} elements`;
  const k = nodes[0].shape.kind;
  return k === 'blob' ? 'Shape' : k === 'rect' ? 'Square' : 'Bubble';
}

export function BubbleBar({ ids }: { ids: Id[] }) {
  const doc = useDoc();
  const nodes = ids.map((id) => doc.nodes[id]).filter(Boolean);
  if (nodes.length === 0) return null;
  const single = nodes.length === 1;
  const resolved = nodes.map((n) => resolveStyle(n, doc));
  const anyOverrides = nodes.some((n) => Object.keys(n.style).length > 0);
  const catId = common(nodes, (n) => n.categoryId);

  /** What a field shows: the element's own override, else the inherited category value
   * (for the outline that means `null` = auto, not the resolved color). */
  const shown = <K extends StyleKey>(n: BubbleNode, k: K): StyleProps[K] =>
    n.style[k] !== undefined ? (n.style[k] as StyleProps[K]) : baseStyle(n, doc)[k];
  const get = <K extends StyleKey>(k: K) => common(nodes, (n) => shown(n, k));
  const set = <K extends StyleKey>(k: K, v: StyleProps[K]) => A.setNodeStyle(ids, k, v);
  const o = (k: StyleKey): OverrideMark => {
    const flags = nodes.map((n) => n.style[k] !== undefined);
    return {
      on: flags.every(Boolean) ? true : flags.some(Boolean) ? null : false,
      reset: () => A.resetNodeStyle(ids, [k]),
    };
  };
  const strokeColor = common(resolved, (s) => s.stroke);
  const stroke = get('stroke');
  const auto = stroke === null ? (strokeColor === null ? null : true) : false;

  return (
    <>
      <span className="bar-title">{title(nodes)}</span>
      <Field label="Name">
        <span className="bar-name">
          <TextField
            value={common(nodes, (n) => n.name)}
            onChange={(v) => A.updateNodes(ids, (n) => void (n.name = v), 'name')}
          />
        </span>
      </Field>
      <Field label="Category">
        <SelectField
          value={common(nodes, (n) => n.categoryId ?? '__none')}
          options={[
            { value: '__none', label: 'None' },
            ...doc.categoryOrder.map((id) => ({ value: id, label: doc.categories[id].name })),
          ]}
          onChange={(v) => A.updateNodes(ids, (n) => void (n.categoryId = v === '__none' ? null : v))}
        />
      </Field>
      <span className="bar-sep" />
      <Field label="Fill" override={o('fill')}>
        <ColorField swatchOnly label="Fill color" value={get('fill')} onChange={(c) => set('fill', c)} />
      </Field>
      <Field
        label="Outline"
        hint={auto ? 'Auto: a darker shade of the fill (pick a color to set your own)' : undefined}
        override={o('stroke')}
      >
        <ColorField swatchOnly label="Outline color" value={strokeColor} onChange={(c) => set('stroke', c)} />
      </Field>
      <Field label="Weight" override={o('strokeWeightPt')}>
        <NumberField
          value={get('strokeWeightPt')}
          format={formatPt}
          parse={parsePt}
          step={0.25}
          min={0}
          max={12}
          width={64}
          onCommit={(v) => set('strokeWeightPt', v)}
        />
      </Field>
      <span className="bar-sep" />
      <AreaField doc={doc} nodes={nodes} />
      <RateField doc={doc} nodes={nodes} />
      <span className="bar-sep" />

      {(nodes.some((n) => isSizable(n.shape) || n.shape.kind === 'blob') || !single) && (
        <Popover label="Size" title="Shape, radius, width and height">
          <SizeFields doc={doc} nodes={nodes} />
        </Popover>
      )}
      <Popover label="Label" title="Label size, color and what it shows">
        <Field label="Size" override={o('labelSizePt')}>
          <NumberField
            value={get('labelSizePt')}
            format={formatPt}
            parse={parsePt}
            step={1}
            min={3}
            max={72}
            onCommit={(v) => set('labelSizePt', v)}
          />
        </Field>
        <Field label="Color" override={o('labelColor')}>
          <ColorField value={get('labelColor')} onChange={(c) => set('labelColor', c)} />
        </Field>
        <Field label="Weight" override={o('labelBold')}>
          <SelectField<'bold' | 'regular'>
            value={get('labelBold') === null ? null : get('labelBold') ? 'bold' : 'regular'}
            options={[
              { value: 'bold', label: 'Bold' },
              { value: 'regular', label: 'Regular' },
            ]}
            onChange={(v) => set('labelBold', v === 'bold')}
          />
        </Field>
        <Field label="Show below" override={o('labelSecondary')}>
          <SelectField<LabelSecondary>
            value={get('labelSecondary')}
            options={[
              { value: 'none', label: 'Name only' },
              { value: 'radius', label: 'Radius / sides' },
              { value: 'area', label: 'Area' },
            ]}
            onChange={(v) => set('labelSecondary', v)}
          />
        </Field>
        <Field
          label="Show cost"
          hint="Cost line under the label; hidden while the rate is $0"
          override={o('labelCost')}
        >
          <SelectField<LabelCost>
            value={get('labelCost')}
            options={[
              { value: 'none', label: 'Off' },
              { value: 'rate', label: 'Cost / sf' },
              { value: 'total', label: 'Total cost' },
            ]}
            onChange={(v) => set('labelCost', v)}
          />
        </Field>
      </Popover>
      <Popover label="More" title="Opacity, outline style, sketch amount, cost, category style">
        <Field label="Opacity" override={o('fillOpacity')}>
          <Slider min={0} max={1} step={0.05} value={get('fillOpacity')} onChange={(v) => set('fillOpacity', v)} />
        </Field>
        <Field label="Outline" override={o('stroke')}>
          <Checkbox
            label="Auto (darker fill)"
            checked={auto}
            onChange={(v) => set('stroke', v ? null : (strokeColor ?? '#666666'))}
          />
        </Field>
        <Field label="Line style" override={o('strokeStyle')}>
          <SelectField<StrokeStyle>
            value={get('strokeStyle')}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'dashed', label: 'Dashed' },
              { value: 'dotted', label: 'Dotted' },
            ]}
            onChange={(v) => set('strokeStyle', v)}
          />
        </Field>
        <Field
          label="Sketch"
          hint="Multiplies the drawing's sketch character. 0% draws this cleanly."
          override={o('sketchAmount')}
        >
          <Slider min={0} max={2} step={0.1} value={get('sketchAmount')} onChange={(v) => set('sketchAmount', v)} />
        </Field>
        <CostReadout doc={doc} nodes={nodes} />
        {anyOverrides && (
          <div className="pop-buttons">
            <button
              className="btn small"
              title="Remove this bubble's own style settings"
              onClick={() => A.resetNodeStyle(ids)}
            >
              Reset to category
            </button>
            {single && catId && (
              <button
                className="btn small"
                title="Apply this bubble's look to every bubble in its category"
                onClick={() => A.makeCategoryStyle(ids[0])}
              >
                Make category style
              </button>
            )}
          </div>
        )}
      </Popover>
      <NodeOverlaps ids={ids} />
    </>
  );
}
