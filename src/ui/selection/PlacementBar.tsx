/**
 * The selection bar while the bubble tool is active: what the next click places. Its shape
 * (any sizable kind), size (typed as an area, or the wheel over the drawing) and category (new
 * bubbles take that category's look). Keyboard flow: B, Tab (focuses Area), type, Tab (to
 * Category: arrows / letters pick one), click to place. Session settings in uiStore.
 */
import type { SizableKind } from '../../model/types';
import { useDoc } from '../../store/documentStore';
import { useUi } from '../../store/uiStore';
import { MIN_SIZE_FT, SIZABLE_SHAPES } from '../../model/defaults';
import { newShape, shapeSize, sizableArea, withArea } from '../../model/geometry';
import { dimensionText } from '../../model/selectors';
import { formatArea, parseArea } from '../../model/units';
import { Field, NumberField, ReadOnly, SelectField } from '../controls/Controls';

const clearAreaFocus = () => useUi.getState().setAreaFocus(false);

export function PlacementBar() {
  const doc = useDoc();
  const kind = useUi((s) => s.bubbleKind);
  const size = useUi((s) => s.placeSize);
  const picked = useUi((s) => s.placeCategory);
  const areaFocus = useUi((s) => s.areaFocus);
  const ui = useUi.getState();
  const category = picked && doc.categories[picked] ? doc.categories[picked] : null;
  const shape = newShape(kind, size);
  const fill = category ? category.style.fill : doc.settings.defaultStyle.fill;

  return (
    <>
      <span className="bar-title">New {SIZABLE_SHAPES.find((s) => s.kind === kind)?.label.toLowerCase()}</span>
      <span className="segmented-inline" role="group" aria-label="Shape to place">
        {SIZABLE_SHAPES.map((s) => (
          <button
            key={s.kind}
            className={`seg ${s.kind === kind ? 'active' : ''}`}
            aria-pressed={s.kind === kind}
            onClick={() => ui.setBubbleKind(s.kind as SizableKind)}
          >
            {s.label}
          </button>
        ))}
      </span>
      <Field label="Area" hint="Type the area to place (e.g. 1200 or 1,200 sf), or scroll over the drawing">
        <NumberField
          value={Math.round(sizableArea(shape))}
          format={formatArea}
          parse={(s) => parseArea(s)}
          step={10}
          min={Math.ceil(Math.PI * MIN_SIZE_FT * MIN_SIZE_FT)}
          width={96}
          label="Area"
          focusNow={areaFocus}
          onFocused={clearAreaFocus}
          onCommit={(a) => ui.setPlaceSize(shapeSize(withArea(shape, a)))}
        />
      </Field>
      <Field label="Category" hint="New bubbles get this category and its look">
        <span className="bar-category">
          <span className="cost-swatch" style={{ background: fill }} aria-hidden />
          <SelectField
            value={category?.id ?? '__none'}
            options={[
              { value: '__none', label: 'None' },
              ...doc.categoryOrder.map((id) => ({ value: id, label: doc.categories[id].name })),
            ]}
            onChange={(v) => ui.setPlaceCategory(v === '__none' ? null : v)}
          />
        </span>
      </Field>
      <ReadOnly value={dimensionText(shape, true) ?? ''} />
      <span className="bar-note">
        Tab: type the area · Tab again: category · click to place · scroll to resize · Shift+click keeps placing
      </span>
    </>
  );
}
